import type {Accessor} from 'solid-js';
import {createSignal, onCleanup, onMount} from 'solid-js';
import type {useCanvasLayers} from '../services/useCanvasLayers';
import type {DrawingTool} from '../services/useDrawing';
import {useDrawing} from '../services/useDrawing';
import ColorSelector from './ColorSelector';
import ToolIcon from './ToolIcon';

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
      originalImageOffscreenCanvas: layer.originalImageOffscreenCanvas,
      imageData: layer.imageData,
      visibleCanvas: layer.visibleCanvas,
      onDraw() {
        layer.sync();
      }
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

  return (
    <div class="pe-settings">
      <div class="pe-settings__tool pe-draw">
        <ColorSelector
          onSelect={selectColor}
        />
        {/* <div class="pe-draw__color">
        {colors.map((colorHex, index) => (
          <div
            classList={{
              'pe-draw__color-item': true,
              'pe-draw__color-item--selected': color() === index,
            }}
            onClick={_ => selectColor(index)}
          >
            <div class="pe-draw__color-item-icon" style={{ 'background-color': colorHex }} />
            <div class="pe-draw__color-item-glow" style={{ 'background-color': colorHex }} />
          </div>
        ))}
      </div> */}
        <div class="pe-settings__section-header">
          Size
        </div>
        <input
          type="range"
          class="pe-draw__size"
          min="1"
          max="30"
          step="1"
          value={size()}
          onInput={(e: InputEvent) => selectBrushSize(Number.parseInt((e.target as HTMLInputElement).value))}
        />
        <div class="pe-settings__section">
          <div class="pe-settings__section-header">
            Tool
          </div>
          {tools.map((toolTitle, index) => (
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
                { ToolIcon(toolTitle) }
              </div>
              <div class="pe-settings-row__title">
                {toolTitle}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
