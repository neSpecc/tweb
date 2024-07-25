self.addEventListener('message', (event) => {
  const {filters, imageData, width, height, canvasId} = event.data;

  /**
   * Manipulate the brightness of the image
   * @param data - underlying pixel data for a specified portion of the canvas
   * @param brightness - The brightness value to apply. From -100 to 100.
   */
  function brightness(data, brightness) {
    const factor = (brightness + 100) / 100;

    for(let i = 0; i < data.length; i += 4) {
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
  function contrast(data, contrast) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for(let i = 0; i < data.length; i += 4) {
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
  function saturation(data, saturation) {
    const factor = 1 + saturation / 100;

    for(let i = 0; i < data.length; i += 4) {
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
  function warmth(data, warmth) {
    const factor = warmth / 100;

    for(let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + factor * 50)); // Red
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - factor * 50)); // Blue
    }
  }

  function fade(data, fade) {
    const normalizedFade = fade / 100;
    const targetSepiaIntensity = normalizedFade * 0.3;

    for(let i = 0; i < data.length; i += 4) {
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
  function highlights(data, highlights) {
    const threshold = 255 * (1 - Math.abs(highlights / 100));

    for(let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if(highlights >= 0 && brightness > threshold) {
      // Enhance highlights
        const factor = 1 + Math.abs(highlights / 100);
        data[i] = Math.min(255, data[i] * factor); // Red
        data[i + 1] = Math.min(255, data[i + 1] * factor); // Green
        data[i + 2] = Math.min(255, data[i + 2] * factor); // Blue
      }
      else if(highlights < 0) {
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
  function shadows(data, shadows) {
    const threshold = 255 * (Math.abs(shadows / 100));

    for(let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if(shadows > 0 && brightness < threshold) {
      // Enhance shadows
        const factor = 1 + shadows / 100;
        data[i] = Math.max(0, data[i] * factor); // Red
        data[i + 1] = Math.max(0, data[i + 1] * factor); // Green
        data[i + 2] = Math.max(0, data[i + 2] * factor); // Blue
      }
      else if(shadows <= 0 && brightness < threshold) {
      // Do nothing for non-shadow pixels when shadows <= 0
      }
    // else, leave pixels unchanged (brightness >= threshold)
    }
  }

  function vignette(data, vignette, {width, height}) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    const vignetteIntensityValue = vignette / 100;

    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
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

  function grain(data, grain) {
    const grainScale = 0.15;
    const intensity = grain / 100 * grainScale;

    for(let i = 0; i < data.length; i += 4) {
      /**
       * Random noise
       */
      const noise = intensity * (Math.random() * 255 - 127);

      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
  }

  function sharpen(data, sharpen, {width, height}) {
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
      0
    ];

    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);

    const tmpData = new Uint8ClampedArray(data.length);

    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;

        for(let cy = 0; cy < side; cy++) {
          for(let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;

            if(scy >= 0 && scy < height && scx >= 0 && scx < width) {
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

    for(let i = 0; i < data.length; i++) {
      data[i] = tmpData[i];
    }
  }

  function enhance(data, enhanceValue, imageSize) {
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

  const filterProcessors = {
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
    enhance
  };

  const data = new Uint8ClampedArray(imageData);

  for(const [filter, value] of Object.entries(filters)) {
    if(filterProcessors[filter]) {
      filterProcessors[filter](data, value, {width, height});
    }
  }

  postMessage({imageData: data.buffer, width, height, canvasId}, [data.buffer]);
});

self.onerror = function(errorEvent) {
  console.error('Worker error:', errorEvent);
  postMessage({error: errorEvent.message});
};
