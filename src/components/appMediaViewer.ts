import { deferredPromise } from "../helpers/cancellablePromise";
import mediaSizes from "../helpers/mediaSizes";
import { isTouchSupported } from "../helpers/touchSupport";
import { isSafari } from "../helpers/userAgent";
import appDocsManager, { MyDocument } from "../lib/appManagers/appDocsManager";
import appImManager from "../lib/appManagers/appImManager";
import appMessagesManager from "../lib/appManagers/appMessagesManager";
import appPeersManager from "../lib/appManagers/appPeersManager";
import appPhotosManager from "../lib/appManagers/appPhotosManager";
import { logger } from "../lib/logger";
import VideoPlayer from "../lib/mediaPlayer";
import { RichTextProcessor } from "../lib/richtextprocessor";
import rootScope from "../lib/rootScope";
import { cancelEvent, fillPropertyValue, findUpClassName, generatePathData } from "../helpers/dom";
import animationIntersector from "./animationIntersector";
import appMediaPlaybackController from "./appMediaPlaybackController";
import AvatarElement from "./avatar";
import ButtonIcon from "./buttonIcon";
import { ButtonMenuItemOptions } from "./buttonMenu";
import ButtonMenuToggle from "./buttonMenuToggle";
import { LazyLoadQueueBase } from "./lazyLoadQueue";
import { renderImageFromUrl } from "./misc";
import PopupForward from "./popupForward";
import ProgressivePreloader from "./preloader";
import Scrollable from "./scrollable";
import appSidebarRight from "./sidebarRight";
import SwipeHandler from "./swipeHandler";
import { months, ONE_DAY } from "../helpers/date";

// TODO: масштабирование картинок (не SVG) при ресайзе, и правильный возврат на исходную позицию
// TODO: картинки "обрезаются" если возвращаются или появляются с места, где есть их перекрытие (топбар, поле ввода)
// TODO: видео в мобильной вёрстке, если показываются элементы управления: если свайпнуть в сторону, то элементы вернутся на место, т.е. прыгнут - это не ок, надо бы замаскировать

const MEDIA_VIEWER_CLASSNAME = 'media-viewer';

class AppMediaViewerBase<ContentAdditionType extends string, ButtonsAdditionType extends string, TargetType extends object> {
  public wholeDiv: HTMLElement;
  protected overlaysDiv: HTMLElement;
  protected author: {[k in 'container' | 'avatarEl' | 'nameEl' | 'date']: HTMLElement} = {} as any;
  protected content: {[k in 'main' | 'container' | 'media' | 'mover' | ContentAdditionType]: HTMLElement} = {} as any;
  public buttons: {[k in 'download' | 'close' | 'prev' | 'next' | 'mobile-close' | ButtonsAdditionType]: HTMLElement} = {} as any;
  
  protected tempId = 0;
  protected preloader: ProgressivePreloader = null;
  protected preloaderStreamable: ProgressivePreloader = null;

  protected lastTarget: HTMLElement = null;
  protected prevTargets: TargetType[] = [];
  protected nextTargets: TargetType[] = [];
  //protected targetContainer: HTMLElement = null;
  //protected loadMore: () => void = null;

  public log: ReturnType<typeof logger>; 

  protected isFirstOpen = true;
  protected loadMediaPromiseUp: Promise<void> = null;
  protected loadMediaPromiseDown: Promise<void> = null;
  protected loadedAllMediaUp = false;
  protected loadedAllMediaDown = false;

  protected reverse = false; // reverse means next = higher msgid
  protected needLoadMore = true;

  protected pageEl = document.getElementById('page-chats') as HTMLDivElement;

  protected setMoverPromise: Promise<void>;
  protected setMoverAnimationPromise: Promise<void>;

  protected lazyLoadQueue: LazyLoadQueueBase;

  protected highlightSwitchersTimeout: number;

  protected onDownloadClick: (e: MouseEvent) => void;
  protected onPrevClick: (target: TargetType) => void;
  protected onNextClick: (target: TargetType) => void;
  protected loadMoreMedia: (older: boolean) => Promise<void>;
  
  constructor(topButtons: Array<keyof AppMediaViewerBase<ContentAdditionType, ButtonsAdditionType, TargetType>['buttons']>) {
    this.log = logger('AMV');
    this.preloader = new ProgressivePreloader();
    this.preloaderStreamable = new ProgressivePreloader(undefined, false, true);
    this.lazyLoadQueue = new LazyLoadQueueBase();

    this.wholeDiv = document.createElement('div');
    this.wholeDiv.classList.add(MEDIA_VIEWER_CLASSNAME + '-whole');

    this.overlaysDiv = document.createElement('div');
    this.overlaysDiv.classList.add('overlays');

    const mainDiv = document.createElement('div');
    mainDiv.classList.add(MEDIA_VIEWER_CLASSNAME);

    // * author
    this.author.container = document.createElement('div');
    this.author.container.classList.add(MEDIA_VIEWER_CLASSNAME + '-author', 'no-select');

    this.author.avatarEl = new AvatarElement();
    this.author.avatarEl.classList.add(MEDIA_VIEWER_CLASSNAME + '-userpic', 'avatar-44');

    this.author.nameEl = document.createElement('div');
    this.author.nameEl.classList.add(MEDIA_VIEWER_CLASSNAME + '-name');

    this.author.date = document.createElement('div');
    this.author.date.classList.add(MEDIA_VIEWER_CLASSNAME + '-date');

    this.author.container.append(this.author.avatarEl, this.author.nameEl, this.author.date);

    // * buttons
    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add(MEDIA_VIEWER_CLASSNAME + '-buttons');

    topButtons.concat(['download', 'close']).forEach(name => {
      const button = ButtonIcon(name);
      this.buttons[name] = button;
      buttonsDiv.append(button);
    });

    // * content
    this.content.main = document.createElement('div');
    this.content.main.classList.add(MEDIA_VIEWER_CLASSNAME + '-content');

    this.content.container = document.createElement('div');
    this.content.container.classList.add(MEDIA_VIEWER_CLASSNAME + '-container');

    this.content.media = document.createElement('div');
    this.content.media.classList.add(MEDIA_VIEWER_CLASSNAME + '-media');

    this.content.container.append(this.content.media);

    this.content.main.append(this.content.container);
    mainDiv.append(this.author.container, buttonsDiv, this.content.main);
    this.overlaysDiv.append(mainDiv);
    // * overlays end

    this.buttons["mobile-close"] = ButtonIcon('close', {onlyMobile: true});

    this.buttons.prev = document.createElement('div');
    this.buttons.prev.className = `${MEDIA_VIEWER_CLASSNAME}-switcher ${MEDIA_VIEWER_CLASSNAME}-switcher-left`;
    this.buttons.prev.innerHTML = `<span class="tgico-down ${MEDIA_VIEWER_CLASSNAME}-prev-button"></span>`;

    this.buttons.next = document.createElement('div');
    this.buttons.next.className = `${MEDIA_VIEWER_CLASSNAME}-switcher ${MEDIA_VIEWER_CLASSNAME}-switcher-right`;
    this.buttons.next.innerHTML = `<span class="tgico-down ${MEDIA_VIEWER_CLASSNAME}-next-button"></span>`;

    this.wholeDiv.append(this.overlaysDiv, this.buttons['mobile-close'], this.buttons.prev, this.buttons.next);

    // * constructing html end
    
    this.setNewMover();
  }

  protected setListeners() {
    this.buttons.download.addEventListener('click', this.onDownloadClick);
    [this.buttons.close, this.buttons["mobile-close"], this.preloaderStreamable.preloader].forEach(el => {
      el.addEventListener('click', this.close.bind(this));
    });

    this.buttons.prev.addEventListener('click', (e) => {
      cancelEvent(e);
      if(this.setMoverPromise) return;

      const target = this.prevTargets.pop();
      if(target) {
        this.onPrevClick(target);
      } else {
        this.buttons.prev.style.display = 'none';
      }
    });
    
    this.buttons.next.addEventListener('click', (e) => {
      cancelEvent(e);
      if(this.setMoverPromise) return;

      let target = this.nextTargets.shift();
      if(target) {
        this.onNextClick(target);
      } else {
        this.buttons.next.style.display = 'none';
      }
    });

    this.wholeDiv.addEventListener('click', this.onClick);

    if(isTouchSupported) {
      const swipeHandler = new SwipeHandler(this.wholeDiv, (xDiff, yDiff) => {
        if(VideoPlayer.isFullScreen()) {
          return;
        }
        //console.log(xDiff, yDiff);

        const percents = Math.abs(xDiff) / appPhotosManager.windowW;
        if(percents > .2 || xDiff > 125) {
          //console.log('will swipe', xDiff);

          if(xDiff < 0) {
            this.buttons.prev.click();
          } else {
            this.buttons.next.click();
          }

          return true;
        }

        const percentsY = Math.abs(yDiff) / appPhotosManager.windowH;
        if(percentsY > .2 || yDiff > 125) {
          this.buttons.close.click();
          return true;
        }

        return false;
      }, (evt) => {
        // * Fix for seek input
        if((evt.target as HTMLElement).tagName == 'INPUT' || findUpClassName(evt.target, 'media-viewer-caption')) {
          return false;
        }

        return true;
      });
    }
  }

  protected setBtnMenuToggle(buttons: ButtonMenuItemOptions[]) {
    const btnMenuToggle = ButtonMenuToggle({onlyMobile: true}, 'bottom-left', buttons);
    this.wholeDiv.append(btnMenuToggle);
  }

  public close(e?: MouseEvent) {
    if(e) {
      cancelEvent(e);
    }

    if(this.setMoverAnimationPromise) return;

    this.lazyLoadQueue.clear();

    const promise = this.setMoverToTarget(this.lastTarget, true).then(({onAnimationEnd}) => onAnimationEnd);

    this.lastTarget = null;
    this.prevTargets = [];
    this.nextTargets = [];
    this.loadedAllMediaUp = this.loadedAllMediaDown = false;
    this.loadMediaPromiseUp = this.loadMediaPromiseDown = null;
    this.setMoverPromise = null;
    this.tempId = -1;

    /* if(appSidebarRight.historyTabIDs.slice(-1)[0] == AppSidebarRight.SLIDERITEMSIDS.forward) {
      promise.then(() => {
        appSidebarRight.forwardTab.closeBtn.click();
      });
    } */

    window.removeEventListener('keydown', this.onKeyDown);

    promise.finally(() => {
      this.wholeDiv.remove();
      rootScope.overlayIsActive = false;
      animationIntersector.checkAnimations(false);
    });

    return promise;
  }

  onClick = (e: MouseEvent) => {
    if(this.setMoverAnimationPromise) return;

    const target = e.target as HTMLElement;
    if(target.tagName == 'A') return;
    cancelEvent(e);

    if(isTouchSupported) {
      if(this.highlightSwitchersTimeout) {
        clearTimeout(this.highlightSwitchersTimeout);
      } else {
        this.wholeDiv.classList.add('highlight-switchers');
      }

      this.highlightSwitchersTimeout = window.setTimeout(() => {
        this.wholeDiv.classList.remove('highlight-switchers');
        this.highlightSwitchersTimeout = 0;
      }, 3e3);
      
      return;
    }

    let mover: HTMLElement = null;
    ['media-viewer-mover', 'media-viewer-buttons', 'media-viewer-author', 'media-viewer-caption'].find(s => {
      try {
        mover = findUpClassName(target, s);
        if(mover) return true;
      } catch(err) {return false;}
    });

    if(/* target == this.mediaViewerDiv */!mover || target.tagName == 'IMG' || target.tagName == 'image') {
      this.buttons.close.click();
    }
  };

  onKeyDown = (e: KeyboardEvent) => {
    //this.log('onKeyDown', e);
    
    if(e.key == 'Escape') {
      this.close();
    } else if(e.key == 'ArrowRight') {
      this.buttons.next.click();
    } else if(e.key == 'ArrowLeft') {
      this.buttons.prev.click();
    }
  };

  protected async setMoverToTarget(target: HTMLElement, closing = false, fromRight = 0) {
    const mover = this.content.mover;

    if(!target) {
      target = this.content.media;
    }

    if(!closing) {
      mover.innerHTML = '';
      //mover.append(this.buttons.prev, this.buttons.next);
    }
    
    this.removeCenterFromMover(mover);

    const wasActive = fromRight !== 0;

    const delay = wasActive ? 350 : 200;
    //let delay = wasActive ? 350 : 10000;

    /* if(wasActive) {
      this.moveTheMover(mover);
      mover = this.setNewMover();
    } */

    this.log('setMoverToTarget', target, closing, wasActive, fromRight);

    let realParent: HTMLElement;

    let rect: DOMRect;
    if(target) {
      if(target instanceof AvatarElement) {
        realParent = target;
        rect = target.getBoundingClientRect();
      } else if(target instanceof SVGImageElement || target.parentElement instanceof SVGForeignObjectElement) {
        realParent = findUpClassName(target, 'attachment');
        rect = realParent.getBoundingClientRect();
      } else {
        realParent = target.parentElement as HTMLElement;
        rect = target.getBoundingClientRect();
      }
    }

    const containerRect = this.content.media.getBoundingClientRect();
    
    let transform = '';
    let left: number;
    let top: number;

    if(wasActive) {
      left = fromRight === 1 ? appPhotosManager.windowW : -containerRect.width;
      top = containerRect.top;
    } else {
      left = rect.left;
      top = rect.top;
    }

    transform += `translate3d(${left}px,${top}px,0) `;

    /* if(wasActive) {
      left = fromRight === 1 ? appPhotosManager.windowW / 2 : -(containerRect.width + appPhotosManager.windowW / 2);
      transform += `translate(${left}px,-50%) `;
    } else {
      left = rect.left - (appPhotosManager.windowW / 2);
      top = rect.top - (appPhotosManager.windowH / 2);
      transform += `translate(${left}px,${top}px) `;
    } */

    let aspecter: HTMLDivElement;
    if(target instanceof HTMLImageElement || target instanceof HTMLVideoElement || target.tagName == 'DIV') {
      if(mover.firstElementChild && mover.firstElementChild.classList.contains('media-viewer-aspecter')) {
        aspecter = mover.firstElementChild as HTMLDivElement;

        const player = aspecter.querySelector('.ckin__player');
        if(player) {
          const video = player.firstElementChild as HTMLVideoElement;
          aspecter.append(video);
          player.remove();
        }

        if(!aspecter.style.cssText) { // всё из-за видео, элементы управления скейлятся, так бы можно было этого не делать
          mover.classList.remove('active');
          this.setFullAspect(aspecter, containerRect, rect);
          void mover.offsetLeft; // reflow
          mover.classList.add('active');
        }
      } else {
        aspecter = document.createElement('div');
        aspecter.classList.add('media-viewer-aspecter'/* , 'disable-hover' */);
        mover.prepend(aspecter);
      }
      
      aspecter.style.cssText = `width: ${rect.width}px; height: ${rect.height}px; transform: scale3d(${containerRect.width / rect.width}, ${containerRect.height / rect.height}, 1);`;
    }

    mover.style.width = containerRect.width + 'px';
    mover.style.height = containerRect.height + 'px';

    const scaleX = rect.width / containerRect.width;
    const scaleY = rect.height / containerRect.height;
    if(!wasActive) {
      transform += `scale3d(${scaleX},${scaleY},1) `;
    }

    let borderRadius = window.getComputedStyle(realParent).getPropertyValue('border-radius');
    const brSplitted = fillPropertyValue(borderRadius) as string[];
    borderRadius = brSplitted.map(r => (parseInt(r) / scaleX) + 'px').join(' ');
    if(!wasActive) {
      mover.style.borderRadius = borderRadius;
    }
    //let borderRadius = '0px 0px 0px 0px';

    mover.style.transform = transform;

    /* if(wasActive) {
      this.log('setMoverToTarget', mover.style.transform);
    } */

    let path: SVGPathElement;
    const isOut = target.classList.contains('is-out');

    const deferred = this.setMoverAnimationPromise = deferredPromise<void>();
    const ret = {onAnimationEnd: deferred};

    this.setMoverAnimationPromise.then(() => {
      this.setMoverAnimationPromise = null;
    });

    if(!closing) {
      let mediaElement: HTMLImageElement | HTMLVideoElement;
      let src: string;

      if(target.tagName == 'DIV' || target.tagName == 'AVATAR-ELEMENT') { // useContainerAsTarget
        if(target.firstElementChild) {
          mediaElement = new Image();
          src = (target.firstElementChild as HTMLImageElement).src;
          mover.append(mediaElement);
        }
        /* mediaElement = new Image();
        src = target.style.backgroundImage.slice(5, -2); */
        
      } else if(target instanceof HTMLImageElement) {
        mediaElement = new Image();
        src = target.src;
      } else if(target instanceof HTMLVideoElement) {
        const video = mediaElement = document.createElement('video');
        video.src = target?.src;
      } else if(target instanceof SVGSVGElement) {
        const clipId = target.dataset.clipId;
        const newClipId = clipId + '-mv';

        const {width, height} = containerRect;

        const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        newSvg.setAttributeNS(null, 'width', '' + width);
        newSvg.setAttributeNS(null, 'height', '' + height);

        // нижние два свойства для масштабирования
        newSvg.setAttributeNS(null, 'viewBox', `0 0 ${width} ${height}`);
        newSvg.setAttributeNS(null, 'preserveAspectRatio', 'xMidYMid meet');

        newSvg.insertAdjacentHTML('beforeend', target.firstElementChild.outerHTML.replace(clipId, newClipId));
        newSvg.insertAdjacentHTML('beforeend', target.lastElementChild.outerHTML.replace(clipId, newClipId));

        // теперь надо выставить новую позицию для хвостика
        const defs = newSvg.firstElementChild;
        const use = defs.firstElementChild.firstElementChild as SVGUseElement;
        if(use instanceof SVGUseElement) {
          let transform = use.getAttributeNS(null, 'transform');
          transform = transform.replace(/translate\((.+?), (.+?)\) scale\((.+?), (.+?)\)/, (match, x, y, sX, sY) => {
            x = +x;
            if(x != 2) {
              x = width - (2 / scaleX);
            } else {
              x = 2 / scaleX;
            }
            
            y = height;
  
            return `translate(${x}, ${y}) scale(${+sX / scaleX}, ${+sY / scaleY})`;
          });
          use.setAttributeNS(null, 'transform', transform);
  
          // и новый RECT
          path = defs.firstElementChild.lastElementChild as SVGPathElement;

          // код ниже нужен только чтобы скрыть моргание до момента как сработает таймаут
          let d: string;
          const br: [number, number, number, number] = borderRadius.split(' ').map(v => parseInt(v)) as any;
          if(isOut) d = generatePathData(0, 0, width - 9 / scaleX, height, ...br);
          else d = generatePathData(9 / scaleX, 0, width - 9 / scaleX, height, ...br);
          path.setAttributeNS(null, 'd', d);
        }

        const foreignObject = newSvg.lastElementChild;
        foreignObject.setAttributeNS(null, 'width', '' + containerRect.width);
        foreignObject.setAttributeNS(null, 'height', '' + containerRect.height);
        
        mover.prepend(newSvg);
      }

      if(aspecter) {
        aspecter.style.borderRadius = borderRadius;

        if(mediaElement) {
          aspecter.append(mediaElement);
        }
      }

      mediaElement = mover.querySelector('video, img');
      if(mediaElement instanceof HTMLImageElement) {
        mediaElement.classList.add('thumbnail');
        if(!aspecter) {
          mediaElement.style.width = containerRect.width + 'px';
          mediaElement.style.height = containerRect.height + 'px';
        }

        if(src) {
          await new Promise((resolve, reject) => {
            mediaElement.addEventListener('load', resolve);
  
            if(src) {
              mediaElement.src = src;
            }
          });
        }
      }/*  else if(mediaElement instanceof HTMLVideoElement && mediaElement.firstElementChild && ((mediaElement.firstElementChild as HTMLSourceElement).src || src)) {
        await new Promise((resolve, reject) => {
          mediaElement.addEventListener('loadeddata', resolve);

          if(src) {
            (mediaElement.firstElementChild as HTMLSourceElement).src = src;
          }
        });
      } */
  
      mover.style.display = '';

      window.requestAnimationFrame(() => {
        mover.classList.add(wasActive ? 'moving' : 'active');
      });
    } else {
      /* if(mover.classList.contains('center')) {
        mover.classList.remove('center');
        void mover.offsetLeft; // reflow
      } */
      
      if(target instanceof SVGSVGElement) {
        path = mover.querySelector('path');

        if(path) {
          this.sizeTailPath(path, containerRect, scaleX, delay, false, isOut, borderRadius);
        }
      }

      if(target.classList.contains('media-viewer-media')) {
        mover.classList.add('hiding');
      }

      setTimeout(() => {
        this.wholeDiv.classList.remove('active');
      }, 0);

      setTimeout(() => {
        mover.style.borderRadius = borderRadius;

        if(mover.firstElementChild) {
          (mover.firstElementChild as HTMLElement).style.borderRadius = borderRadius;
        }
      }, delay / 2);

      setTimeout(() => {
        mover.innerHTML = '';
        mover.classList.remove('moving', 'active', 'hiding');
        mover.style.cssText = 'display: none;';

        deferred.resolve();
      }, delay);

      return ret;
    }

    //await new Promise((resolve) => setTimeout(resolve, 0));
    //await new Promise((resolve) => window.requestAnimationFrame(resolve));
    // * одного RAF'а недостаточно, иногда анимация с одним не срабатывает (преимущественно на мобильных)
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    // чтобы проверить установленную позицию - раскомментировать
    // throw '';

    //await new Promise((resolve) => setTimeout(resolve, 5e3));

    mover.style.transform = `translate3d(${containerRect.left}px,${containerRect.top}px,0) scale3d(1,1,1)`;
    //mover.style.transform = `translate(-50%,-50%) scale(1,1)`;

    if(aspecter) {
      this.setFullAspect(aspecter, containerRect, rect);
    }

    //throw '';

    setTimeout(() => {
      mover.style.borderRadius = '';

      if(mover.firstElementChild) {
        (mover.firstElementChild as HTMLElement).style.borderRadius = '';
      }
    }, 0/* delay / 2 */);

    mover.dataset.timeout = '' + setTimeout(() => {
      mover.classList.remove('moving');

      if(aspecter) { // всё из-за видео, элементы управления скейлятся, так бы можно было этого не делать
        if(mover.querySelector('video') || true) {
          mover.classList.remove('active');
          aspecter.style.cssText = '';
          void mover.offsetLeft; // reflow
        }
        
        //aspecter.classList.remove('disable-hover');
      }

      // эти строки нужны для установки центральной позиции, в случае ресайза это будет нужно
      mover.classList.add('center', 'no-transition');
      /* mover.style.left = mover.style.top = '50%';
      mover.style.transform = 'translate(-50%, -50%)';
      void mover.offsetLeft; // reflow */

      // это уже нужно для будущих анимаций
      mover.classList.add('active');
      delete mover.dataset.timeout;

      deferred.resolve();
    }, delay);

    if(path) {
      this.sizeTailPath(path, containerRect, scaleX, delay, true, isOut, borderRadius);
    }

    return ret;
  }

  protected setFullAspect(aspecter: HTMLDivElement, containerRect: DOMRect, rect: DOMRect) {
    /* let media = aspecter.firstElementChild;
    let proportion: number;
    if(media instanceof HTMLImageElement) {
      proportion = media.naturalWidth / media.naturalHeight;
    } else if(media instanceof HTMLVideoElement) {
      proportion = media.videoWidth / media.videoHeight;
    } */
    const proportion = containerRect.width / containerRect.height;

    let {width, height} = rect;
    /* if(proportion == 1) {
      aspecter.style.cssText = '';
    } else { */
      if(proportion > 0) {
        width = height * proportion;
      } else {
        height = width * proportion;
      }

      //this.log('will set style aspecter:', `width: ${width}px; height: ${height}px; transform: scale(${containerRect.width / width}, ${containerRect.height / height});`);

      aspecter.style.cssText = `width: ${width}px; height: ${height}px; transform: scale3d(${containerRect.width / width}, ${containerRect.height / height}, 1);`;
    //}
  }

  protected sizeTailPath(path: SVGPathElement, rect: DOMRect, scaleX: number, delay: number, upscale: boolean, isOut: boolean, borderRadius: string) {
    const start = Date.now();
    const {width, height} = rect;
    delay = delay / 2;

    const br = borderRadius.split(' ').map(v => parseInt(v));

    const step = () => {
      const diff = Date.now() - start;

      let progress = diff / delay;
      if(progress > 1) progress = 1;
      if(upscale) progress = 1 - progress;

      const _br: [number, number, number, number] = br.map(v => v * progress) as any;

      let d: string;
      if(isOut) d = generatePathData(0, 0, width - (9 / scaleX * progress), height, ..._br);
      else d = generatePathData(9 / scaleX * progress, 0, width/* width - (9 / scaleX * progress) */, height, ..._br);
      path.setAttributeNS(null, 'd', d);

      if(diff < delay) window.requestAnimationFrame(step);
    };
    
    //window.requestAnimationFrame(step);
    step();
  }

  protected removeCenterFromMover(mover: HTMLElement) {
    if(mover.classList.contains('center')) {
      //const rect = mover.getBoundingClientRect();
      const rect = this.content.media.getBoundingClientRect();
      mover.style.transform = `translate3d(${rect.left}px,${rect.top}px,0)`;
      mover.classList.remove('center');
      void mover.offsetLeft; // reflow
      mover.classList.remove('no-transition');
    }
  }

  protected moveTheMover(mover: HTMLElement, toLeft = true) {
    const windowW = appPhotosManager.windowW;

    this.removeCenterFromMover(mover);

    //mover.classList.remove('active');
    mover.classList.add('moving');

    if(mover.dataset.timeout) { // и это тоже всё из-за скейла видео, так бы это не нужно было
      clearTimeout(+mover.dataset.timeout);
    }

    const rect = mover.getBoundingClientRect();

    const newTransform = mover.style.transform.replace(/translate3d\((.+?),/, (match, p1) => {
      const x = toLeft ? -rect.width : windowW;
      //const x = toLeft ? -(rect.right + (rect.width / 2)) : windowW / 2;

      return match.replace(p1, x + 'px');
    });

    ////////this.log('set newTransform:', newTransform, mover.style.transform, toLeft);
    mover.style.transform = newTransform;

    setTimeout(() => {
      mover.remove();
    }, 350);
  }

  protected setNewMover() {
    const newMover = document.createElement('div');
    newMover.classList.add('media-viewer-mover');

    if(this.content.mover) {
      const oldMover = this.content.mover;
      oldMover.parentElement.append(newMover);
    } else {
      this.wholeDiv.append(newMover);
    }

    return this.content.mover = newMover;
  }

  /* public isElementVisible(container: HTMLElement, target: HTMLElement) {
    const rect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    return targetRect.bottom > rect.top && targetRect.top < rect.bottom;
  } */

  protected updateMediaSource(target: HTMLElement, url: string, tagName: 'video' | 'img') {
    //if(target instanceof SVGSVGElement) {
      const el = target.querySelector(tagName) as HTMLElement;
      renderImageFromUrl(el, url);
    /* } else {

    } */
  }

  protected setAuthorInfo(fromId: number, timestamp: number) {
    const date = new Date();
    const time = new Date(timestamp * 1000);
    const now = date.getTime() / 1000;

    const timeStr = time.getHours() + ':' + ('0' + time.getMinutes()).slice(-2);
    let dateStr: string;
    if((now - timestamp) < ONE_DAY && date.getDate() == time.getDate()) { // if the same day
      dateStr = 'Today';
    } else if((now - timestamp) < (ONE_DAY * 2) && (date.getDate() - 1) == time.getDate()) { // yesterday
      dateStr = 'Yesterday';
    } else if(date.getFullYear() != time.getFullYear()) { // different year
      dateStr = months[time.getMonth()].slice(0, 3) + ' ' + time.getDate() + ', ' + time.getFullYear();
    } else {
      dateStr = months[time.getMonth()].slice(0, 3) + ' ' + time.getDate();
    }

    this.author.date.innerText = dateStr + ' at ' + timeStr;

    const name = appPeersManager.getPeerTitle(fromId);
    this.author.nameEl.innerHTML = name;

    let oldAvatar = this.author.avatarEl;
    this.author.avatarEl = (this.author.avatarEl.cloneNode() as AvatarElement);
    this.author.avatarEl.setAttribute('peer', '' + fromId);
    oldAvatar.parentElement.replaceChild(this.author.avatarEl, oldAvatar);
  }
  
  protected async _openMedia(media: any, timestamp: number, fromId: number, fromRight: number, target?: HTMLElement, reverse = false, 
    prevTargets: TargetType[] = [], nextTargets: TargetType[] = [], needLoadMore = true) {
    if(this.setMoverPromise) return this.setMoverPromise;

    this.log('openMedia:', media, fromId);

    this.setAuthorInfo(fromId, timestamp);
    
    const isVideo = (media as MyDocument).type == 'video' || (media as MyDocument).type == 'gif';

    if(this.isFirstOpen) {
      //this.targetContainer = targetContainer;
      this.prevTargets = prevTargets;
      this.nextTargets = nextTargets;
      this.reverse = reverse;
      this.needLoadMore = needLoadMore;
      this.isFirstOpen = false;
      //this.loadMore = loadMore;

      /* if(appSidebarRight.historyTabIDs.slice(-1)[0] == AppSidebarRight.SLIDERITEMSIDS.forward) {
        appSidebarRight.forwardTab.closeBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 200));
      } */
    }

    /* if(this.nextTargets.length < 10 && this.loadMore) {
      this.loadMore();
    } */

    //if(prevTarget && (!prevTarget.parentElement || !this.isElementVisible(this.targetContainer, prevTarget))) prevTarget = null;
    //if(nextTarget && (!nextTarget.parentElement || !this.isElementVisible(this.targetContainer, nextTarget))) nextTarget = null;

    this.buttons.prev.classList.toggle('hide', !this.prevTargets.length);
    this.buttons.next.classList.toggle('hide', !this.nextTargets.length);
    
    const container = this.content.media;
    const useContainerAsTarget = !target;
    if(useContainerAsTarget) target = container;

    this.lastTarget = target;
    const tempId = ++this.tempId;

    if(this.needLoadMore) {
      if(this.nextTargets.length < 20) {
        this.loadMoreMedia(!this.reverse);
      }
  
      if(this.prevTargets.length < 20) {
        this.loadMoreMedia(this.reverse);
      }
    }
    
    if(container.firstElementChild) {
      container.innerHTML = '';
    }
    
    // ok set

    const wasActive = fromRight !== 0;
    if(wasActive) {
      this.moveTheMover(this.content.mover, fromRight === 1);
      this.setNewMover();
    } else {
      window.addEventListener('keydown', this.onKeyDown);
      const mainColumns = this.pageEl.querySelector('#main-columns');
      this.pageEl.insertBefore(this.wholeDiv, mainColumns);
      void this.wholeDiv.offsetLeft; // reflow
      this.wholeDiv.classList.add('active');
      rootScope.overlayIsActive = true;
      animationIntersector.checkAnimations(true);
    }

    ////////this.log('wasActive:', wasActive);

    const mover = this.content.mover;

    //const maxWidth = appPhotosManager.windowW - 16;
    const maxWidth = mediaSizes.isMobile ? this.pageEl.scrollWidth : this.pageEl.scrollWidth - 16;
    const maxHeight = appPhotosManager.windowH - 100;
    const size = appPhotosManager.setAttachmentSize(media, container, maxWidth, maxHeight);

    // need after setAttachmentSize
    /* if(useContainerAsTarget) {
      target = target.querySelector('img, video') || target;
    } */

    const preloader = media.supportsStreaming ? this.preloaderStreamable : this.preloader;

    let setMoverPromise: Promise<void>;
    if(isVideo) {
      ////////this.log('will wrap video', media, size);

      // потому что для safari нужно создать элемент из event'а
      const video = document.createElement('video');

      setMoverPromise = this.setMoverToTarget(target, false, fromRight).then(({onAnimationEnd}) => {
      //return; // set and don't move
      //if(wasActive) return;
        //return;

        const div = mover.firstElementChild && mover.firstElementChild.classList.contains('media-viewer-aspecter') ? mover.firstElementChild : mover;
        //const video = mover.querySelector('video') || document.createElement('video');

        const moverVideo = mover.querySelector('video');
        if(moverVideo) {
          moverVideo.remove();
        }

        //video.src = '';

        video.setAttribute('playsinline', 'true');

        // * fix for playing video if viewer is closed (https://contest.com/javascript-web-bonus/entry1425#issue11629)
        video.addEventListener('timeupdate', () => {
          if(this.tempId != tempId) {
            video.pause();
          }
        });

        if(isSafari) {
          // test stream
          // video.controls = true;
          video.autoplay = true;
        }

        if(media.type == 'gif') {
          video.muted = true;
          video.autoplay = true;
          video.loop = true;
        }

        if(!video.parentElement) {
          div.append(video);
        }

        const canPlayThrough = new Promise((resolve) => {
          video.addEventListener('canplay', resolve, {once: true});
        });

        const createPlayer = () => {
          if(media.type != 'gif') {
            video.dataset.ckin = 'default';
            video.dataset.overlay = '1';

            // fix for simultaneous play
            appMediaPlaybackController.pause();
            appMediaPlaybackController.willBePlayedMedia = null;
            
            Promise.all([canPlayThrough, onAnimationEnd]).then(() => {
              if(this.tempId != tempId) {
                return;
              }

              const player = new VideoPlayer(video, true, media.supportsStreaming);
              /* div.append(video);
              mover.append(player.wrapper); */
            });
          }
        };

        if(media.supportsStreaming) {
          onAnimationEnd.then(() => {
            if(video.readyState < video.HAVE_FUTURE_DATA) {
              preloader.attach(mover, true);
            }

            /* canPlayThrough.then(() => {
              preloader.detach();
            }); */
          });

          const attachCanPlay = () => {
            video.addEventListener('canplay', () => {
              //this.log('video waited and progress loaded');
              preloader.detach();
              video.parentElement.classList.remove('is-buffering');
            }, {once: true});
          };

          video.addEventListener('waiting', (e) => {
            const loading = video.networkState === video.NETWORK_LOADING;
            const isntEnoughData = video.readyState < video.HAVE_FUTURE_DATA;

            //this.log('video waiting for progress', loading, isntEnoughData);
            if(loading && isntEnoughData) {
              attachCanPlay();

              preloader.attach(mover, true);

              // поставлю класс для плеера, чтобы убрать большую иконку пока прелоадер на месте
              video.parentElement.classList.add('is-buffering');
            }
          });

          attachCanPlay();
        }
        
        //if(!video.src || media.url != video.src) {
          const load = () => {
            const promise = media.supportsStreaming ? Promise.resolve() : appDocsManager.downloadDoc(media);
            
            if(!media.supportsStreaming) {
              onAnimationEnd.then(() => {
                preloader.attach(mover, true, promise);
              });
            }

            (promise as Promise<any>).then(async() => {
              if(this.tempId != tempId) {
                this.log.warn('media viewer changed video');
                return;
              }

              const url = media.url;
              if(target instanceof SVGSVGElement/*  && (video.parentElement || !isSafari) */) { // if video exists
                //if(!video.parentElement) {
                  div.firstElementChild.lastElementChild.append(video);
                //}
                
                this.updateMediaSource(mover, url, 'video');
              } else {
                renderImageFromUrl(video, url);
              }

              createPlayer();
            });

            return promise;
          };

          this.lazyLoadQueue.unshift({load});
        //} else createPlayer();
      });
    } else {
      setMoverPromise = this.setMoverToTarget(target, false, fromRight).then(({onAnimationEnd}) => {
      //return; // set and don't move
      //if(wasActive) return;
        //return;
        
        const load = () => {
          const cancellablePromise = appPhotosManager.preloadPhoto(media.id, size);
          onAnimationEnd.then(() => {
            this.preloader.attach(mover, true, cancellablePromise);
          });
          cancellablePromise.then(() => {
            if(this.tempId != tempId) {
              this.log.warn('media viewer changed photo');
              return;
            }
            
            ///////this.log('indochina', blob);
  
            const url = media.url;
            if(target instanceof SVGSVGElement) {
              this.updateMediaSource(target, url, 'img');
              this.updateMediaSource(mover, url, 'img');

              if(mediaSizes.isMobile) {
                const imgs = mover.querySelectorAll('img');
                if(imgs && imgs.length) {
                  imgs.forEach(img => {
                    img.classList.remove('thumbnail'); // может здесь это вообще не нужно
                  });
                }
              }
            } else {
              const div = mover.firstElementChild && mover.firstElementChild.classList.contains('media-viewer-aspecter') ? mover.firstElementChild : mover;
              let image = div.firstElementChild as HTMLImageElement;
              if(!image || image.tagName != 'IMG') {
                image = new Image();
              }
  
              //this.log('will renderImageFromUrl:', image, div, target);
  
              renderImageFromUrl(image, url, () => {
                if(mediaSizes.isMobile) {
                  image.classList.remove('thumbnail'); // может здесь это вообще не нужно
                }

                div.append(image);
              });
            }
  
            this.preloader.detach();
          }).catch(err => {
            this.log.error(err);
          });

          return cancellablePromise;
        };

        this.lazyLoadQueue.unshift({load});
      });
    }

    return this.setMoverPromise = setMoverPromise.catch(() => {
      this.setMoverAnimationPromise = null;
    }).finally(() => {
      this.setMoverPromise = null;
    });
  }
}

type AppMediaViewerTargetType = {
  element: HTMLElement,
  mid: number
};
export default class AppMediaViewer extends AppMediaViewerBase<'caption', 'delete' | 'forward', AppMediaViewerTargetType> {
  public currentMessageId = 0;
  public peerId: number;

  constructor(private inputFilter: 'inputMessagesFilterPhotoVideo' | 'inputMessagesFilterChatPhotos' = 'inputMessagesFilterPhotoVideo') {
    super(['delete', 'forward']);

    /* const stub = document.createElement('div');
    stub.classList.add(MEDIA_VIEWER_CLASSNAME + '-stub');
    this.content.main.prepend(stub); */

    this.content.caption = document.createElement('div');
    this.content.caption.classList.add(MEDIA_VIEWER_CLASSNAME + '-caption'/* , 'media-viewer-stub' */);

    new Scrollable(this.content.caption);

    //this.content.main.append(this.content.caption);
    this.wholeDiv.append(this.content.caption);

    this.setBtnMenuToggle([{
      icon: 'forward',
      text: 'Forward',
      onClick: this.onForwardClick
    }, {
      icon: 'download',
      text: 'Download',
      onClick: this.onDownloadClick
    }, {
      icon: 'delete danger btn-disabled',
      text: 'Delete',
      onClick: () => {}
    }]);

    // * constructing html end
    
    this.setListeners();
  }

  protected setListeners() {
    super.setListeners();
    this.buttons.forward.addEventListener('click', this.onForwardClick);
    this.author.container.addEventListener('click', this.onAuthorClick);
  }

  /* public close(e?: MouseEvent) {
    const good = !this.setMoverAnimationPromise;
    const promise = super.close(e);

    if(good) { // clear
      this.currentMessageId = 0;
      this.peerId = 0;
    }

    return promise;
  } */

  onPrevClick = (target: AppMediaViewerTargetType) => {
    this.nextTargets.unshift({element: this.lastTarget, mid: this.currentMessageId});
    this.openMedia(appMessagesManager.getMessageByPeer(this.peerId, target.mid), target.element);
  };

  onNextClick = (target: AppMediaViewerTargetType) => {
    this.prevTargets.push({element: this.lastTarget, mid: this.currentMessageId});
    this.openMedia(appMessagesManager.getMessageByPeer(this.peerId, target.mid), target.element);
  };

  onForwardClick = () => {
    if(this.currentMessageId) {
      //appSidebarRight.forwardTab.open([this.currentMessageId]);
      new PopupForward(this.peerId, [this.currentMessageId], () => {
        return this.close();
      });
    }
  };

  onAuthorClick = (e: MouseEvent) => {
    if(this.currentMessageId && this.currentMessageId != Number.MAX_SAFE_INTEGER) {
      const mid = this.currentMessageId;
      this.close(e)
      //.then(() => mediaSizes.isMobile ? appSidebarRight.sharedMediaTab.closeBtn.click() : Promise.resolve())
      .then(() => {
        if(mediaSizes.isMobile) {
          appSidebarRight.sharedMediaTab.closeBtn.click();
        }

        const message = appMessagesManager.getMessageByPeer(this.peerId, mid);
        appImManager.setPeer(message.peerId, mid);
      });
    }
  };

  onDownloadClick = () => {
    const message = appMessagesManager.getMessageByPeer(this.peerId, this.currentMessageId);
    if(message.media.photo) {
      appPhotosManager.savePhotoFile(message.media.photo, appImManager.chat.bubbles.lazyLoadQueue.queueId);
    } else {
      let document: MyDocument = null;

      if(message.media.webpage) document = message.media.webpage.document;
      else document = message.media.document;

      if(document) {
        //console.log('will save document:', document);
        appDocsManager.saveDocFile(document, appImManager.chat.bubbles.lazyLoadQueue.queueId);
      }
    }
  };

  // нет смысла делать проверку для reverse и loadMediaPromise
  protected loadMoreMedia = (older = true) => {
    //if(!older && this.reverse) return;

    if(older && this.loadedAllMediaDown) return Promise.resolve();
    else if(!older && this.loadedAllMediaUp) return Promise.resolve();

    if(older && this.loadMediaPromiseDown) return this.loadMediaPromiseDown;
    else if(!older && this.loadMediaPromiseUp) return this.loadMediaPromiseUp;

    const loadCount = 50;
    const backLimit = older ? 0 : loadCount;
    let maxId = this.currentMessageId;
  
    let anchor: {element: HTMLElement, mid: number};
    if(older) {
      anchor = this.reverse ? this.prevTargets[0] : this.nextTargets[this.nextTargets.length - 1];
    } else {
      anchor = this.reverse ? this.nextTargets[this.nextTargets.length - 1] : this.prevTargets[0];
    }

    if(anchor) maxId = anchor.mid;
    if(!older) maxId += 1;

    const peerId = this.peerId;

    const promise = appMessagesManager.getSearch(peerId, '', 
      {_: this.inputFilter}, maxId, backLimit ? 0 : loadCount/* older ? loadCount : 0 */, 0, backLimit).then(value => {
      if(this.peerId != peerId) {
        this.log.warn('peer changed');
        return;
      }

      this.log('loaded more media by maxId:', maxId, value, older, this.reverse);

      if(value.history.length < loadCount) {
        /* if(this.reverse) {
          if(older) this.loadedAllMediaUp = true;
          else this.loadedAllMediaDown = true;
        } else { */
          if(older) this.loadedAllMediaDown = true;
          else this.loadedAllMediaUp = true;
        //}
      }

      const method = older ? value.history.forEach : value.history.forEachReverse;
      method.call(value.history, mid => {
        const message = appMessagesManager.getMessageByPeer(this.peerId, mid);
        const media = this.getMediaFromMessage(message);

        if(!media) return;
        //if(media._ == 'document' && media.type != 'video') return;

        const t = {element: null as HTMLElement, mid: mid};
        if(older) {
          if(this.reverse) this.prevTargets.unshift(t);
          else this.nextTargets.push(t);
        } else {
          if(this.reverse) this.nextTargets.push(t);
          else this.prevTargets.unshift(t);
        }
      });

      this.buttons.prev.classList.toggle('hide', !this.prevTargets.length);
      this.buttons.next.classList.toggle('hide', !this.nextTargets.length);
    }, () => {}).then(() => {
      if(older) this.loadMediaPromiseDown = null;
      else this.loadMediaPromiseUp = null;
    });

    if(older) this.loadMediaPromiseDown = promise;
    else this.loadMediaPromiseUp = promise;

    return promise;
  };

  private getMediaFromMessage(message: any) {
    return message.action ? message.action.photo : message.media.photo 
      || message.media.document 
      || (message.media.webpage && (message.media.webpage.document || message.media.webpage.photo));
  }

  private setCaption(message: any) {
    const caption = message.message;
    this.content.caption.classList.toggle('hide', !caption);
    if(caption) {
      this.content.caption.firstElementChild.innerHTML = RichTextProcessor.wrapRichText(caption, {
        entities: message.totalEntities
      });
    } else {
      this.content.caption.firstElementChild.innerHTML = '';
    }
  }

  public async openMedia(message: any, target?: HTMLElement, reverse = false, 
    prevTargets: AppMediaViewer['prevTargets'] = [], nextTargets: AppMediaViewer['prevTargets'] = [], needLoadMore = true) {
    if(this.setMoverPromise) return this.setMoverPromise;

    const mid = message.mid;
    const fromId = message.fromId;
    const media = this.getMediaFromMessage(message);

    let fromRight = 0;
    if(!this.isFirstOpen) {
      //if(this.lastTarget === prevTarget) {
      if(this.reverse) fromRight = this.currentMessageId < mid ? 1 : -1;
      else fromRight = this.currentMessageId > mid ? 1 : -1;
    } else {
      this.reverse = reverse;
      this.peerId = message.peerId;
    }

    this.currentMessageId = mid;
    const promise = super._openMedia(media, message.date, fromId, fromRight, target, reverse, prevTargets, nextTargets, needLoadMore);
    this.setCaption(message);

    return promise;
  }
}

type AppMediaViewerAvatarTargetType = {element: HTMLElement, photoId: string};
export class AppMediaViewerAvatar extends AppMediaViewerBase<'', 'delete', AppMediaViewerAvatarTargetType> {
  public currentPhotoId: string;
  public peerId: number;

  constructor(peerId: number) {
    super(['delete']);

    this.peerId = peerId;

    this.setBtnMenuToggle([{
      icon: 'download',
      text: 'Download',
      onClick: this.onDownloadClick
    }, {
      icon: 'delete danger btn-disabled',
      text: 'Delete',
      onClick: () => {}
    }]);

    // * constructing html end
    
    this.setListeners();
  }

  onPrevClick = (target: AppMediaViewerAvatarTargetType) => {
    this.nextTargets.unshift({element: this.lastTarget, photoId: this.currentPhotoId});
    this.openMedia(target.photoId, target.element, -1);
  };

  onNextClick = (target: AppMediaViewerAvatarTargetType) => {
    this.prevTargets.push({element: this.lastTarget, photoId: this.currentPhotoId});
    this.openMedia(target.photoId, target.element, 1);
  };

  onDownloadClick = () => {
    appPhotosManager.savePhotoFile(appPhotosManager.getPhoto(this.currentPhotoId), appImManager.chat.bubbles.lazyLoadQueue.queueId);
  };

  protected loadMoreMedia = (older = true) => {
    if(this.peerId < 0) return Promise.resolve(); // ! это значит, что открыло аватар чата, но следующих фотографий нет.
    if(this.loadedAllMediaDown) return Promise.resolve();
    if(this.loadMediaPromiseDown) return this.loadMediaPromiseDown;

    const peerId = this.peerId;
    const loadCount = 50;

    const maxId = this.nextTargets.length ? this.nextTargets[this.nextTargets.length - 1].photoId : this.currentPhotoId;

    const promise = appPhotosManager.getUserPhotos(peerId, maxId, loadCount).then(value => {
      if(this.peerId != peerId) {
        this.log.warn('peer changed');
        return;
      }

      this.log('loaded more media by maxId:', /* maxId,  */value, older, this.reverse);

      if(value.photos.length < loadCount) {
        this.loadedAllMediaDown = true;
      }

      value.photos.forEach(photoId => {
        if(this.currentPhotoId == photoId) return;
        this.nextTargets.push({element: null as HTMLElement, photoId: photoId});
      });

      this.buttons.prev.classList.toggle('hide', !this.prevTargets.length);
      this.buttons.next.classList.toggle('hide', !this.nextTargets.length);
    }, () => {}).then(() => {
      this.loadMediaPromiseDown = null;
    });

    return this.loadMediaPromiseDown = promise;
  };

  public async openMedia(photoId: string, target?: HTMLElement, fromRight = 0) {
    if(this.setMoverPromise) return this.setMoverPromise;

    const photo = appPhotosManager.getPhoto(photoId);

    this.currentPhotoId = photo.id;
  
    return super._openMedia(photo, photo.date, this.peerId, fromRight, target, false);
  }
}
