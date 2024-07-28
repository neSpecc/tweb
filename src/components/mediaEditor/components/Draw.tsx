import type {Accessor} from 'solid-js';
import {createSignal, onCleanup, onMount} from 'solid-js';
import type {useCanvasLayers} from '../services/useCanvasLayers';
import type {DrawingTool} from '../services/useDrawing';
import {useDrawing} from '../services/useDrawing';
import ColorSelector from './ColorSelector';
import ToolIcon from './ToolIcon';
import ripple from '../../ripple';
import {RangeSelectorTsx} from '../../rangeSelectorTsx';

interface BrushProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

export default function Brush(props: BrushProps) {
  const [color, setColor] = createSignal<number>(0);
  const [colorHex, setColorHex] = createSignal<string>('#ffffff');
  const [size, setSize] = createSignal<number>(15);
  const [tool, setTool] = createSignal<number>(0);
  const [drawing, setDrawing] = createSignal<ReturnType<typeof useDrawing>>();

  const tools: DrawingTool[] = [
    'pen',
    'arrow',
    'brush',
    'neon',
    'blur',
    'eraser'
  ];

  function init() {
    const layer = props.layerMaganer().getBaseCanvasLayer();

    const drawingService = useDrawing({
      layerManager: props.layerMaganer(),
      originalImageOffscreenCanvas: layer.originalImageOffscreenCanvas,
      originalImageOffscreenContext: layer.originalImageOffscreenContext,
      imageData: layer.imageData,
      visibleCanvas: layer.visibleCanvas
    });

    setDrawing(drawingService);

    if(!layer.imageData) {
      throw new Error('Canvas image data is not set');
    }

    drawingService.init();
    drawingService.setBrushSize(size());
    drawingService.setTool(tools[tool()]);
  }
  function destroy() {
    const drawingService = drawing();

    if(!drawingService) {
      return;
    }

    const layer = props.layerMaganer().getBaseCanvasLayer();

    layer.save();

    drawingService.destroy();
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function selectColor(color: string) {
    drawing()!.setColor(color);
    setColorHex(color);
  }

  function selectBrushSize(size: number) {
    setSize(size);

    drawing()!.setBrushSize(size);
  }

  function selectTool(index: number) {
    setTool(index);

    drawing()!.setTool(tools[index]);
  }

  function creaToolRow(title: string, index: number) {
    const row = (
      <div
        classList={{
          'pe-settings-row': true,
          'pe-settings-row--selected': tool() === index
        }}
        onClick={_ => selectTool(index)}
        style={{
          '--color': tool() === index ? colorHex() : undefined
        }}
      >
        <div class="pe-settings-row__icon">
          { ToolIcon(title) }
        </div>
        <div class="pe-settings-row__title">
          {title}
        </div>
      </div>
    );

    ripple(row as HTMLElement);

    return row;
  }

  return (
    <div class="pe-settings">
      <div class="pe-settings__tool pe-draw">
        <ColorSelector
          onSelect={selectColor}
        />
        <div class="pe-settings__section">
          <div class="pe-settings__section-header pe-settings__section-header--slider">
            Size

            <div>
              {size()}
            </div>
          </div>
          <div class="pe-settings__slider media-editor-slider">
            { RangeSelectorTsx({
              value: size(),
              step: 1,
              min: 1,
              max: 30,
              onScrub(value) {
                selectBrushSize(value);
              }
            }) }
          </div>
        </div>

        <div class="pe-settings__section">
          <div class="pe-settings__section-header">
            Tool
          </div>
          <div>
            {tools.map((toolTitle, index) => (
              creaToolRow(toolTitle, index)
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
