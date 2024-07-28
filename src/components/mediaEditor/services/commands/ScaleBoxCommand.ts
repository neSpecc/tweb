import type {Command} from './Command';
import type {DraggableBox} from '../useDraggableBox';

export default class ScaleBoxCommand implements Command {
  #prevWidth: number;
  #prevHeight: number;
  #prevX: number;
  #prevY: number;

  constructor(
    private readonly box: DraggableBox,
    private readonly width: number,
    private readonly height: number,
    private readonly x: number,
    private readonly y: number,
    private readonly onResize: (newWidth: number, newHeight: number, x: number, y: number) => void
  ) {
    this.#prevWidth = width;
    this.#prevHeight = height;
    this.#prevX = x;
    this.#prevY = y;
  }

  execute() {
    this.box.el.style.left = `${this.x}px`;
    this.box.el.style.top = `${this.y}px`;
    this.box.el.style.width = `${this.width}px`;
    this.box.el.style.height = `${this.height}px`;

    this.box.position.width = this.width;
    this.box.position.height = this.height;
    this.box.position.x = this.x;
    this.box.position.y = this.y;

    this.onResize(this.width, this.height, this.x, this.y);
  }

  undo() {
    this.box.el.style.left = `${this.#prevX}px`;
    this.box.el.style.top = `${this.#prevY}px`;
    this.box.el.style.width = `${this.#prevWidth}px`;
    this.box.el.style.height = `${this.#prevHeight}px`;

    this.box.position.width = this.#prevWidth;
    this.box.position.height = this.#prevHeight;
    this.box.position.x = this.#prevX;
    this.box.position.y = this.#prevY;

    this.onResize(this.#prevWidth, this.#prevHeight, this.#prevX, this.#prevY);
  }
}
