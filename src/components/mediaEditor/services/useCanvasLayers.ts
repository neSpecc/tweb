import {copyImageData} from '../../../helpers/canvas/copyImageData';
import PromiseQueue from '../utils/promise-queue';
import {resizeImageData} from '../utils/resizeImage';
import {Command} from './commands/Command';
import {type DraggableBox, type DraggableBoxCreationAttributes, useDraggableBox} from './useDraggableBox';
import {type CanvasFilters, useFilters} from './useFilters';
import CommandManager from './CommandManager';
import SaveLayerCommand from './commands/SaveLayerCommand';
import CropCommand from './commands/CropCommand';
import RotateCanvasCommand from './commands/RotateCanvasCommand';

interface UseCanvasLayersParams {
  wrapperEl: HTMLElement;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
}

export interface CanvasLayerState {
  rotation: number;
  filters: CanvasFilters;
}

export interface LayerBase {
  remove: () => void;
}

export interface CanvasLayer extends LayerBase {
  div?: never;
  creationParams: LayerCreationParams;
  visibleCanvas: HTMLCanvasElement;
  visibleCanvasContext: CanvasRenderingContext2D;
  originalImageOffscreenCanvas: OffscreenCanvas;
  originalImageOffscreenContext: OffscreenCanvasRenderingContext2D;
  imageData: ImageData;
  state: CanvasLayerState;
  save: (skipHistory?: boolean) => void;
  rotate: (angle: number, uiReflector: (angle: number) => void) => void;
  rotate90: () => void;
  flip: () => void;
  crop: (params: CropParams) => void;
  applyFilter: (filterName: keyof CanvasFilters, value: number) => void;
  sync: () => void;
  setImageData: (imageData: ImageData) => void;
}

export interface DivLayer extends LayerBase {
  canvas?: never;
  div: HTMLDivElement;
  rect: DOMRect;
  boxes: DraggableBox[];
  redraw: () => void;
  createBox: (params: DraggableBoxCreationAttributes) => DraggableBox;
  insertBox: (box: DraggableBox, x: number, y: number) => void;
  removeBox: (box: DraggableBox) => void;
  getActiveBox: () => DraggableBox | null;
  activateBox: (box: DraggableBox) => void;
  removeEmptyBoxes: () => void;
  removeAllBoxes: () => void;
  deactivateAllBoxes: () => void;
  export: (width: number, height: number) => Promise<HTMLCanvasElement>;
  enable: () => void;
  disable: () => void;
}

export type Layer = CanvasLayer | DivLayer;

export interface LayerCreationParams {
  image: HTMLImageElement;
  onActivate?: (box: DraggableBox) => void;
}

export interface CommandsService {
  execute: (command: Command, skipHistory?: boolean) => void;
  startBatch: () => void;
  endBatch: () => void;
  undo: () => void;
  redo: () => void;
}

export interface CropParams {
  imageDimensions: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  newCanvasDimensions: {
    newCanvasWidth: number;
    newCanvasHeight: number;
    offsetTop: number;
  };

  currentCanvasDimensions: {
    newCanvasWidth: number;
    newCanvasHeight: number;
    offsetTop: number;
  };

  onBeforeCrop?: () => void;

  uiReflector: (newWidth: number, newHeight: number, newOffsetTop: number) => void;
}

export function useCanvasLayers(params?: UseCanvasLayersParams) {
  const layers = new Set<Layer>();

  let textLayer: DivLayer | null = null;
  let stickersLayer: DivLayer | null = null;

  const commandManager = new CommandManager();

  const commands: CommandsService = {
    execute(command: Command, skipHistory = false) {
      commandManager.executeCommand(command, skipHistory);
      onAfterHistoryChange();
    },
    startBatch() {
      commandManager.startBatch();
      onAfterHistoryChange();
    },
    endBatch() {
      commandManager.endBatch();
      onAfterHistoryChange();
    },
    undo() {
      commandManager.undo();
      onAfterHistoryChange();
    },
    redo() {
      commandManager.redo();
      onAfterHistoryChange();
    }
  };

  function onAfterHistoryChange() {
    const canUndo = commandManager.canUndo();
    const canRedo = commandManager.canRedo();

    params?.onHistoryChange(canUndo, canRedo);
  }

  const keydownHandler = (event: KeyboardEvent) => {
    if(event.metaKey || event.ctrlKey) {
      if(event.key === 'z') {
        event.preventDefault();
        commands.undo();
      }
      else if(event.key === 'y') {
        event.preventDefault();
        commands.redo();
      }
    }
  };

  document.addEventListener('keydown', keydownHandler);


  const {create: createDraggableBox} = useDraggableBox(commands);
  const {restoreFilters} = useFilters();

  if(!params?.wrapperEl) {
    throw new Error('wrapperEl is required');
  }

  const layersParent = document.createElement('div');

  layersParent.classList.add('layers-parent');

  layersParent.style.position = 'relative';
  layersParent.style.width = '100%';
  layersParent.style.height = '100%';

  params?.wrapperEl.appendChild(layersParent);

  function isCanvasLayer(layer: Layer): layer is CanvasLayer {
    return 'visibleCanvas' in layer;
  }

  function windowResizeHandler() {
    window.requestAnimationFrame(() => {
      resizeToFit();
    });
  }

  window.addEventListener('resize', windowResizeHandler, {
    passive: true
  });

  function resizeToFit() {
    layers.forEach((layer) => {
      if(isCanvasLayer(layer)) {
        resizeCanvasLayer(layer);
      }
      else {
        resizeDivLayer(layer);
      }
    });
  }
  function resizeCanvasLayer(layer: CanvasLayer): void {
    const newWidth = layersParent.offsetWidth;
    const newHeight = layersParent.offsetHeight;

    layer.visibleCanvas.width = newWidth;
    layer.visibleCanvas.height = newHeight;

    syncVisibleCanvas(layer);
  }

  function rotateCanvasLayerContent(layer: CanvasLayer, angle: number, uiReflector: (angle: number) => void): void {
    const {
      originalImageOffscreenCanvas,
      originalImageOffscreenContext,
      imageData
    } = layer;

    const width = originalImageOffscreenCanvas.width;
    const height = originalImageOffscreenCanvas.height;

    const radians = angle * (Math.PI / 180);
    const absCos = Math.abs(Math.cos(radians));
    const absSin = Math.abs(Math.sin(radians));
    const boundingWidth = width * absCos + height * absSin;
    const boundingHeight = width * absSin + height * absCos;
    const scale = Math.max(boundingWidth / width, boundingHeight / height);

    commands.execute(new RotateCanvasCommand(layer, imageData, angle, radians, uiReflector));
  }

  function rotateCanvasLayerContent90(layer: CanvasLayer): void {
    const {
      originalImageOffscreenCanvas,
      originalImageOffscreenContext
    } = layer;

    const currentWidth = originalImageOffscreenCanvas.width;
    const currentHeight = originalImageOffscreenCanvas.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentHeight;
    tempCanvas.height = currentWidth;
    const tempContext = tempCanvas.getContext('2d');

    if(!tempContext) {
      throw new Error('Could not get temporary context');
    }

    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempContext.rotate(90 * Math.PI / 180);
    tempContext.translate(-tempCanvas.height / 2, -tempCanvas.width / 2);
    tempContext.drawImage(originalImageOffscreenCanvas, 0, 0, currentWidth, currentHeight);

    originalImageOffscreenContext.clearRect(0, 0, currentWidth, currentHeight);
    originalImageOffscreenCanvas.width = tempCanvas.width;
    originalImageOffscreenCanvas.height = tempCanvas.height;
    originalImageOffscreenContext.drawImage(tempCanvas, 0, 0);

    syncVisibleCanvas(layer);
  }

  function saveLayer(layer: CanvasLayer, skipHistory = false): void {
    const canvas = layer.originalImageOffscreenCanvas;
    const context = layer.originalImageOffscreenContext;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    commands.execute(new SaveLayerCommand(layer, imageData), skipHistory);
  }

  function flipCanvasLayerContent(layer: CanvasLayer): void {
    saveLayer(layer);

    const {
      originalImageOffscreenCanvas,
      originalImageOffscreenContext,
      imageData
    } = layer;

    const width = originalImageOffscreenCanvas.width;
    const height = originalImageOffscreenCanvas.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempContext = tempCanvas.getContext('2d');

    if(!tempContext) {
      throw new Error('Could not get temporary context');
    }

    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    const resizedCanvas = resizeImageData(imageData, tempCanvas.width, tempCanvas.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width, 0);
    tempContext.scale(-1, 1);
    tempContext.drawImage(resizedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.restore();

    // context.clearRect(0, 0, canvas.width, canvas.height);
    originalImageOffscreenContext.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    syncVisibleCanvas(layer);

    saveLayer(layer);
  }

  function cropCanvas(params: CropParams): void {
    const layer = getBaseCanvasLayer();
    // layer.save();

    const {
      originalImageOffscreenCanvas,
      visibleCanvas
    } = layer;

    const {x, y, width, height} = params.imageDimensions;

    const scaleX = originalImageOffscreenCanvas.width / visibleCanvas.width;
    const scaleY = originalImageOffscreenCanvas.height / visibleCanvas.height;

    commands.execute(
      new CropCommand(
        layer,
        {
          x,
          y,
          width,
          height
        },
        params.newCanvasDimensions,
        params.currentCanvasDimensions,
        {
          scaleX,
          scaleY
        },
        params.uiReflector,
        params.onBeforeCrop
      )
    )
  };

  function applyCanvasFilter(layer: CanvasLayer, filterName: keyof CanvasFilters, value: number): void {
    const filtersToAdd = Object.fromEntries(Object.entries(layer.state.filters).filter(([_name, value]) => {
      return value !== 0;
    }));

    filtersToAdd[filterName] = value;

    layer.state.filters[filterName] = value;

    const dataToAddFilters = copyImageData(layer.imageData);

    restoreFilters(dataToAddFilters, filtersToAdd);

    layer.originalImageOffscreenContext.putImageData(dataToAddFilters, 0, 0);

    syncVisibleCanvas(layer);
  }

  function syncVisibleCanvas(layer: CanvasLayer): void {
    const {
      visibleCanvas,
      visibleCanvasContext,
      originalImageOffscreenCanvas,
      originalImageOffscreenContext
    } = layer;

    const scale = Math.min(visibleCanvas.width / originalImageOffscreenCanvas.width, visibleCanvas.height / originalImageOffscreenCanvas.height);
    const scaledWidth = originalImageOffscreenCanvas.width * scale;
    const scaledHeight = originalImageOffscreenCanvas.height * scale;

    visibleCanvasContext.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
    visibleCanvasContext.drawImage(originalImageOffscreenCanvas, 0, 0, originalImageOffscreenCanvas.width, originalImageOffscreenCanvas.height, 0, 0, scaledWidth, scaledHeight);
  };

  function removeCanvasLayer(layer: CanvasLayer): void {
    layersParent.removeChild(layer.visibleCanvas);

    layers.delete(layer);
  }

  function createCanvasLayer(params: LayerCreationParams): CanvasLayer {
    /**
     * Create an off-screen canvas for the original image
     */
    const originalImageOffscreenCanvas = new OffscreenCanvas(params.image.width, params.image.height);
    const originalImageOffscreenContext = originalImageOffscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    /**
     * Save original image data to the offscreen canvas
     */
    originalImageOffscreenContext.drawImage(params.image, 0, 0);
    const imageData = originalImageOffscreenContext.getImageData(0, 0, originalImageOffscreenCanvas.width, originalImageOffscreenCanvas.height);

    /**
     * Create a visible canvas layer
     */
    const visibleCanvas = document.createElement('canvas');
    visibleCanvas.classList.add('visible-canvas');
    const visibleCanvasContext = visibleCanvas.getContext('2d') as CanvasRenderingContext2D;

    visibleCanvas.width = layersParent.offsetWidth;
    visibleCanvas.height = layersParent.offsetHeight;

    layersParent.appendChild(visibleCanvas);

    const layer: CanvasLayer = {
      imageData,
      visibleCanvas,
      visibleCanvasContext,
      originalImageOffscreenCanvas,
      originalImageOffscreenContext,
      creationParams: params,
      state: {
        rotation: 0,
        filters: {
          enhance: 0,
          brightness: 0,
          contrast: 0,
          saturation: 0,
          warmth: 0,
          fade: 0,
          highlights: 0,
          shadows: 0,
          vignette: 0,
          grain: 0,
          sharpen: 0
        }
      },
      remove: (): void => {
        removeCanvasLayer(layer);
      },
      save: (skipHistory?: boolean): void => {
        saveLayer(layer, skipHistory);
      },
      rotate: (angle: number, uiReflector: (angle: number) => void): void => {
        rotateCanvasLayerContent(layer, angle, uiReflector);
      },
      rotate90: (): void => {
        rotateCanvasLayerContent90(layer);
      },
      flip: (): void => {
        flipCanvasLayerContent(layer);
      },
      crop: cropCanvas,
      applyFilter: (filterName: keyof CanvasFilters, value: number): void => {
        applyCanvasFilter(layer, filterName, value);
      },
      sync: (): void => {
        syncVisibleCanvas(layer);
      },
      setImageData: (imageData: ImageData): void => {
        layer.originalImageOffscreenContext.putImageData(imageData, 0, 0);
        syncVisibleCanvas(layer);
      }
    };

    layers.add(layer);

    syncVisibleCanvas(layer);

    return layer;
  }

  /**
   * Right now we have only one canvas layer, so we just find and return it
   */
  function getBaseCanvasLayer(): CanvasLayer {
    return Array.from(layers).find(layer => isCanvasLayer(layer)) as CanvasLayer;
  }

  function resizeDivLayer(layer: DivLayer): void {
    layer.rect = layer.div.getBoundingClientRect();

    removeEmptyBoxesFromLayer(layer);

    layer.boxes.forEach((box) => {
      box.reposition();
    });
  }

  function removeEmptyBoxesFromLayer(layer: DivLayer): void {
    layer.boxes.forEach((box) => {
      if(!box.isActive() && box.isEmpty()) {
        layer.removeBox(box);
      }
    });
  };

  function deactivateAllBoxesInLayer(layer: DivLayer): void {
    layer.boxes.forEach((box) => {
      box.deactivate();
    });
  }

  async function exportBoxesToCanvas(layer: DivLayer, width: number, height: number): Promise<HTMLCanvasElement> {
    const scaleFactor = 3;

    const highResCanvas = document.createElement('canvas');
    const highResContext = highResCanvas.getContext('2d');

    if(!highResContext) {
      throw new Error('Could not get high-res canvas context');
    }

    highResCanvas.width = width * scaleFactor;
    highResCanvas.height = height * scaleFactor;

    highResContext.scale(scaleFactor, scaleFactor);

    const scaleX = width / layer.rect.width;
    const scaleY = height / layer.rect.height;

    const queue = new PromiseQueue();

    layer.boxes.forEach((box) => {
      queue.add(async() => {
        const boxCanvas = await box.export(scaleFactor * scaleY);
        const {position} = box;
        const {x, y, rotationAngle} = position;

        /**
         * Rotate the box canvas to respect the rotation angle
         */
        const sin = Math.sin(rotationAngle * Math.PI / 180);
        const cos = Math.cos(rotationAngle * Math.PI / 180);
        const newWidth = Math.abs(boxCanvas.width * cos) + Math.abs(boxCanvas.height * sin);
        const newHeight = Math.abs(boxCanvas.width * sin) + Math.abs(boxCanvas.height * cos);
        const offScreenCanvas = document.createElement('canvas');
        const offScreenContext = offScreenCanvas.getContext('2d');

        offScreenCanvas.width = newWidth;
        offScreenCanvas.height = newHeight;

        offScreenContext.translate(newWidth / 2, newHeight / 2);
        offScreenContext.rotate(rotationAngle * Math.PI / 180);
        offScreenContext.drawImage(boxCanvas, -boxCanvas.width / 2, -boxCanvas.height / 2);

        const offsetX = (newWidth - boxCanvas.width) / 2;
        const offsetY = (newHeight - boxCanvas.height) / 2;

        highResContext.drawImage(
          offScreenCanvas,
          (position.x * scaleX) - offsetX / scaleFactor,
          (position.y * scaleY) - offsetY / scaleFactor,
          newWidth / scaleFactor,
          newHeight / scaleFactor
        );
      });
    });

    await queue.completed;

    return highResCanvas;
  }

  function createDivLayer(): DivLayer {
    const div = document.createElement('div');

    div.style.position = 'absolute';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.top = '0';
    div.style.left = '0';
    div.style.userSelect = 'none';

    layersParent.appendChild(div);

    const layer: DivLayer = {
      div,
      boxes: [],
      rect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      } as DOMRect,
      redraw: (): void => {
        div.innerHTML = '';
      },
      remove: (): void => {
        layer.boxes.forEach((box) => {
          box.remove();
        });

        if(layersParent.contains(div)) {
          layersParent.removeChild(div);
        }

        if(layers.has(layer)) {
          layers.delete(layer);
        }
      },
      createBox: (params: DraggableBoxCreationAttributes): DraggableBox => {
        return createDraggableBox({
          ...params,
          onBeforeActivate: () => {
            deactivateAllBoxesInLayer(layer);
          }
        });
      },
      insertBox: (box: DraggableBox, x: number, y: number): void => {
        box.insert(div as HTMLElement, x, y);

        layer.boxes.push(box);
      },
      removeBox: (box: DraggableBox): void => {
        const index = layer.boxes.indexOf(box);

        if(index === -1) {
          return;
        }

        layer.boxes.splice(index, 1);

        box.remove();
      },
      activateBox: (box: DraggableBox): void => {
        deactivateAllBoxesInLayer(layer);

        box.activate();
      },
      getActiveBox: (): DraggableBox | null => {
        return layer.boxes.find(box => box.isActive()) ?? null;
      },
      removeEmptyBoxes: (): void => {
        removeEmptyBoxesFromLayer(layer);
      },
      removeAllBoxes: (): void => {
        layer.boxes.forEach((box) => {
          box.remove();
        });

        layer.boxes = [];
      },
      deactivateAllBoxes: (): void => {
        layer.boxes.forEach((box) => {
          box.deactivate();
        });
      },
      export: async(width: number, height: number): Promise<HTMLCanvasElement> => {
        return exportBoxesToCanvas(layer, width, height);
      },
      enable: () => {
        layer.div.classList.add('layer-active')
        layer.div.style.pointerEvents = 'auto';
      },
      disable: () => {
        layer.div.classList.remove('layer-active')
        layer.div.style.pointerEvents = 'none';
      }
    };

    layers.add(layer);

    layer.rect = div.getBoundingClientRect();

    return layer;
  }

  function destroy() {
    layersParent.remove();
    window.removeEventListener('resize', windowResizeHandler);

    layers.forEach((layer) => {
      layer.remove();
    });

    layers.clear();

    document.removeEventListener('keydown', keydownHandler);
  }

  /**
   * Combine all layers into one canvas and return it
   */
  async function exportLayers(): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if(!context) {
      throw new Error('Could not get canvas context');
    }
    const baseCanvasLayer = getBaseCanvasLayer();

    canvas.width = baseCanvasLayer.originalImageOffscreenCanvas.width;
    canvas.height = baseCanvasLayer.originalImageOffscreenCanvas.height;

    context.drawImage(baseCanvasLayer.originalImageOffscreenCanvas, 0, 0);

    const queue = new PromiseQueue();

    layers.forEach((layer) => {
      if(isCanvasLayer(layer)) {
        return;
      }

      queue.add(async() => {
        const divCanvasHighRes = await layer.export(baseCanvasLayer.originalImageOffscreenCanvas.width, baseCanvasLayer.originalImageOffscreenCanvas.height);

        /**
         * Scale down and merge
         */
        const divCanvas = document.createElement('canvas');
        divCanvas.width = baseCanvasLayer.originalImageOffscreenCanvas.width;
        divCanvas.height = baseCanvasLayer.originalImageOffscreenCanvas.height;
        const divContext = divCanvas.getContext('2d');

        if(!divContext) {
          throw new Error('Could not get div context');
        }

        divContext.drawImage(divCanvasHighRes, 0, 0, divCanvas.width, divCanvas.height);

        context.drawImage(divCanvas, 0, 0);
      });
    });

    await queue.completed;

    return canvas;
  }

  function getTextLayer() {
    if(textLayer === null) {
      textLayer = createDivLayer();
    }

    return textLayer;
  }

  function getStickersLayer() {
    if(stickersLayer === null) {
      stickersLayer = createDivLayer();
    }

    return stickersLayer;
  }

  return {
    createCanvasLayer,
    createDivLayer,
    destroy,
    resizeToFit,
    getBaseCanvasLayer,
    getTextLayer,
    getStickersLayer,
    exportLayers,
    commands
  };
}
