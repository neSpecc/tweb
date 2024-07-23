import type { Accessor } from 'solid-js';
import { For, createSignal, onCleanup, onMount } from 'solid-js';
import { useFilters } from '../services/useFilters';
import type { useCanvasLayers } from '../services/useCanvasLayers';

interface EnhanceProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

function Enhance(props: EnhanceProps) {
  const [enhance, setEnhance] = createSignal<number>(0);
  const [brightness, setBrightness] = createSignal<number>(0);
  const [contrast, setContrast] = createSignal<number>(0);
  const [saturation, setSaturation] = createSignal<number>(0);
  const [warmth, setWarmth] = createSignal<number>(0);
  const [fade, setFade] = createSignal<number>(0);
  const [highlights, setHighlights] = createSignal<number>(0);
  const [shadows, setShadows] = createSignal<number>(0);
  const [vignette, setVignette] = createSignal<number>(0);
  const [grain, setGrain] = createSignal<number>(0);
  const [sharpen, setSharpen] = createSignal<number>(0);

  const effects = [
    ['enhance', 'Enhance', [0, 100], enhance, setEnhance],
    ['brightness', 'Brightness', [-100, 100], brightness, setBrightness],
    ['contrast', 'Contrast', [-100, 100], contrast, setContrast],
    ['saturation', 'Saturation', [-100, 100], saturation, setSaturation],
    ['warmth', 'Warmth', [-100, 100], warmth, setWarmth],
    ['fade', 'Fade', [0, 100], fade, setFade],
    ['highlights', 'Highlights', [-100, 100], highlights, setHighlights],
    ['shadows', 'Shadows', [-100, 100], shadows, setShadows],
    ['vignette', 'Vignette', [0, 100], vignette, setVignette],
    ['grain', 'Grain', [0, 100], grain, setGrain],
    ['sharpen', 'Sharpen', [0, 100], sharpen, setSharpen],
  ] as [string, string, [number, number], Accessor<number>, (value: number) => void][];

  const { applyFilter, restoreFilters } = useFilters();

  function init() {
    console.log('Enhance init');
  }

  function destroy() {
    console.log('Enhance destroy');
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function handleFilterChange(e: InputEvent) {
    if (e.target === null) {
      return;
    }

    const input = e.target as HTMLInputElement;
    const filterName = input.dataset.name;
    const newValue = Number.parseInt(input.value);

    if (filterName === undefined) {
      return;
    }

    const signalSetter = effects.find(([effect]) => effect === filterName)?.[4] as (value: number) => void;

    signalSetter(newValue);

    const layer = props.layerMaganer().getBaseCanvasLayer();

    layer.redraw();

    /**
     * @todo optimize
     */
    restoreFilters(layer.canvas, filterName);

    applyFilter(layer.canvas, filterName, newValue);

    layer.save();
  };

  return (
    <>
      <div class="enhance">
        <For each={effects}>
          {([effect, name, [min, max], signal]) => (
            <div class="adjust">
              <div class="adjust__name-and-value">
                {name}
                <div class="adjust__name-and-value-value">{ signal() }</div>
              </div>
              <div class="adjust__line">
                <input
                  type="range"
                  data-name={effect.toString()}
                  id={effect.toString()}
                  min={min}
                  max={max}
                  value="0"
                  onInput={handleFilterChange}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

export default Enhance;
