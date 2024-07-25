self.addEventListener('message', (event) => {
  const {command, payload} = event.data;

  /**
   * @private
   */
  function gaussianBlur(imageData, width, height, radius) {
    const sigma = radius / 2;
    const kernelSize = Math.ceil(radius * 2) + 1;
    const kernel = createGaussianKernel(kernelSize, sigma);
    const pixels = imageData.data;
    const newImageData = new ImageData(width, height);
    const newPixels = newImageData.data;

    /**
     * Horizontal pass
     */
    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let weightSum = 0;
        for(let i = -Math.floor(kernelSize / 2); i <= Math.floor(kernelSize / 2); i++) {
          const nx = x + i;
          if(nx >= 0 && nx < width) {
            const weight = kernel[i + Math.floor(kernelSize / 2)];
            const offset = (y * width + nx) * 4;
            r += pixels[offset] * weight;
            g += pixels[offset + 1] * weight;
            b += pixels[offset + 2] * weight;
            a += pixels[offset + 3] * weight;
            weightSum += weight;
          }
        }
        const offset = (y * width + x) * 4;
        newPixels[offset] = r / weightSum;
        newPixels[offset + 1] = g / weightSum;
        newPixels[offset + 2] = b / weightSum;
        newPixels[offset + 3] = a / weightSum;
      }
    }

    /**
     * Vertical pass
     */
    const tempImageData = new ImageData(new Uint8ClampedArray(newPixels), width, height);
    const tempPixels = tempImageData.data;

    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let weightSum = 0;
        for(let i = -Math.floor(kernelSize / 2); i <= Math.floor(kernelSize / 2); i++) {
          const ny = y + i;
          if(ny >= 0 && ny < height) {
            const weight = kernel[i + Math.floor(kernelSize / 2)];
            const offset = (ny * width + x) * 4;
            r += tempPixels[offset] * weight;
            g += tempPixels[offset + 1] * weight;
            b += tempPixels[offset + 2] * weight;
            a += tempPixels[offset + 3] * weight;
            weightSum += weight;
          }
        }
        const offset = (y * width + x) * 4;
        newPixels[offset] = r / weightSum;
        newPixels[offset + 1] = g / weightSum;
        newPixels[offset + 2] = b / weightSum;
        newPixels[offset + 3] = a / weightSum;
      }
    }

    return newImageData;
  }

  /**
   * @private
   */
  function createGaussianKernel(size, sigma) {
    const kernel = [];
    const mean = size / 2;
    let sum = 0;
    for(let x = 0; x < size; x++) {
      kernel[x] = Math.exp(-0.5 * ((x - mean) / sigma) ** 2);
      sum += kernel[x];
    }
    for(let x = 0; x < size; x++) {
      kernel[x] /= sum;
    }
    return kernel;
  }

  switch(command) {
    case 'blur': {
      const result = gaussianBlur(payload.image, payload.width, payload.height, payload.radius);

      postMessage({
        command: 'blur',
        payload: {
          image: result
        }
      }, [result.data.buffer]);
      break;
    }
  }
});

self.onerror = function(errorEvent) {
  console.error('Worker error:', errorEvent);
  postMessage({error: errorEvent.message});
};
