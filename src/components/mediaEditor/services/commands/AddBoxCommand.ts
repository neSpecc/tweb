import type {Command} from './Command';
import type {DivLayer} from '../useCanvasLayers';
import type {DraggableBox} from '../useDraggableBox';

export default class AddBoxCommand implements Command {
  constructor(
    private readonly layer: DivLayer,
    private readonly box: DraggableBox,
    private readonly x: number,
    private readonly y: number
  ) {}

  execute() {
    this.layer.insertBox(this.box, this.x, this.y);
    this.layer.activateBox(this.box);
  }

  undo() {
    this.layer.removeBox(this.box);
  }
}
