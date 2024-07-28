import type {Accessor} from 'solid-js';
import {For, createMemo, createSignal, onCleanup, onMount, createEffect} from 'solid-js';
import type {DivLayer, useCanvasLayers} from '../services/useCanvasLayers';
import type {LeftZoneControls} from '../services/leftZoneControls';
import type {DraggableBox} from '../services/useDraggableBox';
import Icon from '../../icon';
import ripple from '../../ripple';
import {i18n} from '../../../lib/langPack';
import CropCommand from '../services/commands/CropCommand';
import RotateCanvasCommand from '../services/commands/RotateCanvasCommand';

interface CropProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
  leftZoneControls: LeftZoneControls;
  resizeCanvasWrapper: (newWidth: number, newHeight: number, topOffset?: number) => void;
  resizeCanvasWrapperToParent: (minMargin: number, isAnimated: boolean) => void;
  animateResizeCanvasWrapper: (
    newWidth: number,
    newHeight: number,
    topOffset?: number,
    bezierSize?: number[],
    bezierOffset?: number[],
    initialWidth?: number,
    initialHeight?: number,
    initialTop?: number,
    duration?: number,
    animateOpacity?: boolean,
    onComplete?: () => void
  ) => void;
}

interface SliderDraggingInfo {
  initialLeft: number;
  initialClientX: number;
  sliderWidth: number;
}

interface Ratio {
  title: string;
  icon: HTMLElement;
}

type langPackAspectRatiosKey = 'MediaEditor.AspectRatios.Free'
  | 'MediaEditor.AspectRatios.Original'
  | 'MediaEditor.AspectRatios.Square'

export default function Crop(props: CropProps) {
  const [angle, setAngle] = createSignal(0);
  const [cropLayer, setCropLayer] = createSignal<DivLayer>();
  const [overlayLayer, setOverlayLayer] = createSignal<DivLayer>();
  const [aspectRatio, setAspectRatio] = createSignal<string>('Free');
  const [cropBox, setCropBox] = createSignal<DraggableBox>();
  const [canvasRotationApplied, setCanvasRotationApplied] = createSignal(0);
  const [cropChanged, setCropChanged] = createSignal(false);

  const ratios: Ratio[][] = [
    [
      {title: 'Free', icon: Icon('ratio_free')}
    ],
    [
      {title: 'Original', icon: Icon('imageoriginal')}
    ],
    [
      {title: 'Square', icon: Icon('ratio_square')}
    ],
    [
      {title: '3:2', icon: Icon('ratio_3_2')},
      {title: '2:3', icon: Icon('ratio_3_2', 'icon-rotated')}
    ],
    [
      {title: '4:3', icon: Icon('ratio_4_3')},
      {title: '3:4', icon: Icon('ratio_4_3', 'icon-rotated')}
    ],
    [
      {title: '5:4', icon: Icon('ratio_5_4')},
      {title: '4:5', icon: Icon('ratio_5_4', 'icon-rotated')}
    ],
    [
      {title: '7:5', icon: Icon('ratio_7_6')},
      {title: '5:7', icon: Icon('ratio_7_6', 'icon-rotated')}
    ],
    [
      {title: '16:9', icon: Icon('ratio_16_9')},
      {title: '9:16', icon: Icon('ratio_16_9', 'icon-rotated')}
    ]
  ];

  const angles = Array.from({length: 25}, (_, i) => -180 + i * 15);

  const nearestAngleIndex = createMemo(() => {
    const currentAngle = angle();
    return angles.reduce((prev, curr, idx) => {
      return Math.abs(curr - currentAngle) < Math.abs(angles[prev] - currentAngle) ? idx : prev;
    }, 0);
  });

  const resizeSlider = (
    <div class="pe-resizer__slider">
      <div class="pe-resizer__slider-numbers">
        <For each={angles}>
          {(angleValue, index) => (
            <div
              classList={{
                current: nearestAngleIndex() === index(),
                zero: angleValue === 0
              }}
            >
              {angleValue}
              °
            </div>
          )}
        </For>
      </div>
    </div>
  );

  const resizeSliderWrapper = (
    <div class="pe-resizer-wrapper">
      <div class="pe-resizer">
        <div class="pe-resizer__left">
          <span class="pe-resizer__rotate" onClick={() => { !isRotateAlongWithCrop && rotate90() }}>
            { Icon('rotate') }
          </span>
        </div>
        <div class="pe-resizer__center">
          {resizeSlider}
          <div class="pe-resizer__center-pointer" />
        </div>
        <div class="pe-resizer__right">
          <span class="pe-resizer__flip" onClick={flip}>
            { Icon('flip_mirror') }
          </span>
        </div>
      </div>
    </div>
  );

  function init() {
    showResizeSlider();
    initCrop();
  }

  function destroy() {
    deinitCrop();
    hideResizeSlider();
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function flip() {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if(!imageLayer) {
      return;
    }

    imageLayer.flip();
    setAngle(0);
    resetSliderPosition();
  }

  /**
   * Computes box size based on aspect ratio and layer size
   */
  function getCropBoxDimensions(): { width: number; height: number } {
    const layerRect = cropLayer()!.div.getBoundingClientRect();
    const ratioTitle = aspectRatio();

    switch(ratioTitle) {
      case 'Free':
        return {width: layerRect.width, height: layerRect.height};
      case 'Original':
        return {width: layerRect.width, height: layerRect.height};
      case 'Square': {
        const minSide = Math.min(layerRect.width, layerRect.height);

        return {width: minSide, height: minSide};
      }
      default: {
        const [w, h] = ratioTitle.split(':').map(Number);
        const ratio = w / h;

        if(w > h) {
          const width = layerRect.width;
          const height = width / ratio;

          if(height > layerRect.height) {
            return {width: layerRect.height * ratio, height: layerRect.height};
          }

          return {width, height};
        }
        else {
          const height = layerRect.height;
          const width = height * ratio;

          if(width > layerRect.width) {
            return {width: layerRect.width, height: layerRect.width / ratio};
          }

          return {width, height};
        }
      }
    }
  }

  const croppedZoneOverlayTop = <div class="pe-crop__overlay pe-crop__overlay--top" />;
  const croppedZoneOverlayLeft = <div class="pe-crop__overlay pe-crop__overlay--left" />;
  const croppedZoneOverlayRight = <div class="pe-crop__overlay pe-crop__overlay--right" />;
  const croppedZoneOverlayBottom = <div class="pe-crop__overlay pe-crop__overlay--bottom" />;

  function updateCroppedZoneOverlay(width: number, height: number, x: number, y: number) {
    const layerRect = cropLayer()!.rect;

    const bottomZoneHeigth = Math.abs(layerRect.height - y - height);

    (croppedZoneOverlayTop as HTMLElement).style.height = `${Math.abs(y)}px`;
    (croppedZoneOverlayBottom as HTMLElement).style.height = `${bottomZoneHeigth}px`;

    (croppedZoneOverlayLeft as HTMLElement).style.width = `${Math.abs(x)}px`;
    (croppedZoneOverlayLeft as HTMLElement).style.top = `${Math.abs(y)}px`;
    (croppedZoneOverlayLeft as HTMLElement).style.bottom = `${bottomZoneHeigth}px`;

    (croppedZoneOverlayRight as HTMLElement).style.width = `${Math.abs(layerRect.width - x - width)}px`;
    (croppedZoneOverlayRight as HTMLElement).style.top = `${Math.abs(y)}px`;
    (croppedZoneOverlayRight as HTMLElement).style.bottom = `${bottomZoneHeigth}px`;
  }

  const cropBoxGrid = (
    <div class="pe-crop-grid">
    </div>
  );

  let isRotateAlongWithCrop = false;

  const canasClickOutsideListener = async(event: MouseEvent) => {
    const isClickedOutsideCropBox = !cropBox()!.el.contains(event.target as Node);
    const isClickedOnRotation = document.querySelector('.pe-resizer__rotate')!.contains(event.target as Node);

    if(!isClickedOutsideCropBox) {
      return;
    }

    if(!isClickedOnRotation) {
      crop(cropBox()!.position);
    } else {
      isRotateAlongWithCrop = true;

      await crop(cropBox()!.position);
      rotate90();
    }
  };

  const documentKeydownListener = (event: KeyboardEvent) => {
    if(event.key === 'Enter' || event.key === 'Delete' || event.key === 'Backspace') {
      crop(cropBox()!.position);
    } else if(event.key === 'Escape') {
      const {width, height} = getCropBoxDimensions();
      updateCroppedZoneOverlay(width, height, 0, 0);
      event.stopImmediatePropagation();
      event.stopPropagation();
    }
  }

  function initCrop() {
    const overlay = props.layerMaganer().createDivLayer();
    const layer = props.layerMaganer().createDivLayer();

    setOverlayLayer(overlay);
    setCropLayer(layer);

    overlay.div.appendChild(croppedZoneOverlayTop as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayLeft as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayRight as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayBottom as HTMLElement);

    const {width, height} = getCropBoxDimensions();

    const box = layer.createBox({
      width,
      height,
      preserveRatio: aspectRatio() !== 'Free',
      style: 'solid',
      scaleHistory: false,
      onResize(width, height, x, y) {
        updateCroppedZoneOverlay(width, height, box.position.x, box.position.y);
      },
      onDrag(x, y) {
        updateCroppedZoneOverlay(box.position.width, box.position.height, x, y);
      },
      onAfterDrag() {
        setCropChanged(true);
      },
      onAfterResize() {
        const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
        const canvasWrapperRect = canvasWrapper.getBoundingClientRect();
        const {width, height} = box.position;

        if(width == Math.floor(canvasWrapperRect.width) && height === Math.floor(canvasWrapperRect.height)) {
          return;
        }

        setCropChanged(true);
      }
    });

    box.append(cropBoxGrid as HTMLElement);

    setCropBox(box);

    layer.insertBox(box, 0, height / 2);

    updateCroppedZoneOverlay(box.position.width, box.position.height, box.position.x, box.position.y);

    layer.activateBox(box);

    const leftZone = document.querySelector('.media-editor__left') as HTMLElement;

    leftZone.addEventListener('mousedown', canasClickOutsideListener);
    document.addEventListener('keydown', documentKeydownListener);
  }

  function deinitCrop() {
    cropLayer()?.remove();
    overlayLayer()?.remove();

    const leftZone = document.querySelector('.media-editor__left') as HTMLElement;

    leftZone.removeEventListener('mousedown', canasClickOutsideListener);
    document.removeEventListener('keydown', documentKeydownListener);
  }

  function crop({x, y, width, height}: { x: number; y: number; width: number; height: number }): Promise<void> {
    return new Promise<void>((resolve) => {
      if(!cropChanged()) {
        resolve();
        return;
      }

      const layer = props.layerMaganer().getBaseCanvasLayer();

      /**
       * New canvas dimensions should respect aspect ratio and fit all available space except offset top
      */
      const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
      const offsetTopBefore = Number.parseInt(canvasWrapper.style.marginTop);
      const availabeHeight = canvasWrapper.parentElement!.offsetHeight - offsetTopBefore;

      const maxWidht = canvasWrapper.parentElement!.offsetWidth - 100;
      let newCanvasHeight = availabeHeight;
      let newCanvasWidth = newCanvasHeight * width / height;

      if(newCanvasWidth > maxWidht) {
        newCanvasWidth = maxWidht;
        newCanvasHeight = newCanvasWidth * height / width;
      }

      const offsetTopAfter = offsetTopBefore + (availabeHeight - newCanvasHeight) / 2;

      const canvasStyle = window.getComputedStyle(canvasWrapper);
      const currentCanvasDimensions = {
        newCanvasWidth: canvasStyle.width ? parseInt(canvasStyle.width) : canvasWrapper.offsetWidth,
        newCanvasHeight: canvasStyle.height ? parseInt(canvasStyle.height) : canvasWrapper.offsetHeight,
        offsetTop: canvasStyle.marginTop ? parseInt(canvasStyle.marginTop) : canvasWrapper.offsetTop
      };

      layer.crop({
        imageDimensions: {
          x, y, width, height
        },
        newCanvasDimensions: {
          newCanvasWidth,
          newCanvasHeight,
          offsetTop: offsetTopAfter
        },
        currentCanvasDimensions,
        onBeforeCrop: () => {
          const isOnCropPage = document.querySelector('.pe-resizer__slider') !== null;

          if(isOnCropPage) {
            deinitCrop();
            resetSliderPosition();
          }
        },
        uiReflector: (newWidth: number, newHeight: number, newOffsetTop: number) => {
          const isOnCropPage = document.querySelector('.pe-resizer__slider') !== null;

          props.animateResizeCanvasWrapper(
            newWidth,
            newHeight,
            newOffsetTop,
            [0.38, 0.45, 0.26, 1.06],
            undefined,
            newWidth * 0.96,
            newHeight * 0.96,
            newOffsetTop,
            600,
            true, // animate opacity
            () => {
              if(isOnCropPage) {
                initCrop();
                setCropChanged(false);
              }
              resolve();
            }
          );
        }});
    });
  }

  let sliderDraggingInfo: SliderDraggingInfo | null = null;
  let currentSliderLeft = 0;

  function beginAngleSlide(e: Event) {
    const event = e as MouseEvent;

    const slider = resizeSlider as HTMLElement;
    const {clientX} = event;
    const oneNumberWidth = 42;

    sliderDraggingInfo = {
      initialLeft: currentSliderLeft,
      initialClientX: clientX,
      sliderWidth: (angles.length - 1) * oneNumberWidth
    };

    slider.classList.add('pe-resizer__slider--dragging');
    (cropBoxGrid as HTMLElement).classList.add('pe-crop-grid--rotating');

    props.layerMaganer().commands.startBatch();
  }

  function endAngleSlide() {
    sliderDraggingInfo = null;

    const slider = resizeSlider as HTMLElement;

    slider.classList.remove('pe-resizer__slider--dragging');
    (cropBoxGrid as HTMLElement).classList.remove('pe-crop-grid--rotating');

    props.layerMaganer().commands.endBatch();
  }

  function resetSliderPosition() {
    const slider = resizeSlider as HTMLElement;

    slider.style.transform = 'translateX(0)';
    currentSliderLeft = 0;
    setAngle(0);

    const layer = props.layerMaganer().getBaseCanvasLayer();

    layer.state.rotation = 0;
  }

  function moveSliderToAngle(angle: number) {
    const slider = resizeSlider as HTMLElement;
    const maxTranslateAbs = 260;
    const minAngle = -180;
    const maxAngle = 180;
    const range = maxAngle - minAngle;
    const sliderWidth = slider.clientWidth;

    const normalizedAngle = (angle * -1 - minAngle) / range;
    const x = (normalizedAngle * sliderWidth) - (sliderWidth / 2);

    let adjustedX = x;

    if(adjustedX > maxTranslateAbs) {
      adjustedX = maxTranslateAbs;
    } else if(adjustedX < -maxTranslateAbs) {
      adjustedX = -maxTranslateAbs;
    }

    slider.style.transform = `translateX(${adjustedX}px)`;
    currentSliderLeft = adjustedX;
  }


  function moveAngleSlide(e: Event) {
    if(!sliderDraggingInfo) {
      return;
    }

    const event = e as MouseEvent;
    const {clientX} = event;
    const {initialClientX, initialLeft, sliderWidth} = sliderDraggingInfo;
    const deltaX = clientX - initialClientX;

    let x = initialLeft + deltaX;

    const slider = resizeSlider as HTMLElement;

    const maxTranslateAbs = 260;

    if(x > maxTranslateAbs) {
      x = maxTranslateAbs;
    }
    else if(x < -maxTranslateAbs) {
      x = -maxTranslateAbs;
    }

    slider.style.transform = `translateX(${x}px)`;
    currentSliderLeft = x;

    const minAngle = -180;
    const maxAngle = 180;
    const range = maxAngle - minAngle;

    const normalizedX = (x + (sliderWidth / 2)) / sliderWidth;
    const angle = (normalizedX * range + minAngle) * -1;

    const angleRounded = Math.round(angle);
    props.layerMaganer().getBaseCanvasLayer().rotate(angleRounded, (angle) => {
      setAngle(angle);
      resetSliderPosition();
      moveSliderToAngle(angle);
    });
  }

  function showResizeSlider() {
    props.leftZoneControls.show(resizeSliderWrapper as Element);

    (resizeSlider as Element).addEventListener('mousedown', beginAngleSlide);
    document.addEventListener('mouseup', endAngleSlide);
    document.addEventListener('mousemove', moveAngleSlide);
  }

  function hideResizeSlider() {
    props.leftZoneControls.hide();

    (resizeSlider as Element).removeEventListener('mousedown', beginAngleSlide);
    document.removeEventListener('mouseup', endAngleSlide);
    document.removeEventListener('mousemove', moveAngleSlide);
  }

  function _rotate90() {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if(!imageLayer) {
      return;
    }

    const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
    const offsetTopBefore = Number.parseInt(canvasWrapper.style.marginTop);

    canvasWrapper.style.transition = '';
    canvasWrapper.style.transform = `rotate(${canvasRotationApplied()}deg)`;

    const degrees = canvasRotationApplied() + 90;

    canvasWrapper.addEventListener('transitionend', () => {
      const newWidth = canvasRotationApplied() % 90 === 0 ? imageLayer.visibleCanvas.height : imageLayer.visibleCanvas.width;
      const newHeight = canvasRotationApplied() % 90 === 0 ? imageLayer.visibleCanvas.width : imageLayer.visibleCanvas.height;

      const canvasCenterYBefore = offsetTopBefore + imageLayer.visibleCanvas.height / 2;
      const newTopOffset = canvasCenterYBefore - newHeight / 2;

      canvasWrapper.style.transition = '';
      canvasWrapper.style.transform = '';

      props.resizeCanvasWrapper(newWidth, newHeight, newTopOffset);
      imageLayer.rotate90();
      imageLayer.save();
    }, {once: true});

    canvasWrapper.style.transition = 'transform 0.4s cubic-bezier(.69,-0.17,.37,1.14)';
    canvasWrapper.style.transform = `rotate(${90}deg)`;

    setCanvasRotationApplied(degrees);
  }

  function rotate90() {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if(!imageLayer) {
      return;
    }

    deinitCrop();

    const {visibleCanvas} = imageLayer;

    const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
    const minMarginTop = 60;
    const parentContainer = canvasWrapper.parentElement as HTMLElement;
    const parentRect = parentContainer.getBoundingClientRect();
    const canvasRect = visibleCanvas.getBoundingClientRect();

    let newWidth = canvasRect.height;
    let newHeight = canvasRect.width;
    const newRatio = newWidth / newHeight;

    const isHorizontal = newWidth > newHeight;

    if(isHorizontal) {
      if(newWidth > parentRect.width) {
        newWidth = parentRect.width;
        newHeight = newWidth / newRatio;
      }
    }
    else {
      if(newHeight > parentRect.height) {
        newHeight = parentRect.height;
        newWidth = newHeight * newRatio;
      }
    }

    if(newHeight > parentRect.height - minMarginTop) {
      newHeight = parentRect.height - minMarginTop;
      newWidth = newHeight * newRatio;
    }

    const spaceAboveAndBelow = parentRect.height - newHeight;

    let topOffset = minMarginTop;

    if(spaceAboveAndBelow / 2 > minMarginTop) {
      topOffset = spaceAboveAndBelow / 2;
    }

    props.resizeCanvasWrapper(newWidth, newHeight, topOffset);
    imageLayer.rotate90();
    imageLayer.save();
    resetSliderPosition();

    initCrop();
  }

  createEffect(() => {
    const photoWrapper = document.querySelector('.media-editor__left-photo') as HTMLElement;

    if(!photoWrapper) {
      return;
    }

    photoWrapper.classList.toggle('crop-ready', cropChanged());
  })

  // createEffect(() => rotateImage(angle()));

  function aspectRatioChanged(ratio: Ratio) {
    const aspectRatio = ratio.title;

    setAspectRatio(aspectRatio);

    setCropChanged(true);

    deinitCrop();
    initCrop();
  }

  function createRow(ratio: Ratio) {
    const row = (
      <div
        classList={{
          'pe-crop__row': true,
          'pe-crop__row--selected': aspectRatio() === ratio.title
        }}
        onClick={() => aspectRatioChanged(ratio)}
      >
        <div class="pe-crop__icon">{ ratio.icon }</div>
        <div class="pe-crop__title">{
          /\d/.test(ratio.title) ? ratio.title : i18n(`MediaEditor.AspectRatios.${ratio.title}` as langPackAspectRatiosKey)
        }</div>
      </div>
    );

    ripple(row as HTMLElement);

    return row;
  }

  return (
    <div class="pe-settins pe-crop">
      <div class="pe-settings__section-header">
        { i18n('MediaEditor.AspectRatio') }
      </div>
      <For each={ratios}>
        {ratioRow => (
          <div class="pe-crop__row-wrapper">
            <For each={ratioRow}>
              {ratio => (
                createRow(ratio)
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
