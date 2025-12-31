/**
 * Aspect ratio utilities for character cell correction
 * Monospace characters are typically ~2:1 height:width
 */

/** Height/width ratio of typical monospace character */
export const CHAR_ASPECT_RATIO = 0.5;

export interface SamplingGrid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

/**
 * Calculate the sampling grid for ASCII conversion
 * Compensates for character aspect ratio to prevent stretching
 */
export const calculateSamplingGrid = (
  videoWidth: number,
  videoHeight: number,
  targetCols: number
): SamplingGrid => {
  const cellW = videoWidth / targetCols;
  const cellH = cellW / CHAR_ASPECT_RATIO; // Taller cells to compensate
  const rows = Math.floor(videoHeight / cellH);

  return { cols: targetCols, rows, cellW, cellH };
};

/**
 * Calculate optimal columns based on container width and font size
 */
export const calculateOptimalCols = (
  containerWidth: number,
  charWidth: number,
  maxCols: number = 160
): number => {
  const cols = Math.floor(containerWidth / charWidth);
  return Math.min(cols, maxCols);
};
