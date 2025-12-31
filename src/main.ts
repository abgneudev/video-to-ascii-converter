/**
 * ASCII Video Converter - Main Application Entry Point
 * High-performance version with Canvas rendering and Web Worker support
 */

import './styles/main.css';
import { VideoProcessor } from './core/VideoProcessor';
import { ASCIIRenderer, ASCII_RAMPS, type ASCIIFrame, type RampType } from './core/ASCIIRenderer';
import { ColorQuantizer } from './core/ColorQuantizer';
import { PerformanceManager } from './core/PerformanceManager';
import { DropZone } from './ui/DropZone';
import { Controls, type ControlValues } from './ui/Controls';

class ASCIIVideoConverter {
  private videoProcessor: VideoProcessor;
  private asciiRenderer: ASCIIRenderer;
  private colorQuantizer: ColorQuantizer;
  private performanceManager: PerformanceManager;
  private dropZone: DropZone | null = null;
  private controls: Controls | null = null;
  private outputElement: HTMLPreElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private outputContainer: HTMLElement | null = null;
  private currentFrame: ASCIIFrame | null = null;
  private videoLoaded = false;
  private currentColorMode: 'mono' | 'color' | 'palette' = 'mono';

  // Web Worker for off-main-thread processing
  private worker: Worker | null = null;
  private useWorker = false;
  private pendingFrame = false;

  // Frame tracking
  private frameSkipCount = 0;

  constructor() {
    this.videoProcessor = new VideoProcessor();
    this.asciiRenderer = new ASCIIRenderer();
    this.colorQuantizer = new ColorQuantizer();
    this.performanceManager = new PerformanceManager();

    this.initWorker();
    this.init();
  }

  /**
   * Initialize Web Worker for off-main-thread processing
   */
  private initWorker(): void {
    try {
      this.worker = new Worker(
        new URL('./core/ascii.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e) => {
        if (e.data.type === 'frame') {
          this.handleWorkerFrame(e.data);
        }
      };

      this.worker.onerror = (e) => {
        console.warn('Worker error, falling back to main thread:', e);
        this.useWorker = false;
      };

      this.useWorker = true;
    } catch (e) {
      console.warn('Web Worker not supported, using main thread');
      this.useWorker = false;
    }
  }

  /**
   * Handle frame data from worker
   */
  private handleWorkerFrame(data: {
    charCodes: Uint8Array;
    colors: Uint8Array;
    rows: number;
    cols: number;
  }): void {
    this.pendingFrame = false;

    // Build minimal frame object
    this.currentFrame = {
      chars: [], // Not needed for canvas rendering
      rows: data.rows,
      cols: data.cols,
      charCodes: data.charCodes,
      colors: data.colors,
    };

    this.updateOutput();
    this.performanceManager.frameEnd(this.lastRenderTime);
  }

  /**
   * Initialize the application
   */
  private init(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup the application UI
   */
  private setup(): void {
    const app = document.getElementById('app');
    if (!app) {
      console.error('App container not found');
      return;
    }

    // Create main layout with both pre and canvas output options
    app.innerHTML = `
      <header class="header">
        <h1 class="title">ASCII Video Converter</h1>
      </header>
      <main class="main">
        <div class="sidebar">
          <div id="dropzone-container"></div>
          <div id="controls-container"></div>
        </div>
        <div class="output-container" id="output-container">
          <pre id="ascii-output" class="ascii-output"></pre>
          <canvas id="ascii-canvas" class="ascii-canvas" style="display:none"></canvas>
        </div>
      </main>
    `;

    this.outputElement = document.getElementById('ascii-output') as HTMLPreElement;
    this.canvasElement = document.getElementById('ascii-canvas') as HTMLCanvasElement;
    this.outputContainer = document.getElementById('output-container') as HTMLElement;

    // Setup drop zone
    const dropzoneContainer = document.getElementById('dropzone-container');
    if (dropzoneContainer) {
      this.dropZone = new DropZone(dropzoneContainer, {
        onFile: (file) => this.handleVideoFile(file),
        onUrl: (url) => this.handleVideoUrl(url),
        onError: (message) => this.showError(message),
      });
    }

    // Setup controls
    const controlsContainer = document.getElementById('controls-container');
    if (controlsContainer) {
      this.controls = new Controls(controlsContainer, {
        initialValues: {
          cols: 80,
          ramp: 'minimal',
          colorMode: 'mono',
          invert: false,
        },
        onChange: (values) => this.handleControlChange(values),
        onPlay: () => this.play(),
        onPause: () => this.pause(),
        onExport: () => this.exportToFile(),
        onCopy: () => this.copyToClipboard(),
        onReset: () => this.reset(),
      });
    }

    // Setup performance monitoring
    this.performanceManager.setFPSCallback((fps) => {
      this.controls?.updateFPS(fps);
    });

    // Setup video frame processing with throttling
    this.videoProcessor.onFrame((imageData) => {
      this.processFrameThrottled(imageData);
    });

    // Check for reduced motion preference
    if (PerformanceManager.prefersReducedMotion()) {
      this.controls?.updateStatus('Reduced motion enabled');
    }
  }

  /**
   * Handle video file upload
   */
  private async handleVideoFile(file: File): Promise<void> {
    try {
      this.controls?.updateStatus('Loading video...');

      const metadata = await this.videoProcessor.loadFile(file);
      this.onVideoLoaded(metadata);

    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to load video');
    }
  }

  /**
   * Handle video URL input (e.g., Cloudinary links)
   */
  private async handleVideoUrl(url: string): Promise<void> {
    try {
      this.controls?.updateStatus('Loading from URL...');

      const metadata = await this.videoProcessor.loadUrl(url);
      this.onVideoLoaded(metadata);

    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to load video from URL');
    }
  }

  /**
   * Common handler after video is loaded (from file or URL)
   */
  private onVideoLoaded(metadata: { width: number; height: number; duration: number }): void {
    this.videoLoaded = true;

    this.controls?.enableVideoControls();
    this.controls?.updateStatus(
      `${metadata.width}x${metadata.height} | ${Math.round(metadata.duration)}s`
    );

    // Capture and display first frame
    setTimeout(() => {
      const firstFrame = this.videoProcessor.captureFrame();
      this.processFrame(firstFrame);
    }, 100);

    this.dropZone?.getElement().classList.add('drop-zone--loaded');
  }

  /**
   * Process frame directly - VideoProcessor already handles throttling
   */
  private processFrameThrottled(imageData: ImageData): void {
    // If worker is still processing previous frame, skip this one
    if (this.useWorker && this.pendingFrame) {
      this.frameSkipCount++;
      return;
    }

    this.processFrame(imageData);
  }

  /**
   * Process a video frame and render ASCII
   */
  private processFrame(imageData: ImageData): void {
    const startTime = this.performanceManager.frameStart();
    this.lastRenderTime = startTime;

    if (this.useWorker && this.worker && this.currentColorMode === 'mono') {
      // Use worker for monochrome mode
      this.pendingFrame = true;
      this.worker.postMessage({
        type: 'render',
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      });
    } else {
      // Main thread processing
      this.currentFrame = this.asciiRenderer.render(imageData);

      // Apply color quantization if needed
      if (this.currentColorMode === 'palette' && this.currentFrame) {
        this.applyPaletteQuantization();
      }

      this.updateOutput();
      this.performanceManager.frameEnd(startTime);
    }
  }

  /**
   * Apply palette quantization to current frame
   */
  private applyPaletteQuantization(): void {
    if (!this.currentFrame) return;

    const colors = this.currentFrame.colors;
    for (let i = 0; i < colors.length; i += 3) {
      const quantized = this.colorQuantizer.snapToPalette({
        r: colors[i],
        g: colors[i + 1],
        b: colors[i + 2],
      });
      colors[i] = quantized.r;
      colors[i + 1] = quantized.g;
      colors[i + 2] = quantized.b;
    }
  }

  /**
   * Update the ASCII output display
   * Uses Canvas for color modes (0 DOM nodes) or textContent for mono
   */
  private updateOutput(): void {
    if (!this.currentFrame) return;

    if (this.currentColorMode === 'mono') {
      // Show pre, hide canvas
      if (this.outputElement) {
        this.outputElement.style.display = 'block';
        this.outputElement.textContent = this.asciiRenderer.frameToText(this.currentFrame);
      }
      if (this.canvasElement) {
        this.canvasElement.style.display = 'none';
      }
    } else {
      // Show canvas, hide pre - ZERO DOM NODES for color!
      if (this.outputElement) {
        this.outputElement.style.display = 'none';
      }
      if (this.canvasElement) {
        this.canvasElement.style.display = 'block';
        this.asciiRenderer.renderToCanvas(this.currentFrame, this.canvasElement);
      }
    }
  }

  /**
   * Handle control value changes
   */
  private handleControlChange(values: ControlValues): void {
    this.currentColorMode = values.colorMode;

    this.asciiRenderer.setOptions({
      cols: values.cols,
      ramp: values.ramp,
      colorMode: values.colorMode,
      invert: values.invert,
    });

    this.performanceManager.setCols(values.cols);

    // Update worker options
    if (this.worker) {
      const ramp = values.ramp in ASCII_RAMPS
        ? ASCII_RAMPS[values.ramp as RampType]
        : values.ramp;
      const rampCodes = Array.from(ramp).map(c => c.charCodeAt(0));

      this.worker.postMessage({
        type: 'setOptions',
        options: {
          cols: values.cols,
          rampCodes,
          invert: values.invert,
        },
      });
    }

    // Re-render current frame if video is loaded but paused
    if (this.videoLoaded && !this.videoProcessor.playing) {
      const frame = this.videoProcessor.captureFrame();
      this.processFrame(frame);
    }
  }

  /**
   * Start playback
   */
  private play(): void {
    if (!this.videoLoaded) return;
    this.videoProcessor.play();
    this.controls?.setPlaying(true);
    this.controls?.updateStatus('Playing');
  }

  /**
   * Pause playback
   */
  private pause(): void {
    this.videoProcessor.pause();
    this.controls?.setPlaying(false);
    this.controls?.updateStatus('Paused');
  }

  /**
   * Reset the application
   */
  private reset(): void {
    this.pause();
    this.videoProcessor.destroy();
    this.videoProcessor = new VideoProcessor();
    this.videoProcessor.onFrame((imageData) => {
      this.processFrameThrottled(imageData);
    });

    this.videoLoaded = false;
    this.currentFrame = null;
    this.frameSkipCount = 0;

    if (this.outputElement) {
      this.outputElement.textContent = '';
      this.outputElement.style.display = 'block';
    }
    if (this.canvasElement) {
      this.canvasElement.style.display = 'none';
      const ctx = this.canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      }
    }

    this.asciiRenderer.clearCache();
    this.controls?.disableVideoControls();
    this.controls?.setPlaying(false);
    this.controls?.updateStatus('Ready');
    this.controls?.updateFPS(0);
    this.performanceManager.reset();

    this.dropZone?.getElement().classList.remove('drop-zone--loaded');
  }

  /**
   * Export current frame to text file
   */
  private exportToFile(): void {
    if (!this.currentFrame) return;

    const text = this.asciiRenderer.frameToText(this.currentFrame);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ascii-frame-${Date.now()}.txt`;
    a.click();

    URL.revokeObjectURL(url);
    this.controls?.updateStatus('Exported!');

    setTimeout(() => {
      this.controls?.updateStatus(this.videoProcessor.playing ? 'Playing' : 'Paused');
    }, 1500);
  }

  /**
   * Copy current frame to clipboard
   */
  private async copyToClipboard(): Promise<void> {
    if (!this.currentFrame) return;

    const text = this.asciiRenderer.frameToText(this.currentFrame);

    try {
      await navigator.clipboard.writeText(text);
      this.controls?.updateStatus('Copied!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.controls?.updateStatus('Copied!');
    }

    setTimeout(() => {
      this.controls?.updateStatus(this.videoProcessor.playing ? 'Playing' : 'Paused');
    }, 1500);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    console.error(message);
    this.controls?.updateStatus(`Error: ${message}`);
    alert(message);
  }
}

// Initialize the application
new ASCIIVideoConverter();
