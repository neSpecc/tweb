import type {Accessor} from 'solid-js';
import {createSignal, For, onCleanup, onMount} from 'solid-js';
import type {DivLayer, useCanvasLayers} from '../services/useCanvasLayers';
import rootScope from '../../../lib/rootScope';
import emoticonsDropdown, {EmoticonsDropdown, EMOTICONSSTICKERGROUP} from '../../emoticonsDropdown';
import cloneDOMRect from '../../../helpers/dom/cloneDOMRect';
import EmojiTab from '../../emoticonsDropdown/tabs/emoji';
import {AccountEmojiStatuses, Document, EmojiStatus} from '../../../layer';
import filterUnique from '../../../helpers/array/filterUnique';
import flatten from '../../../helpers/array/flatten';
import Icon, {getIconContent} from '../../icon';
import SuperStickerRenderer from '../../emoticonsDropdown/tabs/SuperStickerRenderer';
import LazyLoadQueue from '../../lazyLoadQueue';
import {MyDocument} from '../../../lib/appManagers/appDocsManager';
import ButtonIcon from '../../buttonIcon';
import {DraggableBox} from '../services/useDraggableBox';

interface StickersProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

interface StikerSet {
  id: string | number;
  title: string;
  stickers: MyDocument[];
}

export default function Stickers(props: StickersProps) {
  const [renderer, setRenderer] = createSignal<SuperStickerRenderer>();
  const [sets, setSets] = createSignal<StikerSet[]>([]);
  const [stickersLayer, setStickersLayer] = createSignal<DivLayer>();


  async function init() {
    const layer = props.layerMaganer().getStickersLayer();

    setStickersLayer(layer);

    const tabContent = document.querySelector('.pe-stickers') as HTMLElement;
    const recents = await rootScope.managers.appStickersManager.getRecentStickers()

    stickersLayer().enable();

    const superStickerRenderer = new SuperStickerRenderer({
      managers: rootScope.managers,
      regularLazyLoadQueue: new LazyLoadQueue(1),
      group: EMOTICONSSTICKERGROUP,
      intersectionObserverInit: {
        root: tabContent
      }
    })

    setRenderer(superStickerRenderer);

    const recentSet = {
      id: 'recent',
      title: 'Recently Used',
      stickers: recents.stickers as MyDocument[]
    }

    setSets([recentSet]);

    void loadAllStickers();
  }
  function destroy() {
    stickersLayer().disable();
    stickersLayer().deactivateAllBoxes();
  }

  async function loadAllStickers() {
    const all = await rootScope.managers.appStickersManager.getAllStickers();

    all.sets.forEach(async(set) => {
      const setData = await rootScope.managers.appStickersManager.getStickerSet(set);

      const setToAdd: StikerSet = {
        id: setData.set.id,
        title: setData.set.title,
        stickers: setData.documents as MyDocument[]
      }

      setSets(prevSets => [...prevSets, setToAdd]);
    })
  }


  onMount(async() => {
    void init();
  });

  onCleanup(() => {
    destroy();
  });

  function renderTab(set: StikerSet) {
    const button = ButtonIcon('pe-stickers-tab', {noRipple: true});

    button.append(renderer().renderSticker(set.stickers[0] as MyDocument) as Element)

    return button;
  }

  function onStickerSelect(sticker: Document.document): void {
    console.log('sticker -->', sticker);


    sticker.animated = false;

    const stickerRendered = renderer().renderSticker(sticker as MyDocument);

    stickerRendered.classList.add('pe-sticker')

    let initialWidth = Math.min(200, sticker.w);
    let initialHeight = Math.min(200, sticker.h);
    const ratio = initialWidth / initialHeight;

    if(sticker.w > sticker.h) {
      initialHeight = initialWidth / ratio;
    } else {
      initialWidth = initialHeight / ratio;
    }

    console.log('initialWidth', initialWidth)
    console.log('initialHeight', initialHeight)

    stickerRendered.style.width = `${initialWidth}px`;
    stickerRendered.style.height = `${initialHeight}px`;

    /**
     * Save original
     */
    stickerRendered.dataset.w = `${sticker.w}`;
    stickerRendered.dataset.h = `${sticker.h}`;

    const box = stickersLayer().createBox({
      rotatable: true,
      preserveRatio: true,
      horizons: true,
      onResize(newWidth: number, newHeight: number) {
        stickerRendered.style.width = `${newWidth}px`;
        stickerRendered.style.height = `${newHeight}px`;
      }
    });


    box.append(stickerRendered);

    requestAnimationFrame(() => {

    })

    const centerX = stickersLayer().div.offsetWidth / 2
    const centerY = stickersLayer().div.offsetHeight / 2

    stickersLayer().insertBox(box, centerX, centerY);
    stickersLayer().activateBox(box);
  }

  return (
    <div class="pe-settings">
      <div class="pe-settings__tool pe-stickers">
        <div class="pe-stickers-packs">
          <div class="pe-stickers-packs-scrollable">
            {ButtonIcon('clock_stroked')}
            <For each={sets()}>
              {(set) => (
                renderTab(set)
              )}
            </For>
          </div>
        </div>
        <div class="pe-stickers-search">
          { Icon('search') }
          Search
        </div>

        <div class="pe-stickers-set">
          <For each={sets()}>
            {(set) => (
              <div class="pe-stickers-set-item">
                <div class="pe-settings__section-header">
                  {set.title}
                </div>
                <div class="pe-stickers-grid">
                  <For each={set.stickers}>
                    {(sticker) => (
                      <div
                        class="pe-stickers-grid-item"
                        onClick={() => onStickerSelect(sticker)}
                      >
                        { renderer().renderSticker(sticker as MyDocument) as Element }
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
