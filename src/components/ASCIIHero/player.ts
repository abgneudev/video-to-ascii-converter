/**
 * ASCII Animation Player
 * Lightweight runtime player for pre-processed ASCII animation data
 */

import type { ASCIIAnimation, ASCIIFrameDelta } from './types';

export interface PlayerOptions {
  speed?: number;
  onReady?: () => void;
  onLoop?: () => void;
  onError?: (error: Error) => void;
}

interface DecodedFrame {
  text: string;
  colors?: Uint8Array;
}

export class ASCIIPlayer {
  private animation: ASCIIAnimation;
  private container: HTMLElement;
  private frameIndex = 0;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameDuration: number;
  private decodedFrames: DecodedFrame[] = [];
  private options: PlayerOptions;
  private isDestroyed = false;

  constructor(
    animation: ASCIIAnimation,
    container: HTMLElement,
    options: PlayerOptions = {}
  ) {
    this.animation = animation;
    this.container = container;
    this.options = options;
    this.frameDuration = 1000 / (animation.meta.fps * (options.speed ?? 1));

    // Pre-decode all frames for instant playback
    this.preDecodeFrames();

    // Set CSS custom properties for styling
    container.style.setProperty('--ascii-cols', String(animation.meta.cols));
    container.style.setProperty('--ascii-rows', String(animation.meta.rows));

    options.onReady?.();
  }

  /**
   * Pre-decode all frames (apply deltas) for zero-latency playback
   */
  private preDecodeFrames(): void {
    const { frames, meta } = this.animation;
    let currentChars = '';
    let currentColors: Uint8Array | undefined;
    const includeColors = meta.colorMode !== 'mono';
    const totalChars = meta.rows * meta.cols;

    if (includeColors) {
      currentColors = new Uint8Array(totalChars * 3);
    }

    for (const frame of frames) {
      if (frame.type === 'full') {
        currentChars = frame.chars;
        if (includeColors && frame.colors) {
          const colorsArray = frame.colors instanceof Uint8Array
            ? frame.colors
            : new Uint8Array(frame.colors);
          currentColors = colorsArray.slice();
        }
      } else {
        // Apply delta changes
        const chars = currentChars.split('');
        const deltaFrame = frame as ASCIIFrameDelta;

        for (const change of deltaFrame.changes) {
          chars[change.index] = change.char;
          if (includeColors && currentColors) {
            currentColors[change.index * 3] = change.colorR ?? 0;
            currentColors[change.index * 3 + 1] = change.colorG ?? 0;
            currentColors[change.index * 3 + 2] = change.colorB ?? 0;
          }
        }
        currentChars = chars.join('');
      }

      // Format with line breaks for display
      const lines: string[] = [];
      for (let i = 0; i < currentChars.length; i += meta.cols) {
        lines.push(currentChars.slice(i, i + meta.cols));
      }

      this.decodedFrames.push({
        text: lines.join('\n'),
        colors: currentColors ? currentColors.slice() : undefined
      });
    }
  }

  /**
   * Start playback
   */
  play(): void {
    if (this.isDestroyed) return;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  /**
   * Animation tick - render current frame
   */
  private tick = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= this.frameDuration) {
      this.renderFrame();

      // Advance to next frame
      this.frameIndex++;
      if (this.frameIndex >= this.decodedFrames.length) {
        this.frameIndex = 0;
        this.options.onLoop?.();
      }

      // Account for frame time drift
      this.lastFrameTime = now - (elapsed % this.frameDuration);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Render current frame to container
   */
  private renderFrame(): void {
    const frame = this.decodedFrames[this.frameIndex];

    if (this.animation.meta.colorMode === 'mono') {
      // Simple text rendering - very fast
      this.container.textContent = frame.text;
    } else {
      // Color rendering - use canvas for performance
      this.renderColoredFrame(frame);
    }
  }

  /**
   * Render colored frame using spans (simpler, works everywhere)
   * For high performance, consider canvas rendering
   */
  private renderColoredFrame(frame: DecodedFrame): void {
    if (!frame.colors) {
      this.container.textContent = frame.text;
      return;
    }

    const { cols, rows } = this.animation.meta;
    const chars = frame.text.replace(/\n/g, '');
    let html = '';
    let prevColor = '';

    for (let i = 0; i < chars.length; i++) {
      // Add line break at end of each row
      if (i > 0 && i % cols === 0) {
        html += '\n';
      }

      const r = frame.colors[i * 3];
      const g = frame.colors[i * 3 + 1];
      const b = frame.colors[i * 3 + 2];
      const color = `rgb(${r},${g},${b})`;

      // Batch same-colored characters
      if (color !== prevColor) {
        if (prevColor) html += '</span>';
        html += `<span style="color:${color}">`;
        prevColor = color;
      }

      // Escape special HTML chars
      const char = chars[i];
      html += char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char;
    }

    if (prevColor) html += '</span>';

    this.container.innerHTML = html;
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Seek to specific frame
   */
  seek(frameIndex: number): void {
    this.frameIndex = Math.max(0, Math.min(frameIndex, this.decodedFrames.length - 1));
    this.renderFrame();
  }

  /**
   * Set playback speed (1.0 = normal)
   */
  setSpeed(speed: number): void {
    this.frameDuration = 1000 / (this.animation.meta.fps * speed);
  }

  /**
   * Get current frame index
   */
  get currentFrame(): number {
    return this.frameIndex;
  }

  /**
   * Get total frame count
   */
  get totalFrames(): number {
    return this.decodedFrames.length;
  }

  /**
   * Check if playing
   */
  get isPlaying(): boolean {
    return this.rafId !== null;
  }

  /**
   * Destroy player and cleanup
   */
  destroy(): void {
    this.isDestroyed = true;
    this.pause();
    this.decodedFrames = [];
    this.container.textContent = '';
  }
}
