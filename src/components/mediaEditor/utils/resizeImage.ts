export function resizeImageData(imageData: ImageData, newWidth: number, newHeight: number): HTMLCanvasElement {
  /**
   * Create an off-screen canvas for resizing
   */
  const offScreenCanvas = document.createElement('canvas');
  offScreenCanvas.width = newWidth;
  offScreenCanvas.height = newHeight;
  const offScreenCtx = offScreenCanvas.getContext('2d');

  if(!offScreenCtx) {
    throw new Error('Could not get off-screen context');
  }

  /**
   * Create a temporary canvas to draw the original image data
   */
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d');

  if(!tempCtx) {
    throw new Error('Could not get temporary context');
  }

  tempCtx.putImageData(imageData, 0, 0);
  offScreenCtx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight);

  return offScreenCanvas;
}
