/**
 * ASCII Animation Types
 * Shared types for the runtime player
 */

export interface ASCIIAnimationMeta {
  version: 1;
  cols: number;
  rows: number;
  fps: number;
  frameCount: number;
  duration: number;
  colorMode: 'mono' | 'rgb' | 'palette';
  palette?: string[];
  ramp: string;
}

export interface ASCIIFrameFull {
  type: 'full';
  chars: string;
  colors?: number[] | Uint8Array;
}

export interface DeltaChange {
  index: number;
  char: string;
  colorR?: number;
  colorG?: number;
  colorB?: number;
}

export interface ASCIIFrameDelta {
  type: 'delta';
  changes: DeltaChange[];
}

export type ASCIIFrame = ASCIIFrameFull | ASCIIFrameDelta;

export interface ASCIIAnimation {
  meta: ASCIIAnimationMeta;
  frames: ASCIIFrame[];
}
