/**
 * ColorQuantizer - Perceptual color extraction and palette snapping
 * Reduces colors to a limited palette for improved visual coherence
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Default color palette for quantization */
export const DEFAULT_PALETTE: RGB[] = [
  { r: 0, g: 0, b: 0 }, // black
  { r: 255, g: 255, b: 255 }, // white
  { r: 255, g: 85, b: 85 }, // red
  { r: 85, g: 255, b: 85 }, // green
  { r: 85, g: 85, b: 255 }, // blue
  { r: 255, g: 255, b: 85 }, // yellow
  { r: 255, g: 85, b: 255 }, // magenta
  { r: 85, g: 255, b: 255 }, // cyan
  { r: 255, g: 170, b: 85 }, // orange
  { r: 170, g: 85, b: 255 }, // purple
  { r: 128, g: 128, b: 128 }, // gray
  { r: 85, g: 85, b: 85 }, // dark gray
  { r: 170, g: 170, b: 170 }, // light gray
  { r: 170, g: 85, b: 85 }, // dark red
  { r: 85, g: 170, b: 85 }, // dark green
  { r: 85, g: 85, b: 170 }, // dark blue
];

/** Terminal 16-color palette (ANSI) */
export const ANSI_PALETTE: RGB[] = [
  { r: 0, g: 0, b: 0 }, // Black
  { r: 128, g: 0, b: 0 }, // Red
  { r: 0, g: 128, b: 0 }, // Green
  { r: 128, g: 128, b: 0 }, // Yellow
  { r: 0, g: 0, b: 128 }, // Blue
  { r: 128, g: 0, b: 128 }, // Magenta
  { r: 0, g: 128, b: 128 }, // Cyan
  { r: 192, g: 192, b: 192 }, // White
  { r: 128, g: 128, b: 128 }, // Bright Black (Gray)
  { r: 255, g: 0, b: 0 }, // Bright Red
  { r: 0, g: 255, b: 0 }, // Bright Green
  { r: 255, g: 255, b: 0 }, // Bright Yellow
  { r: 0, g: 0, b: 255 }, // Bright Blue
  { r: 255, g: 0, b: 255 }, // Bright Magenta
  { r: 0, g: 255, b: 255 }, // Bright Cyan
  { r: 255, g: 255, b: 255 }, // Bright White
];

export class ColorQuantizer {
  private palette: RGB[] = DEFAULT_PALETTE;
  private cache: Map<string, RGB> = new Map();

  /**
   * Set the color palette
   */
  setPalette(palette: RGB[]): void {
    this.palette = palette;
    this.cache.clear();
  }

  /**
   * Use ANSI terminal palette
   */
  useANSIPalette(): void {
    this.setPalette(ANSI_PALETTE);
  }

  /**
   * Use default palette
   */
  useDefaultPalette(): void {
    this.setPalette(DEFAULT_PALETTE);
  }

  /**
   * Calculate perceptual distance between two colors
   * Uses weighted Euclidean distance in RGB space
   */
  private colorDistance(c1: RGB, c2: RGB): number {
    // Weight coefficients based on human perception
    // Green is most sensitive, blue least
    const rMean = (c1.r + c2.r) / 2;
    const dR = c1.r - c2.r;
    const dG = c1.g - c2.g;
    const dB = c1.b - c2.b;

    // Redmean color distance formula for better perceptual accuracy
    const rWeight = rMean < 128 ? 2 : 3;
    const bWeight = rMean < 128 ? 3 : 2;

    return Math.sqrt(
      rWeight * dR * dR + 4 * dG * dG + bWeight * dB * dB
    );
  }

  /**
   * Snap a color to the nearest palette color
   */
  snapToPalette(color: RGB): RGB {
    const key = `${color.r},${color.g},${color.b}`;

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    let minDist = Infinity;
    let closest = this.palette[0];

    for (const p of this.palette) {
      const dist = this.colorDistance(color, p);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }

    // Cache the result (limit cache size)
    if (this.cache.size > 10000) {
      this.cache.clear();
    }
    this.cache.set(key, closest);

    return closest;
  }

  /**
   * Quantize an array of colors
   */
  quantizeColors(colors: RGB[]): RGB[] {
    return colors.map((c) => this.snapToPalette(c));
  }

  /**
   * Get the current palette
   */
  getPalette(): RGB[] {
    return [...this.palette];
  }

  /**
   * Convert RGB to CSS color string
   */
  static rgbToCSS(color: RGB): string {
    return `rgb(${color.r},${color.g},${color.b})`;
  }

  /**
   * Convert RGB to hex color string
   */
  static rgbToHex(color: RGB): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }
}
