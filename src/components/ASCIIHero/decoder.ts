/**
 * Binary Format Decoder for ASCII Animation
 * Decodes .bin files created by the preprocessor
 */

import type { ASCIIAnimation, ASCIIFrame, ASCIIFrameFull, ASCIIFrameDelta, DeltaChange } from './types';

/**
 * Load animation from URL (supports .bin, .json, and .js imports)
 */
export async function loadAnimation(src: string): Promise<ASCIIAnimation> {
  const response = await fetch(src);

  if (src.endsWith('.json')) {
    return response.json();
  }

  if (src.endsWith('.bin')) {
    const buffer = await response.arrayBuffer();
    return decodeBinary(buffer);
  }

  // For .js files, they should be imported directly
  throw new Error(`Unsupported format: ${src}. Use .bin or .json`);
}

/**
 * Decode variable-length integer
 */
function decodeVarInt(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
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

/**
 * Decode binary format
 *
 * Binary Format:
 * - Header (32 bytes): magic, version, colorMode, cols, rows, fps, frameCount, rampLen
 * - Ramp string (rampLen bytes)
 * - Frames: type byte + data
 */
function decodeBinary(buffer: ArrayBuffer): ASCIIAnimation {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Verify magic "ASCI"
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'ASCI') {
    throw new Error('Invalid ASCII animation file: bad magic number');
  }

  // Parse header
  const version = bytes[4];
  const colorModeNum = bytes[5];
  const colorMode: 'mono' | 'rgb' | 'palette' =
    colorModeNum === 0 ? 'mono' : colorModeNum === 1 ? 'rgb' : 'palette';
  const cols = view.getUint16(6, true);
  const rows = view.getUint16(8, true);
  const fps = bytes[10];
  const frameCount = view.getUint16(11, true);
  const rampLen = bytes[13];

  // Parse ramp string
  let offset = 32;
  const rampBytes = bytes.slice(offset, offset + rampLen);
  const ramp = String.fromCharCode(...rampBytes);
  offset += rampLen;

  // Parse frames
  const frames: ASCIIFrame[] = [];
  const totalChars = rows * cols;
  const includeColors = colorMode !== 'mono';

  for (let i = 0; i < frameCount; i++) {
    const frameType = bytes[offset++];

    if (frameType === 0) {
      // Full frame
      const chars = String.fromCharCode(...bytes.slice(offset, offset + totalChars));
      offset += totalChars;

      const frame: ASCIIFrameFull = { type: 'full', chars };

      if (includeColors) {
        frame.colors = Array.from(bytes.slice(offset, offset + totalChars * 3));
        offset += totalChars * 3;
      }

      frames.push(frame);
    } else {
      // Delta frame
      const { value: changeCount, bytesRead: countBytes } = decodeVarInt(bytes, offset);
      offset += countBytes;

      const changes: DeltaChange[] = [];

      for (let j = 0; j < changeCount; j++) {
        const { value: index, bytesRead: indexBytes } = decodeVarInt(bytes, offset);
        offset += indexBytes;

        const char = String.fromCharCode(bytes[offset++]);

        const change: DeltaChange = { index, char };

        if (includeColors) {
          change.colorR = bytes[offset++];
          change.colorG = bytes[offset++];
          change.colorB = bytes[offset++];
        }

        changes.push(change);
      }

      frames.push({ type: 'delta', changes } as ASCIIFrameDelta);
    }
  }

  return {
    meta: {
      version: version as 1,
      cols,
      rows,
      fps,
      frameCount,
      duration: frameCount / fps,
      colorMode,
      ramp
    },
    frames
  };
}
