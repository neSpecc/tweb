import {createSignal} from 'solid-js';

interface ColorSelectorProps {
  onSelect: (color: string) => void;
}

export default function ColorSelector(props: ColorSelectorProps) {
  const [color, setColor] = createSignal<number>(0);

  const colors = [
    '#ffffff',
    '#FE4438',
    '#FF8901',
    '#FFD60A',
    '#33C759',
    '#62E5E0',
    '#0A84FF',
    '#BD5CF3',
    '#000000'
  ];

  function selectColor(index: number) {
    setColor(index);
    props.onSelect(colors[index]);
  }

  return (
    <div class="pe-color-selector">
      {colors.map((colorHex, index) => (
        <div
          classList={{
            'pe-color-selector__item': true,
            'pe-color-selector__item--selected': color() === index
          }}
          onClick={_ => selectColor(index)}
        >
          <div class="pe-color-selector__item-icon" style={{'background-color': colorHex}} />
          <div class="pe-color-selector__item-glow" style={{'background-color': colorHex}} />
        </div>
      ))}
    </div>
  );
}
