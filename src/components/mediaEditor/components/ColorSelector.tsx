import {createSignal} from 'solid-js';
import ColorPicker, {ColorPickerColor} from '../../colorPicker';

interface ColorSelectorProps {
  onSelect: (color: string) => void;
}

export default function ColorSelector(props: ColorSelectorProps) {
  const [color, setColor] = createSignal<number>(0);
  const [isColorPickerShown, setIsColorPickerShown] = createSignal<boolean>(false);

  const colors = [
    '#ffffff',
    '#FE4438',
    '#FF8901',
    '#FFD60A',
    '#33C759',
    '#62E5E0',
    '#0A84FF',
    '#BD5CF3',
    'custom'
  ];

  function selectColor(index: number) {
    setColor(index);

    if(colors[index] === 'custom') {
      setIsColorPickerShown(true);
      colorPicker.setColor('#ef208b');
      return;
    }

    props.onSelect(colors[index]);
  }

  function onColorChange(color: ColorPickerColor) {
    props.onSelect(color.hex);
  };

  const colorPicker = new ColorPicker({
    width: 200,
    height: 120,
    sliderHeight: 20,
    circleRadius: 10
  });

  colorPicker.onChange = onColorChange;

  return (
    <div class="pe-color-selector">
      <div class="pe-color-selector-circles">
        {colors.map((colorHex, index) => (
          <div
            classList={{
              'pe-color-selector-item': true,
              'pe-color-selector-item-selected': color() === index,
              'pe-color-selector-item-custom': colorHex === 'custom'
            }}
            onClick={_ => selectColor(index)}
          >
            <div
              class="pe-color-selector-item-icon"
              style={{
                'background': colorHex !== 'custom' ? colorHex : 'url(\'assets/img/color-picker-gradient.png\') center center / cover no-repeat'
              }}
            />
            <div
              class="pe-color-selector-item-glow"
              style={{
                'background-color': colorHex !== 'custom' ? colorHex : 'rgba(255, 255, 255, 0.6'
              }}
            />
          </div>
        ))}
      </div>
      { isColorPickerShown() &&  colorPicker.container }
      { isColorPickerShown() &&  (
        <div
          class="pe-color-selector-close-picker"
          onClick={_ => setIsColorPickerShown(false)}
        />
      ) }

    </div>
  );
}
