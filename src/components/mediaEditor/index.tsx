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
import Icon from '../icon';
import {Middleware} from '../../helpers/middleware';
import Icons from '../../icons';
import ripple from '../ripple';
import {ButtonIconTsx} from '../buttonIconTsx';
import canvasToFile from '../../helpers/canvas/canvasToFile';


/**
 * Now working
 *
 * @todo add undo/redo
 * @todo saving rotated texts
 * @todo sliders from center
 * @todo stickers search, tabbing
 *
 * Critical bugs
 * - erase tool not working
 *
 * Working but not ideal
 *
 * @todo crop by enter
 * @todo delete active draggable box by delete (if caret is not set)
 * @todo increase border-radius of text along with scale up
 * @todo second rotate90 decreases width
 * @todo default text background is black, but need a white
 * @todo fix hightlighs and shadows filters
 * @todo fix erasing effect of the Blur Brush
 * @todo adjusting filters resets a crop
 * @todo improve animation after crop
 * @todo preselect text color is not working
 * @todo long text wrapping
 * @todo crop on Enter
 *
 */
function MediaEditor(params: {
  file: File,
  width: number,
  height: number,
  onClose: () => void,
  onSave: (file: File) => void
}, {middleware}: { middleware: Middleware }) {
  const [originalImage, setOriginalImage] = createSignal<HTMLImageElement>();
  const [layerManager, setLayerManager] = createSignal<ReturnType<typeof useCanvasLayers>>();
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

  const tabs: (keyof typeof Icons)[] = [
    'enhance',
    'crop',
    'text',
    'brush',
    'smile'
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
      const t = Math.min(elapsed / duration, 1);

      const easedT = bezier(t);

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

  function resizeCanvasWrapperToParent(minMargin = 0, isAnimated = false) {
    const layer = layerManager()?.getBaseCanvasLayer();
    const width = layer!.originalImageOffscreenCanvas.width;
    const height = layer!.originalImageOffscreenCanvas.height;

    const leftZoneRect = leftZonePhotoholder.getBoundingClientRect();
    const leftZoneControlsRect = leftZoneControls.element.getBoundingClientRect();
    const newLeftZonePhotoHolderHeight = leftZoneRect.height - minMargin - leftZoneControlsRect.height;
    const aspectRatio = width / height;

    let newWidth = newLeftZonePhotoHolderHeight * aspectRatio;
    let newHeight = newWidth / aspectRatio;

    const maxWidth = Math.min(leftZoneRect.width, originalImage()!.width);
    const maxHeight = Math.min(leftZoneRect.height - minMargin, originalImage()!.height);

    if(originalImage()!.width > originalImage()!.height) {
      if(newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = newWidth / aspectRatio;
      }
    }
    else {
      if(newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
      }
    }

    let topOffset = (newLeftZonePhotoHolderHeight + leftZoneControlsRect.height - newHeight) / 2;

    if(minMargin > 0 && minMargin > topOffset) {
      topOffset = minMargin;
    }

    if(isAnimated) {
      animateResizeCanvasWrapper(newWidth, newHeight, topOffset);
    }
    else {
      resizeCanvasWrapper(newWidth, newHeight, topOffset);
    }
  }

  function onImageLoad(image: HTMLImageElement) {
    setOriginalImage(image);

    const layerManager = useCanvasLayers({
      wrapperEl: document.getElementById('canvasWrapper') as HTMLElement
    });

    setLayerManager(layerManager);

    /**
     * Create base layer with the image
     */
    layerManager.createCanvasLayer({
      image
    });
    resizeCanvasWrapperToParent(

      tab() === 1 ? cropModeMargins : 0,
      tab() === 1
    );
  }

  loadImage({
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

  onMount(() => {
    prepareFonts();
  })

  async function saveResult() {
    const result = await layerManager()!.exportLayers();

    const file = canvasToFile(result, 'image/png');

    params.onSave(file);
  }

  function createTab(icon: keyof typeof Icons, index: number) {
    const tabEl = (
      <div
        class={`tab ${tab() === index ? 'tab--selected' : ''}`}
        onClick={() => onTabActivate(index)}
      >
        <span class="tab__icon">{Icon(icon)}</span>
      </div>
    );

    ripple(tabEl as HTMLElement);

    return tabEl;
  }

  function prepareFonts() {
    const fonts = [
      ['ITC American Typewriter Std', 'assets/fonts/AmericanTypewriterStd-Bold.woff2', '90%'],
      ['Avenir Next Cyr', 'assets/fonts/AvenirNextCyr-BoldItalic.woff2'],
      ['Noteworthy', 'assets/fonts/Noteworthy-Bold.woff2', '90%'],
      ['Papyrus', 'assets/fonts/PapyrusV2.woff2'],
      ['SnellRoundhand', 'assets/fonts/SnellBT-Bold.otf']
    ]

    fonts.forEach(([name, url, ascentOverride]) => {
      const font = new FontFace(name, `url(${url})`);

      if(ascentOverride) {
        font.ascentOverride = ascentOverride;
      }
      font.load().then(() => {
        document.fonts.add(font);
      }).catch((e) => {
        console.error(e);
      });
    })
  }

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
                <div class="navbar__undo-undo">
                  {
                    ButtonIconTsx({
                      icon: 'undo',
                      onClick: () => {}
                    })
                  }
                </div>
                <div class="navbar__undo-redo">
                  {
                    ButtonIconTsx({
                      icon: 'redo',
                      onClick: () => {}
                    })
                  }
                </div>
              </div>
              <div
                class="navbar__cross"
              >
                {
                  ButtonIconTsx({
                    icon: 'close',
                    onClick: () => params.onClose()
                  })
                }
              </div>
            </div>
            <div class="tabs">
              <For each={tabs} fallback={<div />}>
                {(tabIcon, index) => (
                  createTab(tabIcon, index())
                )}
              </For>
            </div>

          </div>
          <div class="media-editor-settings">
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
                  resizeCanvasWrapperToParent={resizeCanvasWrapperToParent}
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
        <div class="media-editor__save" onClick={saveResult}>
        </div>
      </div>
    </>
  );
}

export default MediaEditor;
