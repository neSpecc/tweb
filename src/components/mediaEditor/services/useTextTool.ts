import {isColorLight} from '../../../helpers/color';
import type {DivLayer} from './useCanvasLayers';
import type {DraggableBox, TextBoxMeta} from './useDraggableBox';

interface UseTextToolParams {
  layer: DivLayer;
  onFontSizeChange?: (value: number) => void;
}

type TextAlignment = 'left' | 'center' | 'right';
type TextStyle = 'regular' | 'stroked' | 'backgrounded';

export function useTextTool(params: UseTextToolParams) {
  /**
   * Actual state of each text-box
   */
  const state = new WeakMap<DraggableBox, TextBoxMeta>();

  const preset: {
    fontSize: number;
    color: string;
    alignment: TextAlignment;
    style: TextStyle;
    font: string;
  } = {
    fontSize: 45,
    color: '#ffffff',
    alignment: 'left',
    style: 'regular',
    font: 'Roboto'
  };

  const originalPaddingBlock = 12;
  const originalPaddingInline = 10;
  const CSS = {
    textBox: 'text-box',
    textBoxLineWrapper: 'text-box__line',
    textBoxStroked: 'text-box--stroked',
    textBoxBackgrounded: 'text-box--backgrounded',
    textBoxLeftAligned: 'text-box--left-aligned',
    textBoxCenterAligned: 'text-box--center-aligned',
    textBoxRightAligned: 'text-box--right-aligned'
  };

  function updateBoxParam(box: DraggableBox, newParams: Partial<TextBoxMeta>): void {
    const newState = {
      ...state.get(box) as TextBoxMeta ?? {},
      ...newParams
    } as TextBoxMeta;
    state.set(box, newState);

    box.meta = {
      ...box.meta,
      ...newParams
    };
  }

  function onLayerClick(event: MouseEvent) {
    const {offsetX, offsetY} = event;

    addText(offsetX, offsetY);
    params.layer.removeEmptyBoxes();
  }

  function changeBoxTextareaSize(box: DraggableBox, newFontSize: number): void {
    const prevState = state.get(box);
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if(!prevState) {
      throw new Error('Can change font size of the box since it is not initialized');
    }

    const scaleRatio = newFontSize / prevState.fontSize;

    const newPaddingTop = prevState.originalPaddingBlock * scaleRatio;
    const newPaddingRight = prevState.originalPaddingInline * scaleRatio;
    const newPaddingBottom = prevState.originalPaddingBlock * scaleRatio;
    const newPaddingLeft = prevState.originalPaddingInline * scaleRatio;

    // Update the font size and padding of the textarea
    textarea.style.paddingTop = `${newPaddingTop}px`;
    textarea.style.paddingRight = `${newPaddingRight}px`;
    textarea.style.paddingBottom = `${newPaddingBottom}px`;
    textarea.style.paddingLeft = `${newPaddingLeft}px`;
    textarea.style.fontSize = `${newFontSize}px`;

    params.onFontSizeChange?.(newFontSize);
  }

  function focusEditableDiv(editableDiv: HTMLDivElement) {
    const lineWrapper = editableDiv.querySelectorAll(`.${CSS.textBoxLineWrapper}`);

    if(lineWrapper.length === 0) {
      return;
    }

    const lastLine = lineWrapper[lineWrapper.length - 1];

    /**
     * If line is empty, add zero-width space to it
     */
    if(lastLine.textContent === '') {
      lastLine.textContent = '\u200B';
    }

    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(lastLine);
    range.collapse(false);

    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function insertLineWrapper(editableDiv: HTMLDivElement) {
    const lineWrapper = document.createElement('div');

    lineWrapper.classList.add(CSS.textBoxLineWrapper);
    editableDiv.appendChild(lineWrapper);
  }

  function drawSvgShape(box: DraggableBox) {
    const boxState = state.get(box) as TextBoxMeta;

    if(boxState.style !== 'backgrounded') {
      return;
    }

    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLDivElement;
    // Remove any existing SVG
    const existingSvg = textarea.querySelector('svg');
    if(existingSvg) {
      existingSvg.remove();
    }

    // const existingDots = box.el.querySelectorAll('.dot');
    // existingDots.forEach(dot => dot.remove());

    const textBoxLines = textarea.querySelectorAll('.text-box__line') as NodeListOf<HTMLDivElement>;
    if(textBoxLines.length === 0) {
      console.error('No elements found with class .text-box__line');
      return;
    }

    const bgColor = boxState.color;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    let pathData = '';

    const padX = boxState.fontSize / 4;
    const padY = boxState.fontSize / 8;
    const radius = boxState.fontSize / 2.2;

    // function dot(x: number, y: number, color = 'white'): string {
    //   const dot = document.createElement('div');
    //   dot.classList.add('dot');
    //   dot.style.position = 'absolute';
    //   dot.style.width = '4px';
    //   dot.style.height = '4px';
    //   dot.style.borderRadius = '5px';
    //   dot.style.left = `${x}px`;
    //   dot.style.top = `${y}px`;

    //   dot.style.backgroundColor = color;
    //   dot.style.transform = `translate(-50%, -50%)`;
    //   // dot.style.opacity = '0.2';

    //   box.append(dot);

    //   return '';
    // }

    let originalTransform;

    if(box.position.rotationAngle !== 0) {
      originalTransform = box.el.style.transform;
      box.el.style.transform = 'none';
    }

    const lines = Array.from(textBoxLines).map((line) => {
      const rect = line.getBoundingClientRect();
      const left = line.offsetLeft;
      const top = line.offsetTop;
      const right = left + rect.width;
      const bottom = top + rect.height;
      const width = rect.width;
      const height = rect.height;

      return {
        left,
        top,
        right,
        bottom,
        width,
        height
      };
    });

    if(box.position.rotationAngle !== 0) {
      box.el.style.transform = originalTransform;
    }

    function traverseFromTopToBottom(lineIndex: number): string {
      let result = '';
      const line = lines[lineIndex];
      const next = lines[lineIndex + 1];

      if(!line) {
        throw new Error(`Line not found: ${lineIndex}`);
      }

      const {right, bottom} = line;

      const rightPadded = right + padX;
      const bottomPadded = bottom + padY;

      if(next && next.right > right) {
        result += `L${rightPadded},${next.top - padY - radius}`;
        // dot(rightPadded, next.top - padY - radius);
      }
      else {
        result += `L${rightPadded},${bottomPadded - radius}`;
        // dot(rightPadded, bottomPadded - radius);
      }

      if(next) {
        const distance = Math.abs(next.right + padX - rightPadded);
        const radiusAdjusted = Math.min(radius, distance / 2);

        if(right < next.right) { // If the next line is wider
          result += `Q${rightPadded},${next.top - padY} ${rightPadded + radiusAdjusted},${next.top - padY}`; // Bottom-right corner rounded
          // dot(rightPadded, next.top - padY, 'green');
          // dot(rightPadded + radiusAdjusted, next.top - padY);

          result += `L${next.right + padX - radiusAdjusted},${next.top - padY}`;
          // dot(next.right + padX - radiusAdjusted, next.top - padY);
          result += `Q${next.right + padX},${next.top - padY} ${next.right + padX},${next.top - padY + radiusAdjusted}`;
          // dot(next.right + padX, next.top - padY);
          // dot(next.right + padX, next.top - padY + radiusAdjusted);
        }
        else if(right > next.right) {
          result += `Q${rightPadded},${bottomPadded} ${rightPadded - radiusAdjusted},${bottomPadded}`; // Bottom-right corner rounded
          // dot(rightPadded, bottomPadded);
          // dot(rightPadded - radiusAdjusted, bottomPadded, 'orange');

          result += `L${next.right + padX + radiusAdjusted},${bottomPadded}`;
          // dot(next.right + padX + radiusAdjusted, bottomPadded);

          result += `Q${next.right + padX},${bottomPadded} ${next.right + padX},${next.top + padY + radiusAdjusted}`;
          // dot(next.right + padX, bottomPadded);
          // dot(next.right + padX, next.top + padY + radiusAdjusted);
        }
        else { // right === next.right
          result += `L${rightPadded},${next.top + padY}`;
          // dot(rightPadded, next.top + padY);
        }
      }

      return result;
    }

    function traverseFromBottomToTop(lineIndex: number): string {
      let result = '';
      const line = lines[lineIndex];
      const prev = lines[lineIndex - 1];

      if(!line) {
        throw new Error(`Line not found: ${lineIndex}`);
      }

      const {left} = line;

      const distance = Math.abs(prev.left - left);
      const radiusAdjusted = Math.min(radius, distance / 2);

      if(prev.left < left) {
        result += `L${left - padX},${prev.bottom + padY + radiusAdjusted}`;
        // dot(left - padX, prev.bottom + padY + radiusAdjusted, 'black');
      }
      else {
        result += `L${left - padX},${prev.bottom - padY + radiusAdjusted}`;
        // dot(left - padX, prev.bottom - padY + radiusAdjusted, 'black');
      }

      if(left > prev.left && left) {
        result += `Q${line.left - padX},${prev.bottom + padY} ${line.left - padX - radiusAdjusted},${prev.bottom + padY}`;
        // dot(line.left - padX, prev.bottom + padY);
        // dot(line.left - padX - radiusAdjusted, prev.bottom + padY, 'orange');

        result += `L${prev.left - padX + radiusAdjusted},${prev.bottom + padY}`;
        // dot(prev.left - padX + radiusAdjusted, prev.bottom + padY);

        result += `Q${prev.left - padX},${prev.bottom + padY} ${prev.left - padX},${prev.bottom + padY - radiusAdjusted}`;
        // dot(prev.left - padX, prev.bottom + padY, 'blue');
        // dot(prev.left - padX, prev.bottom + padY - radiusAdjusted);
      }
      else if(left < prev.left) {
        result += `Q${line.left - padX},${line.top - padY} ${line.left - padX + radiusAdjusted},${prev.bottom - padY}`;
        // dot(line.left - padX, line.top - padY);
        // dot(line.left - padX + radiusAdjusted, prev.bottom - padY);

        result += `L${prev.left - padX - radiusAdjusted},${prev.bottom - padY}`;
        // dot(prev.left - padX - radiusAdjusted, prev.bottom - padY);

        result += `Q${prev.left - padX},${prev.bottom - padY} ${prev.left - padX},${prev.bottom - padY - radiusAdjusted}`;
        // dot(prev.left - padX, prev.bottom - padY);
        // dot(prev.left - padX, prev.bottom - padY - radiusAdjusted);
      }
      else {
        result += `L${prev.left - padX},${prev.bottom - padY}`;
        // dot(prev.left - padX, prev.bottom - padY, 'orange');
      }

      return result;
    }

    let curIndex = 0;
    const firstLine = lines[curIndex];

    /**
     * Begin at top+radius and turn bottom to start traversing from top to bottom
     */
    // dot(firstLine.left + radius - padX, firstLine.top - padY, 'red');
    pathData += `M${firstLine.left + radius - padX},${firstLine.top - padY}`; // Move to the starting point with radius offset
    // dot(firstLine.right + padX - radius, firstLine.top - padY, 'red');
    pathData += `L${firstLine.right + padX - radius},${firstLine.top - padY}`;
    // dot(firstLine.right + padX, firstLine.top - padY, 'red');
    // dot(firstLine.right + padX, firstLine.top - padY + radius, 'red');
    pathData += `Q${firstLine.right + padX},${firstLine.top - padY} ${firstLine.right + padX},${firstLine.top - padY + radius}`; // Top-right corner rounded

    while(curIndex < lines.length) {
      pathData += traverseFromTopToBottom(curIndex);
      curIndex++;
    }

    const lastLine = lines[lines.length - 1];

    /**
     * Now we're at the right bottom–radius point of the last block
     * Turn bottom left
     */
    pathData += `Q${lastLine.right + padX},${lastLine.bottom + padY} ${lastLine.right + padX - radius},${lastLine.bottom + padY}`; // Bottom-right corner rounded
    // dot(lastLine.right + padX, lastLine.bottom + padY, 'green');
    // dot(lastLine.right + padX - radius, lastLine.bottom + padY, 'green');
    pathData += `L${lastLine.left - padX + radius},${lastLine.bottom + padY}`;
    // dot(lastLine.left - padX + radius, lastLine.bottom + padY);

    pathData += `Q${lastLine.left - padX},${lastLine.bottom + padY} ${lastLine.left - padX},${lastLine.bottom + padY - radius}`;
    // dot(lastLine.left - padX, lastLine.bottom + padY, 'blue');
    // dot(lastLine.left - padX, lastLine.bottom + padY - radius, 'pink');

    curIndex = lines.length - 1;

    while(curIndex > 0) {
      pathData += traverseFromBottomToTop(curIndex);
      curIndex--;
    }

    pathData += `L${firstLine.left - padX},${firstLine.top - padY + radius}`;
    // dot(firstLine.left - padX, firstLine.top - padY + radius, 'red');
    pathData += `Q${firstLine.left - padX},${firstLine.top - padY} ${firstLine.left - padX + radius},${firstLine.top - padY}`;
    // dot(firstLine.left - padX, firstLine.top - padY, 'blue');
    // dot(firstLine.left - padX + radius, firstLine.top - padY, 'green');
    pathData += `Z`;

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', bgColor);
    path.setAttribute('transform', `translate(${padX}, ${padY})`);

    svg.appendChild(path);

    const svgWidth = textarea.offsetWidth + padX * 2;
    const svgHeight = textarea.offsetHeight + padY * 2;
    svg.setAttribute('width', `${svgWidth}px`);
    svg.setAttribute('height', `${svgHeight}px`);
    svg.setAttribute('style', `position: absolute; left: ${-padX}px; top: ${-padY}px; pointer-events: none;`);

    textarea.appendChild(svg);
  }

  function addText(x: number, y: number): void {
    const textarea = document.createElement('div');

    textarea.spellcheck = false;
    textarea.classList.add(CSS.textBox);
    insertLineWrapper(textarea);

    /**
     * @todo Disable pasting, shortcuts, etc
     */
    textarea.contentEditable = 'true';

    const box = params.layer.createBox({
      rotatable: true,
      preserveRatio: true,
      horizons: true,
      /**
       * We need to adjust font size based on the width of the box
       */
      onResize: (newWidth) => {
        const startState = state.get(box) as TextBoxMeta;
        const scaleRatio = newWidth / startState.originalWidth;
        const newFontSize = startState.fontSize * scaleRatio;

        changeBoxTextareaSize(box, newFontSize);
        drawSvgShape(box);
      },
      /**
       * Hide caret while resizing, dragging and rotating
       */
      onBeforeResize: () => {
        const computedStyle = window.getComputedStyle(textarea);

        updateBoxParam(box, {
          fontSize: Number.parseFloat(textarea.style.fontSize),
          originalWidth: textarea.offsetWidth,
          originalPaddingBlock: Number.parseFloat(computedStyle.paddingBlock),
          originalPaddingInline: Number.parseFloat(computedStyle.paddingInline)
        });
        textarea.blur();
      },
      onAfterResize: () => {
      },
      onBeforeDrag: () => {
        textarea.blur();
        params.layer.div.style.cursor = 'grabbing';
      },
      onBeforeRotate: () => {
        textarea.blur();
      },
      onAfterDrag: () => {
        params.layer.div.style.cursor = 'text';
      },
      onActivate: () => {
        requestAnimationFrame(() => {
          focusEditableDiv(textarea);
        });
      },
      onDeactivate() {
        textarea.blur();
      }
    });

    textarea.addEventListener('input', () => {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);

      if(!range) {
        return;
      }

      const currentLine = range.startContainer.parentElement;
      const currentLineRight = box.position.x + currentLine.getBoundingClientRect().width;
      const layerRight = params.layer.div.offsetWidth;
      const treshold = 50;

      if(currentLineRight + treshold > layerRight) {
        insertLineWrapper(textarea);
        focusEditableDiv(textarea);
      }

      box.adjustWidth();
      drawSvgShape(box);
    });

    textarea.addEventListener('beforeinput', (event: Event) => {
      const inputType = (event as InputEvent).inputType;

      /**
       * Prevent deleting last line wrapper
       */
      if(inputType === 'deleteContentBackward' && textarea.textContent!.replace('/\u200B/', '').trim() === '') {
        event.preventDefault();
      }

      if(inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
        event.preventDefault();
        insertLineWrapper(textarea);
        focusEditableDiv(textarea);
      }
    });

    box.append(textarea);
    params.layer.insertBox(box, x, y);
    params.layer.activateBox(box);

    updateBoxParam(box, {
      fontSize: preset.fontSize,
      originalWidth: textarea.offsetWidth,
      originalPaddingBlock,
      originalPaddingInline,
      style: 'regular'
    });

    /**
     * Set initial font size and paddings
     */
    changeBoxTextareaSize(box, preset.fontSize);

    setColor(preset.color);
    setAlignment(preset.alignment);
    setStyle(preset.style);
    setFont(preset.font);

    // requestAnimationFrame(() => {
    //   console.log('raw');

    //   textarea.focus();
    // });
  }

  function setTextSize(value: number): void {
    const box = params.layer.getActiveBox();

    if(!box) {
      return;
    }

    changeBoxTextareaSize(box, value);
    box.resizeToFitContent();
    drawSvgShape(box);

    updateBoxParam(box, {
      fontSize: value
    });
  }

  function toggleStoked(box: DraggableBox, state = true): void {
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if(!textarea) {
      return;
    }

    textarea.classList.toggle(CSS.textBoxStroked, state);
  }

  function toggleBackgrounded(box: DraggableBox, newState = true): void {
    const boxState = state.get(box) as TextBoxMeta;
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if(!textarea) {
      return;
    }

    textarea.classList.toggle(CSS.textBoxBackgrounded, newState);

    if(newState) {
      drawSvgShape(box);
      textarea.style.color = boxState.color === '#ffffff' ? '#000000' : '#ffffff';
    }
    else {
      const existingSvg = textarea.querySelector('svg');
      if(existingSvg) {
        existingSvg.remove();
      }

      textarea.style.color = boxState.color;
    }
  }

  function setStyle(style: 'regular' | 'stroked' | 'backgrounded'): void {
    const box = params.layer.getActiveBox();

    if(!box) {
      preset.style = style;
      return;
    }

    updateBoxParam(box, {
      style
    });

    toggleBackgrounded(box, false);
    toggleStoked(box, false);

    switch(style) {
      case 'regular':
        break;
      case 'stroked':
        toggleStoked(box, true);
        break;
      case 'backgrounded':
        toggleBackgrounded(box, true);
    }
  }

  function setAlignment(alignment: 'left' | 'center' | 'right'): void {
    const box = params.layer.getActiveBox()!;

    if(!box) {
      preset.alignment = alignment;
      return;
    }

    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLDivElement;

    if(!textarea) {
      return;
    }

    textarea.classList.remove(CSS.textBoxLeftAligned, CSS.textBoxCenterAligned, CSS.textBoxRightAligned);
    textarea.classList.add(`text-box--${alignment}-aligned`);

    updateBoxParam(box, {
      alignment
    });

    drawSvgShape(box);
  }

  async function setFont(fontFamily: string): Promise<void> {
    const box = params.layer.getActiveBox();

    if(!box) {
      preset.font = fontFamily;
      return;
    }

    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if(!textarea) {
      return;
    }

    const toBeBold = ['Roboto', 'Courier New', 'Georgia'];

    textarea.style.fontFamily = fontFamily;
    textarea.style.fontWeight = toBeBold.includes(fontFamily) ? 'bold' : 'normal';

    updateBoxParam(box, {
      font: fontFamily
    });

    drawSvgShape(box);
  }

  function setColor(color: string): void {
    const box = params.layer.getActiveBox();
    const boxState = state.get(box) as TextBoxMeta;
    const textarea = box?.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if(box === null || !textarea) {
      preset.color = color;
      return;
    }

    let textColor = color;

    if(boxState.style === 'backgrounded') {
      textColor = isColorLight(color) ? '#000000' : '#ffffff';
    }

    textarea.style.color = textColor;

    updateBoxParam(box, {
      color
      // save second color
    });

    drawSvgShape(box);
  }

  function init() {
    const {layer} = params;

    layer.div.addEventListener('mousedown', onLayerClick);
    layer.div.style.cursor = 'text';
  }

  function destroy() {
    const {layer} = params;

    layer.div.removeEventListener('mousedown', onLayerClick);
    layer.deactivateAllBoxes();
    layer.div.style.cursor = 'default';
  }

  return {
    init,
    destroy,
    setTextSize,
    setStyle,
    setAlignment,
    setColor,
    setFont
  };
}
