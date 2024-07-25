/**
 * Filters is a function implementing this type
 */
type Filter = (data: Uint8ClampedArray, value: number, imageSize: { width: number; height: number }) => void;

export interface CanvasFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  highlights: number;
  shadows: number;
  vignette: number;
  grain: number;
  sharpen: number;
  enhance: number;
}

export function useFilters() {
  /**
   * Manipulate the brightness of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param brightness - The brightness value to apply. From -100 to 100.
   */
  function brightness(data: Uint8ClampedArray, brightness: number): void {
    let factor = (brightness + 100) / 100;
    const strength = 0.8;

    factor = factor * strength + 1 - strength;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
    }
  }

  /**
   * Manipulate the contrast of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param contrast - The contrast value to apply. From -100 to 100.
   */
  function contrast(data: Uint8ClampedArray, contrast: number) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  }

  /**
   * Manipulate the saturation of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param saturation - The saturation value to apply. From -100 to 100.
   */
  function saturation(data: Uint8ClampedArray, saturation: number) {
    const factor = 1 + saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = 0.3 * r + 0.59 * g + 0.11 * b;

      data[i] = Math.min(255, Math.max(0, avg + factor * (r - avg)));
      data[i + 1] = Math.min(255, Math.max(0, avg + factor * (g - avg)));
      data[i + 2] = Math.min(255, Math.max(0, avg + factor * (b - avg)));
    }
  }

  /**
   * Manipulate the warmth of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param warmth - The warmth value to apply. From -100 to 100.
   */
  function warmth(data: Uint8ClampedArray, warmth: number) {
    const factor = warmth / 100;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + factor * 50)); // Red
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - factor * 50)); // Blue
    }
  }

  function fade(data: Uint8ClampedArray, fade: number) {
    const normalizedFade = fade / 100;
    const targetSepiaIntensity = normalizedFade * 0.3;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let tr = targetSepiaIntensity * (0.393 * r + 0.769 * g + 0.189 * b) + (1 - targetSepiaIntensity) * r;
      let tg = targetSepiaIntensity * (0.349 * r + 0.686 * g + 0.168 * b) + (1 - targetSepiaIntensity) * g;
      let tb = targetSepiaIntensity * (0.272 * r + 0.534 * g + 0.131 * b) + (1 - targetSepiaIntensity) * b;

      /**
       * Clamp values to [0, 255]
       */
      tr = Math.min(255, Math.max(0, tr));
      tg = Math.min(255, Math.max(0, tg));
      tb = Math.min(255, Math.max(0, tb));

      data[i] = tr;
      data[i + 1] = tg;
      data[i + 2] = tb;
    }
  }

  /**
   * Apply highlights adjustment to the image.
   * @param data - The underlying pixel data for a specified portion of the canvas.
   * @param highlights - The highlights adjustment value (-100 to 100).
   */
  function highlights(data: Uint8ClampedArray, highlights: number) {
    const threshold = 255 * (1 - Math.abs(highlights / 100));

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if (highlights >= 0 && brightness > threshold) {
        const factor = 1 + Math.abs(highlights / 100);
        data[i] = Math.min(255, data[i] * factor); // Red
        data[i + 1] = Math.min(255, data[i + 1] * factor); // Green
        data[i + 2] = Math.min(255, data[i + 2] * factor); // Blue
      }
      else if (highlights < 0) {
        const factor = 1 - Math.abs(highlights / 100);
        data[i] *= factor; // Red
        data[i + 1] *= factor; // Green
        data[i + 2] *= factor; // Blue
      }
    }
  }

  /**
   * Apply shadows adjustment to the image.
   * @param data - The underlying pixel data for a specified portion of the canvas.
   * @param shadows - The shadows adjustment value (-100 to 100).
   */
  function shadows(data: Uint8ClampedArray, shadows: number) {
    const threshold = 255 * (Math.abs(shadows / 100));

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if (shadows > 0 && brightness < threshold) {
        const factor = 1 + shadows / 100;
        data[i] = Math.max(0, data[i] * factor); // Red
        data[i + 1] = Math.max(0, data[i + 1] * factor); // Green
        data[i + 2] = Math.max(0, data[i + 2] * factor); // Blue
      }
      else if (shadows <= 0 && brightness < threshold) {
        // Do nothing for non-shadow pixels when shadows <= 0
      }
    }
  }

  function vignette(data: Uint8ClampedArray, vignette: number, { width, height }: { width: number; height: number }) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    const vignetteIntensityValue = vignette / 100;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = centerX - x;
        const dy = centerY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const gradient = distance / maxDistance;

        const vignette = vignetteIntensityValue * gradient;
        const index = (y * width + x) * 4;

        data[index] *= 1 - vignette;
        data[index + 1] *= 1 - vignette;
        data[index + 2] *= 1 - vignette;
      }
    }
  }

  function grain(data: Uint8ClampedArray, grain: number) {
    const grainScale = 0.15;
    const intensity = grain / 100 * grainScale;

    for (let i = 0; i < data.length; i += 4) {
      /**
       * Random noise
       */
      const noise = intensity * (Math.random() * 255 - 127);

      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
  }

  function sharpen(data: Uint8ClampedArray, sharpen: number, { width, height }: { width: number; height: number }) {
    const intensity = sharpen / 100;

    const weights = [
      0,
      -1,
      0,
      -1,
      5,
      -1,
      0,
      -1,
      0,
    ];

    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);

    const tmpData = new Uint8ClampedArray(data.length);

    for (let y = halfSide; y < height - halfSide; y++) {
      for (let x = halfSide; x < width - halfSide; x++) {
        const offset = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;
            const srcOffset = (scy * width + scx) * 4;
            const wt = weights[cy * side + cx];

            r += data[srcOffset] * wt;
            g += data[srcOffset + 1] * wt;
            b += data[srcOffset + 2] * wt;
          }
        }

        tmpData[offset] = Math.min(Math.max(data[offset] + intensity * (r - data[offset]), 0), 255);
        tmpData[offset + 1] = Math.min(Math.max(data[offset + 1] + intensity * (g - data[offset + 1]), 0), 255);
        tmpData[offset + 2] = Math.min(Math.max(data[offset + 2] + intensity * (b - data[offset + 2]), 0), 255);
        tmpData[offset + 3] = data[offset + 3]; // Preserve alpha
      }
    }

    // Copy tmpData back to original data array
    for (let i = 0; i < data.length; i++) {
      data[i] = tmpData[i];
    }
  }

  function enhance(data: Uint8ClampedArray, enhanceValue: number, imageSize = { width: 0, height: 0 }) {
    const intensity = 0.2;
    const contrastValue = enhanceValue * intensity * 0.5;
    const brightnessValue = enhanceValue * intensity * 0.5;
    const saturationValue = enhanceValue * intensity * 0.5;
    const sharpenValue = enhanceValue * intensity * 0.5;

    contrast(data, contrastValue);
    brightness(data, brightnessValue);
    saturation(data, saturationValue);
    sharpen(data, sharpenValue, imageSize);
  }

  const filters: Record<string, Filter> = {
    brightness,
    contrast,
    saturation,
    warmth,
    fade,
    highlights,
    shadows,
    vignette,
    grain,
    sharpen,
    enhance,
  };

  // const offScreenCanvas = document.createElement('canvas');
  // const offScreenContext = offScreenCanvas.getContext('2d');

  function applyFilter(imageData: ImageData, filter: keyof CanvasFilters, value: number) {
    const data = imageData.data;

    if (!(filter in filters)) {
      throw new Error(`Filter ${filter} not found`);
    }

    filters[filter](data, value, {
      width: imageData.width,
      height: imageData.height,
    });
  }

  // function applyFilter(canvas: HTMLCanvasElement, filter: keyof typeof filters, value: number) {
  //   const context = canvas.getContext('2d');

  //   if (!context || !offScreenContext) {
  //     throw new Error('Could not get canvas context to apply filter');
  //   }

  //   offScreenCanvas.width = canvas.width;
  //   offScreenCanvas.height = canvas.height;

  //   offScreenContext.drawImage(canvas, 0, 0);

  //   const imageData = offScreenContext.getImageData(0, 0, offScreenCanvas.width, offScreenCanvas.height);
  //   const data = imageData.data;

  //   if (!(filter in filters)) {
  //     throw new Error(`Filter ${filter} not found`);
  //   }

  //   filters[filter](data, value, {
  //     width: offScreenCanvas.width,
  //     height: offScreenCanvas.height,
  //   });

  //   offScreenContext.putImageData(imageData, 0, 0);
  //   context.clearRect(0, 0, canvas.width, canvas.height);
  //   context.drawImage(offScreenCanvas, 0, 0);
  // }

  function restoreFilters(imageData: ImageData, filtersValues: Partial<CanvasFilters>) {
    const data = imageData.data;

    for (const [filter, value] of Object.entries(filtersValues)) {
      if (!(filter in filters)) {
        throw new Error(`Filter ${filter} not found`);
      }

      filters[filter](data, value, {
        width: imageData.width,
        height: imageData.height,
      });
    }
  }

  // function restoreFilters(canvas: HTMLCanvasElement, filtersValues: Record<keyof typeof filters, number>) {
  //   const context = canvas.getContext('2d');

  //   if (!context || !offScreenContext) {
  //     throw new Error('Could not get canvas context to restore filters');
  //   }

  //   offScreenCanvas.width = canvas.width;
  //   offScreenCanvas.height = canvas.height;

  //   offScreenContext.drawImage(canvas, 0, 0);

  //   const imageData = offScreenContext.getImageData(0, 0, offScreenCanvas.width, offScreenCanvas.height);
  //   const data = imageData.data;

  //   for (const [filter, value] of Object.entries(filtersValues)) {
  //     if (!(filter in filters)) {
  //       throw new Error(`Filter ${filter} not found`);
  //     }

  //     filters[filter](data, value, {
  //       width: offScreenCanvas.width,
  //       height: offScreenCanvas.height,
  //     });
  //   }

  //   offScreenContext.putImageData(imageData, 0, 0);
  //   context.clearRect(0, 0, canvas.width, canvas.height);
  //   context.drawImage(offScreenCanvas, 0, 0);
  // }

  return {
    applyFilter,
    restoreFilters,
  };
}
