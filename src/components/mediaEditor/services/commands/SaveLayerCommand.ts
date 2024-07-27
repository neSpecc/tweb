import type {Command} from './Command';
import type {CanvasLayer} from '../useCanvasLayers';

export default class SaveLayerCommand implements Command {
  #prevImageData: ImageData;
  constructor(
    private readonly layer: CanvasLayer,
    private readonly newImageData: ImageData
  ) {
    this.#prevImageData = layer.imageData;
  }

  execute() {
    this.layer.imageData = this.newImageData;
    this.apply();
  }

  undo() {
    this.layer.imageData = this.#prevImageData;
    this.apply();
  }

  private apply() {

  }
}
