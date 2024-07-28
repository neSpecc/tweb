import type {Command} from './Command';
import type {CanvasLayer} from '../useCanvasLayers';
import {copyImageData} from '../../../../helpers/canvas/copyImageData';
import {resizeImageData} from '../../utils/resizeImage';

export default class RotateCanvasCommand implements Command {
  private previousImageData: ImageData;
  private previousRotation: number;
  private currentImageData: ImageData;

  constructor(
    private readonly layer: CanvasLayer,
    private readonly imageData: ImageData,
    private readonly angle: number,
    private readonly radians: number,
    private readonly uiReflecor: (angle: number) => void

  ) {
    const {originalImageOffscreenContext, originalImageOffscreenCanvas} = layer;
    this.previousImageData = copyImageData(originalImageOffscreenContext.getImageData(0, 0, originalImageOffscreenCanvas.width, originalImageOffscreenCanvas.height));
    this.previousRotation = layer.state.rotation;
    this.currentImageData = imageData;
  }

  execute() {
    this.rotateCanvasLayerContent(this.layer, this.currentImageData, this.angle, this.radians);
  }

  undo() {
    this.layer.originalImageOffscreenContext.putImageData(this.previousImageData, 0, 0);
    this.layer.state.rotation = this.previousRotation;

    this.layer.setImageData(this.previousImageData);
    this.layer.sync();

    this.uiReflecor(this.previousRotation);
  }

  redo() {
    this.execute();
  }

  private rotateCanvasLayerContent(layer: CanvasLayer, imageData: ImageData, angle: number, radians: number): void {
    const {originalImageOffscreenCanvas, originalImageOffscreenContext} = layer;

    const width = originalImageOffscreenCanvas.width;
    const height = originalImageOffscreenCanvas.height;

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

    this.layer.sync();
  }
}
