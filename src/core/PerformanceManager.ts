/**
 * PerformanceManager - Adaptive quality and frame throttling
 * Dynamically adjusts processing based on device capability
 */

export interface PerformanceMetrics {
  fps: number;
  avgFrameTime: number;
  recommendedCols: number;
  isThrottled: boolean;
}

export class PerformanceManager {
  private frameTimes: number[] = [];
  private targetFPS = 30;
  private currentCols = 80;
  private minCols = 40;
  private maxCols = 160;
  private lastFrameTimestamp = 0;
  private frameCount = 0;
  private fpsUpdateInterval = 500; // Update FPS every 500ms
  private lastFPSUpdate = 0;
  private currentFPS = 0;
  private isLowEndDevice = false;
  private onFPSUpdate: ((fps: number) => void) | null = null;

  constructor() {
    this.detectDeviceCapability();
  }

  /**
   * Detect if running on a low-end device
   */
  private detectDeviceCapability(): void {
    // Check for mobile/tablet
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check for low memory (if available)
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isLowMemory = memory !== undefined && memory < 4;

    // Check for hardware concurrency
    const cores = navigator.hardwareConcurrency || 2;
    const isLowCores = cores < 4;

    this.isLowEndDevice = isMobile || isLowMemory || isLowCores;

    // Adjust defaults for low-end devices
    if (this.isLowEndDevice) {
      this.currentCols = 60;
      this.maxCols = 100;
      this.targetFPS = 24;
    }
  }

  /**
   * Set FPS update callback
   */
  setFPSCallback(callback: (fps: number) => void): void {
    this.onFPSUpdate = callback;
  }

  /**
   * Measure frame processing time
   */
  measureFrame(duration: number): void {
    this.frameTimes.push(duration);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
  }

  /**
   * Call this at the start of each frame
   */
  frameStart(): number {
    return performance.now();
  }

  /**
   * Call this at the end of each frame
   */
  frameEnd(startTime: number): void {
    const now = performance.now();
    const duration = now - startTime;
    this.measureFrame(duration);
    this.frameCount++;

    // Update FPS counter
    if (now - this.lastFPSUpdate >= this.fpsUpdateInterval) {
      const elapsed = now - this.lastFPSUpdate;
      this.currentFPS = Math.round((this.frameCount / elapsed) * 1000);
      this.frameCount = 0;
      this.lastFPSUpdate = now;

      if (this.onFPSUpdate) {
        this.onFPSUpdate(this.currentFPS);
      }
    }
  }

  /**
   * Get recommended column count based on performance
   */
  getRecommendedCols(): number {
    if (this.frameTimes.length < 10) {
      return this.currentCols;
    }

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const estimatedFPS = 1000 / avgFrameTime;

    // Adjust resolution based on performance
    if (estimatedFPS < this.targetFPS * 0.7) {
      // Performance is poor, reduce resolution
      this.currentCols = Math.max(this.minCols, this.currentCols - 10);
    } else if (estimatedFPS > this.targetFPS * 1.3) {
      // Performance is good, can increase resolution
      this.currentCols = Math.min(this.maxCols, this.currentCols + 5);
    }

    return this.currentCols;
  }

  /**
   * Set current column count
   */
  setCols(cols: number): void {
    this.currentCols = Math.max(this.minCols, Math.min(this.maxCols, cols));
  }

  /**
   * Set target FPS
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(15, Math.min(60, fps));
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    const estimatedFPS = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

    return {
      fps: this.currentFPS,
      avgFrameTime,
      recommendedCols: this.currentCols,
      isThrottled: estimatedFPS < this.targetFPS * 0.8,
    };
  }

  /**
   * Get current FPS
   */
  get fps(): number {
    return this.currentFPS;
  }

  /**
   * Check if device is low-end
   */
  get isLowEnd(): boolean {
    return this.isLowEndDevice;
  }

  /**
   * Reset performance measurements
   */
  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.currentFPS = 0;
    this.lastFPSUpdate = performance.now();
  }

  /**
   * Check if reduced motion is preferred
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
