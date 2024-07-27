import {copyImageData} from '../../../../helpers/canvas/copyImageData';
import type {Command} from './Command';
import type {CanvasLayer} from '../useCanvasLayers';
import {useFilters, type CanvasFilters} from '../useFilters';

export default class ApplyFilterCommand implements Command {
  #filtersService: ReturnType<typeof useFilters>;
  #previousFilterValue: number;
  #newFilterValue: number;

  constructor(
    private readonly layer: CanvasLayer,
    private readonly filterName: keyof CanvasFilters,
    private readonly value: number,
    private readonly uiReflector: () => void
  ) {
    this.#previousFilterValue = layer.state.filters[filterName];
    this.#newFilterValue = value;
    this.#filtersService = useFilters();
  }

  execute() {
    this.layer.state.filters[this.filterName] = this.#newFilterValue;
    this.apply();
  }

  undo() {
    this.layer.state.filters[this.filterName] = this.#previousFilterValue;
    this.apply();
  }

  private apply() {
    const filtersToAdd = Object.fromEntries(Object.entries(this.layer.state.filters).filter(([_name, value]) => {
      return value !== 0;
    }));

    filtersToAdd[this.filterName] = this.value;
    const dataToAddFilters = copyImageData(this.layer.imageData);

    this.#filtersService.restoreFilters(dataToAddFilters, filtersToAdd);
    this.layer.setImageData(dataToAddFilters);

    this.uiReflector();
  }
}
