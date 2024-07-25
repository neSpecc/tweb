import type {Accessor} from 'solid-js';
import {createSignal, onCleanup, onMount} from 'solid-js';
import type {DivLayer, useCanvasLayers} from '../services/useCanvasLayers';
import {useTextTool} from '../services/useTextTool';
import ColorSelector from './ColorSelector';
import Icon from '../../icon';
import {RangeSelectorTsx} from '../../rangeSelectorTsx';
import ripple from '../../ripple';
import Icons from '../../../icons';

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

  const alignments: ['left' | 'center' | 'right', keyof typeof Icons][] = [
    ['left', 'align_left'],
    ['center', 'align_center'],
    ['right', 'align_right']
  ];

  const textStyles: ['regular' | 'stroked' | 'backgrounded', keyof typeof Icons][] = [
    ['regular', 'fontframe_no'],
    ['stroked', 'fontframe_black'],
    ['backgrounded', 'fontframe_white']
  ];

  const fonts = [
    'Roboto',
    'Typewriter',
    'Avenir Next',
    'Courier New',
    'Noteworthy',
    'Georgia',
    'Papyrus',
    'Snell Roundhand'
  ];

  function init() {
    let layer = textLayer();

    /**
     * Initialize text layer if it is  not already initialized
     */
    if(layer === undefined) {
      layer = props.layerMaganer().createDivLayer();

      setTextLayer(layer);
    }

    const tool = useTextTool({
      layer,
      onFontSizeChange: (value) => {
        setFontSize(value);
      }
    });

    tool.init();

    setTextTool(tool);
  }

  function destroy() {
    textLayer().deactivateAllBoxes();
    textTool()?.destroy();
  }

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  function handleFontSizeChange(value: number) {
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

  function createTextRow(title: string, index: number) {
    const row = (
      <div
        classList={{
          'pe-settings-row': true,
          'pe-settings-row--selected': font() === index
        }}
        onClick={_ => selectFont(index)}
      >
        <div class="pe-settings-row__title">
          {title}
        </div>
      </div>
    );

    ripple(row as HTMLElement);

    return row;
  }

  function createAttributeButton(icon: keyof typeof Icons, index: number, handler: (index: number) => void) {
    const button = (
      <div
        classList={{
          'pe-text__style-section-item': true,
          'pe-text__style-section-item--selected': textStyle() === index
        }}
        onClick={_ => handler(index)}
      >
        { Icon(icon) }
      </div>
    );

    ripple(button as HTMLElement);

    return button;
  }

  return (
    <div class="pe-settings">
      <ColorSelector
        onSelect={selectColor}
      />
      <div class="pe-text__style">
        <div class="pe-text__style-section">
          {alignments.map(([_, icon], index) => (
            createAttributeButton(icon, index, alignmentChanged)
          ))}
        </div>
        <div class="pe-text__style-section">
          {textStyles.map(([_, icon], index) => (
            createAttributeButton(icon, index, setStyle)
          ))}
        </div>
      </div>
      <div class="pe-settings__section-header pe-settings__section-header--slider">
        Size

        <div class='pe-settings__slider-counter'>
          { Math.floor(fontSize()) }
        </div>
      </div>

      <div class="pe-settings__slider">
        { RangeSelectorTsx({
          value: fontSize(),
          step: 1,
          min: 10,
          max: 80,
          onScrub(value) {
            handleFontSizeChange(value);
          }
        }) }
      </div>


      <div class="pe-settings__section">
        <div class="pe-settings__section-header">
          Font
        </div>
        {fonts.map((title, index) => (
          createTextRow(title, index)
        ))}
      </div>
    </div>
  );
}
