/**
 * ASCII Hero Background Component
 * Vanilla JS component for displaying pre-processed ASCII animations
 *
 * Usage:
 *   const hero = new ASCIIHero('#hero-container', {
 *     src: '/ascii-data/hero-loop.bin',
 *     fadeIn: true,
 *     speed: 1
 *   });
 */

import { loadAnimation } from './decoder';
import { ASCIIPlayer, type PlayerOptions } from './player';
import type { ASCIIAnimation } from './types';

export interface ASCIIHeroOptions {
  src: string;
  fadeIn?: boolean;
  speed?: number;
  autoplay?: boolean;
  fallbackImage?: string;
  onReady?: () => void;
  onLoop?: () => void;
  onError?: (error: Error) => void;
}

export class ASCIIHero {
  private container: HTMLElement;
  private asciiElement: HTMLPreElement;
  private overlayElement: HTMLDivElement;
  private player: ASCIIPlayer | null = null;
  private options: ASCIIHeroOptions;
  private animation: ASCIIAnimation | null = null;

  constructor(selector: string | HTMLElement, options: ASCIIHeroOptions) {
    this.options = {
      fadeIn: true,
      speed: 1,
      autoplay: true,
      ...options
    };

    // Get container element
    this.container = typeof selector === 'string'
      ? document.querySelector(selector) as HTMLElement
      : selector;

    if (!this.container) {
      throw new Error(`Container not found: ${selector}`);
    }

    // Create structure
    this.container.classList.add('ascii-hero');

    this.asciiElement = document.createElement('pre');
    this.asciiElement.className = 'ascii-hero__ascii';
    this.asciiElement.setAttribute('aria-hidden', 'true');

    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'ascii-hero__overlay';

    this.container.appendChild(this.asciiElement);
    this.container.appendChild(this.overlayElement);

    // Load and initialize
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Load animation data
      this.animation = await loadAnimation(this.options.src);

      // Create player
      const playerOptions: PlayerOptions = {
        speed: this.options.speed,
        onReady: () => {
          if (this.options.fadeIn) {
            this.asciiElement.classList.add('ascii-hero__ascii--visible');
          }
          this.options.onReady?.();
        },
        onLoop: this.options.onLoop
      };

      this.player = new ASCIIPlayer(this.animation, this.asciiElement, playerOptions);

      // Autoplay unless reduced motion preferred
      if (this.options.autoplay && !prefersReducedMotion) {
        this.player.play();
      } else {
        // Show first frame
        this.player.seek(0);
      }
    } catch (error) {
      console.error('ASCIIHero: Failed to load animation', error);

      // Show fallback image if provided
      if (this.options.fallbackImage) {
        this.showFallback();
      }

      this.options.onError?.(error as Error);
    }
  }

  private showFallback(): void {
    if (this.options.fallbackImage) {
      const img = document.createElement('img');
      img.src = this.options.fallbackImage;
      img.alt = '';
      img.className = 'ascii-hero__fallback';
      this.container.appendChild(img);
      this.asciiElement.style.display = 'none';
    }
  }

  /**
   * Set overlay content (for hero text, buttons, etc.)
   */
  setOverlay(content: string | HTMLElement): void {
    if (typeof content === 'string') {
      this.overlayElement.innerHTML = content;
    } else {
      this.overlayElement.innerHTML = '';
      this.overlayElement.appendChild(content);
    }
  }

  /**
   * Play animation
   */
  play(): void {
    this.player?.play();
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.player?.pause();
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.player?.setSpeed(speed);
  }

  /**
   * Get animation metadata
   */
  get meta() {
    return this.animation?.meta ?? null;
  }

  /**
   * Check if animation is playing
   */
  get isPlaying(): boolean {
    return this.player?.isPlaying ?? false;
  }

  /**
   * Destroy component and cleanup
   */
  destroy(): void {
    this.player?.destroy();
    this.player = null;
    this.container.innerHTML = '';
    this.container.classList.remove('ascii-hero');
  }
}

// Export for module usage
export { loadAnimation } from './decoder';
export { ASCIIPlayer } from './player';
export type { ASCIIAnimation, ASCIIFrame, ASCIIAnimationMeta } from './types';
