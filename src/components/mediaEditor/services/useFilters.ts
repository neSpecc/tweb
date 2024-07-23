import { createSignal } from 'solid-js';

/**
 * Filters is a function implementing this type
 */
type Filter = (data: Uint8ClampedArray, value: number, imageSize: { width: number; height: number }) => void;

export function useFilters() {
  const [filterValues, setFilterValues] = createSignal({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    fade: 0,
    highlights: 0,
    shadows: 0,
    vignette: 0,
    grain: 0,
    sharpen: 0,
  });

  /**
   * Manipulate the brightness of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param brightness - The brightness value to apply. From -100 to 100.
   */
  function brightness(data: Uint8ClampedArray, brightness: number): void {
    const factor = (brightness + 100) / 100;

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
      // Enhance highlights
        const factor = 1 + Math.abs(highlights / 100);
        data[i] = Math.min(255, data[i] * factor); // Red
        data[i + 1] = Math.min(255, data[i + 1] * factor); // Green
        data[i + 2] = Math.min(255, data[i + 2] * factor); // Blue
      }
      else if (highlights < 0) {
      // Reduce non-highlights
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
      // Enhance shadows
        const factor = 1 + shadows / 100;
        data[i] = Math.max(0, data[i] * factor); // Red
        data[i + 1] = Math.max(0, data[i + 1] * factor); // Green
        data[i + 2] = Math.max(0, data[i + 2] * factor); // Blue
      }
      else if (shadows <= 0 && brightness < threshold) {
      // Do nothing for non-shadow pixels when shadows <= 0
      }
    // else, leave pixels unchanged (brightness >= threshold)
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

        // Calculate vignette factor based on intensity and gradient
        const vignette = vignetteIntensityValue * gradient;

        // Calculate index in the image data array
        const index = (y * width + x) * 4;

        // Apply vignette effect
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

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;

            if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
              const srcOffset = (scy * width + scx) * 4;
              const wt = weights[cy * side + cx];
              r += data[srcOffset] * wt;
              g += data[srcOffset + 1] * wt;
              b += data[srcOffset + 2] * wt;
            }
          }
        }

        tmpData[offset] = data[offset] + intensity * (r - data[offset]);
        tmpData[offset + 1] = data[offset + 1] + intensity * (g - data[offset + 1]);
        tmpData[offset + 2] = data[offset + 2] + intensity * (b - data[offset + 2]);
        tmpData[offset + 3] = data[offset + 3];
      }
    }

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

  const offScreenCanvas = document.createElement('canvas');
  const offScreenContext = offScreenCanvas.getContext('2d');

  function applyFilter(canvas: HTMLCanvasElement, filter: keyof typeof filters, value: number) {
    const context = canvas.getContext('2d');

    if (!context || !offScreenContext) {
      throw new Error('Could not get canvas context to apply filter');
    }

    // Resize the off-screen canvas to match the main canvas
    offScreenCanvas.width = canvas.width;
    offScreenCanvas.height = canvas.height;

    // Copy the current state of the main canvas to the off-screen canvas
    offScreenContext.drawImage(canvas, 0, 0);

    const imageData = offScreenContext.getImageData(0, 0, offScreenCanvas.width, offScreenCanvas.height);
    const data = imageData.data;

    if (!(filter in filters)) {
      throw new Error(`Filter ${filter} not found`);
    }

    filters[filter](data, value, {
      width: offScreenCanvas.width,
      height: offScreenCanvas.height,
    });

    setFilterValues(prev => ({
      ...prev,
      [filter]: value,
    }));

    // Put the processed image data back to the off-screen canvas
    offScreenContext.putImageData(imageData, 0, 0);

    // Draw the off-screen canvas back to the main canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(offScreenCanvas, 0, 0);
  }

  function restoreFilters(canvas: HTMLCanvasElement, skip: keyof typeof filters) {
    const context = canvas.getContext('2d');

    if (!context || !offScreenContext) {
      throw new Error('Could not get canvas context to restore filters');
    }

    // Resize the off-screen canvas to match the main canvas
    offScreenCanvas.width = canvas.width;
    offScreenCanvas.height = canvas.height;

    // Copy the current state of the main canvas to the off-screen canvas
    offScreenContext.drawImage(canvas, 0, 0);

    const imageData = offScreenContext.getImageData(0, 0, offScreenCanvas.width, offScreenCanvas.height);
    const data = imageData.data;

    for (const [f, v] of Object.entries(filterValues())) {
      if (f !== skip && v !== 0) {
        filters[f](data, v, {
          width: offScreenCanvas.width,
          height: offScreenCanvas.height,
        });
      }
    }

    // Put the processed image data back to the off-screen canvas
    offScreenContext.putImageData(imageData, 0, 0);

    // Draw the off-screen canvas back to the main canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(offScreenCanvas, 0, 0);
  }

  function _applyFilter(canvas: HTMLCanvasElement, filter: keyof typeof filters, value: number) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context to apply filter');
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    if (!(filter in filters)) {
      throw new Error(`Filter ${filter} not found`);
    }

    filters[filter](data, value, {
      width: canvas.width,
      height: canvas.height,
    });

    setFilterValues((prev) => {
      return {
        ...prev,
        [filter]: value,
      };
    });

    context.putImageData(imageData, 0, 0);
  }

  function _restoreFilters(canvas: HTMLCanvasElement, skip: keyof typeof filters) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context to restore filters');
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (const [f, v] of Object.entries(filterValues())) {
      if (f !== skip && v !== 0) {
        filters[f](data, v, {
          width: canvas.width,
          height: canvas.height,
        });
      }
    }

    context.putImageData(imageData, 0, 0);
  }

  return {
    applyFilter,
    restoreFilters,
  };
}
