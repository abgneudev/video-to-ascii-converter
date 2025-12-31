/**
 * Color science utilities for perceptual luminance calculation
 * Uses Rec. 709 luma coefficients for accurate brightness perception
 */

/**
 * Convert sRGB channel value to linear RGB
 * Applies inverse gamma correction for accurate luminance calculation
 */
export const sRGBToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/**
 * Calculate simple luminance using Rec. 709 coefficients
 * Human eye is most sensitive to green, least to blue
 */
export const getLuminance = (r: number, g: number, b: number): number => {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Calculate perceptual luminance with gamma correction
 * More accurate for human vision but computationally heavier
 */
export const getPerceptualLuminance = (r: number, g: number, b: number): number => {
  return (
    0.2126 * sRGBToLinear(r) +
    0.7152 * sRGBToLinear(g) +
    0.0722 * sRGBToLinear(b)
  );
};

/**
 * Normalize luminance to 0-1 range
 */
export const normalizeLuminance = (r: number, g: number, b: number): number => {
  return getLuminance(r, g, b) / 255;
};
