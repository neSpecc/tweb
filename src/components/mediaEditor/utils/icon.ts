import AlignCenter from '../assets/icons/align-center.svg?raw';
import AlignLeft from '../assets/icons/align-left.svg?raw';
import AlignRight from '../assets/icons/align-right.svg?raw';
import Brush from '../assets/icons/brush.svg?raw';
import Clock from '../assets/icons/clock.svg?raw';
import Crop from '../assets/icons/crop.svg?raw';
import Flip from '../assets/icons/flip.svg?raw';
import ImageOriginal from '../assets/icons/imageoriginal.svg?raw';
import Ratio32 from '../assets/icons/ratio-3-2.svg?raw';
import Ratio43 from '../assets/icons/ratio-4-3.svg?raw';
import Ratio54 from '../assets/icons/ratio-5-4.svg?raw';
import Ratio76 from '../assets/icons/ratio-7-6.svg?raw';
import Ratio169 from '../assets/icons/ratio-16-9.svg?raw';
import RatioFree from '../assets/icons/ratio-free.svg?raw';
import RatioSquare from '../assets/icons/ratio-square.svg?raw';
import Redo from '../assets/icons/redo.svg?raw';
import Rotate from '../assets/icons/rotate.svg?raw';
import Smile from '../assets/icons/smile.svg?raw';
import Text from '../assets/icons/text.svg?raw';
import Undo from '../assets/icons/undo.svg?raw';
import FontFrameBlack from '../assets/icons/font-frame-black.svg?raw';
import FontFrameNo from '../assets/icons/font-frame-no.svg?raw';
import FontFrameWhite from '../assets/icons/font-frame-white.svg?raw';

const Cross = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289Z" fill="white"/>
</svg>
`;

const Enhance = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M17 4C17 3.44772 16.5523 3 16 3C15.4477 3 15 3.44772 15 4V6V8C15 8.55228 15.4477 9 16 9C16.5523 9 17 8.55228 17 8V7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H17V4ZM3 6C3 5.44772 3.44772 5 4 5H12C12.5523 5 13 5.44772 13 6C13 6.55228 12.5523 7 12 7H4C3.44772 7 3 6.55228 3 6ZM3 18C3 17.4477 3.44772 17 4 17H8C8.55228 17 9 17.4477 9 18C9 18.5523 8.55228 19 8 19H4C3.44772 19 3 18.5523 3 18ZM12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13H20C20.5523 13 21 12.5523 21 12C21 11.4477 20.5523 11 20 11H12ZM13 16V17H20C20.5523 17 21 17.4477 21 18C21 18.5523 20.5523 19 20 19H13V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V18V16C11 15.4477 11.4477 15 12 15C12.5523 15 13 15.4477 13 16ZM3 12C3 11.4477 3.44772 11 4 11H7V10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10V12V14C9 14.5523 8.55228 15 8 15C7.44772 15 7 14.5523 7 14V13H4C3.44772 13 3 12.5523 3 12Z" fill="white"/>
</svg>
`;

export default function Icon(name: string, className?: string): HTMLDivElement {
  const iconEl = document.createElement('div');

  iconEl.classList.add('tmp-icon', `tmp-icon--${name}`);

  if(className) {
    iconEl.classList.add(className);
  }

  let innerHTML = '';

  switch(name) {
    case 'align-center':
      innerHTML = AlignCenter;
      break;
    case 'align-left':
      innerHTML = AlignLeft;
      break;
    case 'align-right':
      innerHTML = AlignRight;
      break;
    case 'brush':
      innerHTML = Brush;
      break;
    case 'clock':
      innerHTML = Clock;
      break;
    case 'crop':
      innerHTML = Crop;
      break;
    case 'flip':
      innerHTML = Flip;
      break;
    case 'fontframe':
      innerHTML = FontFrame;
      break;
    case 'imageoriginal':
      innerHTML = ImageOriginal;
      break;
    case 'ratio-3-2':
      innerHTML = Ratio32;
      break;
    case 'ratio-4-3':
      innerHTML = Ratio43;
      break;
    case 'ratio-5-4':
      innerHTML = Ratio54;
      break;
    case 'ratio-7-6':
      innerHTML = Ratio76;
      break;
    case 'ratio-16-9':
      innerHTML = Ratio169;
      break;
    case 'ratio-free':
      innerHTML = RatioFree;
      break;
    case 'ratio-square':
      innerHTML = RatioSquare;
      break;
    case 'redo':
      innerHTML = Redo;
      break;
    case 'rotate':
      innerHTML = Rotate;
      break;
    case 'smile':
      innerHTML = Smile;
      break;
    case 'text':
      innerHTML = Text;
      break;
    case 'undo':
      innerHTML = Undo;
      break;
    case 'enhance':
      innerHTML = Enhance;
      break;
    case 'cross':
      innerHTML = Cross;
      break;
    case 'font-frame-black':
      innerHTML = FontFrameBlack;
      break;
    case 'font-frame-no':
      innerHTML = FontFrameNo;
      break;
    case 'font-frame-white':
      innerHTML = FontFrameWhite;
      break;
  }

  iconEl.innerHTML = innerHTML;

  return iconEl;
}
