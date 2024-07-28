import type {Command} from './Command';
import type {DraggableBox} from '../useDraggableBox';

export default class RotateBoxCommand implements Command {
  #prevAngle: number;

  constructor(
    private readonly box: DraggableBox,
    private readonly angle: number
  ) {
    this.#prevAngle = angle;
  }

  execute() {
    this.box.el.style.transform = `rotate(${this.angle}deg)`;
    this.box.position.rotationAngle = this.angle;
  }

  undo() {
    this.box.el.style.transform = `rotate(${this.#prevAngle}deg)`;
    this.box.position.rotationAngle = this.#prevAngle;
  }
}
