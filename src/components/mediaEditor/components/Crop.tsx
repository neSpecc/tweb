import type { Accessor } from 'solid-js';
import { For, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { DivLayer, useCanvasLayers } from '../services/useCanvasLayers';
import type { LeftZoneControls } from '../services/leftZoneControls';
import type { DraggableBox } from '../services/useDraggableBox';
import { debounce } from '../utils/debounce';

interface CropProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
  leftZoneControls: LeftZoneControls;
  resizeCanvasWrapper: (newWidth: number, newHeight: number, topOffset?: number) => void;
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
  ) => void;
}

interface SliderDraggingInfo {
  initialLeft: number;
  initialClientX: number;
  sliderWidth: number;
}

interface Ratio {
  title: string;
  icon: string;
}

export default function Crop(props: CropProps) {
  const [angle, setAngle] = createSignal(0);
  const [cropLayer, setCropLayer] = createSignal<DivLayer>();
  const [overlayLayer, setOverlayLayer] = createSignal<DivLayer>();
  const [aspectRatio, setAspectRatio] = createSignal<string>('Free');
  const [cropBox, setCropBox] = createSignal<DraggableBox>();
  const [canvasRotationApplied, setCanvasRotationApplied] = createSignal(0);

  const ratios: Ratio[][] = [
    [
      { title: 'Free', icon: '' },
    ],
    [
      { title: 'Original', icon: '' },
    ],
    [
      { title: 'Square', icon: '' },
    ],
    [
      { title: '3:2', icon: '' },
      { title: '2:3', icon: '' },
    ],
    [
      { title: '4:3', icon: '' },
      { title: '3:4', icon: '' },
    ],
    [
      { title: '5:4', icon: '' },
      { title: '4:5', icon: '' },
    ],
    [
      { title: '7:5', icon: '' },
      { title: '5:7', icon: '' },
    ],
    [
      { title: '16:9', icon: '' },
      { title: '9:16', icon: '' },
    ],
  ];

  const angles = Array.from({ length: 25 }, (_, i) => -180 + i * 15);

  // const nearestAngleIndex = createMemo(() => {
  //   const currentAngle = angle();
  //   const nearest = angles.reduce((prev, curr, idx) => {
  //     return Math.abs(curr - currentAngle) < Math.abs(angles[prev] - currentAngle) ? idx : prev;
  //   }, 0);

  //   // Check if the nearest angle is within ±3 degrees of the current angle
  //   return Math.abs(angles[nearest] - currentAngle) <= 5 ? nearest : null;
  // });

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
                zero: angleValue === 0,
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
          <span class="pe-resizer__rotate" onClick={rotate90} />
        </div>
        <div class="pe-resizer__center">
          {resizeSlider}
          <div class="pe-resizer__center-pointer" />
        </div>
        <div class="pe-resizer__right">
          <span class="pe-resizer__flip" onClick={flip} />
        </div>
      </div>
    </div>
  );

  function init() {
    showResizeSlider();
    initCrop();
  }

  function destroy() {
    hideResizeSlider();
    cropLayer()?.remove();
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function flip() {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if (!imageLayer) {
      return;
    }

    imageLayer.flip();
  }

  /**
   * Computes box size based on aspect ratio and layer size
   */
  function getCropBoxDimensions(): { width: number; height: number } {
    const layerRect = cropLayer()!.div.getBoundingClientRect();
    const ratioTitle = aspectRatio();

    switch (ratioTitle) {
      case 'Free':
        return { width: layerRect.width, height: layerRect.height };
      case 'Original':
        return { width: layerRect.width, height: layerRect.height };
      case 'Square':
        return { width: layerRect.width, height: layerRect.width };
      default: {
        const [w, h] = ratioTitle.split(':').map(Number);
        const ratio = w / h;

        if (w > h) {
          const width = layerRect.width;
          const height = width / ratio;

          if (height > layerRect.height) {
            return { width: layerRect.height * ratio, height: layerRect.height };
          }

          return { width, height };
        }
        else {
          const height = layerRect.height;
          const width = height * ratio;

          if (width > layerRect.width) {
            return { width: layerRect.width, height: layerRect.width / ratio };
          }

          return { width, height };
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

    const bottomZoneHeigth = layerRect.height - y - height;

    (croppedZoneOverlayTop as HTMLElement).style.height = `${y}px`;
    (croppedZoneOverlayBottom as HTMLElement).style.height = `${bottomZoneHeigth}px`;

    (croppedZoneOverlayLeft as HTMLElement).style.width = `${x}px`;
    (croppedZoneOverlayLeft as HTMLElement).style.top = `${y}px`;
    (croppedZoneOverlayLeft as HTMLElement).style.bottom = `${bottomZoneHeigth}px`;

    (croppedZoneOverlayRight as HTMLElement).style.width = `${layerRect.width - x - width}px`;
    (croppedZoneOverlayRight as HTMLElement).style.top = `${y}px`;
    (croppedZoneOverlayRight as HTMLElement).style.bottom = `${bottomZoneHeigth}px`;
  }

  const cropBoxGrid = (
    <div class="pe-crop-grid">
    </div>
  );

  const debouncedCrop = debounce(() => {
    crop(cropBox()!.position);
  }, 1000);

  function initCrop() {
    const overlay = props.layerMaganer().createDivLayer();
    const layer = props.layerMaganer().createDivLayer();

    setOverlayLayer(overlay);
    setCropLayer(layer);

    overlay.div.appendChild(croppedZoneOverlayTop as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayLeft as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayRight as HTMLElement);
    overlay.div.appendChild(croppedZoneOverlayBottom as HTMLElement);

    const { width, height } = getCropBoxDimensions();

    const box = layer.createBox({
      width,
      height,
      preserveRatio: aspectRatio() !== 'Free',
      style: 'solid',
      onResize(width, height, x, y) {
        updateCroppedZoneOverlay(width, height, x ?? box.position.x, y ?? box.position.y);
      },
      onDrag(x, y) {
        updateCroppedZoneOverlay(box.position.width, box.position.height, x, y);
      },
      onAfterDrag() {
        debouncedCrop();
      },
      onAfterResize() {
        debouncedCrop();
      },
    });

    box.append(cropBoxGrid as HTMLElement);

    setCropBox(box);

    layer.insertBox(box, 0, height / 2);

    updateCroppedZoneOverlay(box.position.width, box.position.height, box.position.x, box.position.y);

    layer.activateBox(box);

    // layer.div.addEventListener('mouseout', canasMouseOutListener);
  }

  function canasMouseOutListener(e: MouseEvent) {
    debouncedCrop();
  }

  function deinitCrop() {
    cropLayer()?.removeAllBoxes();

    const layer = cropLayer();

    // if (layer) {
    //   layer.div.removeEventListener('mouseout', canasMouseOutListener);
    // }
  }

  function crop({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
    cropLayer()!.div.style.width = '0';
    cropLayer()!.div.style.height = '0';
    cropLayer()!.div.style.display = 'none';

    /**
     * New canvas dimensions should respect aspect ratio and fit all available space except offset top
     */
    const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
    const offsetTopBefore = Number.parseInt(canvasWrapper.style.marginTop);
    const availabeHeight = canvasWrapper.parentElement!.offsetHeight - offsetTopBefore;

    const maxWidht = canvasWrapper.parentElement!.offsetWidth - 100;
    let newCanvasHeight = availabeHeight;
    let newCanvasWidth = newCanvasHeight * width / height;

    if (newCanvasWidth > maxWidht) {
      newCanvasWidth = maxWidht;
      newCanvasHeight = newCanvasWidth * height / width;
    }

    const offsetTopAfter = offsetTopBefore + (availabeHeight - newCanvasHeight) / 2;

    // const canvasCenterYBefore = offsetTopBefore + canvasWrapper.offsetHeight / 2;
    // const offsetTop = canvasCenterYBefore - height / 2;

    const layer = props.layerMaganer().getBaseCanvasLayer();
    const animationDuration = 700;

    props.animateResizeCanvasWrapper(
      newCanvasWidth,
      newCanvasHeight,
      offsetTopAfter,
      [0.38, 0.45, 0.26, 1.06],
      // [0.42, 0.16, 0.43, 1.15],
      undefined,
      newCanvasWidth * 0.85,
      newCanvasHeight * 0.85,
      offsetTopAfter * 2,
      animationDuration,
    );

    layer!.crop(x, y, width, height);

    setTimeout(() => {
      cropLayer()!.div.style.display = 'block';
      cropLayer()!.div.style.width = '100%';
      cropLayer()!.div.style.height = '100%';

      console.log('restoring crop layer', width, height);

      cropBox()!.position.x = 0;
      cropBox()!.position.y = 0;
      cropBox()!.position.width = width;
      cropBox()!.position.height = height;

      cropBox()!.reposition();
    }, animationDuration);
  }

  let sliderDraggingInfo: SliderDraggingInfo | null = null;
  let currentSliderLeft = 0;

  function beginAngleSlide(e: Event) {
    const event = e as MouseEvent;

    const slider = resizeSlider as HTMLElement;
    const { clientX } = event;
    const oneNumberWidth = 42;

    sliderDraggingInfo = {
      initialLeft: currentSliderLeft,
      initialClientX: clientX,
      sliderWidth: (angles.length - 1) * oneNumberWidth,
    };

    slider.classList.add('pe-resizer__slider--dragging');
    (cropBoxGrid as HTMLElement).classList.add('pe-crop-grid--rotating');
  }

  function endAngleSlide() {
    sliderDraggingInfo = null;

    const slider = resizeSlider as HTMLElement;

    slider.classList.remove('pe-resizer__slider--dragging');
    (cropBoxGrid as HTMLElement).classList.remove('pe-crop-grid--rotating');
  }

  function moveAngleSlide(e: Event) {
    if (!sliderDraggingInfo) {
      return;
    }

    const event = e as MouseEvent;
    const { clientX } = event;
    const { initialClientX, initialLeft, sliderWidth } = sliderDraggingInfo;
    const deltaX = clientX - initialClientX;

    let x = initialLeft + deltaX;

    // Update the slider position
    const slider = resizeSlider as HTMLElement;

    const maxTranslateAbs = 260;

    if (x > maxTranslateAbs) {
      x = maxTranslateAbs;
    }
    else if (x < -maxTranslateAbs) {
      x = -maxTranslateAbs;
    }

    slider.style.transform = `translateX(${x}px)`;
    currentSliderLeft = x;

    const minAngle = -180;
    const maxAngle = 180;
    const range = maxAngle - minAngle;

    // Normalize the x position to a value between 0 and 1
    const normalizedX = (x + (sliderWidth / 2)) / sliderWidth;

    // Calculate the angle based on the normalized position
    const angle = (normalizedX * range + minAngle) * -1;

    // console.log(`Angle: ${angle.toFixed(2)}°`);
    setAngle(Math.round(angle)); // Use the calculated angle directly
  }

  function setupInitialSliderPosition() {
    // const slider = resizeSlider as HTMLElement;
    // const sliderWidth = slider.offsetWidth;

    // const currentAngle = angle();
    // const maxAngle = 180; // Change to 180
    // const minAngle = -180; // Change to -180
    // const range = maxAngle - minAngle;

    // // Calculate the center position for the current angle
    // const normalizedAngle = (currentAngle - minAngle) / range; // Normalize angle to range [0, 1]
    // const centerX = normalizedAngle * sliderWidth; // Position within the slider width

    // // Calculate the translateX value to center the current angle
    // const translateX = 0 - centerX + sliderWidth / 2; // Adjust to center

    // // Set the translateX value
    // slider.style.transform = `translateX(${translateX}px)`;

    // currentSliderLeft = translateX;
  }

  function showResizeSlider() {
    props.leftZoneControls.show(resizeSliderWrapper as Element);

    setupInitialSliderPosition();

    (resizeSlider as Element).addEventListener('mousedown', beginAngleSlide);
    document.addEventListener('mouseup', endAngleSlide);
    document.addEventListener('mousemove', moveAngleSlide);
  }

  function hideResizeSlider() {
    props.leftZoneControls.hide();
    document.removeEventListener('mouseup', endAngleSlide);
    document.removeEventListener('mousemove', moveAngleSlide);
  }

  function rotate90() {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if (!imageLayer) {
      return;
    }

    const canvasWrapper = document.getElementById('canvasWrapper') as HTMLElement;
    const offsetTopBefore = Number.parseInt(canvasWrapper.style.marginTop);

    canvasWrapper.style.transition = '';
    canvasWrapper.style.transform = `rotate(${canvasRotationApplied()}deg)`;

    const degrees = canvasRotationApplied() + 90;

    canvasWrapper.addEventListener('transitionend', () => {
      const newWidth = canvasRotationApplied() % 90 === 0 ? imageLayer.canvas.height : imageLayer.canvas.width;
      const newHeight = canvasRotationApplied() % 90 === 0 ? imageLayer.canvas.width : imageLayer.canvas.height;

      const canvasCenterYBefore = offsetTopBefore + imageLayer.canvas.height / 2;
      const newTopOffset = canvasCenterYBefore - newHeight / 2;

      canvasWrapper.style.transition = '';
      canvasWrapper.style.transform = '';

      props.resizeCanvasWrapper(newWidth, newHeight, newTopOffset);
      imageLayer.rotate90();
      imageLayer.save();
    }, { once: true });

    canvasWrapper.style.transition = 'transform 0.4s cubic-bezier(.69,-0.17,.37,1.14)';
    canvasWrapper.style.transform = `rotate(${90}deg)`;

    setCanvasRotationApplied(degrees);
  }

  function rotateImage(degrees: number) {
    const imageLayer = props.layerMaganer().getBaseCanvasLayer();

    if (!imageLayer) {
      return;
    }

    imageLayer.rotate(degrees);
    // imageLayer.save();
  }

  createEffect(() => rotateImage(angle()));

  function aspectRatioChanged(ratio: Ratio) {
    const aspectRatio = ratio.title;

    setAspectRatio(aspectRatio);

    deinitCrop();
    initCrop();
  }

  return (
    <div class="pe-crop">
      <div class="pe-crop__section-header">
        Aspect ratio
      </div>
      <For each={ratios}>
        {ratioRow => (
          <div class="pe-crop__row-wrapper">
            <For each={ratioRow}>
              {ratio => (
                <div
                  classList={
                    {
                      'pe-crop__row': true,
                      'pe-crop__row--selected': aspectRatio() === ratio.title,
                    }
                  }
                  onClick={() => aspectRatioChanged(ratio)}
                >
                  <div class="pe-crop__icon">{ ratio.icon }</div>
                  <div class="pe-crop__title">{ ratio.title }</div>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
