import SliderSuperTab from '../sliderTab';

export default class DrawTab extends SliderSuperTab {
  public init() {
    this.container.classList.add('draw-container');

    const div = document.createElement('div');

    div.innerHTML = 'Draw tab';

    this.scrollable.append(div);

    this.setTitle('Edit');
  }
}
