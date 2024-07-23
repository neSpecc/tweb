import { hexToRgb } from '../utils/hex-to-rgb';
import { ramerDouglasPeucker } from '../utils/ramer-douglas-peucker';
import { cubicBezier } from '../utils/timing-functions';

export type DrawingTool = 'pen' | 'brush' | 'arrow' | 'neon' | 'blur' | 'eraser';

interface Point { x: number; y: number }

export function useDrawing() {
  let canvas: HTMLCanvasElement | null = null;
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenContext: CanvasRenderingContext2D | null = null;
  let originalImageData: ImageData | null = null;
  let blurredCanvas: HTMLCanvasElement | null = null;
  let worker: Worker | null = null;

  const drawingOptions = {
    isDrawing: false,
    isAnimating: false,
    color: '#ffffff',
    brushSize: 15,
    tool: 'pen',
    offscreenCanvasScale: 2,
    points: [] as Point[],
  };

  function drawByPen(event: MouseEvent) {
    if (!drawingOptions.isDrawing) {
      return;
    }

    if (offscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;

    offscreenContext.lineWidth = drawingOptions.brushSize * scale;
    offscreenContext.lineCap = 'round';
    offscreenContext.strokeStyle = drawingOptions.color;
    offscreenContext.globalCompositeOperation = 'source-over'; // Ensure default composite operation for pen

    offscreenContext.lineTo(event.offsetX * scale, event.offsetY * scale);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(event.offsetX * scale, event.offsetY * scale);
  }

  function drawByBrush(event: MouseEvent) {
    if (!drawingOptions.isDrawing) {
      return;
    }

    if (offscreenContext === null || canvas === null || offscreenCanvas === null) {
      throw new Error('Offscreen context is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;
    const brushSize = drawingOptions.brushSize * scale;
    const brushColor = drawingOptions.color;
    const opacity = 0.1;

    const dotDistance = brushSize / 10;
    const radiusX = brushSize;
    const radiusY = brushSize / 3;

    const x = event.offsetX * scale;
    const y = event.offsetY * scale;

    drawingOptions.points.push({ x, y });

    function drawBrushDot(x: number, y: number, alpha: number) {
      offscreenContext!.save();
      offscreenContext!.beginPath();
      offscreenContext!.translate(x, y);
      offscreenContext!.ellipse(0, 0, radiusX, radiusY, (45 * Math.PI) / 180, 0, Math.PI * 2);
      offscreenContext!.fillStyle = `rgba(${hexToRgb(brushColor)}, ${alpha})`;
      offscreenContext!.fill();
      offscreenContext!.restore();
    }

    if (drawingOptions.points.length > 1) {
      const prevPoint = drawingOptions.points[drawingOptions.points.length - 2];
      const distance = Math.sqrt((x - prevPoint.x) ** 2 + (y - prevPoint.y) ** 2);
      const steps = Math.ceil(distance / dotDistance);

      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const xStep = prevPoint.x + t * (x - prevPoint.x);
        const yStep = prevPoint.y + t * (y - prevPoint.y);
        drawBrushDot(xStep, yStep, opacity);
      }
    }
    else {
      drawBrushDot(x, y, opacity / 20);
    }

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width / scale, offscreenCanvas.height / scale, 0, 0, canvas.width, canvas.height);
    }
  }

  function scaleCoord(xOrY: number): number {
    return xOrY * drawingOptions.offscreenCanvasScale;
  }

  function drawByArrow(event: MouseEvent): void {
    if (drawingOptions.isAnimating) {
      return;
    }

    if (canvas === null || offscreenCanvas === null || offscreenContext === null) {
      throw new Error('Canvas or offscreen canvas is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;

    const x = event.offsetX * scale;
    const y = event.offsetY * scale;

    offscreenContext.lineWidth = drawingOptions.brushSize * scale; // Adjust brush size for scale
    offscreenContext.lineCap = 'round';
    offscreenContext.lineJoin = 'round';
    offscreenContext.strokeStyle = drawingOptions.color;

    drawingOptions.points.push({
      x,
      y,
    });

    const epsilon = 2 * scale;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    offscreenContext.beginPath();
    offscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for (const point of filteredPoints) {
      offscreenContext.lineTo(point.x, point.y);
    }

    offscreenContext.stroke();

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width / scale, offscreenCanvas.height / scale, 0, 0, canvas.width, canvas.height);
    }
  }

  function drawByNeon(event: MouseEvent): void {
    if (drawingOptions.isAnimating) {
      return;
    }

    if (canvas === null || offscreenCanvas === null || offscreenContext === null) {
      throw new Error('Canvas or offscreen canvas is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;

    const x = event.offsetX * scale;
    const y = event.offsetY * scale;

    offscreenContext.lineWidth = drawingOptions.brushSize * scale; // Adjust brush size for scale
    offscreenContext.lineCap = 'round';

    // neon effect is white line with colorful glow
    offscreenContext.strokeStyle = '#ffffff';

    // smooth line join
    offscreenContext.lineJoin = 'round';

    offscreenContext.shadowColor = `rgba(${hexToRgb(drawingOptions.color)}, 0.3)`;
    offscreenContext.shadowBlur = drawingOptions.brushSize * scale;

    drawingOptions.points.push({
      x,
      y,
    });

    const epsilon = 2 * scale;
    const filteredPoints = ramerDouglasPeucker(drawingOptions.points, epsilon);

    offscreenContext.beginPath();
    offscreenContext.moveTo(filteredPoints[0].x, filteredPoints[0].y);

    for (const point of filteredPoints) {
      offscreenContext.lineTo(point.x, point.y);
    }

    offscreenContext.stroke();

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width / scale, offscreenCanvas.height / scale, 0, 0, canvas.width, canvas.height);
    }

    offscreenContext.shadowBlur = 0;
    offscreenContext.shadowColor = 'transparent';
  }

  function drawByBlur(event: MouseEvent): void {
    if (!drawingOptions.isDrawing || blurredCanvas === null || offscreenCanvas === null || canvas === null || offscreenContext === null) {
      return;
    }

    if (offscreenContext === null || canvas === null) {
      throw new Error('Offscreen context or canvas is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;

    offscreenContext.lineWidth = drawingOptions.brushSize * scale;
    offscreenContext.lineCap = 'round';

    offscreenContext.strokeStyle = offscreenContext.createPattern(blurredCanvas, 'no-repeat') as CanvasPattern;
    offscreenContext.lineTo(event.offsetX * scale, event.offsetY * scale);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(event.offsetX * scale, event.offsetY * scale);

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width / scale, offscreenCanvas.height / scale, 0, 0, canvas.width, canvas.height);
    }
  }

  function drawByEraser(event: MouseEvent): void {
    if (!drawingOptions.isDrawing) {
      return;
    }

    if (offscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    const scale = drawingOptions.offscreenCanvasScale;

    offscreenContext.lineWidth = drawingOptions.brushSize * scale;
    offscreenContext.lineCap = 'round';
    offscreenContext.globalCompositeOperation = 'destination-out'; // Set composite operation for erasing

    offscreenContext.lineTo(event.offsetX * scale, event.offsetY * scale);
    offscreenContext.stroke();
    offscreenContext.beginPath();
    offscreenContext.moveTo(event.offsetX * scale, event.offsetY * scale);
    offscreenContext.globalCompositeOperation = 'source-over';

    // layer.savedImageData = offscreenContext.getImageData(0, 0, layer.offscreenCanvas.width, layer.offscreenCanvas.height);
  }

  function mergeCanvases() {
    if (canvas === null || offscreenCanvas === null || originalImageData === null) {
      throw new Error('Canvas, offscreen canvas, or original image data is not initialized');
    }

    const mainContext = canvas.getContext('2d');

    if (mainContext === null) {
      throw new Error('Main context is not initialized');
    }

    // Ensure the image is not lost during merging
    if (originalImageData) {
      mainContext.putImageData(originalImageData, 0, 0, 0, 0, canvas.width, canvas.height);
    }

    // mainContext.clearRect(0, 0, canvas.width, canvas.height);
    mainContext.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
  }

  function draw(event: MouseEvent): void {
    if (!drawingOptions.isDrawing) {
      return;
    }

    if (drawingOptions.isAnimating) {
      return;
    }

    switch (drawingOptions.tool) {
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

    mergeCanvases();
  }

  function prepareBlurCanvas(blurredImageData: ImageData): void {
    if (offscreenContext === null || offscreenCanvas === null || canvas === null) {
      throw new Error('Offscreen context or canvas is not initialized');
    }

    const bCanvas = document.createElement('canvas');
    const bContext = bCanvas.getContext('2d');

    if (bContext === null) {
      throw new Error('Could not get context for blurred canvas');
    }

    bCanvas.width = offscreenCanvas.width;
    bCanvas.height = offscreenCanvas.height;

    bContext.putImageData(blurredImageData, 0, 0);

    blurredCanvas = bCanvas;
  }

  function beginDraw(event: MouseEvent): void {
    if (offscreenContext === null) {
      throw new Error('Offscreen context is not initialized');
    }

    drawingOptions.isDrawing = true;

    offscreenContext.beginPath();
    offscreenContext.moveTo(event.offsetX * drawingOptions.offscreenCanvasScale, event.offsetY * drawingOptions.offscreenCanvasScale);
  }

  function endDrawDefault(): void {

  }

  function endDrawArrow(): void {
    if (!drawingOptions.points.length) {
      return;
    }

    if (canvas === null || offscreenCanvas === null || offscreenContext === null) {
      throw new Error('Canvas, offscreen canvas, or offscreen context is not initialized');
    }

    drawingOptions.isAnimating = true;

    const points = drawingOptions.points;
    const numPointsForDirection = 5;
    const totalPoints = Math.min(points.length, numPointsForDirection);
    let dx = 0;
    let dy = 0;

    for (let i = 0; i < totalPoints - 1; i++) {
      dx += points[points.length - 1 - i].x - points[points.length - 2 - i].x;
      dy += points[points.length - 1 - i].y - points[points.length - 2 - i].y;
    }

    dx /= totalPoints - 1;
    dy /= totalPoints - 1;

    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.max(4 * drawingOptions.brushSize * drawingOptions.offscreenCanvasScale, 15);
    const perpendicularAngle1 = angle + Math.PI / 4; // 45 degrees to one side
    const perpendicularAngle2 = angle - Math.PI / 4; // 45 degrees to the other side

    const lastPoint = points[points.length - 1];
    const arrowPoint1 = {
      x: lastPoint.x - arrowLength * Math.cos(perpendicularAngle1),
      y: lastPoint.y - arrowLength * Math.sin(perpendicularAngle1),
    };

    const arrowPoint2 = {
      x: lastPoint.x - arrowLength * Math.cos(perpendicularAngle2),
      y: lastPoint.y - arrowLength * Math.sin(perpendicularAngle2),
    };

    offscreenContext.lineWidth = drawingOptions.brushSize * drawingOptions.offscreenCanvasScale;

    const savedImageData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    offscreenContext.globalCompositeOperation = 'source-over';

    // Cubic Bezier easing function
    const easing = cubicBezier(0.72, 0.46, 0.26, 1.04);

    // Animation parameters
    const animationDuration = 300; // Duration in milliseconds
    const startTime = performance.now();

    function animateArrow() {
      if (canvas === null || offscreenCanvas === null || offscreenContext === null) {
        throw new Error('Canvas, offscreen canvas, or offscreen context is not initialized');
      }

      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const t = Math.min(elapsedTime / animationDuration, 1);
      const easedT = easing(t);

      const currentArrowPoint1 = {
        x: lastPoint.x + easedT * (arrowPoint1.x - lastPoint.x),
        y: lastPoint.y + easedT * (arrowPoint1.y - lastPoint.y),
      };

      const currentArrowPoint2 = {
        x: lastPoint.x + easedT * (arrowPoint2.x - lastPoint.x),
        y: lastPoint.y + easedT * (arrowPoint2.y - lastPoint.y),
      };

      offscreenContext.putImageData(savedImageData, 0, 0);

      offscreenContext.beginPath();
      offscreenContext.moveTo(lastPoint.x, lastPoint.y);
      offscreenContext.lineTo(currentArrowPoint1.x, currentArrowPoint1.y);
      offscreenContext.moveTo(lastPoint.x, lastPoint.y);
      offscreenContext.lineTo(currentArrowPoint2.x, currentArrowPoint2.y);
      offscreenContext.stroke();

      // Copy the offscreen canvas to the visible canvas
      const context = canvas.getContext('2d');
      if (context) {
        // context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        context.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
      }

      if (t < 1) {
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

    if (offscreenContext) {
      offscreenContext.closePath();
    }

    switch (drawingOptions.tool) {
      case 'arrow':
        endDrawArrow();
        break;
      default:
        endDrawDefault();
        break;
    }

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
    drawingOptions.brushSize = size;
  }

  function setTool(tool: DrawingTool): void {
    drawingOptions.tool = tool;
  }

  function init(targetCanvas: HTMLCanvasElement, image: ImageData): void {
    canvas = targetCanvas;
    originalImageData = image;

    offscreenCanvas = document.createElement('canvas');
    offscreenContext = offscreenCanvas.getContext('2d') as CanvasRenderingContext2D;
    offscreenCanvas.width = canvas.width * drawingOptions.offscreenCanvasScale;
    offscreenCanvas.height = canvas.height * drawingOptions.offscreenCanvasScale;

    // Draw the original image data onto the offscreen canvas
    const offscreenTempCanvas = document.createElement('canvas');
    offscreenTempCanvas.width = image.width;
    offscreenTempCanvas.height = image.height;
    const offscreenTempContext = offscreenTempCanvas.getContext('2d');
    if (offscreenTempContext) {
      offscreenTempContext.putImageData(image, 0, 0);
      offscreenContext.drawImage(offscreenTempCanvas, 0, 0, image.width, image.height, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    worker = new Worker(new URL('./DrawingWorker.js', import.meta.url));

    worker.onmessage = (event: MessageEvent<{ command: 'blur'; payload: { image: ImageData } }>) => {
      const { command, payload } = event.data;

      switch (command) {
        case 'blur': {
          prepareBlurCanvas(payload.image);
          break;
        }
      }
    };

    const imageData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    worker.postMessage({ command: 'blur', payload: {
      image: imageData,
      width: offscreenCanvas.width,
      height: offscreenCanvas.height,
      radius: 50,
    } });

    canvas.addEventListener('mousedown', drawMouseDown);
    canvas.addEventListener('mousemove', drawMouseMove);
    canvas.addEventListener('mouseup', drawMouseUp);
    canvas.addEventListener('mouseout', drawMouseUp);
  }

  function destroy() {
    if (canvas === null) {
      return;
    }

    canvas.removeEventListener('mousedown', drawMouseDown);
    canvas.removeEventListener('mousemove', drawMouseMove);
    canvas.removeEventListener('mouseup', drawMouseUp);
    canvas.removeEventListener('mouseout', drawMouseUp);

    canvas = null;
    offscreenCanvas = null;
    offscreenContext = null;
    originalImageData = null;
    blurredCanvas = null;
  }

  return {
    init,
    destroy,
    setColor,
    setBrushSize,
    setTool,
  };
}
