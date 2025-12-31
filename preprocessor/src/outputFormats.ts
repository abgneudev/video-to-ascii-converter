/**
 * Output format writers for ASCII animation data
 * Supports Binary, JSON, and JS module formats
 */

import { writeFileSync } from 'fs';
import type { ASCIIAnimation, ASCIIFrame, ASCIIFrameFull, ASCIIFrameDelta } from './types.js';
import { encodeVarInt } from './compress.js';

/**
 * Write animation as JSON file
 */
export function writeJSON(animation: ASCIIAnimation, path: string): void {
  // Convert Uint8Arrays to regular arrays for JSON serialization
  const jsonSafe = {
    ...animation,
    frames: animation.frames.map(frame => {
      if (frame.type === 'full' && frame.colors) {
        return {
          ...frame,
          colors: Array.from(frame.colors)
        };
      }
      return frame;
    })
  };

  writeFileSync(path, JSON.stringify(jsonSafe));
  console.log(`Written JSON: ${path}`);
}

/**
 * Write animation as JS module (can be imported directly)
 */
export function writeJSModule(animation: ASCIIAnimation, path: string): void {
  const jsonSafe = {
    ...animation,
    frames: animation.frames.map(frame => {
      if (frame.type === 'full' && frame.colors) {
        return {
          ...frame,
          colors: Array.from(frame.colors)
        };
      }
      return frame;
    })
  };

  const code = `// Auto-generated ASCII animation data
// Generated at: ${new Date().toISOString()}
export const asciiAnimation = ${JSON.stringify(jsonSafe)};
export const meta = asciiAnimation.meta;
export const frames = asciiAnimation.frames;
export default asciiAnimation;
`;

  writeFileSync(path, code);
  console.log(`Written JS module: ${path}`);
}

/**
 * Binary Format Specification:
 *
 * Header (32 bytes):
 * - 0x00-0x03: Magic "ASCI" (4 bytes)
 * - 0x04: Version (1 byte)
 * - 0x05: Color mode (0=mono, 1=rgb, 2=palette)
 * - 0x06-0x07: Cols (uint16 LE)
 * - 0x08-0x09: Rows (uint16 LE)
 * - 0x0A: FPS (uint8)
 * - 0x0B-0x0C: Frame count (uint16 LE)
 * - 0x0D: Ramp length (uint8)
 * - 0x0E-0x1F: Reserved (18 bytes)
 *
 * Ramp string (rampLength bytes)
 *
 * Frame data:
 * For each frame:
 * - Type byte (0=full, 1=delta)
 * - If full: chars (rows*cols bytes), then colors if rgb (rows*cols*3 bytes)
 * - If delta: change count (varint), then changes
 *   Each change: index (varint), char (1 byte), colors if rgb (3 bytes)
 */
export function writeBinary(animation: ASCIIAnimation, path: string): void {
  const { meta, frames } = animation;
  const chunks: Uint8Array[] = [];

  // Header (32 bytes)
  const header = new Uint8Array(32);
  const headerView = new DataView(header.buffer);

  // Magic "ASCI"
  header[0] = 0x41; // A
  header[1] = 0x53; // S
  header[2] = 0x43; // C
  header[3] = 0x49; // I

  header[4] = meta.version;
  header[5] = meta.colorMode === 'mono' ? 0 : meta.colorMode === 'rgb' ? 1 : 2;
  headerView.setUint16(6, meta.cols, true);
  headerView.setUint16(8, meta.rows, true);
  header[10] = meta.fps;
  headerView.setUint16(11, meta.frameCount, true);
  header[13] = meta.ramp.length;

  chunks.push(header);

  // Ramp string
  const rampBytes = new Uint8Array(meta.ramp.length);
  for (let i = 0; i < meta.ramp.length; i++) {
    rampBytes[i] = meta.ramp.charCodeAt(i);
  }
  chunks.push(rampBytes);

  // Frames
  const includeColors = meta.colorMode !== 'mono';

  for (const frame of frames) {
    if (frame.type === 'full') {
      // Type byte
      chunks.push(new Uint8Array([0]));

      // Characters
      const charBytes = new Uint8Array(frame.chars.length);
      for (let i = 0; i < frame.chars.length; i++) {
        charBytes[i] = frame.chars.charCodeAt(i);
      }
      chunks.push(charBytes);

      // Colors (if rgb mode)
      if (includeColors && frame.colors) {
        chunks.push(frame.colors);
      }
    } else {
      // Delta frame
      const deltaFrame = frame as ASCIIFrameDelta;

      // Type byte
      chunks.push(new Uint8Array([1]));

      // Change count (varint)
      chunks.push(new Uint8Array(encodeVarInt(deltaFrame.changes.length)));

      // Changes
      for (const change of deltaFrame.changes) {
        // Index (varint)
        chunks.push(new Uint8Array(encodeVarInt(change.index)));

        // Character
        chunks.push(new Uint8Array([change.char.charCodeAt(0)]));

        // Colors (if rgb mode)
        if (includeColors) {
          chunks.push(new Uint8Array([
            change.colorR ?? 0,
            change.colorG ?? 0,
            change.colorB ?? 0
          ]));
        }
      }
    }
  }

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  writeFileSync(path, result);
  console.log(`Written binary: ${path} (${(totalLength / 1024).toFixed(1)} KB)`);
}
