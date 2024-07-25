import type { DivLayer } from './useCanvasLayers';
import type { DraggableBox } from './useDraggableBox';

interface UseTextToolParams {
  layer: DivLayer;
  onFontSizeChange?: (value: number) => void;
}

interface TextareaState {
  fontSize: number;
  originalWidth: number;
  originalPaddingBlock: number;
  originalPaddingInline: number;
  style: 'regular' | 'stroked' | 'backgrounded';
  alignment: 'left' | 'center' | 'right';
  color: string;
}

export function useTextTool(params: UseTextToolParams) {
  /**
   * Actual state of each text-box
   */
  const state = new WeakMap<DraggableBox, TextareaState>();

  const currentFontSize = 45;
  const originalPaddingBlock = 12;
  const originalPaddingInline = 10;
  const CSS = {
    textBox: 'text-box',
    textBoxLineWrapper: 'text-box__line',
    textBoxStroked: 'text-box--stroked',
    textBoxBackgrounded: 'text-box--backgrounded',
    textBoxLeftAligned: 'text-box--left-aligned',
    textBoxCenterAligned: 'text-box--center-aligned',
    textBoxRightAligned: 'text-box--right-aligned',
  };

  function updateBoxParam(box: DraggableBox, newParams: Partial<TextareaState>): void {
    state.set(box, {
      ...state.get(box) as TextareaState ?? {},
      ...newParams,
    });

    const statesToStoreInBoxMeta = ['style', 'alignment', 'color'] as (keyof Pick<TextareaState, 'style' | 'alignment' | 'color'>)[];

    for (const key of statesToStoreInBoxMeta) {
      const value = newParams[key];

      if (value) {
        box.meta[key] = value;
      }
    }
  }

  function onLayerClick(event: MouseEvent) {
    const { offsetX, offsetY } = event;

    addText(offsetX, offsetY);
    params.layer.removeEmptyBoxes();
  }

  function changeBoxTextareaSize(box: DraggableBox, newFontSize: number): void {
    const prevState = state.get(box);
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if (!prevState) {
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

  // function wrapTextInBackgroundSpan(editableDiv: HTMLDivElement) {
  //   console.log(editableDiv.textContent, editableDiv.textContent!.split('\n'));

  //   // const content = editableDiv.textContent!.split('\n').map((line) => {
  //   //   return `<span class="background-span">${line}</span>`;
  //   // }).join('\n');
  //   const childNodes = Array.from(editableDiv.childNodes);
  //   childNodes.forEach((node) => {
  //     if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
  //       const span = document.createElement('span');
  //       span.className = 'background-span';
  //       span.textContent = node.textContent;
  //       editableDiv.replaceChild(span, node);
  //     }
  //     else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
  //       // Do nothing for <br> elements, allow them to be preserved
  //     }
  //   });
  //   // editableDiv.innerHTML = content;
  // }

  function focusEditableDiv(editableDiv: HTMLDivElement) {
    const lineWrapper = editableDiv.querySelectorAll(`.${CSS.textBoxLineWrapper}`);

    console.log('lineWrapper', lineWrapper);

    if (lineWrapper.length === 0) {
      return;
    }

    const lastLine = lineWrapper[lineWrapper.length - 1];

    /**
     * If line is empty, add zero-width space to it
     */
    if (lastLine.textContent === '') {
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
    const boxState = state.get(box) as TextareaState;

    if (boxState.style !== 'backgrounded') {
      return;
    }

    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLDivElement;
    // Remove any existing SVG
    const existingSvg = textarea.querySelector('svg');
    if (existingSvg) {
      existingSvg.remove();
    }

    const textBoxLines = textarea.querySelectorAll('.text-box__line');
    if (textBoxLines.length === 0) {
      console.error('No elements found with class .text-box__line');
      return;
    }

    const bgColor = boxState.color;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    let pathData = '';

    const textareaRect = textarea.getBoundingClientRect();

    // Calculate positions and dimensions for all lines first to minimize layout thrashing
    const lines = Array.from(textBoxLines).map((line) => {
      const rect = line.getBoundingClientRect();
      const left = rect.left - textareaRect.left;
      const top = rect.top - textareaRect.top;
      const right = left + rect.width;
      const bottom = top + rect.height;

      return {
        left,
        top,
        right,
        bottom,
      };
    });
    const radius = boxState.fontSize > 30 ? 16 : boxState.fontSize / 1.5;

    function traverseFromTopToBottom(lineIndex: number): string {
      let result = '';
      const line = lines[lineIndex];
      const next = lines[lineIndex + 1];

      if (!line) {
        throw new Error(`Line not found: ${lineIndex}`);
      }

      const { right, bottom } = line;

      result += `L${line.right},${line.bottom - radius}`;

      if (next) {
        const distance = Math.abs(next.right - right);
        const radiusAdjusted = Math.min(radius, distance / 2);

        console.log('distance', distance, 'radiusAdjusted', radiusAdjusted, radius);

        if (right < next.right) { // If the next line is wider
          result += `Q${right},${bottom} ${right + radiusAdjusted},${next.top}`; // Bottom-right corner rounded
          result += `L${next.right - radiusAdjusted},${next.top}`;
          result += `Q${next.right},${next.top} ${next.right},${next.top + radiusAdjusted}`;
        }
        else if (right > next.right) {
          result += `Q${right},${bottom} ${right - radiusAdjusted},${bottom}`; // Bottom-right corner rounded
          result += `L${next.right + radiusAdjusted},${bottom}`;
          result += `Q${next.right},${bottom} ${next.right},${next.top + radiusAdjusted}`;
        }
        else { // right === next.right
          result += `L${right},${bottom + radius}`;
        }
      }

      return result;
    }

    function traverseFromBottomToTop(lineIndex: number): string {
      let result = '';
      const line = lines[lineIndex];
      const prev = lines[lineIndex - 1];

      if (!line) {
        throw new Error(`Line not found: ${lineIndex}`);
      }

      const { left } = line;

      result += `L${line.left},${line.top + radius}`;

      const distance = Math.abs(prev.left - left);
      const radiusAdjusted = Math.min(radius, distance / 2);

      if (left > prev.left && left) {
        result += `Q${line.left},${line.top} ${line.left - radiusAdjusted},${prev.bottom}`;
        result += `L${prev.left + radiusAdjusted},${prev.bottom}`;
        result += `Q${prev.left},${prev.bottom} ${prev.left},${prev.bottom - radiusAdjusted}`;
      }
      else if (left < prev.left) {
        result += `Q${line.left},${line.top} ${line.left + radiusAdjusted},${prev.bottom}`;
        result += `L${prev.left - radiusAdjusted},${prev.bottom}`;
        result += `Q${prev.left},${prev.bottom} ${prev.left},${prev.bottom - radiusAdjusted}`;
      }
      else {
        result += `L${prev.left},${prev.bottom - radius}`;
      }

      return result;
    }

    let curIndex = 0;
    const firstLine = lines[curIndex];

    /**
     * Begin at top+radius and turn bottom to start traversing from top to bottom
     */
    pathData += `M${firstLine.left + radius},${firstLine.top}`; // Move to the starting point with radius offset
    pathData += `L${firstLine.right - radius},${firstLine.top}`;
    pathData += `Q${firstLine.right},${firstLine.top} ${firstLine.right},${firstLine.top + radius}`; // Top-right corner rounded

    while (curIndex < lines.length) {
      pathData += traverseFromTopToBottom(curIndex);
      curIndex++;
    }

    const lastLine = lines[lines.length - 1];

    /**
     * Now we're at the right bottom–radius point of the last block
     * Turn bottom left
     */
    pathData += `Q${lastLine.right},${lastLine.bottom} ${lastLine.right - radius},${lastLine.bottom}`; // Bottom-right corner rounded
    pathData += `L${lastLine.left + radius},${lastLine.bottom}`;
    pathData += `Q${lastLine.left},${lastLine.bottom} ${lastLine.left},${lastLine.bottom - radius}`;

    curIndex = lines.length - 1;

    while (curIndex > 0) {
      pathData += traverseFromBottomToTop(curIndex);
      curIndex--;
    }

    pathData += `L${firstLine.left},${firstLine.top + radius}`;
    pathData += `Q${firstLine.left},${firstLine.top} ${firstLine.left + radius},${firstLine.top}`;
    pathData += `Z`;

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', bgColor);
    svg.appendChild(path);

    const svgWidth = textarea.offsetWidth;
    const svgHeight = textarea.offsetHeight;
    svg.setAttribute('width', svgWidth.toString());
    svg.setAttribute('height', svgHeight.toString());
    svg.setAttribute('style', `position: absolute; left: 0; top: 0; pointer-events: none;`);

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
        const startState = state.get(box) as TextareaState;

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
          originalPaddingInline: Number.parseFloat(computedStyle.paddingInline),
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
      },
    });

    textarea.addEventListener('input', () => {
      // wrapTextInBackgroundSpan(textarea);
      box.adjustWidth();
      drawSvgShape(box);
    });

    textarea.addEventListener('beforeinput', (event: Event) => {
      const inputType = (event as InputEvent).inputType;

      /**
       * Prevent deleting last line wrapper
       */
      if (inputType === 'deleteContentBackward' && textarea.textContent!.replace('/\u200B/', '').trim() === '') {
        event.preventDefault();
      }

      if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
        event.preventDefault();
        insertLineWrapper(textarea);
        focusEditableDiv(textarea);
      }
    });

    box.append(textarea);
    params.layer.insertBox(box, x, y);
    params.layer.activateBox(box);

    updateBoxParam(box, {
      fontSize: currentFontSize,
      originalWidth: textarea.offsetWidth,
      originalPaddingBlock,
      originalPaddingInline,
      style: 'regular',
    });

    /**
     * Set initial font size and paddings
     */
    changeBoxTextareaSize(box, currentFontSize);

    // requestAnimationFrame(() => {
    //   console.log('raw');

    //   textarea.focus();
    // });
  }

  function setTextSize(value: number): void {
    const box = params.layer.getActiveBox();

    if (!box) {
      return;
    }

    changeBoxTextareaSize(box, value);
    box.resizeToFitContent();
    drawSvgShape(box);

    updateBoxParam(box, {
      fontSize: value,
    });
  }

  function toggleStoked(box: DraggableBox, state = true): void {
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if (!textarea) {
      return;
    }

    textarea.classList.toggle(CSS.textBoxStroked, state);
  }

  function toggleBackgrounded(box: DraggableBox, newState = true): void {
    const boxState = state.get(box) as TextareaState;
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if (!textarea) {
      return;
    }

    textarea.classList.toggle(CSS.textBoxBackgrounded, newState);

    if (newState) {
      drawSvgShape(box);
      textarea.style.color = boxState.color === '#ffffff' ? '#000000' : '#ffffff';
    }
    else {
      const existingSvg = textarea.querySelector('svg');
      if (existingSvg) {
        existingSvg.remove();
      }

      textarea.style.color = boxState.color;
    }
  }

  function setStyle(style: 'regular' | 'stroked' | 'backgrounded'): void {
    const box = params.layer.getActiveBox();

    if (!box) {
      return;
    }

    updateBoxParam(box, {
      style,
    });

    toggleBackgrounded(box, false);
    toggleStoked(box, false);

    switch (style) {
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
    const textarea = box.el.querySelector(`.${CSS.textBox}`) as HTMLDivElement;

    if (!textarea) {
      return;
    }

    textarea.classList.remove(CSS.textBoxLeftAligned, CSS.textBoxCenterAligned, CSS.textBoxRightAligned);
    textarea.classList.add(`text-box--${alignment}-aligned`);

    updateBoxParam(box, {
      alignment,
    });

    drawSvgShape(box);
  }

  function setColor(color: string): void {
    const box = params.layer.getActiveBox();
    const boxState = state.get(box) as TextareaState;
    const textarea = box?.el.querySelector(`.${CSS.textBox}`) as HTMLTextAreaElement;

    if (box === null || !textarea) {
      return;
    }

    textarea.style.color = boxState.style === 'backgrounded' ? (color === '#ffffff' ? '#000000' : '#ffffff') : color;

    updateBoxParam(box, {
      color,
    });

    drawSvgShape(box);
  }

  function init() {
    const { layer } = params;

    layer.div.addEventListener('mousedown', onLayerClick);
    layer.div.style.cursor = 'text';
  }

  function destroy() {
    const { layer } = params;

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
  };
}
