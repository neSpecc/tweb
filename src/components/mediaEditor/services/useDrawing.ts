import {hexToRgb} from '../utils/hex-to-rgb';
import {ramerDouglasPeucker} from '../utils/ramer-douglas-peucker';
import {cubicBezier} from '../utils/timing-functions';

export type DrawingTool = 'pen' | 'brush' | 'arrow' | 'neon' | 'blur' | 'eraser';

interface Point { x: number; y: number }

interface UseDrawingParams {
  originalImageOffscreenCanvas: OffscreenCanvas
  originalImageOffscreenContext: OffscreenCanvasRenderingContext2D | null;
  imageData: ImageData;
  visibleCanvas: HTMLCanvasElement;
  onDraw: () => void;
}

export function useDrawing(params: UseDrawingParams) {
  const {
    originalImageOffscreenCanvas,
    originalImageOffscreenContext,
    imageData,
    visibleCanvas
  } = params;

  let blurredCanvas: HTMLCanvasElement | null = null;
  let erasingCanvas: HTMLCanvasElement | null = null;
  let worker: Worker | null = null;

  const drawingOptions = {
    isDrawing: false,
    isAnimating: false,
    color: '#ffffff',
    brushSize: 15,
    tool: 'pen',
    points: [] as Point[]
  };

  /**
   * Return the coordinates of the mouse event relative to the offscreen canvas
   */
  function getCoordinates(event: MouseEvent): Point {
    const visibleWidth = visibleCanvas.width;
    const visibleHeight = visibleCanvas.height;
    const offscreenWidth = originalImageOffscreenCanvas.width;
    const offscreenHeight = originalImageOffscreenCanvas.height;

    const scaleX = offscreenWidth / visibleWidth;
    const scaleY = offscreenHeight / visibleHeight;

    const x = event.offsetX * scaleX;
    const y = event.offsetY * scaleY;

    return {x, y};
  }

  function drawByPen(event: MouseEvent) {
    if(!drawingOptions.isDrawing) {
      return;
    }

    if(originalImageOffscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;
    originalImageOffscreenContext.lineCap = 'round';
    originalImageOffscreenContext.strokeStyle = drawingOptions.color;
    originalImageOffscreenContext.globalCompositeOperation = 'source-over';

    originalImageOffscreenContext.lineTo(x, y);
    originalImageOffscreenContext.stroke();
    originalImageOffscreenContext.beginPath();
    originalImageOffscreenContext.moveTo(x, y);
  }

  function drawByBrush(event: MouseEvent) {
    if(!drawingOptions.isDrawing) {
      return;
    }

    const brushSize = drawingOptions.brushSize;
    const brushColor = drawingOptions.color;
    const opacity = 0.1;

    const dotDistance = brushSize / 10;
    const radiusX = brushSize;
    const radiusY = brushSize / 3;

    const {x, y} = getCoordinates(event);

    drawingOptions.points.push({x, y});

    function drawBrushDot(x: number, y: number, alpha: number) {
      originalImageOffscreenContext!.save();
      originalImageOffscreenContext!.beginPath();
      originalImageOffscreenContext!.translate(x, y);
      originalImageOffscreenContext!.ellipse(0, 0, radiusX, radiusY, (45 * Math.PI) / 180, 0, Math.PI * 2);
      originalImageOffscreenContext!.fillStyle = `rgba(${hexToRgb(brushColor)}, ${alpha})`;
      originalImageOffscreenContext!.fill();
      originalImageOffscreenContext!.restore();
    }

    if(drawingOptions.points.length > 1) {
      const prevPoint = drawingOptions.points[drawingOptions.points.length - 2];
      const distance = Math.sqrt((x - prevPoint.x) ** 2 + (y - prevPoint.y) ** 2);
      const steps = Math.ceil(distance / dotDistance);

      for(let i = 0; i < steps; i++) {
        const t = i / steps;
        const xStep = prevPoint.x + t * (x - prevPoint.x);
        const yStep = prevPoint.y + t * (y - prevPoint.y);
        drawBrushDot(xStep, yStep, opacity);
      }
    }
    else {
      drawBrushDot(x, y, opacity / 20);
    }
  }

  function drawByArrow(event: MouseEvent): void {
    if(drawingOptions.isAnimating) {
      return;
    }

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;
    originalImageOffscreenContext.lineCap = 'round';
    originalImageOffscreenContext.lineJoin = 'round';
    originalImageOffscreenContext.strokeStyle = drawingOptions.color;

    drawingOptions.points.push({
      x,
      y
    });

    const epsilon = 2;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    originalImageOffscreenContext.beginPath();
    originalImageOffscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for(const point of filteredPoints) {
      originalImageOffscreenContext.lineTo(point.x, point.y);
    }

    originalImageOffscreenContext.stroke();
  }

  function drawByNeon(event: MouseEvent): void {
    if(drawingOptions.isAnimating) {
      return;
    }

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;
    originalImageOffscreenContext.lineCap = 'round';
    originalImageOffscreenContext.strokeStyle = '#ffffff';

    originalImageOffscreenContext.lineJoin = 'round';

    originalImageOffscreenContext.shadowColor = `rgba(${hexToRgb(drawingOptions.color)}, 0.3)`;
    originalImageOffscreenContext.shadowBlur = drawingOptions.brushSize;

    drawingOptions.points.push({
      x,
      y
    });

    const epsilon = 2;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    originalImageOffscreenContext.beginPath();
    originalImageOffscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for(const point of filteredPoints) {
      originalImageOffscreenContext.lineTo(point.x, point.y);
    }

    originalImageOffscreenContext.stroke();

    originalImageOffscreenContext.shadowBlur = 0;
    originalImageOffscreenContext.shadowColor = 'transparent';
  }

  function drawByBlur(event: MouseEvent): void {
    if(!drawingOptions.isDrawing || blurredCanvas === null) {
      return;
    }

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;
    originalImageOffscreenContext.lineCap = 'round';

    originalImageOffscreenContext.strokeStyle = originalImageOffscreenContext.createPattern(blurredCanvas, 'no-repeat') as CanvasPattern;
    originalImageOffscreenContext.lineTo(x, y);
    originalImageOffscreenContext.stroke();
    originalImageOffscreenContext.beginPath();
    originalImageOffscreenContext.moveTo(x, y);
  }

  function drawByEraser(event: MouseEvent): void {
    if(!drawingOptions.isDrawing || erasingCanvas === null) {
      return;
    }

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;
    originalImageOffscreenContext.lineCap = 'round';

    originalImageOffscreenContext.strokeStyle = originalImageOffscreenContext.createPattern(erasingCanvas, 'no-repeat') as CanvasPattern;
    originalImageOffscreenContext.lineTo(x, y);
    originalImageOffscreenContext.stroke();
    originalImageOffscreenContext.beginPath();
    originalImageOffscreenContext.moveTo(x, y);
  }

  function draw(event: MouseEvent): void {
    if(!drawingOptions.isDrawing) {
      return;
    }

    if(drawingOptions.isAnimating) {
      return;
    }

    switch(drawingOptions.tool) {
      case 'pen':
        drawByPen(event);
        break;
      case 'brush':
        drawByBrush(event);
        break;
      case 'arrow':
        drawByArrow(event);
        break;
      case 'neon':
        drawByNeon(event);
        break;
      case 'blur':
        drawByBlur(event);
        break;
      case 'eraser':
        drawByEraser(event);
        break;
      default:
        break;
    }

    params.onDraw();
  }

  function prepareBlurCanvas(blurredImageData: ImageData): void {
    const bCanvas = document.createElement('canvas');
    const bContext = bCanvas.getContext('2d');

    if(bContext === null) {
      throw new Error('Could not get context for blurred canvas');
    }

    bCanvas.width = originalImageOffscreenCanvas.width;
    bCanvas.height = originalImageOffscreenCanvas.height;

    bContext.putImageData(blurredImageData, 0, 0);

    blurredCanvas = bCanvas;
  }

  function prepareErasingCanvas(orignImageData: ImageData): void {
    const eCanvas = document.createElement('canvas');
    const eContext = eCanvas.getContext('2d');

    if(eContext === null) {
      throw new Error('Could not get context for blurred canvas');
    }

    eCanvas.width = originalImageOffscreenCanvas.width;
    eCanvas.height = originalImageOffscreenCanvas.height;

    eContext.putImageData(orignImageData, 0, 0);

    erasingCanvas = eCanvas;
  }

  function beginDraw(event: MouseEvent): void {
    if(originalImageOffscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    drawingOptions.isDrawing = true;

    // layer.save();

    originalImageOffscreenContext.beginPath();

    const {x, y} = getCoordinates(event);

    originalImageOffscreenContext.moveTo(x, y);
  }

  function endDrawDefault(): void {

  }

  function endDrawArrow(): void {
    if(!drawingOptions.points.length) {
      return;
    }

    drawingOptions.isAnimating = true;

    const points = drawingOptions.points;
    const numPointsForDirection = 5;
    const totalPoints = Math.min(points.length, numPointsForDirection);
    let dx = 0;
    let dy = 0;

    for(let i = 0; i < totalPoints - 1; i++) {
      dx += points[points.length - 1 - i].x - points[points.length - 2 - i].x;
      dy += points[points.length - 1 - i].y - points[points.length - 2 - i].y;
    }

    dx /= totalPoints - 1;
    dy /= totalPoints - 1;

    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.max(4 * drawingOptions.brushSize, 15);
    /**
     * 45 degree to both sides of the direction
     */
    const perpendicularAngle1 = angle + Math.PI / 4;
    const perpendicularAngle2 = angle - Math.PI / 4;

    const lastPoint = points[points.length - 1];
    const arrowPoint1 = {
      x: lastPoint.x - arrowLength * Math.cos(perpendicularAngle1),
      y: lastPoint.y - arrowLength * Math.sin(perpendicularAngle1)
    };

    const arrowPoint2 = {
      x: lastPoint.x - arrowLength * Math.cos(perpendicularAngle2),
      y: lastPoint.y - arrowLength * Math.sin(perpendicularAngle2)
    };

    originalImageOffscreenContext.lineWidth = drawingOptions.brushSize;

    const savedImageData = originalImageOffscreenContext.getImageData(0, 0, originalImageOffscreenCanvas.width, originalImageOffscreenCanvas.height);

    originalImageOffscreenContext.globalCompositeOperation = 'source-over';

    const easing = cubicBezier(0.72, 0.46, 0.26, 1.04);
    const animationDuration = 300;
    const startTime = performance.now();

    function animateArrow() {
      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const t = Math.min(elapsedTime / animationDuration, 1);
      const easedT = easing(t);

      const currentArrowPoint1 = {
        x: lastPoint.x + easedT * (arrowPoint1.x - lastPoint.x),
        y: lastPoint.y + easedT * (arrowPoint1.y - lastPoint.y)
      };

      const currentArrowPoint2 = {
        x: lastPoint.x + easedT * (arrowPoint2.x - lastPoint.x),
        y: lastPoint.y + easedT * (arrowPoint2.y - lastPoint.y)
      };

      originalImageOffscreenContext.putImageData(savedImageData, 0, 0);

      originalImageOffscreenContext.beginPath();
      originalImageOffscreenContext.moveTo(lastPoint.x, lastPoint.y);
      originalImageOffscreenContext.lineTo(currentArrowPoint1.x, currentArrowPoint1.y);
      originalImageOffscreenContext.moveTo(lastPoint.x, lastPoint.y);
      originalImageOffscreenContext.lineTo(currentArrowPoint2.x, currentArrowPoint2.y);
      originalImageOffscreenContext.stroke();

      params.onDraw();

      if(t < 1) {
        requestAnimationFrame(animateArrow);
      }
      else {
        drawingOptions.isAnimating = false;
      }
    }

    requestAnimationFrame(animateArrow);
  }

  function endDraw() {
    drawingOptions.isDrawing = false;

    if(originalImageOffscreenContext) {
      originalImageOffscreenContext.closePath();
    }

    switch(drawingOptions.tool) {
      case 'arrow':
        endDrawArrow();
        break;
      default:
        endDrawDefault();
        break;
    }

    params.onDraw();

    drawingOptions.points = [];
  }

  function drawMouseDown(event: MouseEvent) {
    beginDraw(event);
    draw(event);
  }

  function drawMouseMove(event: MouseEvent) {
    draw(event);
  }

  function drawMouseUp() {
    endDraw();
  }

  function setColor(color: string): void {
    drawingOptions.color = color;
  }

  function setBrushSize(size: number): void {
    const canvasRatio = visibleCanvas.width / originalImageOffscreenCanvas.width;

    drawingOptions.brushSize = size * 2 / canvasRatio;
  }

  function setTool(tool: DrawingTool): void {
    drawingOptions.tool = tool;
  }

  function init(): void {
    prepareErasingCanvas(imageData);

    worker = new Worker(new URL('./DrawingWorker.js', import.meta.url));

    visibleCanvas.addEventListener('mousedown', drawMouseDown);
    visibleCanvas.addEventListener('mousemove', drawMouseMove);
    visibleCanvas.addEventListener('mouseup', drawMouseUp);
    visibleCanvas.addEventListener('mouseout', drawMouseUp);

    worker.onmessage = (event: MessageEvent<{ command: 'blur'; payload: { image: ImageData } }>) => {
      const {command, payload} = event.data;

      switch(command) {
        case 'blur': {
          prepareBlurCanvas(payload.image);
          break;
        }
      }
    };

    worker.postMessage({command: 'blur', payload: {
      image: imageData,
      width: originalImageOffscreenCanvas.width,
      height: originalImageOffscreenCanvas.height,
      radius: 50
    }});
  }

  function destroy() {
    visibleCanvas.removeEventListener('mousedown', drawMouseDown);
    visibleCanvas.removeEventListener('mousemove', drawMouseMove);
    visibleCanvas.removeEventListener('mouseup', drawMouseUp);
    visibleCanvas.removeEventListener('mouseout', drawMouseUp);

    blurredCanvas = null;

    worker?.terminate();
  }

  return {
    init,
    destroy,
    setColor,
    setBrushSize,
    setTool
  };
}
