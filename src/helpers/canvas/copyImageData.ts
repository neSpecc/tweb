
export function copyImageData(imageData: ImageData): ImageData {
  const copy = new ImageData(imageData.width, imageData.height);

  copy.data.set(imageData.data);

  return copy;
}
