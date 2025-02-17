import DragBoxCommand from './commands/DragBoxCommand';
import RotateBoxCommand from './commands/RotateBoxCommand';
import ScaleBoxCommand from './commands/ScaleBoxCommand';
import type {CommandsService} from './useCanvasLayers';

export interface TextBoxMeta {
  fontSize: number;
  originalWidth: number;
  originalPaddingBlock: number;
  originalPaddingInline: number;
  style: 'regular' | 'stroked' | 'backgrounded';
  alignment: 'left' | 'center' | 'right';
  color: string;
  font: string;
  bgPadX: number;
  bgPadY: number;
  bgRadius: number;
}

export interface DraggableBox {
  el: HTMLDivElement;
  creationAttributes: DraggableBoxCreationAttributes;
  insert: (parent: HTMLElement, x: number, y: number) => void;
  moveTo: (x: number, y: number) => void;
  remove: () => void;
  append: (element: HTMLElement) => void;
  activate: () => void;
  deactivate: () => void;
  adjustWidth: () => void;
  isActive: () => boolean;
  isEmpty: () => boolean;
  reposition: () => void;
  resizeToFitContent: () => void;
  export: (scaleFactor: number) => Promise<HTMLCanvasElement>;
  setMeta: (key: keyof TextBoxMeta, value: string) => void;

  meta: TextBoxMeta;

  position: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotationAngle: number;
  };

  initialMouseAngle?: number;
}

interface DraggableBoxParent {
  element: HTMLElement;
  mouseMoveListener: (event: MouseEvent) => void;
  mouseUpListener: (event: MouseEvent) => void;
  rect: DOMRect;
  horizons: Map<string, Horizon>;
}

interface ScalingBoxData {
  box: DraggableBox;
  direction: DraggableBoxDirection;
  startPoint: {
    pageX: number;
    pageY: number;
  };
  startSize: {
    width: number;
    height: number;
  };
}

interface Horizon {
  element: HTMLElement;
}

interface RotatingBoxData {
  box: DraggableBox;
  startRotationAngle: number;
}

interface DraggingBoxData {
  box: DraggableBox;
  startOffsetWithinBox: {
    x: number;
    y: number;
  };
}

export interface DraggableBoxCreationAttributes {
  width?: number;
  height?: number;
  style?: 'solid' | 'dashed';
  rotatable?: boolean;
  horizons?: boolean;
  preserveRatio?: boolean;
  scaleHistory?: boolean;
  onBeforeResize?: () => void;
  onBeforeDrag?: () => void;
  onBeforeRotate?: () => void;
  onResize?: (newWidth: number, newHeight: number, newLeft?: number, newTop?: number) => void;
  onDrag?: (x: number, y: number) => void;
  onAfterDrag?: () => void;
  onAfterResize?: () => void;
  onBeforeActivate?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

const CSS = {
  draggableBox: 'draggable-box',
  draggableBoxDragging: 'draggable-box--dragging',
  draggableBoxActive: 'draggable-box--active',
  draggableBoxCorner: 'draggable-box__corner',
  draggableBoxCornerActive: 'draggable-box__corner--active',
  draggableBoxScaler: 'draggable-box__scaler',
  draggableBoxRotator: 'draggable-box__rotator',
  draggableBoxContent: 'draggable-box__content',
  horizonWrapper: 'db-horizon-wrapper',
  horizon: 'db-horizon',
  horizonAnimateOut: 'db-horizon--animate-out'
};

/**
 * Corner locations
 * Scale directions
 */
type DraggableBoxDirection = 'top left' | 'top right' | 'bottom left' | 'bottom right';

export function useDraggableBox(commands: CommandsService) {
  let currentlyScaling: ScalingBoxData | null = null;
  let currentlyDragging: DraggingBoxData | null = null;
  let currentlyRotating: RotatingBoxData | null = null;

  const parentMap = new WeakMap<HTMLDivElement, DraggableBoxParent>();

  function moveTo(box: DraggableBox, x: number, y: number) {
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    /**
     * Do nothing if coors are not changed
     */
    if(box.position.x === x && box.position.y === y) {
      return;
    }

    /**
     * Prevent moving outside the parent
     */
    const parentRect = parent.rect;
    const boxRect = {
      width: box.position.width,
      height: box.position.height
    };

    if(x < 0) {
      x = 0;
    }
    else if(x + boxRect.width > parentRect.width) {
      x = parentRect.width - boxRect.width;
    }

    if(y < 0) {
      y = 0;
    }
    else if(y + boxRect.height > parentRect.height) {
      y = parentRect.height - boxRect.height;
    }

    box.el.style.left = `${x}px`;
    box.el.style.top = `${y}px`;

    box.position.x = x;
    box.position.y = y;

    box.creationAttributes.onDrag?.(x, y);
  }

  function getPointInParent(parent: DraggableBoxParent, x: number, y: number) {
    const parentRect = parent.rect;

    return {
      x: x - parentRect.left,
      y: y - parentRect.top
    };
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function scale(scalingBox: ScalingBoxData, event: MouseEvent, minSize = 0) {
    const box = scalingBox.box;
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    const pageX = event.pageX;
    const pageY = event.pageY;

    const boxRect = {
      left: box.position.x,
      top: box.position.y,
      width: box.position.width,
      height: box.position.height
    };

    const boxLeftInParent = boxRect.left;
    const boxTopInParent = boxRect.top;

    const pageXYInParent = getPointInParent(parent, pageX, pageY);

    const distanceX = pageXYInParent.x - boxLeftInParent;
    const distanceY = pageXYInParent.y - boxTopInParent;

    let newWidth, newHeight, newLeft, newTop;

    const maxWidth = parent.rect.width;
    const maxHeight = parent.rect.height;

    const aspectRatio = boxRect.width / boxRect.height;
    const preserveRatio = box.creationAttributes.preserveRatio;

    function adjustDimensions(width: number, height: number, left: number, top: number) {
      let adjustedWidth = width;
      let adjustedHeight = height;
      let adjustedLeft = left;
      let adjustedTop = top;

      if(preserveRatio) {
        adjustedHeight = adjustedWidth / aspectRatio;

        if(adjustedLeft < 0) {
          adjustedWidth += adjustedLeft; // Adjust width if left position is negative
          adjustedHeight = adjustedWidth / aspectRatio;
          adjustedLeft = 0;
        }

        if(adjustedLeft + adjustedWidth > maxWidth) {
          adjustedWidth = maxWidth - adjustedLeft;
          adjustedHeight = adjustedWidth / aspectRatio;
        }

        if(adjustedTop < 0) {
          adjustedTop = 0;
        }

        if(adjustedTop + adjustedHeight > maxHeight) {
          adjustedHeight = maxHeight - adjustedTop;
          adjustedWidth = adjustedHeight * aspectRatio;
        }

        adjustedWidth = Math.max(adjustedWidth, minSize);
        adjustedHeight = Math.max(adjustedHeight, minSize);
      }
      else {
        if(adjustedLeft < 0) {
          adjustedLeft = 0;
        }
        if(adjustedTop < 0) {
          adjustedTop = 0;
        }

        adjustedWidth = clamp(adjustedWidth, minSize, maxWidth - adjustedLeft);
        adjustedHeight = clamp(adjustedHeight, minSize, maxHeight - adjustedTop);
      }

      return {width: adjustedWidth, height: adjustedHeight, left: adjustedLeft, top: adjustedTop};
    }

    switch(scalingBox.direction) {
      case 'top left':
        newWidth = boxRect.width - distanceX;
        newHeight = preserveRatio ? newWidth / aspectRatio : boxRect.height - distanceY;
        newLeft = boxLeftInParent + (boxRect.width - newWidth);
        newTop = boxTopInParent + (boxRect.height - newHeight);
        if(newLeft < 0) {
          newLeft = 0;
          newWidth = boxRect.width + boxLeftInParent;
          newHeight = preserveRatio ? newWidth / aspectRatio : newHeight;
        }
        if(newTop < 0) {
          newTop = 0;
          newHeight = boxRect.height + boxTopInParent;
          newWidth = preserveRatio ? newHeight * aspectRatio : newWidth;
        }
        break;
      case 'top right':
        newWidth = distanceX;
        newHeight = preserveRatio ? newWidth / aspectRatio : boxRect.height - distanceY;
        newTop = boxTopInParent + (boxRect.height - newHeight);
        if(newTop < 0) {
          newTop = 0;
          newHeight = boxRect.height + boxTopInParent;
          newWidth = preserveRatio ? newHeight * aspectRatio : newWidth;
        }
        if(newWidth + boxLeftInParent > maxWidth) {
          newWidth = maxWidth - boxLeftInParent;
          newHeight = preserveRatio ? newWidth / aspectRatio : newHeight;
        }
        break;
      case 'bottom left':
        newWidth = boxRect.width - distanceX;
        newHeight = preserveRatio ? newWidth / aspectRatio : distanceY;
        newLeft = boxLeftInParent + (boxRect.width - newWidth);
        if(newLeft < 0) {
          newLeft = 0;
          newWidth = boxRect.width + boxLeftInParent;
          newHeight = preserveRatio ? newWidth / aspectRatio : newHeight;
        }
        if(newHeight + boxTopInParent > maxHeight) {
          newHeight = maxHeight - boxTopInParent;
          newWidth = preserveRatio ? newHeight * aspectRatio : newWidth;
        }
        break;
      case 'bottom right':
        newWidth = distanceX;
        newHeight = preserveRatio ? newWidth / aspectRatio : distanceY;
        if(newWidth + boxLeftInParent > maxWidth) {
          newWidth = maxWidth - boxLeftInParent;
          newHeight = preserveRatio ? newWidth / aspectRatio : newHeight;
        }
        if(newHeight + boxTopInParent > maxHeight) {
          newHeight = maxHeight - boxTopInParent;
          newWidth = preserveRatio ? newHeight * aspectRatio : newWidth;
        }
        break;
    }

    const adjusted = adjustDimensions(newWidth, newHeight, newLeft ?? boxLeftInParent, newTop ?? boxTopInParent);

    // Ensure the box does not move unexpectedly
    if(preserveRatio) {
      if(adjusted.width === box.position.width) {
        adjusted.left = box.position.x;
      }
      if(adjusted.height === box.position.height) {
        adjusted.top = box.position.y;
      }
    }
    else {
      if(scalingBox.direction.includes('left') && adjusted.left < 0) {
        adjusted.left = 0;
      }
      if(scalingBox.direction.includes('right') && adjusted.left + adjusted.width > maxWidth) {
        adjusted.left = maxWidth - adjusted.width;
      }
      if(scalingBox.direction.includes('top') && adjusted.top < 0) {
        adjusted.top = 0;
      }
      if(scalingBox.direction.includes('bottom') && adjusted.top + adjusted.height > maxHeight) {
        adjusted.top = maxHeight - adjusted.height;
      }
    }

    if(!box.creationAttributes.scaleHistory) {
      commands.execute(new ScaleBoxCommand(
        box,
        adjusted.width,
        adjusted.height,
        adjusted.left,
        adjusted.top,
        scalingBox.box.creationAttributes.onResize
      ), box.creationAttributes.scaleHistory === false);
    }
  }

  function drag(draggingBox: DraggingBoxData, event: MouseEvent) {
    const box = draggingBox.box;
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    const pointInParent = getPointInParent(parent, event.pageX, event.pageY);

    // Use the offset to calculate the new position
    let x = pointInParent.x - draggingBox.startOffsetWithinBox.x;
    let y = pointInParent.y - draggingBox.startOffsetWithinBox.y;

    const horizonTreshold = 8;
    const newBoxCenter = {
      x: x + box.position.width / 2,
      y: y + box.position.height / 2
    };
    const parentCenter = {
      x: parent.rect.width / 2,
      y: parent.rect.height / 2
    };

    if(box.creationAttributes.horizons) {
      if(newBoxCenter.x > parentCenter.x - horizonTreshold && newBoxCenter.x < parentCenter.x + horizonTreshold) {
        showHorizon('drag-center-horizontal', parent, parentCenter.x, pointInParent.y);

        x = parentCenter.x - box.position.width / 2;
      }
      else {
        hideHorizon(parentMap.get(box.el)!, 'drag-center-horizontal');
      }

      if(newBoxCenter.y > parentCenter.y - horizonTreshold && newBoxCenter.y < parentCenter.y + horizonTreshold) {
        showHorizon('drag-center-vertical', parent, pointInParent.x, parentCenter.y);

        y = parentCenter.y - box.position.height / 2;
      }
      else {
        hideHorizon(parentMap.get(box.el)!, 'drag-center-vertical');
      }
    }

    commands.execute(new DragBoxCommand(box, x, y));
  }

  function prepareHorizons(parentElement: HTMLElement) {
    const horizonWrapper = document.createElement('div');

    horizonWrapper.classList.add(CSS.horizonWrapper);
    parentElement.appendChild(horizonWrapper);

    const horizons = new Map<string, Horizon>();

    [
      'rotate-horizontal',
      'rotate-vertical',
      'rotate-positive45',
      'rotate-negative45',
      'drag-center-vertical',
      'drag-center-horizontal'
    ].forEach((type) => {
      const horizon = document.createElement('div');

      horizon.style.display = 'none';
      horizon.classList.add(CSS.horizon, `${CSS.horizon}--${type}`);
      horizonWrapper.appendChild(horizon);

      horizons.set(type, {
        element: horizon
      });
    });

    return horizons;
  }

  function hideHorizon(parent: DraggableBoxParent, type?: 'rotate-horizontal' | 'rotate-vertical' | 'rotate-positive45' | 'rotate-negative45' | 'drag-center-vertical' | 'drag-center-horizontal') {
    function fadeOut(horizonElement: HTMLElement) {
      horizonElement.classList.add(CSS.horizonAnimateOut);

      horizonElement.addEventListener('animationend', () => {
        horizonElement.classList.remove(CSS.horizonAnimateOut);
        horizonElement.style.display = 'none';
      }, {once: true});
    }

    if(!type) {
      parent.horizons.forEach(({element}) => {
        if(element.style.display === 'none') {
          return;
        }

        fadeOut(element);
      });

      return;
    }

    const horizon = parent.horizons.get(type);

    if(horizon && horizon.element.style.display !== 'none') {
      fadeOut(horizon.element);
    }
  }

  function showHorizon(type: 'rotate-horizontal' | 'rotate-vertical' | 'rotate-positive45' | 'rotate-negative45' | 'drag-center-vertical' | 'drag-center-horizontal', parent: DraggableBoxParent, x: number, y: number) {
    const horizon = parent.horizons.get(type);

    const {element} = horizon!;

    switch(type) {
      case 'rotate-horizontal':
        element.style.top = `${y}px`;
        break;
      case 'rotate-vertical':
        element.style.left = `${x}px`;
        break;
      case 'rotate-positive45':
      case 'rotate-negative45':
        element.style.width = `${Math.max(parent.rect.width, parent.rect.height) * 2}px`;
        element.style.transform = `translate(-50%, 50%) rotate(${type === 'rotate-positive45' ? 45 : -45}deg)`;
        /**
         * Put line center to the passed X an Y
         */
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        break;
    }

    element.style.display = 'block';
  }

  function rotate(rotatingBox: RotatingBoxData, event: MouseEvent) {
    const box = rotatingBox.box;
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    const boxRect = box.el.getBoundingClientRect();
    const boxCenterX = boxRect.left + boxRect.width / 2;
    const boxCenterY = boxRect.top + boxRect.height / 2;

    const boxCenterInParent = getPointInParent(parent, boxCenterX, boxCenterY);

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const deltaX = mouseX - boxCenterX;
    const deltaY = mouseY - boxCenterY;

    const currentMouseAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    let rotationAngle = currentMouseAngle - box.initialMouseAngle! + rotatingBox.startRotationAngle;

    const horizonTreshold = 7;

    if(box.creationAttributes.horizons) {
      if(Math.abs(rotationAngle) < horizonTreshold) {
        rotationAngle = 0;
        showHorizon('rotate-horizontal', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(Math.abs(rotationAngle) > 90 - horizonTreshold && Math.abs(rotationAngle) < 90 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 90 : -90;
        showHorizon('rotate-vertical', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(rotationAngle > 45 - horizonTreshold && rotationAngle < 45 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 45 : -45;
        showHorizon('rotate-positive45', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(rotationAngle > -45 - horizonTreshold && rotationAngle < -45 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 45 : -45;
        showHorizon('rotate-negative45', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(rotationAngle > 135 - horizonTreshold && rotationAngle < 135 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 135 : -135;
        showHorizon('rotate-negative45', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(rotationAngle > -135 - horizonTreshold && rotationAngle < -135 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 135 : -135;
        showHorizon('rotate-positive45', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else if(rotationAngle > 180 - horizonTreshold || rotationAngle < -180 + horizonTreshold) {
        rotationAngle = rotationAngle > 0 ? 180 : -180;
        showHorizon('rotate-horizontal', parent, boxCenterInParent.x, boxCenterInParent.y);
      }
      else {
        hideHorizon(parent);
      }
    }

    commands.execute(new RotateBoxCommand(box, rotationAngle));
  }

  function appendContentToBox(box: DraggableBox, element: HTMLElement) {
    const contentHolder = box.el.querySelector(`.${CSS.draggableBoxContent}`) as HTMLElement;

    contentHolder.appendChild(element);

    requestAnimationFrame(() => {
      const newBoxRect = box.el.getBoundingClientRect();

      box.position.width = newBoxRect.width;
      box.position.height = newBoxRect.height;
    });
  }

  function insert(box: DraggableBox, parent: HTMLElement, x: number, y: number) {
    parent.appendChild(box.el);

    const parentRect = parent.getBoundingClientRect();

    const left = clamp(x - box.el.offsetWidth / 2, 0, parentRect.width - box.el.offsetWidth);
    const top = clamp(y - box.el.offsetHeight / 2, 0, parentRect.height - box.el.offsetHeight);

    /**
     * Center the box
     */
    box.el.style.left = `${left}px`;
    box.el.style.top = `${top}px`;

    box.position.x = left;
    box.position.y = top;

    const mouseMoveListener = (event: MouseEvent) => {
      if(currentlyScaling) {
        scale(currentlyScaling, event);
      }
      else if(currentlyDragging) {
        drag(currentlyDragging, event);
      }
      else if(currentlyRotating) {
        rotate(currentlyRotating, event);
      }
    };

    const mouseUpListener = () => {
      if(currentlyScaling) {
        endScale(currentlyScaling);
      }

      if(currentlyDragging) {
        endDrag(currentlyDragging);
      }

      if(currentlyRotating) {
        endRotate(currentlyRotating);
      }
    };

    const wholeParent = document.querySelector('.media-editor__left') as HTMLElement;

    wholeParent.addEventListener('mousemove', mouseMoveListener, {passive: true});
    wholeParent.addEventListener('mouseup', mouseUpListener, {passive: true});
    // parent.addEventListener('mousemove', mouseMoveListener);
    // parent.addEventListener('mouseup', mouseUpListener);

    if(parentMap.has(box.el)) {
      return;
    }

    parentMap.set(box.el, {
      element: parent,
      mouseMoveListener,
      mouseUpListener,
      rect: parent.getBoundingClientRect(),
      horizons: box.creationAttributes.horizons ? prepareHorizons(parent) : new Map()
    });
  }

  function createBoxCorner(location: DraggableBoxDirection, rotatable = false) {
    const corner = document.createElement('div');
    const scaler = document.createElement('div');
    const rotator = document.createElement('div');

    corner.classList.add(CSS.draggableBoxCorner, `${CSS.draggableBoxCorner}--${location.replace(' ', '-')}`);
    scaler.classList.add(CSS.draggableBoxScaler);
    rotator.classList.add(CSS.draggableBoxRotator);

    corner.dataset.direction = location;

    corner.appendChild(scaler);

    if(rotatable) {
      corner.appendChild(rotator);
    }

    return corner;
  }

  function beginScale(box: DraggableBox, direction: DraggableBoxDirection, event: MouseEvent) {
    if(box.creationAttributes.scaleHistory !== false) {
      commands.startBatch();
    }

    box.creationAttributes.onBeforeResize?.();

    const rotationAngle = getRotationAngle(box.el);
    box.position.rotationAngle = rotationAngle;

    const boxStyle = window.getComputedStyle(box.el);
    const originalWidth = Number.parseInt(boxStyle.width);
    const originalHeight = Number.parseInt(boxStyle.height);

    currentlyScaling = {
      box,
      direction,
      startPoint: {
        pageX: event.pageX,
        pageY: event.pageY
      },
      startSize: {
        width: originalWidth,
        height: originalHeight
      }
    };
  }

  function endScale(scalingBox: ScalingBoxData) {
    currentlyScaling = null;

    /**
     * Store final width and height
     */
    const box = scalingBox.box;
    const boxStyle = window.getComputedStyle(box.el);
    const newWidth = Number.parseInt(boxStyle.width);
    const newHeight = Number.parseInt(boxStyle.height);

    box.position.width = newWidth;
    box.position.height = newHeight;

    box.creationAttributes.onAfterResize?.();

    if(box.creationAttributes.scaleHistory !== false) {
      commands.endBatch();
    }
  }

  function getRotationAngle(element: HTMLElement): number {
    const transform = getComputedStyle(element).transform;
    if(transform && transform !== 'none') {
      const values = transform.split('(')[1].split(')')[0].split(',');
      const a = Number.parseFloat(values[0]);
      const b = Number.parseFloat(values[1]);
      return Math.atan2(b, a) * (180 / Math.PI);
    }
    return 0;
  }

  function beginDrag(box: DraggableBox, event: MouseEvent) {
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    commands.startBatch();

    box.creationAttributes.onBeforeDrag?.();

    const boxRect = box.el.getBoundingClientRect();

    const x = event.clientX - boxRect.left;
    const y = event.clientY - boxRect.top;

    currentlyDragging = {
      box,
      startOffsetWithinBox: {
        x,
        y
      }
    };
    box.el.classList.add(CSS.draggableBoxDragging);
  }

  function endDrag(draggingBox: DraggingBoxData) {
    const box = draggingBox.box;

    box.el.classList.remove(CSS.draggableBoxDragging);

    hideHorizon(parentMap.get(box.el)!);

    box.creationAttributes.onAfterDrag?.();
    currentlyDragging = null;

    commands.endBatch();
  }

  function beginRotate(box: DraggableBox, event: MouseEvent) {
    commands.startBatch();

    box.creationAttributes.onBeforeRotate?.();

    const boxRect = box.el.getBoundingClientRect();
    const boxCenterX = boxRect.left + boxRect.width / 2;
    const boxCenterY = boxRect.top + boxRect.height / 2;

    const initialMouseX = event.clientX;
    const initialMouseY = event.clientY;

    const deltaX = initialMouseX - boxCenterX;
    const deltaY = initialMouseY - boxCenterY;

    // Calculate initial angle between the box center and the mouse pointer
    box.initialMouseAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Get the initial rotation angle of the box
    const startingAngle = getRotationAngle(box.el);

    currentlyRotating = {
      box,
      startRotationAngle: startingAngle
    };
  }

  function endRotate(rotatingBox: RotatingBoxData) {
    const box = rotatingBox.box;
    currentlyRotating = null;

    const boxRect = box.el.getBoundingClientRect();
    const boxCenterX = boxRect.left + boxRect.width / 2;
    const boxCenterY = boxRect.top + boxRect.height / 2;

    const corners = Array.from(box.el.querySelectorAll('.draggable-box__corner')) as HTMLElement[];

    corners.forEach((corner) => {
      const cornerRect = corner.getBoundingClientRect();
      const cornerCenterX = cornerRect.left + cornerRect.width / 2;
      const cornerCenterY = cornerRect.top + cornerRect.height / 2;

      const relativeX = cornerCenterX - boxCenterX;
      const relativeY = cornerCenterY - boxCenterY;

      if(relativeX <= 0 && relativeY <= 0) {
        corner.setAttribute('data-direction', 'top left');
      }
      else if(relativeX > 0 && relativeY <= 0) {
        corner.setAttribute('data-direction', 'top right');
      }
      else if(relativeX <= 0 && relativeY > 0) {
        corner.setAttribute('data-direction', 'bottom left');
      }
      else if(relativeX > 0 && relativeY > 0) {
        corner.setAttribute('data-direction', 'bottom right');
      }
    });

    hideHorizon(parentMap.get(box.el)!);

    commands.endBatch();
  }

  function removeBox(box: DraggableBox) {
    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    parent.element.removeEventListener('mousemove', parent.mouseMoveListener);
    parentMap.delete(box.el);

    box.el.remove();

    if(currentlyDragging?.box === box) {
      currentlyDragging = null;
    }

    if(currentlyScaling?.box === box) {
      currentlyScaling = null;
    }

    if(currentlyRotating?.box === box) {
      currentlyRotating = null;
    }
  }

  function deactivateBox(box: DraggableBox) {
    box.el.classList.remove(CSS.draggableBoxActive);

    box.creationAttributes.onDeactivate?.();
  }

  /**
   * Activate box: show border, corners, rotator, scaler
   */
  function activateBox(box: DraggableBox) {
    box.creationAttributes.onBeforeActivate?.();

    box.el.classList.add(CSS.draggableBoxActive);

    box.creationAttributes.onActivate?.();
  }

  /**
   * Recalculate box position after parent size change
   * depending on the parent rect size change and the original box position
   */
  function restoreBoxPosition(box: DraggableBox) {
    box.creationAttributes.onBeforeResize?.();

    const parent = parentMap.get(box.el);

    if(!parent) {
      return;
    }

    const parentRectOrigin = parent.rect;
    const parentRectNew = parent.element.getBoundingClientRect();

    /**
     * We need to recaclulate x, y, width and height according to the parent rect size change
     */
    const parentRectWidthChangeRatio = parentRectNew.width / parentRectOrigin.width;
    const parentRectHeightChangeRatio = parentRectNew.height / parentRectOrigin.height;

    const newX = box.position.x * parentRectWidthChangeRatio;
    const newY = box.position.y * parentRectHeightChangeRatio;

    const newWidth = box.position.width * parentRectWidthChangeRatio;
    const newHeight = box.position.height * parentRectHeightChangeRatio;

    box.el.style.left = `${newX}px`;
    box.el.style.top = `${newY}px`;

    box.creationAttributes.onResize?.(newWidth, newHeight, newX, newY);

    box.el.style.width = `${newWidth}px`;
    box.el.style.height = `${newHeight}px`;

    parent.rect = parentRectNew;

    box.position.x = newX;
    box.position.y = newY;
    box.position.width = newWidth;
    box.position.height = newHeight;
  }

  function resizeToFitContent(box: DraggableBox) {
    box.el.style.width = 'auto';
    box.el.style.height = 'auto';

    requestAnimationFrame(() => {
      const rect = box.el.getBoundingClientRect();

      box.position.width = rect.width;
      box.position.height = rect.height;

      box.el.style.width = `${rect.width}px`;
      box.el.style.height = `${rect.height}px`;
    });
  }

  function loadSvgImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = () => {
        reject();
      };

      img.src = url;
    });
  }

  async function exportTextBox(box: DraggableBox, scaleFactor: number = 1): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if(!ctx) {
      console.error('Failed to get canvas context');
      return canvas;
    }

    canvas.width = (box.position.width + box.meta.bgPadX * 2) * scaleFactor;
    canvas.height = (box.position.height + box.meta.bgPadY * 2) * scaleFactor;

    // ctx.fillStyle = 'rgba(255, 255, 255, .2)';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    if(box.meta.style === 'backgrounded') {
      const boxBackgroundShape = box.el.querySelector('svg') as SVGElement;
      const shape = boxBackgroundShape.cloneNode(true) as SVGElement;

      shape.removeAttribute('style');
      const svgString = new XMLSerializer().serializeToString(shape);
      const img = await loadSvgImage(`data:image/svg+xml,${encodeURIComponent(svgString)}`);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    const boxTextLines = Array.from(box.el.querySelectorAll('.text-box__line')) as HTMLDivElement[];

    const {
      font,
      style
    } = box.meta;

    let color = box.meta.color;
    const fontSize = box.meta.fontSize * scaleFactor;

    boxTextLines.forEach((line) => {
      const text = line.textContent;
      if(!text) {
        return;
      }

      const lineStyle = window.getComputedStyle(line);
      const fontWeight = lineStyle.fontWeight;

      const padX = box.meta.bgPadX * scaleFactor;
      const padY = box.meta.bgPadY * scaleFactor;

      // const lineRect = line.getBoundingClientRect();
      const lineTop = Math.round(line.offsetTop * scaleFactor + padY);
      const lineLeft = Math.round(line.offsetLeft * scaleFactor + padX);

      // ctx.fillStyle = 'rgba(255, 255, 255, .4)';
      // ctx.fillRect(
      //   lineLeft,
      //   lineTop,
      //   lineRect.width * scaleFactor,
      //   lineRect.height * scaleFactor
      // );

      ctx.font = `${fontWeight} ${fontSize}px ${font}`;

      if(style === 'backgrounded') {
        color = 'white';
      }
      ctx.fillStyle = color;

      // ctx.textRendering = 'optimizeLegibility';

      const textMetrics = ctx.measureText(text);
      const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
      const lineHeight = lineStyle.lineHeight !== 'normal' ? Number.parseFloat(lineStyle.lineHeight) : fontSize;
      const baseLine = Math.round(lineTop + (lineHeight * scaleFactor - textHeight) / 2 + textMetrics.actualBoundingBoxAscent);

      if(style === 'stroked') {
        const textBox = box.el.querySelector('.text-box') as HTMLElement;
        const boxStyle = window.getComputedStyle(textBox);
        const strokeWidth = Number.parseFloat(boxStyle.getPropertyValue('--stroke-width')) * scaleFactor;

        ctx.strokeStyle = '#000';

        ctx.lineWidth = strokeWidth * 2;
        ctx.strokeText(text, lineLeft, baseLine);
      }

      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, lineLeft, baseLine);
    });

    return canvas;
  }

  function exportSticker(box: DraggableBox, scaleFactor: number = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if(!ctx) {
      console.error('Failed to get canvas context');
      return canvas;
    }

    canvas.width = box.position.width * scaleFactor;
    canvas.height = box.position.height * scaleFactor;

    // ctx.fillStyle = 'rgba(255, 255, 255, .2)';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxSticker = box.el.querySelector('.super-sticker') as HTMLElement;
    const stickerCanvas = boxSticker.querySelector('canvas');
    const stickerVideo = boxSticker.querySelector('video');
    const stickerImg = boxSticker.querySelector('img');
    const originalWidth = Number.parseInt(boxSticker.dataset.w);
    const originalHeidht = Number.parseInt(boxSticker.dataset.h);

    if(stickerCanvas) {
      ctx.drawImage(stickerCanvas, 0, 0, box.position.width * scaleFactor, box.position.height * scaleFactor);
    }
    else if(stickerImg || stickerVideo) {
      let imageWidth = box.position.width * scaleFactor;
      let imageHeight = 0;
      const ratio = originalWidth / originalHeidht;

      if(originalWidth > originalHeidht) {
        imageHeight = imageWidth / ratio;
      }
      else {
        imageHeight = box.position.width * scaleFactor;
        imageWidth = imageHeight * ratio;
      }

      const topOffset = (box.position.height * scaleFactor - imageHeight) / 2;
      const leftOffset = (box.position.width * scaleFactor - imageWidth) / 2;

      ctx.drawImage(stickerImg ?? stickerVideo, leftOffset, topOffset, imageWidth, imageHeight);
    }

    return canvas;
  }

  async function exportBoxToCanvas(box: DraggableBox, scaleFactor: number = 1): Promise<HTMLCanvasElement> {
    const boxText = box.el.querySelector('.text-box') as HTMLElement;
    const isTextBox = boxText !== null;

    if(isTextBox) {
      return exportTextBox(box, scaleFactor);
    } else {
      return exportSticker(box, scaleFactor);
    }
  }


  function create(attributes?: DraggableBoxCreationAttributes): DraggableBox {
    const el = document.createElement('div');
    el.style.position = 'absolute';

    el.classList.add(CSS.draggableBox);

    el.classList.add(`${CSS.draggableBox}--${attributes?.style ?? 'dashed'}`);

    if(attributes?.width) {
      el.style.width = `${attributes.width}px`;
    }

    if(attributes?.height) {
      el.style.height = `${attributes.height}px`;
    }

    const corners = [
      createBoxCorner('top left', attributes?.rotatable),
      createBoxCorner('top right', attributes?.rotatable),
      createBoxCorner('bottom left', attributes?.rotatable),
      createBoxCorner('bottom right', attributes?.rotatable)
    ];

    corners.forEach(corner => el.appendChild(corner));

    const contentHolder = document.createElement('div');

    contentHolder.classList.add(CSS.draggableBoxContent);

    el.appendChild(contentHolder);

    const box: DraggableBox = {
      el,
      position: {
        x: 0,
        y: 0,
        width: attributes?.width ?? 0,
        height: attributes?.height ?? 0,
        rotationAngle: 0
      },
      meta: {
        color: '#fff',
        alignment: 'left',
        style: 'regular',
        font: 'Roboto',
        bgPadX: 0,
        bgPadY: 0,
        bgRadius: 0,
        fontSize: 16,
        originalWidth: 0,
        originalPaddingBlock: 0,
        originalPaddingInline: 0
      },
      setMeta: <K extends keyof TextBoxMeta>(key: K, value: string) => {
        box.meta[key] = value as TextBoxMeta[typeof key];
      },
      moveTo: (x: number, y: number) => moveTo(box, x, y),
      insert: (parent: HTMLElement, x: number, y: number) => insert(box, parent, x, y),
      remove: () => {
        removeBox(box);
      },
      append: (element: HTMLElement) => {
        appendContentToBox(box, element);
      },
      isEmpty: () => {
        return contentHolder.textContent?.replace('\u200B', '').trim() === '';
      },
      activate: () => {
        activateBox(box);
      },
      deactivate: () => {
        deactivateBox(box);
      },
      creationAttributes: attributes ?? {},
      adjustWidth: () => {
        box.el.style.width = 'auto';

        requestAnimationFrame(() => {
          const rect = box.el.getBoundingClientRect();

          box.position.width = rect.width;
          box.position.height = rect.height;
        });
      },
      isActive: () => box.el.classList.contains(CSS.draggableBoxActive),
      reposition: () => {
        restoreBoxPosition(box);
      },
      resizeToFitContent: () => {
        resizeToFitContent(box);
      },
      export: (scaleFactor: number) => {
        return exportBoxToCanvas(box, scaleFactor);
      }
    };

    el.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      event.preventDefault();

      const isRotatorClicked = (event.target as HTMLElement).classList.contains(CSS.draggableBoxRotator);
      const isScalerClicked = (event.target as HTMLElement).classList.contains(CSS.draggableBoxCorner) || (event.target as HTMLElement).classList.contains(CSS.draggableBoxScaler);

      if(isRotatorClicked) {
        beginRotate(box, event);
        return;
      }

      if(isScalerClicked) {
        const corner = (event.target as HTMLElement).closest(`.${CSS.draggableBoxCorner}`) as HTMLElement;
        const direction = corner.dataset.direction as DraggableBoxDirection;

        beginScale(box, direction, event);
        return;
      }

      activateBox(box);
      beginDrag(box, event);
    });

    return box;
  }

  function destroy() {
    currentlyScaling = null;
    currentlyDragging = null;
    currentlyRotating = null;

    /**
     * @todo remove event listeners
     */
  }

  return {
    create,
    destroy
  };
}
