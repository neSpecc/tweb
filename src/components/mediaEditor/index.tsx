import {For, Match, Switch, createSignal, onCleanup, onMount} from 'solid-js';
// import SidebarSlider from '../slider';
// import DrawTab from './draw';
import {useCanvasLayers} from './services/useCanvasLayers';
import Enhance from './components/Enhance';
import TextTool from './components/TextTool';
import Crop from './components/Crop';
import Draw from './components/Draw';
import Stickers from './components/Stickers';
import type {LeftZoneControls} from './services/leftZoneControls';
import {cubicBezier, lerp} from './utils/timing-functions';

function MediaEditor(params: {
  file: File,
  width: number,
  height: number,
}) {
  const [layerManager, setLayerManager] = createSignal<ReturnType<typeof useCanvasLayers>>();
  const [aspectRatio, setAspectRatio] = createSignal<number>(1);
  const [tab, setTab] = createSignal<number>(0);

  /**
   * This element holds the layer system
   */
  const canvasWrapper = <div id="canvasWrapper" /> as HTMLElement;

  /**
   * Visible photo element with all canvas wrapper inside
   */
  const leftZonePhotoholder = (
    <div class="media-editor__left-photo">
      {canvasWrapper}
    </div>
  ) as HTMLElement;

  const cropModeMargins = 60;

  /**
   * Controls below the photo
   * For example, rotation slider
   */
  const leftZoneControls: LeftZoneControls = {
    element: <div class="media-editor__left-controls" /> as Element,
    show(content: Element) {
      leftZoneControls.element.appendChild(content);
      resizeCanvasWrapperToParent(cropModeMargins, true);
      // requestAnimationFrame(() => {
      //   layerManager()?.getBaseCanvasLayer().save();
      // });
    },
    hide() {
      leftZoneControls.element.innerHTML = '';
      resizeCanvasWrapperToParent(0, true);
    }
  };

  const tabs = [
    '🎨',
    '✂️',
    'T',
    '🖌️',
    '😃'
  ];

  function loadImage({url, onLoad}: { url: string; onLoad: (image: HTMLImageElement) => void }) {
    const image = new Image();
    image.src = url;
    image.onload = () => {
      onLoad(image);
    };
  }

  function resizeCanvasWrapper(width: number, height: number, topOffset?: number): void {
    if(!canvasWrapper) {
      console.error('resizeCanvasWrapper @ Canvas wrapper is not initialized');
      return;
    }

    // Resize canvas to match the new image dimensions
    canvasWrapper.style.width = `${width}px`;
    canvasWrapper.style.height = `${height}px`;
    if(topOffset !== undefined) {
      canvasWrapper.style.marginTop = `${topOffset}px`;
    }

    layerManager()?.resizeToFit();
  };

  function animateResizeCanvasWrapper(
    newWidth: number,
    newHeight: number,
    topOffset = 0,
    bezierSize = [0.21, 0.48, 0.31, 1.13],
    bezierOfset = [0.53, 1.02, 0.85, 1.08],
    initialWidth = canvasWrapper.offsetWidth,
    initialHeight = canvasWrapper.offsetHeight,
    initialTop = canvasWrapper.offsetTop,
    duration = 350
  ): void {
    const startTime = performance.now();

    const bezier = cubicBezier(bezierSize[0], bezierSize[1], bezierSize[2], bezierSize[3]);
    const bezierForTop = cubicBezier(bezierOfset[0], bezierOfset[1], bezierOfset[2], bezierOfset[3]);

    function animate(time: number) {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1); // t is in the range [0, 1]

      const easedT = bezier(t);
      // const easedT = easeOutQuad(t); // Apply easing

      const width = lerp(initialWidth, newWidth, easedT);
      const height = lerp(initialHeight, newHeight, easedT);
      const top = lerp(initialTop, topOffset, bezierForTop(t));

      resizeCanvasWrapper(width, height, top);

      if(t < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  function resizeCanvasWrapperToParent(margin = 0, isAnimated = false) {
    const leftZoneRect = leftZonePhotoholder.getBoundingClientRect();
    const leftZoneControlsRect = leftZoneControls.element.getBoundingClientRect();
    let newLeftZonePhotoHolderHeight = window.innerHeight - leftZoneControlsRect.height - margin;
    let newWidth = newLeftZonePhotoHolderHeight * aspectRatio();

    const maxWidth = leftZoneRect.width - 20;
    const maxHeight = window.innerHeight - leftZoneControlsRect.height - margin;

    if(newWidth > maxWidth) {
      newWidth = maxWidth;
      newLeftZonePhotoHolderHeight = newWidth / aspectRatio();
    }
    else if(newLeftZonePhotoHolderHeight > maxHeight) {
      newLeftZonePhotoHolderHeight = maxHeight;
      newWidth = newLeftZonePhotoHolderHeight * aspectRatio();
    }

    if(isAnimated) {
      animateResizeCanvasWrapper(newWidth, newLeftZonePhotoHolderHeight, margin);
    }
    else {
      const topOffset = (window.innerHeight - newLeftZonePhotoHolderHeight - leftZoneControlsRect.height) / 2;
      resizeCanvasWrapper(newWidth, newLeftZonePhotoHolderHeight, topOffset);
    }
  }

  function onImageLoad(image: HTMLImageElement) {
    setAspectRatio(image.width / image.height);

    resizeCanvasWrapperToParent(
      tab() === 1 ? cropModeMargins : 0,
      tab() === 1
    );

    const layerManager = useCanvasLayers({
      wrapperEl: document.getElementById('canvasWrapper') as HTMLElement
    });

    setLayerManager(layerManager);

    /**
     * Create base layer with the image
     */
    layerManager.createCanvasLayer({
      bgImage: image
    });
  }

  loadImage({
    // url: './photo.png',
    url: URL.createObjectURL(params.file),
    onLoad: (image) => {
      onImageLoad(image);
      URL.revokeObjectURL(image.src);
    }
  });

  function windowResizeHandler() {
    resizeCanvasWrapperToParent();
  }

  function onTabActivate(index: number) {
    setTab(index);
  }

  window.addEventListener('resize', windowResizeHandler);

  onCleanup(() => {
    window.removeEventListener('resize', windowResizeHandler);

    const layers = layerManager();

    if(layers) {
      layers.destroy();
    }
  });

  return (
    <>
      <div class="media-editor">
        <div class="media-editor__left">
          {leftZonePhotoholder}
          {leftZoneControls.element}
        </div>
        <div class="media-editor__right options-wrapper">
          <div class="navbar-and-tabs">
            <div class="navbar">
              <div class="navbar__title">
                Edit
              </div>
              <div class="navbar__undo">
                <div class="navbar__undo-undo" />
                <div class="navbar__undo-redo" />
              </div>
              <div class="navbar__cross" />
            </div>
            <div class="tabs">
              <For each={tabs} fallback={<div />}>
                {([tabName], index) => (
                  <div class={`tab ${tab() === index() ? 'tab--selected' : ''}`} onClick={() => onTabActivate(index())}>
                    <span class="tab__icon">{tabName}</span>
                  </div>
                )}
              </For>
            </div>

          </div>
          <div class="settings">
            <Switch>
              <Match when={tab() === 0}>
                <Enhance
                  layerMaganer={layerManager as () => ReturnType<typeof useCanvasLayers>}
                />
              </Match>
              <Match when={tab() === 1}>
                <Crop
                  layerMaganer={layerManager as () => ReturnType<typeof useCanvasLayers>}
                  leftZoneControls={leftZoneControls}
                  resizeCanvasWrapper={resizeCanvasWrapper}
                  animateResizeCanvasWrapper={animateResizeCanvasWrapper}
                />
              </Match>
              <Match when={tab() === 2}>
                <TextTool
                  layerMaganer={layerManager as () => ReturnType<typeof useCanvasLayers>}
                />
              </Match>
              <Match when={tab() === 3}>
                <Draw
                  layerMaganer={layerManager as () => ReturnType<typeof useCanvasLayers>}
                />
              </Match>
              <Match when={tab() === 4}>
                <Stickers
                  layerMaganer={layerManager as () => ReturnType<typeof useCanvasLayers>}
                />
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </>
  );
}

export default MediaEditor;
