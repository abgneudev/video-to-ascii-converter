/**
 * ASCII Animation Types
 * Shared between preprocessor and runtime player
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
  colors?: Uint8Array;
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

export interface ProcessOptions {
  inputPath: string;
  outputPath: string;
  cols: number;
  fps: number;
  colorMode: 'mono' | 'rgb' | 'palette';
  ramp: string;
  format: 'binary' | 'json' | 'js';
  loopOptimize: boolean;
}
