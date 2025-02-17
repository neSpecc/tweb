import type {Accessor} from 'solid-js';
import {For, createSignal, onCleanup, onMount} from 'solid-js';
import type {CanvasLayer, useCanvasLayers} from '../services/useCanvasLayers';
import {RangeSelectorTsx} from '../../rangeSelectorTsx';
import ApplyFilterCommand from '../services/commands/ApplyFilterCommand';
import {i18n} from '../../../lib/langPack';

interface EnhanceProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

type langPackFiltersKey = 'MediaEditor.Filters.Enhance'
  | 'MediaEditor.Filters.Brightness'
  | 'MediaEditor.Filters.Contrast'
  | 'MediaEditor.Filters.Saturation'
  | 'MediaEditor.Filters.Warmth'
  | 'MediaEditor.Filters.Fade'
  | 'MediaEditor.Filters.Highlights'
  | 'MediaEditor.Filters.Shadows'
  | 'MediaEditor.Filters.Vignette'
  | 'MediaEditor.Filters.Grain'
  | 'MediaEditor.Filters.Sharpen';

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
    ['sharpen', 'Sharpen', [0, 100], sharpen, setSharpen]
  ] as [string, string, [number, number], Accessor<number>, (value: number) => void][];

  function init() {
    if(!props.layerMaganer()) {

    }

    // const layer = props.layerMaganer().getBaseCanvasLayer();

    // setBrightness(layer.state.filters.brightness);
    // setContrast(layer.state.filters.contrast);
    // setSaturation(layer.state.filters.saturation);
    // setWarmth(layer.state.filters.warmth);
    // setFade(layer.state.filters.fade);
    // setHighlights(layer.state.filters.highlights);
    // setShadows(layer.state.filters.shadows);
    // setVignette(layer.state.filters.vignette);
    // setGrain(layer.state.filters.grain);
    // setSharpen(layer.state.filters.sharpen);
    // setEnhance(layer.state.filters.enhance);
  }

  function destroy() {
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    const layer = props.layerMaganer().getBaseCanvasLayer();

    layer.save();
    destroy();
  });

  function handleFilterChange(value: number, filterName: keyof CanvasLayer['state']['filters']) {
    const signalSetter = effects.find(([effect]) => effect === filterName)?.[4] as (value: number) => void;

    signalSetter(value);

    const layer = props.layerMaganer().getBaseCanvasLayer();

    layer.applyFilter(filterName, value);
  };

  let isBatching = false;

  function startBatchIfNeeded() {
    if(!isBatching) {
      props.layerMaganer().commands.startBatch();
      isBatching = true;
    }
  }

  return (
    <>
      <div class="enhance">
        <For each={effects}>
          {([effect, name, [min, max], signal]) => (
            <div class="adjust">
              <div class="adjust__name-and-value">
                {
                  i18n(`MediaEditor.Filters.${name}` as langPackFiltersKey)
                }
                <div
                  classList={
                    {
                      'adjust__name-and-value-value': true,
                      'adjust__name-and-value-value--zero': signal() === 0
                    }
                  }>
                  { signal() }
                </div>
              </div>
              <div class="adjust__line media-editor-slider">
                { RangeSelectorTsx({
                  value: signal(),
                  step: 1,
                  min,
                  max,
                  zeroCentered: min < 0,
                  onScrub(value) {
                    // handleFilterChange(value, effect.toString() as keyof CanvasLayer['state']['filters']);

                    startBatchIfNeeded();

                    const signalSetter = effects.find(([e]) => e === effect)?.[4];

                    props.layerMaganer().commands.execute(
                      new ApplyFilterCommand(
                        props.layerMaganer().getBaseCanvasLayer(),
                        effect as keyof CanvasLayer['state']['filters'],
                        value,
                        () => {
                          signalSetter(value);
                        })
                    );
                  },
                  onMouseDown() {
                    startBatchIfNeeded();;
                    props.layerMaganer().commands.startBatch();
                  },
                  onMouseUp() {
                    if(isBatching) {
                      props.layerMaganer().commands.endBatch();
                      isBatching = false;
                    }
                  }
                }) }
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

export default Enhance;
