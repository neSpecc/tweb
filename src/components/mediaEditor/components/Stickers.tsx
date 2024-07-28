import type {Accessor} from 'solid-js';
import {createSignal, For, onCleanup, onMount} from 'solid-js';
import type {DivLayer, useCanvasLayers} from '../services/useCanvasLayers';
import rootScope from '../../../lib/rootScope';
import emoticonsDropdown, {EmoticonsDropdown, EMOTICONSSTICKERGROUP} from '../../emoticonsDropdown';
import cloneDOMRect from '../../../helpers/dom/cloneDOMRect';
import EmojiTab from '../../emoticonsDropdown/tabs/emoji';
import {AccountEmojiStatuses, Document, EmojiGroup, EmojiStatus} from '../../../layer';
import filterUnique from '../../../helpers/array/filterUnique';
import flatten from '../../../helpers/array/flatten';
import Icon, {getIconContent} from '../../icon';
import SuperStickerRenderer from '../../emoticonsDropdown/tabs/SuperStickerRenderer';
import LazyLoadQueue from '../../lazyLoadQueue';
import {MyDocument} from '../../../lib/appManagers/appDocsManager';
import ButtonIcon from '../../buttonIcon';
import {DraggableBox} from '../services/useDraggableBox';
import EmoticonsSearch from '../../emoticonsDropdown/search';
import {i18n} from '../../../lib/langPack';
import {attachClickEvent} from '../../../helpers/dom/clickEvent';
import {ScrollableX} from '../../scrollable';

interface StickersProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

interface StikerSetMeta {
  id: string | number;
  title: string;
  stickers: MyDocument[];
}

export default function Stickers(props: StickersProps) {
  const [renderer, setRenderer] = createSignal<SuperStickerRenderer>();
  const [sets, setSets] = createSignal<StikerSetMeta[]>([]);
  const [stickersLayer, setStickersLayer] = createSignal<DivLayer>();
  const [emojiGroups, setEmojiGroups] = createSignal<EmojiGroup[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedGroup, setSelectedGroup] = createSignal<EmojiGroup>(null);
  const [selectedGroupStickers, setSelectedGroupStickers] = createSignal<MyDocument[]>([]);
  const [isSearchPerformed, setIsSearchPerformed] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  function documentKeydownHandler(event: KeyboardEvent) {
    if(event.key === 'Delete' || event.key === 'Backspace') {
      stickersLayer().getActiveBox()?.remove();
    }
  }

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

    document.addEventListener('keydown', documentKeydownHandler);
  }

  function destroy() {
    stickersLayer().disable();
    stickersLayer().deactivateAllBoxes();

    document.removeEventListener('keydown', documentKeydownHandler);
  }

  async function loadAllStickers() {
    const all = await rootScope.managers.appStickersManager.getAllStickers();

    all.sets.forEach(async(set) => {
      const setData = await rootScope.managers.appStickersManager.getStickerSet(set);

      const setToAdd: StikerSetMeta = {
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

  function scrollToSet(id: StikerSetMeta['id']) {
    const set = document.querySelector(`.pe-stickers-set-item[data-id="${id}"]`) as HTMLElement;

    if(!set) {
      return;
    }

    set.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function renderTab(set: StikerSetMeta) {
    const button = ButtonIcon('pe-stickers-tab', {noRipple: true});

    button.append(renderer().renderSticker(set.stickers[0] as MyDocument) as Element)

    attachClickEvent(button, () => scrollToSet(set.id));

    return button;
  }

  function onStickerSelect(sticker: Document.document): void {
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

    const centerX = stickersLayer().div.offsetWidth / 2
    const centerY = stickersLayer().div.offsetHeight / 2

    stickersLayer().insertBox(box, centerX, centerY);
    stickersLayer().activateBox(box);
  }

  async function searchFetcher(value: string): Promise<void> {
    if(!value) {
      setIsSearchPerformed(false);
      return;
    }

    setIsLoading(true);

    const documents = await rootScope.managers.appStickersManager.searchStickers(value);

    setIsSearchPerformed(true);
    setSelectedGroupStickers(documents);
    setIsLoading(false);
  }

  async function groupFetcher(group: EmojiGroup) {
    setSelectedGroup(group)

    if(!group) {
      setSelectedGroupStickers([]);
      return;
    }

    if(group._ === 'emojiGroupPremium') {
      const documents = await rootScope.managers.appStickersManager.getPremiumStickers();

      setSelectedGroupStickers(documents);
      return;
    }

    const emoticons = (group as EmojiGroup.emojiGroup).emoticons;
    const documents = await rootScope.managers.appStickersManager.getStickersByEmoticon({emoticon: emoticons, includeServerStickers: true});

    setSelectedGroupStickers(documents);
  }

  function createPackTabs() {
    const scollableInner = (
      <div class="pe-stickers-packs-scrollable-inner">
        <span onClick={() => scrollToSet('recent')}>
          { ButtonIcon('clock_stroked') }
        </span>
        <For each={sets()}>
          {(set) => (
            set.id !== 'recent' && renderTab(set)
          )}
        </For>
      </div>
    )
    const el = (
      <div class="pe-stickers-packs-scrollable">
        { scollableInner }
      </div>
    )

    const scrollable = new ScrollableX(el as HTMLElement);

    return scrollable.container;
  }

  return (
    <div class="pe-settings pe-settings-small-pad">
      <div class="pe-settings__tool pe-stickers">
        <div
          classList={{
            'pe-stickers-packs': true,
            'pe-stickers-packs--collapsed': isSearchPerformed()
          }}
        >
          { createPackTabs() }
        </div>

        <div class="pe-stickers-search">
          {
            EmoticonsSearch({
              type: 'stickers',
              placeholder: 'SearchStickers',
              loading,
              onValue: searchFetcher,
              onGroup: groupFetcher
            })
          }
        </div>

        <div class="pe-stickers-set">
          {
            (selectedGroup() || isSearchPerformed()) ? (
              <div class="pe-stickers-set-item">
                {
                  selectedGroup() && (
                    <div class="pe-settings__section-header">
                      {selectedGroup().title}
                    </div>
                  )
                }
                {
                  selectedGroupStickers().length ? (
                    <div class="pe-stickers-grid">
                      <For each={selectedGroupStickers()}>
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
                  ) : (
                      isLoading() === false && (
                        <div class="pe-stickers-nothing-found">
                          { i18n('NoStickersFound') }
                        </div>
                      )
                  )
                }
              </div>
            ) : (
              <For each={sets()}>
                {(set) => (
                  <div class="pe-stickers-set-item" data-id={set.id}>
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
            )
          }
        </div>
      </div>
    </div>
  );
}
