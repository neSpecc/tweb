import type {Command} from './Command';
import type {DraggableBox} from '../useDraggableBox';

export default class DragBoxCommand implements Command {
  #prevX: number;
  #prevY: number;

  constructor(
    private readonly box: DraggableBox,
    private readonly x: number,
    private readonly y: number
  ) {
    this.#prevX = x;
    this.#prevY = y;
  }

  execute() {
    this.box.moveTo(this.x, this.y);
  }

  undo() {
    this.box.moveTo(this.#prevX, this.#prevY);
  }
}
