import PromiseQueue from '../utils/promise-queue';
import {resizeImageData} from '../utils/resizeImage';
import {type DraggableBox, type DraggableBoxCreationAttributes, useDraggableBox} from './useDraggableBox';
import {type CanvasFilters, useFilters} from './useFilters';

interface UseCanvasLayersParams {
  wrapperEl: HTMLElement;
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
  imageDataWithoutFilters: ImageData;
  state: {
    rotation: number;
    crop: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    filters: CanvasFilters;
  };
  save: (withoutFilters?: boolean) => void;
  rotate: (angle: number) => void;
  rotate90: () => void;
  flip: () => void;
  crop: (x: number, y: number, width: number, height: number) => void;
  restoreState: () => void;
  applyFilter: (filterName: keyof CanvasFilters, value: number) => void;
  sync: () => void;
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
}

export type Layer = CanvasLayer | DivLayer;

export interface LayerCreationParams {
  image: HTMLImageElement;
  onActivate?: (box: DraggableBox) => void;
}

export function useCanvasLayers(params?: UseCanvasLayersParams) {
  const layers = new Set<Layer>();

  const {create: createDraggableBox} = useDraggableBox();
  const {applyFilter, restoreFilters} = useFilters();

  if(!params?.wrapperEl) {
    throw new Error('wrapperEl is required');
  }

  const layersParent = document.createElement('div');

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

  function drawWithoutFilters(layer: CanvasLayer): void {
    // restoreState(layer); ???

    if(!layer.imageDataWithoutFilters) {
      throw new Error('No image data available for drawing without filters');
    }

    layer.originalImageOffscreenContext.putImageData(layer.imageDataWithoutFilters, 0, 0);

    syncVisibleCanvas(layer);
  }

  function rotateCanvasLayerContent(layer: CanvasLayer, angle: number): void {
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

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    const tempContext = tempCanvas.getContext('2d');

    if(!tempContext) {
      throw new Error('Could not get temporary context');
    }

    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    const resizedCanvas = resizeImageData(imageData, tempCanvas.width, tempCanvas.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempContext.rotate(radians);
    tempContext.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
    tempContext.drawImage(resizedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.restore();

    originalImageOffscreenContext.drawImage(
      tempCanvas,
      (width - tempCanvas.width) / 2,
      (height - tempCanvas.height) / 2,
      tempCanvas.width,
      tempCanvas.height
    );

    layer.state.rotation = angle;

    syncVisibleCanvas(layer);
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

  function saveLayer(layer: CanvasLayer, withoutFilters = false, newWidth?: number, newHeight?: number): void {
    const canvas = layer.originalImageOffscreenCanvas;
    const context = layer.originalImageOffscreenContext;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    if(withoutFilters) {
      layer.imageDataWithoutFilters = imageData;
      return;
    }

    layer.imageData = imageData;
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

  function cropCanvas(layer: CanvasLayer, x: number, y: number, width: number, height: number): void {
    layer.save();
    layer.state.crop = {x, y, width, height};

    restoreCrop(layer);
  }

  function restoreCrop(layer: CanvasLayer): void {
    const {
      originalImageOffscreenCanvas,
      originalImageOffscreenContext,
      visibleCanvas
    } = layer;

    const {x, y, width, height} = layer.state.crop;

    const scaleX = originalImageOffscreenCanvas.width / visibleCanvas.width;
    const scaleY = originalImageOffscreenCanvas.height / visibleCanvas.height;

    const cropX = x * scaleX;
    const cropY = y * scaleY;
    const cropWidth = width * scaleX;
    const cropHeight = height * scaleY;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');

    if(!croppedContext) {
      throw new Error('Failed to crop: Could not get temporary context');
    }

    croppedContext.drawImage(
      originalImageOffscreenCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    originalImageOffscreenCanvas.width = cropWidth;
    originalImageOffscreenCanvas.height = cropHeight;
    originalImageOffscreenContext.clearRect(0, 0, cropWidth, cropHeight);
    originalImageOffscreenContext.drawImage(croppedCanvas, 0, 0);

    syncVisibleCanvas(layer);

    saveLayer(layer);
  }

  function restoreState(layer: CanvasLayer): void {
    if(layer.state.rotation !== 0) {
      rotateCanvasLayerContent(layer, layer.state.rotation);
    }

    if(layer.state.crop.width !== 0 && layer.state.crop.height !== 0) {
      restoreCrop(layer);
    }
  }

  function copyImageData(imageData: ImageData): ImageData {
    const copy = new ImageData(imageData.width, imageData.height);

    copy.data.set(imageData.data);

    return copy;
  }

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
      originalImageOffscreenCanvas
    } = layer;

    const scale = Math.min(visibleCanvas.width / originalImageOffscreenCanvas.width, visibleCanvas.height / originalImageOffscreenCanvas.height);
    const scaledWidth = originalImageOffscreenCanvas.width * scale;
    const scaledHeight = originalImageOffscreenCanvas.height * scale;

    // visibleCanvas.width = scaledWidth;
    // visibleCanvas.height = scaledHeight;

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
    const visibleCanvasContext = visibleCanvas.getContext('2d') as CanvasRenderingContext2D;

    visibleCanvas.width = layersParent.offsetWidth;
    visibleCanvas.height = layersParent.offsetHeight;

    layersParent.appendChild(visibleCanvas);

    const layer: CanvasLayer = {
      imageData,
      imageDataWithoutFilters: imageData,
      visibleCanvas,
      visibleCanvasContext,
      originalImageOffscreenCanvas,
      originalImageOffscreenContext,
      creationParams: params,
      state: {
        rotation: 0,
        crop: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        },
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
      save: (withoutFilters: boolean = false): void => {
        saveLayer(layer, withoutFilters);
      },
      rotate: (angle: number): void => {
        rotateCanvasLayerContent(layer, angle);
      },
      rotate90: (): void => {
        rotateCanvasLayerContent90(layer);
      },
      flip: (): void => {
        flipCanvasLayerContent(layer);
      },
      crop: (x: number, y: number, width: number, height: number): void => {
        cropCanvas(layer, x, y, width, height);
      },
      restoreState: (): void => {
        restoreState(layer);
      },
      applyFilter: (filterName: keyof CanvasFilters, value: number): void => {
        applyCanvasFilter(layer, filterName, value);
      },
      sync: (): void => {
        syncVisibleCanvas(layer);
      }
      // initDrawing: (): void => {

      // }
    };

    layers.add(layer);

    syncVisibleCanvas(layer);

    layer.save();
    layer.save(true);
    drawWithoutFilters(layer);

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

        highResContext.drawImage(boxCanvas, position.x * scaleX, position.y * scaleY, boxCanvas.width / scaleFactor, boxCanvas.height / scaleFactor);
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
        layersParent.removeChild(div);
        layers.delete(layer);
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

  return {
    createCanvasLayer,
    createDivLayer,
    destroy,
    resizeToFit,
    getBaseCanvasLayer,
    exportLayers
  };
}
