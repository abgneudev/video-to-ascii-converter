/**
 * ASCII Converter - Convert image data to ASCII
 * Uses same algorithm as runtime converter for consistency
 */

// Rec. 709 luminance coefficients (scaled to avoid floats)
const LUMA_R = 54;
const LUMA_G = 183;
const LUMA_B = 19;

export interface ConvertOptions {
  cols: number;
  ramp: string;
  colorMode: 'mono' | 'rgb' | 'palette';
}

export interface ConvertedFrame {
  chars: string;
  colors: Uint8Array;
  rows: number;
  cols: number;
}

export function convertToASCII(
  imageData: { data: Uint8Array | Uint8ClampedArray; width: number; height: number },
  options: ConvertOptions
): ConvertedFrame {
  const { cols, ramp, colorMode } = options;
  const { data, width, height } = imageData;

  // Calculate aspect-ratio-correct grid
  const charAspect = 0.5; // Characters are ~2x tall as wide
  const cellW = width / cols;
  const cellH = cellW / charAspect;
  const rows = Math.floor(height / cellH);

  const totalChars = rows * cols;
  const chars: string[] = new Array(totalChars);
  const colors = new Uint8Array(totalChars * 3);

  // Build luminance to char LUT
  const lumToChar = new Uint8Array(256);
  const rampLen = ramp.length;
  for (let lum = 0; lum < 256; lum++) {
    lumToChar[lum] = Math.min(Math.floor((lum * rampLen) / 256), rampLen - 1);
  }

  let charIdx = 0;
  let colorIdx = 0;

  for (let row = 0; row < rows; row++) {
    const baseY = Math.floor(row * cellH);
    const endY = Math.min(Math.floor(baseY + cellH), height);

    for (let col = 0; col < cols; col++) {
      const baseX = Math.floor(col * cellW);
      const endX = Math.min(Math.floor(baseX + cellW), width);

      let totalR = 0, totalG = 0, totalB = 0;
      let sampleCount = 0;

      // Sample pixels in cell
      const step = Math.max(1, Math.floor(Math.sqrt((endX - baseX) * (endY - baseY) / 16)));

      for (let y = baseY; y < endY; y += step) {
        for (let x = baseX; x < endX; x += step) {
          const i = (y * width + x) * 4;
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          sampleCount++;
        }
      }

      if (sampleCount === 0) sampleCount = 1;

      const avgR = Math.floor(totalR / sampleCount);
      const avgG = Math.floor(totalG / sampleCount);
      const avgB = Math.floor(totalB / sampleCount);

      // Calculate luminance and map to character
      const lum = (LUMA_R * avgR + LUMA_G * avgG + LUMA_B * avgB) >> 8;
      const charIndex = lumToChar[lum];

      chars[charIdx++] = ramp[charIndex];
      colors[colorIdx++] = avgR;
      colors[colorIdx++] = avgG;
      colors[colorIdx++] = avgB;
    }
  }

  return {
    chars: chars.join(''),
    colors,
    rows,
    cols
  };
}
