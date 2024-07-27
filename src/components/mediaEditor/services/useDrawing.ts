import {hexToRgb} from '../utils/hex-to-rgb';
import {ramerDouglasPeucker} from '../utils/ramer-douglas-peucker';
import {cubicBezier} from '../utils/timing-functions';

export type DrawingTool = 'pen' | 'brush' | 'arrow' | 'neon' | 'blur' | 'eraser';

interface Point { x: number; y: number }

interface UseDrawingParams {
  originalImageOffscreenCanvas: OffscreenCanvas;
  imageData: ImageData;
  visibleCanvas: HTMLCanvasElement;
  onDraw: () => void;
}

export function useDrawing(params: UseDrawingParams) {
  const {originalImageOffscreenCanvas, imageData, visibleCanvas} = params;

  const offscreenCanvas = originalImageOffscreenCanvas;
  const offscreenContext = offscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  let blurredCanvas: HTMLCanvasElement | null = null;
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
    const offscreenWidth = offscreenCanvas.width;
    const offscreenHeight = offscreenCanvas.height;

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

    if(offscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    const {x, y} = getCoordinates(event);

    offscreenContext.lineWidth = drawingOptions.brushSize;
    offscreenContext.lineCap = 'round';
    offscreenContext.strokeStyle = drawingOptions.color;
    offscreenContext.globalCompositeOperation = 'source-over';

    offscreenContext.lineTo(x, y);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(x, y);
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
      offscreenContext!.save();
      offscreenContext!.beginPath();
      offscreenContext!.translate(x, y);
      offscreenContext!.ellipse(0, 0, radiusX, radiusY, (45 * Math.PI) / 180, 0, Math.PI * 2);
      offscreenContext!.fillStyle = `rgba(${hexToRgb(brushColor)}, ${alpha})`;
      offscreenContext!.fill();
      offscreenContext!.restore();
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

    offscreenContext.lineWidth = drawingOptions.brushSize;
    offscreenContext.lineCap = 'round';
    offscreenContext.lineJoin = 'round';
    offscreenContext.strokeStyle = drawingOptions.color;

    drawingOptions.points.push({
      x,
      y
    });

    const epsilon = 2;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    offscreenContext.beginPath();
    offscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for(const point of filteredPoints) {
      offscreenContext.lineTo(point.x, point.y);
    }

    offscreenContext.stroke();
  }

  function drawByNeon(event: MouseEvent): void {
    if(drawingOptions.isAnimating) {
      return;
    }

    const {x, y} = getCoordinates(event);

    offscreenContext.lineWidth = drawingOptions.brushSize;
    offscreenContext.lineCap = 'round';
    offscreenContext.strokeStyle = '#ffffff';

    offscreenContext.lineJoin = 'round';

    offscreenContext.shadowColor = `rgba(${hexToRgb(drawingOptions.color)}, 0.3)`;
    offscreenContext.shadowBlur = drawingOptions.brushSize;

    drawingOptions.points.push({
      x,
      y
    });

    const epsilon = 2;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    offscreenContext.beginPath();
    offscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for(const point of filteredPoints) {
      offscreenContext.lineTo(point.x, point.y);
    }

    offscreenContext.stroke();

    offscreenContext.shadowBlur = 0;
    offscreenContext.shadowColor = 'transparent';
  }

  function drawByBlur(event: MouseEvent): void {
    if(!drawingOptions.isDrawing || blurredCanvas === null) {
      return;
    }

    const {x, y} = getCoordinates(event);

    offscreenContext.lineWidth = drawingOptions.brushSize;
    offscreenContext.lineCap = 'round';

    offscreenContext.strokeStyle = offscreenContext.createPattern(blurredCanvas, 'no-repeat') as CanvasPattern;
    offscreenContext.lineTo(x, y);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(x, y);
  }

  function drawByEraser(event: MouseEvent): void {
    if(!drawingOptions.isDrawing) {
      return;
    }

    const {x, y} = getCoordinates(event);

    offscreenContext.globalCompositeOperation = 'destination-out';
    offscreenContext.lineWidth = drawingOptions.brushSize;
    offscreenContext.lineCap = 'round';

    offscreenContext.lineTo(x, y);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(x, y);
    offscreenContext.closePath();

    offscreenContext.globalCompositeOperation = 'source-over';
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

    bCanvas.width = offscreenCanvas.width;
    bCanvas.height = offscreenCanvas.height;

    bContext.putImageData(blurredImageData, 0, 0);

    blurredCanvas = bCanvas;
  }

  function beginDraw(event: MouseEvent): void {
    if(offscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    drawingOptions.isDrawing = true;

    offscreenContext.beginPath();

    const {x, y} = getCoordinates(event);

    offscreenContext.moveTo(x, y);
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

    offscreenContext.lineWidth = drawingOptions.brushSize;

    const savedImageData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    offscreenContext.globalCompositeOperation = 'source-over';

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

      offscreenContext.putImageData(savedImageData, 0, 0);

      offscreenContext.beginPath();
      offscreenContext.moveTo(lastPoint.x, lastPoint.y);
      offscreenContext.lineTo(currentArrowPoint1.x, currentArrowPoint1.y);
      offscreenContext.moveTo(lastPoint.x, lastPoint.y);
      offscreenContext.lineTo(currentArrowPoint2.x, currentArrowPoint2.y);
      offscreenContext.stroke();

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

    if(offscreenContext) {
      offscreenContext.closePath();
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
    drawingOptions.brushSize = size * 2;
  }

  function setTool(tool: DrawingTool): void {
    drawingOptions.tool = tool;
  }

  function init(): void {
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
