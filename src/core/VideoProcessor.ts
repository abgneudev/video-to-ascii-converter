/**
 * VideoProcessor - Frame extraction and canvas management
 * Handles video loading, playback control, and frame capture
 */

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
}

export class VideoProcessor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private isPlaying = false;
  private onFrameCallback: ((imageData: ImageData) => void) | null = null;
  private lastFrameTime = 0;
  private useVideoFrameCallback = false;
  private targetFPS = 24; // Target 24 FPS for smooth performance
  private minFrameInterval = 1000 / 24; // ~42ms between frames

  constructor() {
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.loop = true;

    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }
    this.ctx = ctx;

    // Check for requestVideoFrameCallback support
    this.useVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  }

  /**
   * Load a video file from a File object
   */
  async loadFile(file: File): Promise<VideoMetadata> {
    // Revoke previous object URL if any
    if (this.video.src && this.video.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.video.src);
    }

    const url = URL.createObjectURL(file);
    return this.loadVideoSource(url);
  }

  /**
   * Load a video from a URL (e.g., Cloudinary, CDN)
   */
  async loadUrl(url: string): Promise<VideoMetadata> {
    // Revoke previous object URL if any
    if (this.video.src && this.video.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.video.src);
    }

    return this.loadVideoSource(url);
  }

  /**
   * Internal method to load video from any source
   */
  private loadVideoSource(url: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      this.video.src = url;

      const onLoadedMetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Estimate FPS (default to 30 if not detectable)
        const fps = 30;

        resolve({
          width: this.video.videoWidth,
          height: this.video.videoHeight,
          duration: this.video.duration,
          fps,
        });

        this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.video.removeEventListener('error', onError);
      };

      const onError = () => {
        reject(new Error('Failed to load video. Check URL or format.'));
        this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.video.removeEventListener('error', onError);
      };

      this.video.addEventListener('loadedmetadata', onLoadedMetadata);
      this.video.addEventListener('error', onError);
    });
  }

  /**
   * Set the callback function for frame processing
   */
  onFrame(callback: (imageData: ImageData) => void): void {
    this.onFrameCallback = callback;
  }

  /**
   * Start video playback and frame processing
   */
  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.video.play();

    if (this.useVideoFrameCallback) {
      this.processFrameWithVideoCallback();
    } else {
      this.processFrameWithRAF();
    }
  }

  /**
   * Pause video playback
   */
  pause(): void {
    this.isPlaying = false;
    this.video.pause();
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Toggle play/pause
   */
  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Get current playback state
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the video element for display
   */
  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  /**
   * Get current frame as ImageData
   */
  captureFrame(): ImageData {
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Process frames using requestVideoFrameCallback (modern API)
   * With frame rate limiting for performance
   */
  private processFrameWithVideoCallback(): void {
    if (!this.isPlaying) return;

    const processFrame = (now: DOMHighResTimeStamp, _metadata: VideoFrameCallbackMetadata) => {
      if (!this.isPlaying) return;

      // Skip frames if we're going too fast
      const elapsed = now - this.lastFrameTime;
      if (elapsed < this.minFrameInterval) {
        // Schedule next frame check but skip processing
        if (this.isPlaying) {
          this.video.requestVideoFrameCallback(processFrame);
        }
        return;
      }

      this.lastFrameTime = now;
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      if (this.onFrameCallback) {
        this.onFrameCallback(imageData);
      }

      if (this.isPlaying) {
        this.video.requestVideoFrameCallback(processFrame);
      }
    };

    this.video.requestVideoFrameCallback(processFrame);
  }

  /**
   * Process frames using requestAnimationFrame (fallback)
   */
  private processFrameWithRAF(): void {
    const processFrame = (timestamp: number) => {
      if (!this.isPlaying) return;

      // Throttle to target FPS (20fps = 50ms)
      if (timestamp - this.lastFrameTime >= this.minFrameInterval) {
        this.lastFrameTime = timestamp;

        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        if (this.onFrameCallback) {
          this.onFrameCallback(imageData);
        }
      }

      this.animationId = requestAnimationFrame(processFrame);
    };

    this.animationId = requestAnimationFrame(processFrame);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.pause();
    if (this.video.src && this.video.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.video.src);
    }
    this.video.src = '';
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    this.video.currentTime = time;
  }

  /**
   * Get current time
   */
  get currentTime(): number {
    return this.video.currentTime;
  }

  /**
   * Get duration
   */
  get duration(): number {
    return this.video.duration;
  }
}

// Type declaration for Video Frame Callback
interface VideoFrameCallbackMetadata {
  presentationTime: DOMHighResTimeStamp;
  expectedDisplayTime: DOMHighResTimeStamp;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration?: number;
}

declare global {
  interface HTMLVideoElement {
    requestVideoFrameCallback(
      callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void
    ): number;
    cancelVideoFrameCallback(handle: number): void;
  }
}
