import type {Command} from './Command';
import type {CanvasLayer} from '../useCanvasLayers';

export default class DrawingCommand implements Command {
  #prevImageData: ImageData;
  constructor(
    private readonly layer: CanvasLayer,
    private readonly newImageData: ImageData
  ) {
    this.#prevImageData = layer.imageData;
  }

  execute() {
    this.layer.imageData = this.newImageData;
    this.layer.setImageData(this.newImageData);
  }

  undo() {
    this.layer.imageData = this.#prevImageData;
    this.layer.setImageData(this.#prevImageData);
  }
}
