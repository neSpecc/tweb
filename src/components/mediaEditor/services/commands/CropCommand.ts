import type {Command} from './Command';
import type {CanvasLayer} from '../useCanvasLayers';
import copy from '../../../../helpers/object/copy';

export type CropImageDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropCanvasDimensions = {
  newCanvasWidth: number;
  newCanvasHeight: number;
  offsetTop: number;
}

export default class CropCommand implements Command {
  // #prevImageDimension: CropImageDimensions;
  // #prevScale: { scaleX: number, scaleY: number };
  #prevImageData: ImageData;
  constructor(
    private readonly layer: CanvasLayer,
    private readonly imageDimensions: CropImageDimensions,
    private readonly newCanvasDimensions: CropCanvasDimensions,
    private readonly prevCanvasDimensions: CropCanvasDimensions,
    private readonly scale: { scaleX: number, scaleY: number },
    private readonly uiReflector: (newWidth: number, newHeight: number, newOffsetTop: number) => void,
    private readonly onBeforeCrop: () => void
  ) {
    // this.#prevScale = copy(scale);
    this.#prevImageData = layer.originalImageOffscreenContext.getImageData(0, 0, layer.originalImageOffscreenCanvas.width, layer.originalImageOffscreenCanvas.height);
  }

  execute() {
    this.onBeforeCrop();

    const {originalImageOffscreenCanvas, originalImageOffscreenContext} = this.layer!;
    const cropWidth = this.imageDimensions.width * this.scale.scaleX;
    const cropHeight = this.imageDimensions.height * this.scale.scaleY;
    const cropX = this.imageDimensions.x * this.scale.scaleX;
    const cropY = this.imageDimensions.y * this.scale.scaleY;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');

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
    const newImageData = croppedContext.getImageData(0, 0, cropWidth, cropHeight);

    this.layer.setImageData(newImageData);

    this.uiReflector(this.newCanvasDimensions.newCanvasWidth, this.newCanvasDimensions.newCanvasHeight, this.newCanvasDimensions.offsetTop);
  }

  undo() {
    this.onBeforeCrop();

    const {originalImageOffscreenCanvas} = this.layer!;
    originalImageOffscreenCanvas.width = this.#prevImageData.width;
    originalImageOffscreenCanvas.height = this.#prevImageData.height;
    this.layer.setImageData(this.#prevImageData)

    this.uiReflector(this.prevCanvasDimensions.newCanvasWidth, this.prevCanvasDimensions.newCanvasHeight, this.prevCanvasDimensions.offsetTop);
  }
}
