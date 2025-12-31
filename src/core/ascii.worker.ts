/**
 * ASCII Web Worker - Off-main-thread frame processing
 * Handles CPU-intensive pixel sampling and luminance calculation
 */

// Luminance coefficients (Rec.709) as integers
const LUMA_R = 54;
const LUMA_G = 183;
const LUMA_B = 19;

// Character aspect ratio
const CHAR_ASPECT_RATIO = 0.5;

interface WorkerMessage {
  type: 'init' | 'render' | 'setOptions';
  imageData?: ImageData;
  width?: number;
  height?: number;
  data?: Uint8ClampedArray;
  options?: {
    cols: number;
    rampCodes: number[];
    invert: boolean;
  };
}

interface RenderResult {
  type: 'frame';
  charCodes: Uint8Array;
  colors: Uint8Array;
  rows: number;
  cols: number;
}

let currentOptions = {
  cols: 80,
  rampCodes: new Uint8Array([32, 46, 58, 43, 42, 35, 64]), // ' .:+*#@'
  rampLength: 7,
  invert: false,
};

// Reusable buffers
let charCodesBuffer: Uint8Array | null = null;
let colorsBuffer: Uint8Array | null = null;
let lastRows = 0;
let lastCols = 0;

function fastLuminance(r: number, g: number, b: number): number {
  return (LUMA_R * r + LUMA_G * g + LUMA_B * b) >> 8;
}

function getCharIndex(lum: number): number {
  const adjusted = currentOptions.invert ? 255 - lum : lum;
  return Math.min(
    (adjusted * currentOptions.rampLength) >> 8,
    currentOptions.rampLength - 1
  );
}

function calculateGrid(width: number, height: number, targetCols: number) {
  const cellW = width / targetCols;
  const cellH = cellW / CHAR_ASPECT_RATIO;
  const rows = Math.floor(height / cellH);
  return { cols: targetCols, rows, cellW, cellH };
}

function processFrame(
  data: Uint8ClampedArray,
  width: number,
  height: number
): RenderResult {
  const grid = calculateGrid(width, height, currentOptions.cols);
  const totalChars = grid.rows * grid.cols;

  // Reuse or allocate buffers
  if (lastRows !== grid.rows || lastCols !== grid.cols) {
    charCodesBuffer = new Uint8Array(totalChars);
    colorsBuffer = new Uint8Array(totalChars * 3);
    lastRows = grid.rows;
    lastCols = grid.cols;
  }

  const charCodes = charCodesBuffer!;
  const colors = colorsBuffer!;

  const cellW = Math.floor(grid.cellW);
  const cellH = Math.floor(grid.cellH);
  const cellArea = cellW * cellH;

  let charIdx = 0;
  let colorIdx = 0;

  // Process each cell with adaptive sampling
  for (let row = 0; row < grid.rows; row++) {
    const baseY = Math.floor(row * grid.cellH);

    for (let col = 0; col < grid.cols; col++) {
      const baseX = Math.floor(col * grid.cellW);

      let totalR = 0, totalG = 0, totalB = 0;

      // Adaptive step: sample fewer pixels for larger cells
      const step = cellArea > 64 ? 2 : 1;
      let sampleCount = 0;

      for (let dy = 0; dy < cellH; dy += step) {
        const y = baseY + dy;
        if (y >= height) break;
        const rowOffset = y * width;

        for (let dx = 0; dx < cellW; dx += step) {
          const x = baseX + dx;
          if (x >= width) break;

          const i = (rowOffset + x) << 2;
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          sampleCount++;
        }
      }

      const invCount = 1 / sampleCount;
      const avgR = (totalR * invCount) | 0;
      const avgG = (totalG * invCount) | 0;
      const avgB = (totalB * invCount) | 0;

      const lum = fastLuminance(avgR, avgG, avgB);
      const charIndex = getCharIndex(lum);

      charCodes[charIdx++] = currentOptions.rampCodes[charIndex];
      colors[colorIdx++] = avgR;
      colors[colorIdx++] = avgG;
      colors[colorIdx++] = avgB;
    }
  }

  return {
    type: 'frame',
    charCodes: charCodes.slice(), // Copy for transfer
    colors: colors.slice(),
    rows: grid.rows,
    cols: grid.cols,
  };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'setOptions' && e.data.options) {
    const { cols, rampCodes, invert } = e.data.options;
    currentOptions.cols = cols;
    currentOptions.rampCodes = new Uint8Array(rampCodes);
    currentOptions.rampLength = rampCodes.length;
    currentOptions.invert = invert;
    return;
  }

  if (type === 'render' && e.data.data && e.data.width && e.data.height) {
    const result = processFrame(
      e.data.data,
      e.data.width,
      e.data.height
    );

    // Transfer buffers back to main thread
    self.postMessage(result, {
      transfer: [result.charCodes.buffer, result.colors.buffer]
    } as any);
  }
};

export {};
