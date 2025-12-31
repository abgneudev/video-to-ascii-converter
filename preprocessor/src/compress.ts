/**
 * Compression utilities for ASCII animation data
 * Implements delta compression for efficient frame storage
 */

import type { ASCIIFrame, ASCIIFrameFull, ASCIIFrameDelta, DeltaChange } from './types.js';
import type { ConvertedFrame } from './asciiConverter.js';

const DELTA_THRESHOLD = 0.4; // If >40% changed, store full frame

export function computeDelta(
  prev: ConvertedFrame,
  curr: ConvertedFrame,
  includeColors: boolean
): ASCIIFrame {
  const changes: DeltaChange[] = [];

  for (let i = 0; i < curr.chars.length; i++) {
    const charChanged = curr.chars[i] !== prev.chars[i];
    const colorChanged = includeColors && (
      curr.colors[i * 3] !== prev.colors[i * 3] ||
      curr.colors[i * 3 + 1] !== prev.colors[i * 3 + 1] ||
      curr.colors[i * 3 + 2] !== prev.colors[i * 3 + 2]
    );

    if (charChanged || colorChanged) {
      const change: DeltaChange = {
        index: i,
        char: curr.chars[i]
      };

      if (includeColors) {
        change.colorR = curr.colors[i * 3];
        change.colorG = curr.colors[i * 3 + 1];
        change.colorB = curr.colors[i * 3 + 2];
      }

      changes.push(change);
    }
  }

  // If too many changes, store full frame
  if (changes.length > curr.chars.length * DELTA_THRESHOLD) {
    const frame: ASCIIFrameFull = {
      type: 'full',
      chars: curr.chars
    };
    if (includeColors) {
      frame.colors = curr.colors;
    }
    return frame;
  }

  return {
    type: 'delta',
    changes
  } as ASCIIFrameDelta;
}

export function createFullFrame(frame: ConvertedFrame, includeColors: boolean): ASCIIFrameFull {
  const result: ASCIIFrameFull = {
    type: 'full',
    chars: frame.chars
  };
  if (includeColors) {
    result.colors = frame.colors;
  }
  return result;
}

/**
 * Encode variable-length integer (for binary format)
 */
export function encodeVarInt(n: number): number[] {
  const bytes: number[] = [];
  while (n > 127) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return bytes;
}

/**
 * Decode variable-length integer
 */
export function decodeVarInt(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    const byte = bytes[offset + bytesRead];
    bytesRead++;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return { value, bytesRead };
}
