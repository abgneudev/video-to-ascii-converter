/**
 * ASCIIRenderer - High-performance ASCII art renderer
 * Uses native Canvas drawImage for speed instead of pixel manipulation
 */

import { calculateSamplingGrid, type SamplingGrid } from '../utils/aspectRatio';

export const ASCII_RAMPS = {
  minimal: ' .:+*#@',
  standard: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  binary: '01',
} as const;

export type RampType = keyof typeof ASCII_RAMPS;

export interface RenderOptions {
  cols: number;
  ramp: RampType | string;
  colorMode: 'mono' | 'color' | 'palette';
  invert: boolean;
}

export interface ASCIIChar {
  char: string;
  r: number;
  g: number;
  b: number;
}

export interface ASCIIFrame {
  chars: ASCIIChar[][];
  rows: number;
  cols: number;
  charCodes: Uint8Array;
  colors: Uint8Array;
}

const LUMA_R = 54;
const LUMA_G = 183;
const LUMA_B = 19;

export class ASCIIRenderer {
  private ramp: string = ASCII_RAMPS.minimal;
  private rampCodes: Uint8Array;

  // Glyph cache for colored characters
  private glyphCache: Map<string, HTMLCanvasElement> = new Map();
  private readonly MAX_CACHE_SIZE = 2000;
  private colorMode: 'mono' | 'color' | 'palette' = 'mono';
  private invert = false;
  private cols = 80;

  // Character dimensions
  private charWidth = 6;
  private charHeight = 10;

  // Reusable buffers
  private charCodesBuffer: Uint8Array | null = null;
  private colorsBuffer: Uint8Array | null = null;
  private lastRows = 0;
  private lastCols = 0;

  // LUT for fast luminance to char mapping
  private lumToCharLUT: Uint8Array = new Uint8Array(256);

  // Pre-built character strings (ASCII 0-127) - zero allocation lookup
  private readonly charLookup: string[] = new Array(128);

  // Single glyph canvas for rendering
  private glyphCanvas: HTMLCanvasElement;
  private glyphCtx: CanvasRenderingContext2D;

  // Reusable line string buffer
  private lineChars: string[] = [];
  private lastLineCols = 0;

  constructor() {
    this.rampCodes = new Uint8Array(this.ramp.length);
    this.updateRampCodes();
    this.buildLumLUT();

    // Pre-build character lookup table (zero allocation at render time)
    for (let i = 0; i < 128; i++) {
      this.charLookup[i] = String.fromCharCode(i);
    }

    // Create glyph rendering canvas
    this.glyphCanvas = document.createElement('canvas');
    this.glyphCtx = this.glyphCanvas.getContext('2d', { alpha: true })!;

    // Measure actual character dimensions
    this.measureCharDimensions();
  }

  private measureCharDimensions(): void {
    const fontSize = 10;
    this.glyphCtx.font = `${fontSize}px "SF Mono","Fira Code",Consolas,monospace`;
    const metrics = this.glyphCtx.measureText('M');
    this.charWidth = Math.ceil(metrics.width);
    this.charHeight = fontSize;

    this.glyphCanvas.width = this.charWidth;
    this.glyphCanvas.height = this.charHeight;
  }

  private updateRampCodes(): void {
    this.rampCodes = new Uint8Array(this.ramp.length);
    for (let i = 0; i < this.ramp.length; i++) {
      this.rampCodes[i] = this.ramp.charCodeAt(i);
    }
    this.buildLumLUT();
  }

  private buildLumLUT(): void {
    const rampLen = this.ramp.length;

    for (let lum = 0; lum < 256; lum++) {
      const adjusted = this.invert ? 255 - lum : lum;
      // Standard linear mapping for all ramps
      this.lumToCharLUT[lum] = Math.min(
        Math.floor((adjusted * rampLen) / 256),
        rampLen - 1
      );
    }
  }

  /**
   * Get or create a cached colored glyph
   */
  private getColoredGlyph(char: string, r: number, g: number, b: number): HTMLCanvasElement {
    // Quantize color to reduce cache entries (64 levels per channel)
    const qr = (r >> 2) << 2;
    const qg = (g >> 2) << 2;
    const qb = (b >> 2) << 2;
    const key = `${char}_${qr}_${qg}_${qb}`;

    let cached = this.glyphCache.get(key);
    if (cached) return cached;

    // Create new glyph canvas
    const canvas = document.createElement('canvas');
    canvas.width = this.charWidth;
    canvas.height = this.charHeight;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Draw character
    ctx.font = `${this.charHeight}px "SF Mono","Fira Code",Consolas,monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgb(${qr},${qg},${qb})`;
    ctx.fillText(char, 0, 0);

    // Manage cache size
    if (this.glyphCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (first 500)
      const keys = Array.from(this.glyphCache.keys()).slice(0, 500);
      keys.forEach(k => this.glyphCache.delete(k));
    }

    this.glyphCache.set(key, canvas);
    return canvas;
  }

  setOptions(options: Partial<RenderOptions>): void {
    if (options.cols !== undefined) {
      this.cols = Math.max(20, Math.min(200, options.cols));
    }
    if (options.ramp !== undefined) {
      this.ramp = options.ramp in ASCII_RAMPS
        ? ASCII_RAMPS[options.ramp as RampType]
        : options.ramp;
      this.updateRampCodes();
    }
    if (options.colorMode !== undefined) {
      this.colorMode = options.colorMode;
    }
    if (options.invert !== undefined) {
      this.invert = options.invert;
      this.buildLumLUT();
    }
  }

  /**
   * Fast render using LUT and typed arrays
   */
  render(imageData: ImageData): ASCIIFrame {
    const grid: SamplingGrid = calculateSamplingGrid(
      imageData.width,
      imageData.height,
      this.cols
    );

    const totalChars = grid.rows * grid.cols;

    if (this.lastRows !== grid.rows || this.lastCols !== grid.cols) {
      this.charCodesBuffer = new Uint8Array(totalChars);
      this.colorsBuffer = new Uint8Array(totalChars * 3);
      this.lastRows = grid.rows;
      this.lastCols = grid.cols;
    }

    const charCodes = this.charCodesBuffer!;
    const colors = this.colorsBuffer!;
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const cellW = grid.cellW;
    const cellH = grid.cellH;

    // More aggressive sampling for large cells
    const cellArea = Math.floor(cellW) * Math.floor(cellH);
    const step = cellArea > 200 ? 4 : cellArea > 100 ? 3 : cellArea > 50 ? 2 : 1;

    let charIdx = 0;
    let colorIdx = 0;

    for (let row = 0; row < grid.rows; row++) {
      const baseY = (row * cellH) | 0;
      const endY = Math.min(baseY + (cellH | 0), height);

      for (let col = 0; col < grid.cols; col++) {
        const baseX = (col * cellW) | 0;
        const endX = Math.min(baseX + (cellW | 0), width);

        let totalR = 0, totalG = 0, totalB = 0;
        let sampleCount = 0;

        for (let y = baseY; y < endY; y += step) {
          const rowOffset = y * width;
          for (let x = baseX; x < endX; x += step) {
            const i = (rowOffset + x) << 2;
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
            sampleCount++;
          }
        }

        if (sampleCount === 0) sampleCount = 1;

        const avgR = (totalR / sampleCount) | 0;
        const avgG = (totalG / sampleCount) | 0;
        const avgB = (totalB / sampleCount) | 0;

        const lum = (LUMA_R * avgR + LUMA_G * avgG + LUMA_B * avgB) >> 8;
        const charIndex = this.lumToCharLUT[lum];

        charCodes[charIdx++] = this.rampCodes[charIndex];
        colors[colorIdx++] = avgR;
        colors[colorIdx++] = avgG;
        colors[colorIdx++] = avgB;
      }
    }

    return {
      chars: [],
      rows: grid.rows,
      cols: grid.cols,
      charCodes,
      colors,
    };
  }

  frameToText(frame: ASCIIFrame): string {
    const { charCodes, rows, cols } = frame;
    const lines: string[] = new Array(rows);

    for (let row = 0; row < rows; row++) {
      const start = row * cols;
      lines[row] = String.fromCharCode(...charCodes.subarray(start, start + cols));
    }

    return lines.join('\n');
  }

  // Cached canvas context
  private lastCanvasCtx: CanvasRenderingContext2D | null = null;

  /**
   * Canvas rendering with color support and enhanced contrast
   */
  renderToCanvas(frame: ASCIIFrame, canvas: HTMLCanvasElement): void {
    // Reuse context
    if (!this.lastCanvasCtx || this.lastCanvasCtx.canvas !== canvas) {
      this.lastCanvasCtx = canvas.getContext('2d', { alpha: false });
    }
    const ctx = this.lastCanvasCtx;
    if (!ctx) return;

    const { charCodes, colors, rows, cols } = frame;
    const charHeight = this.charHeight;
    const charWidth = this.charWidth;

    const requiredWidth = cols * charWidth;
    const requiredHeight = rows * charHeight;

    if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
      canvas.width = requiredWidth;
      canvas.height = requiredHeight;
    }

    // Clear with pure black background for maximum contrast
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Setup text
    ctx.font = `bold ${charHeight}px "SF Mono","Fira Code",Consolas,monospace`;
    ctx.textBaseline = 'top';

    // Render each row with enhanced color
    for (let row = 0; row < rows; row++) {
      const start = row * cols;
      const line = String.fromCharCode(...charCodes.subarray(start, start + cols));

      // Calculate average color for this row
      let totalR = 0, totalG = 0, totalB = 0;
      const rowColorStart = row * cols * 3;

      for (let col = 0; col < cols; col++) {
        const ci = rowColorStart + col * 3;
        totalR += colors[ci];
        totalG += colors[ci + 1];
        totalB += colors[ci + 2];
      }

      let avgR = (totalR / cols) | 0;
      let avgG = (totalG / cols) | 0;
      let avgB = (totalB / cols) | 0;

      // Boost contrast: increase saturation and brightness
      const max = Math.max(avgR, avgG, avgB);
      const min = Math.min(avgR, avgG, avgB);
      const lum = (max + min) / 2;

      // Boost brightness significantly (minimum 100 for visibility)
      const boostFactor = lum < 50 ? 3.0 : lum < 100 ? 2.0 : 1.5;
      avgR = Math.min(255, (avgR * boostFactor) | 0);
      avgG = Math.min(255, (avgG * boostFactor) | 0);
      avgB = Math.min(255, (avgB * boostFactor) | 0);

      // Ensure minimum brightness
      const finalMax = Math.max(avgR, avgG, avgB);
      if (finalMax < 80) {
        const scale = 80 / Math.max(finalMax, 1);
        avgR = Math.min(255, (avgR * scale) | 0);
        avgG = Math.min(255, (avgG * scale) | 0);
        avgB = Math.min(255, (avgB * scale) | 0);
      }

      ctx.fillStyle = `rgb(${avgR},${avgG},${avgB})`;
      ctx.fillText(line, 0, row * charHeight);
    }
  }

  /**
   * Monochrome rendering - simpler and faster
   */
  renderMonoToCanvas(frame: ASCIIFrame, canvas: HTMLCanvasElement, color: string = '#e0e0e0'): void {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { charCodes, rows, cols } = frame;
    const charWidth = this.charWidth;
    const charHeight = this.charHeight;

    const requiredWidth = cols * charWidth;
    const requiredHeight = rows * charHeight;

    if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
      canvas.width = requiredWidth;
      canvas.height = requiredHeight;
    }

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Setup text rendering
    ctx.font = `${charHeight}px "SF Mono","Fira Code",Consolas,monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;

    // Batch render - build full text and render line by line
    let idx = 0;
    for (let row = 0; row < rows; row++) {
      const y = row * charHeight;
      let lineText = '';

      for (let col = 0; col < cols; col++) {
        lineText += String.fromCharCode(charCodes[idx++]);
      }

      ctx.fillText(lineText, 0, y);
    }
  }

  frameToColoredHTML(frame: ASCIIFrame): string {
    if (this.colorMode === 'mono') {
      return this.escapeHTML(this.frameToText(frame));
    }
    return this.frameToText(frame);
  }

  private escapeHTML(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  get currentCols(): number {
    return this.cols;
  }

  get currentColorMode(): 'mono' | 'color' | 'palette' {
    return this.colorMode;
  }

  clearCache(): void {
    this.glyphCache.clear();
  }
}
