import type { Accessor } from 'solid-js';
import { createSignal, onCleanup, onMount } from 'solid-js';
import type { DivLayer, useCanvasLayers } from '../services/useCanvasLayers';
import { useTextTool } from '../services/useTextTool';
import Icon from '../utils/icon';
import ColorSelector from './ColorSelector';

interface TextToolProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

export default function TextTool(props: TextToolProps) {
  const [textLayer, setTextLayer] = createSignal<DivLayer>();
  const [textTool, setTextTool] = createSignal<ReturnType<typeof useTextTool>>();
  const [alignment, setAlignment] = createSignal<number>(0);
  const [textStyle, setTextStyle] = createSignal<number>(0);
  const [fontSize, setFontSize] = createSignal<number>(45);
  const [font, setFont] = createSignal<number>(0);

  const alignments: ['left' | 'center' | 'right', HTMLElement][] = [
    ['left', Icon('align-left')],
    ['center', Icon('align-center')],
    ['right', Icon('align-right')],
  ];

  const textStyles: ['regular' | 'stroked' | 'backgrounded', HTMLElement][] = [
    ['regular', Icon('font-frame-no')],
    ['stroked', Icon('font-frame-black')],
    ['backgrounded', Icon('font-frame-white')],
  ];

  const fonts = [
    'Roboto',
    'Typewriter',
    'Avenir Next',
    'Courier New',
    'Noteworthy',
    'Georgia',
    'Papyrus',
    'Snell Roundhand',
  ];

  function init() {
    let layer = textLayer();

    /**
     * Initialize text layer if it is  not already initialized
     */
    if (layer === undefined) {
      layer = props.layerMaganer().createDivLayer();

      setTextLayer(layer);
    }

    const tool = useTextTool({
      layer,
      onFontSizeChange: (value) => {
        setFontSize(value);
      },
    });

    tool.init();

    setTextTool(tool);
  }

  function destroy() {
    textTool()?.destroy();
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function handleFontSizeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = Number.parseInt(target.value);

    textTool()?.setTextSize(value);
  };

  function selectColor(color: string) {
    textTool()?.setColor(color);
  }

  function selectFont(index: number) {
    setFont(index);
    // textTool()?.setFont(fonts[index]);
  }

  function setStyle(index: number) {
    setTextStyle(index);
    textTool()?.setStyle(textStyles[index][0]);
  }

  function alignmentChanged(index: number) {
    setAlignment(index);
    textTool()?.setAlignment(alignments[index][0]);
  }

  return (
    <div class="pe-settings">
      <ColorSelector
        onSelect={selectColor}
      />
      <div class="pe-text__style">
        <div class="pe-text__style-section">
          {alignments.map(([_, icon], index) => (
            <div
              classList={{
                'pe-text__style-section-item': true,
                'pe-text__style-section-item--selected': alignment() === index,
              }}
              onClick={_ => alignmentChanged(index)}
            >
              { icon }
            </div>
          ))}
        </div>
        <div class="pe-text__style-section">
          {textStyles.map(([_, icon], index) => (
            <div
              classList={{
                'pe-text__style-section-item': true,
                'pe-text__style-section-item--selected': textStyle() === index,
              }}
              onClick={_ => setStyle(index)}
            >
              { icon }
            </div>
          ))}
        </div>
      </div>
      <div class="pe-settings__section-header">
        Size
      </div>

      <input
        type="range"
        min="10"
        max="80"
        class="slider"
        value={fontSize()}
        onInput={handleFontSizeChange}
      />

      <div class="pe-settings__section">
        <div class="pe-settings__section-header">
          Font
        </div>
        {fonts.map((title, index) => (
          <div
            classList={{
              'pe-settings-row': true,
              'pe-settings-row--selected': font() === index,
            }}
            onClick={_ => selectFont(index)}
          >
            <div class="pe-settings-row__title">
              {title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
