export default function canvasToFile(canvas: HTMLCanvasElement, filename: string = 'canvas.png', mimeType: string = 'image/png'): File {
  const dataURL = canvas.toDataURL(mimeType);
  const byteString = atob(dataURL.split(',')[1]);
  const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for(let i = 0; i < byteString.length; i++) {
    uintArray[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([uintArray], {type: mimeString});
  const file = new File([blob], filename, {type: mimeString});

  return file;
}
