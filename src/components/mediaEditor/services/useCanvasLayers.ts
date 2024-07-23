import { resizeImageData } from '../utils/resizeImage';
import { type DraggableBox, type DraggableBoxCreationAttributes, useDraggableBox } from './useDraggableBox';

interface UseCanvasLayersParams {
  wrapperEl: HTMLElement;
}

export interface LayerBase {
  creationParams: LayerCreationParams;
  redraw: () => void;
  remove: () => void;
}

export interface CanvasLayer extends LayerBase {
  canvas: HTMLCanvasElement;
  div?: never;
  originalImageData: ImageData | undefined;
  state: {
    rotation: number;
  };
  save: () => void;
  rotate: (angle: number) => void;
  rotate90: () => void;
  flip: () => void;
  crop: (x: number, y: number, width: number, height: number) => void;
}

export interface DivLayer extends LayerBase {
  canvas?: never;
  div: HTMLDivElement;
  rect: DOMRect;
  boxes: DraggableBox[];
  createBox: (params: DraggableBoxCreationAttributes) => DraggableBox;
  insertBox: (box: DraggableBox, x: number, y: number) => void;
  removeBox: (box: DraggableBox) => void;
  getActiveBox: () => DraggableBox | null;
  activateBox: (box: DraggableBox) => void;
  removeEmptyBoxes: () => void;
  removeAllBoxes: () => void;
  deactivateAllBoxes: () => void;
}

export type Layer = CanvasLayer | DivLayer;

export interface LayerCreationParams {
  bgImage?: HTMLImageElement;
  onActivate?: (box: DraggableBox) => void;
}

export function useCanvasLayers(params?: UseCanvasLayersParams) {
  const layers = new Set<Layer>();

  const { create: createDraggableBox } = useDraggableBox();

  if (!params?.wrapperEl) {
    throw new Error('wrapperEl is required');
  }

  const layersParent = document.createElement('div');

  layersParent.style.position = 'relative';
  layersParent.style.width = '100%';
  layersParent.style.height = '100%';

  params?.wrapperEl.appendChild(layersParent);

  function isCanvasLayer(layer: Layer): layer is CanvasLayer {
    return 'canvas' in layer;
  }

  function windowResizeHandler() {
    window.requestAnimationFrame(() => {
      resizeToFit();
    });
  }

  window.addEventListener('resize', windowResizeHandler, {
    passive: true,
  });

  function resizeToFit() {
    layers.forEach((layer) => {
      if (isCanvasLayer(layer)) {
        resizeCanvasLayer(layer);
      }
      else {
        resizeDivLayer(layer);
      }
    });
  }

  function resizeCanvasLayer(layer: CanvasLayer): void {
    const context = layer.canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new Error('Could not get layer context');
    }

    const newWidth = layersParent.offsetWidth;
    const newHeight = layersParent.offsetHeight;

    if (layer.originalImageData) {
      const resizedCanvas = resizeImageData(layer.originalImageData, newWidth, newHeight);

      layer.canvas.width = newWidth;
      layer.canvas.height = newHeight;

      context.drawImage(resizedCanvas, 0, 0);
    }

    /**
     * @todo Resize offscreen canvas
     */
  }

  function drawCanvasLayer(layer: CanvasLayer, image?: ImageData): void {
    layer.canvas.width = layersParent.offsetWidth;
    layer.canvas.height = layersParent.offsetHeight;

    const context = layer.canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new Error('Could not get layer context');
    }

    if (image) {
      context.putImageData(image, 0, 0);
    }
    else if (layer.creationParams.bgImage) {
      context.drawImage(layer.creationParams.bgImage, 0, 0, layer.canvas.width, layer.canvas.height);
      layer.originalImageData = context.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    }
  }

  function rotateCanvasLayerContent(layer: CanvasLayer, angle: number): void {
    const { canvas, originalImageData } = layer;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get context');
    }

    if (!originalImageData) {
      throw new Error('No original image data available');
    }

    const radians = angle * (Math.PI / 180);
    const absCos = Math.abs(Math.cos(radians));
    const absSin = Math.abs(Math.sin(radians));
    const boundingWidth = canvas.width * absCos + canvas.height * absSin;
    const boundingHeight = canvas.width * absSin + canvas.height * absCos;
    const scale = Math.max(boundingWidth / canvas.width, boundingHeight / canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const tempContext = tempCanvas.getContext('2d');

    if (!tempContext) {
      throw new Error('Could not get temporary context');
    }

    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    const resizedCanvas = resizeImageData(originalImageData, tempCanvas.width, tempCanvas.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempContext.rotate(radians);
    tempContext.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
    tempContext.drawImage(resizedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.restore();

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(tempCanvas, (canvas.width - tempCanvas.width) / 2, (canvas.height - tempCanvas.height) / 2, tempCanvas.width, tempCanvas.height);
  }

  function rotateCanvasLayerContent90(layer: CanvasLayer): void {
    const { canvas } = layer;
    const context = canvas.getContext('2d');
    if (!context)
      return;

    // Save the current dimensions of the canvas
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;

    // Create a new canvas to hold the rotated image
    const newCanvas = document.createElement('canvas');
    newCanvas.width = currentWidth;
    newCanvas.height = currentHeight;
    const newContext = newCanvas.getContext('2d');
    if (!newContext)
      return;

    // Rotate the new canvas context
    newContext.translate(currentWidth / 2, currentHeight / 2);
    newContext.rotate(90 * Math.PI / 180);
    newContext.drawImage(canvas, -currentHeight / 2, -currentWidth / 2, currentHeight, currentWidth);

    // Clear the original canvas and draw the rotated image back onto it
    context.clearRect(0, 0, currentWidth, currentHeight);
    context.drawImage(newCanvas, 0, 0);
  }

  function _rotateCanvasLayerContent90(layer: CanvasLayer): void {
    const { canvas } = layer;
    const context = canvas.getContext('2d');
    if (!context)
      return;

    // Save the original image data if it's not saved already
    if (!layer.originalImageData) {
      saveLayer(layer);
    }

    const originalImageData = layer.originalImageData;
    if (!originalImageData)
      return;

    // Update the rotation state
    layer.state.rotation = (layer.state.rotation + 90) % 360;

    // Save the current dimensions of the canvas
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;

    // Create a new canvas to hold the rotated image
    const newCanvas = document.createElement('canvas');
    newCanvas.width = currentWidth;
    newCanvas.height = currentHeight;
    const newContext = newCanvas.getContext('2d');
    if (!newContext)
      return;

    // Create a temporary canvas to use the original image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImageData.width;
    tempCanvas.height = originalImageData.height;
    const tempContext = tempCanvas.getContext('2d');
    if (!tempContext)
      return;
    tempContext.putImageData(originalImageData, 0, 0);

    // Rotate the new canvas context according to the current rotation state
    newContext.translate(currentWidth / 2, currentHeight / 2);
    newContext.rotate((layer.state.rotation * Math.PI) / 180);

    // Adjust translation for correct positioning and draw the image
    if (layer.state.rotation === 90 || layer.state.rotation === 270) {
      newContext.translate(-currentHeight / 2, -currentWidth / 2);
      newContext.drawImage(tempCanvas, 0, 0, currentHeight, currentWidth);
    }
    else {
      newContext.translate(-currentWidth / 2, -currentHeight / 2);
      newContext.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
    }

    // Clear the original canvas and draw the rotated image back onto it
    context.clearRect(0, 0, currentWidth, currentHeight);
    context.drawImage(newCanvas, 0, 0, currentWidth, currentHeight);
  }

  function saveLayer(layer: CanvasLayer): void {
    layer.originalImageData = layer.canvas.getContext('2d')?.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  }

  function flipCanvasLayerContent(layer: CanvasLayer): void {
    const { canvas, originalImageData } = layer;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get context');
    }

    if (!originalImageData) {
      throw new Error('No original image data available');
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempContext = tempCanvas.getContext('2d');

    if (!tempContext) {
      throw new Error('Could not get temporary context');
    }

    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    const resizedCanvas = resizeImageData(originalImageData, tempCanvas.width, tempCanvas.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width, 0);
    tempContext.scale(-1, 1);
    tempContext.drawImage(resizedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.restore();

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    saveLayer(layer);
  }

  function cropCanvas(layer: CanvasLayer, x: number, y: number, width: number, height: number): void {
    const { canvas } = layer;
    const context = canvas.getContext('2d');
    if (!context)
      return;

    // Get the current canvas image data
    const currentImageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Create a new canvas to hold the cropped image
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedContext = croppedCanvas.getContext('2d');
    if (!croppedContext)
      return;

    // Draw the specified area from the current canvas onto the cropped canvas
    croppedContext.putImageData(currentImageData, -x, -y);

    // Update the original image data with the new cropped image data
    layer.originalImageData = croppedContext.getImageData(0, 0, width, height);

    // Clear the original canvas and draw the cropped image back onto it
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(croppedCanvas, 0, 0);
  }

  function createCanvasLayer(params?: LayerCreationParams): CanvasLayer {
    const canvas = document.createElement('canvas');

    canvas.width = layersParent.offsetWidth;
    canvas.height = layersParent.offsetHeight;

    layersParent.appendChild(canvas);

    const layer: CanvasLayer = {
      canvas,
      creationParams: params ?? {},
      state: {
        rotation: 0,
      },
      originalImageData: undefined,
      redraw: (): void => drawCanvasLayer(layer),
      remove: (): void => {
        layersParent.removeChild(canvas);
      },
      save: (): void => {
        saveLayer(layer);
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
    };

    layers.add(layer);

    drawCanvasLayer(layer);

    // Store the original image data
    const context = canvas.getContext('2d');
    if (context && layer.creationParams.bgImage) {
      context.drawImage(layer.creationParams.bgImage, 0, 0, canvas.width, canvas.height);
      layer.originalImageData = context.getImageData(0, 0, canvas.width, canvas.height);
    }

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
      if (!box.isActive() && box.isEmpty()) {
        layer.removeBox(box);
      }
    });
  };

  function deactivateAllBoxesInLayer(layer: DivLayer): void {
    layer.boxes.forEach((box) => {
      box.deactivate();
    });
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
        left: 0,
      } as DOMRect,
      creationParams: {},
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
          },
        });
      },
      insertBox: (box: DraggableBox, x: number, y: number): void => {
        box.insert(div as HTMLElement, x, y);

        layer.boxes.push(box);
      },
      removeBox: (box: DraggableBox): void => {
        const index = layer.boxes.indexOf(box);

        if (index === -1) {
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

  return {
    createCanvasLayer,
    createDivLayer,
    destroy,
    resizeToFit,
    getBaseCanvasLayer,
  };
}
