/**
 * Controls - User controls component
 * Manages resolution, character set, color mode, and other settings
 */

import { ASCII_RAMPS, type RampType } from '../core/ASCIIRenderer';

export interface ControlValues {
  cols: number;
  ramp: RampType;
  colorMode: 'mono' | 'color' | 'palette';
  invert: boolean;
}

export interface ControlsOptions {
  initialValues?: Partial<ControlValues>;
  onChange: (values: ControlValues) => void;
  onPlay: () => void;
  onPause: () => void;
  onExport: () => void;
  onCopy: () => void;
  onReset: () => void;
}

export class Controls {
  private element: HTMLElement;
  private values: ControlValues;
  private onChange: (values: ControlValues) => void;
  private fpsDisplay: HTMLElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private isPlaying = false;

  constructor(container: HTMLElement, options: ControlsOptions) {
    this.values = {
      cols: options.initialValues?.cols ?? 80,
      ramp: options.initialValues?.ramp ?? 'standard',
      colorMode: options.initialValues?.colorMode ?? 'mono',
      invert: options.initialValues?.invert ?? false,
    };

    this.onChange = options.onChange;
    this.element = this.createControls(options);
    container.appendChild(this.element);
  }

  /**
   * Create the controls panel
   */
  private createControls(options: ControlsOptions): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'controls-panel';

    panel.innerHTML = `
      <div class="control-group">
        <label class="control-label" for="resolution-slider">
          Resolution: <span id="resolution-value">${this.values.cols}</span> cols
        </label>
        <input
          type="range"
          id="resolution-slider"
          class="control-slider"
          min="40"
          max="160"
          value="${this.values.cols}"
          step="10"
        />
      </div>

      <div class="control-group">
        <label class="control-label" for="charset-select">Character Set</label>
        <select id="charset-select" class="control-select">
          <option value="minimal" ${this.values.ramp === 'minimal' ? 'selected' : ''}>Minimal ( .:+*#@)</option>
          <option value="standard" ${this.values.ramp === 'standard' ? 'selected' : ''}>Standard ( .:-=+*#%@)</option>
          <option value="detailed" ${this.values.ramp === 'detailed' ? 'selected' : ''}>Detailed (70 chars)</option>
          <option value="blocks" ${this.values.ramp === 'blocks' ? 'selected' : ''}>Blocks (░▒▓█)</option>
          <option value="binary" ${this.values.ramp === 'binary' ? 'selected' : ''}>Binary (01)</option>
        </select>
      </div>

      <div class="control-group">
        <label class="control-label">Color Mode</label>
        <div class="control-radio-group">
          <label class="control-radio">
            <input type="radio" name="colorMode" value="mono" ${this.values.colorMode === 'mono' ? 'checked' : ''} />
            <span>Mono</span>
          </label>
          <label class="control-radio">
            <input type="radio" name="colorMode" value="color" ${this.values.colorMode === 'color' ? 'checked' : ''} />
            <span>Color</span>
          </label>
          <label class="control-radio">
            <input type="radio" name="colorMode" value="palette" ${this.values.colorMode === 'palette' ? 'checked' : ''} />
            <span>Palette</span>
          </label>
        </div>
      </div>

      <div class="control-group">
        <label class="control-checkbox">
          <input type="checkbox" id="invert-toggle" ${this.values.invert ? 'checked' : ''} />
          <span>Invert Colors</span>
        </label>
      </div>

      <div class="control-group control-buttons">
        <button id="play-button" class="control-button control-button--primary" disabled>
          <span class="play-icon">&#9654;</span>
          <span class="pause-icon" style="display:none">&#10074;&#10074;</span>
          <span class="button-text">Play</span>
        </button>
        <button id="reset-button" class="control-button" disabled>Reset</button>
      </div>

      <div class="control-group control-buttons">
        <button id="copy-button" class="control-button" disabled>Copy</button>
        <button id="export-button" class="control-button" disabled>Export .txt</button>
      </div>

      <div class="control-group control-status">
        <span id="fps-display" class="fps-display">-- FPS</span>
        <span id="status-display" class="status-display">Ready</span>
      </div>
    `;

    this.setupEventListeners(panel, options);

    return panel;
  }

  /**
   * Setup event listeners for controls
   */
  private setupEventListeners(panel: HTMLElement, options: ControlsOptions): void {
    // Resolution slider
    const slider = panel.querySelector<HTMLInputElement>('#resolution-slider');
    const resolutionValue = panel.querySelector<HTMLSpanElement>('#resolution-value');

    slider?.addEventListener('input', () => {
      const value = parseInt(slider.value, 10);
      this.values.cols = value;
      if (resolutionValue) {
        resolutionValue.textContent = value.toString();
      }
      this.onChange(this.values);
    });

    // Character set select
    const charsetSelect = panel.querySelector<HTMLSelectElement>('#charset-select');
    charsetSelect?.addEventListener('change', () => {
      this.values.ramp = charsetSelect.value as RampType;
      this.onChange(this.values);
    });

    // Color mode radios
    const colorRadios = panel.querySelectorAll<HTMLInputElement>('input[name="colorMode"]');
    colorRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.values.colorMode = radio.value as 'mono' | 'color' | 'palette';
          this.onChange(this.values);
        }
      });
    });

    // Invert checkbox
    const invertToggle = panel.querySelector<HTMLInputElement>('#invert-toggle');
    invertToggle?.addEventListener('change', () => {
      this.values.invert = invertToggle.checked;
      this.onChange(this.values);
    });

    // Play button
    this.playButton = panel.querySelector<HTMLButtonElement>('#play-button');
    this.playButton?.addEventListener('click', () => {
      if (this.isPlaying) {
        options.onPause();
      } else {
        options.onPlay();
      }
    });

    // Reset button
    const resetButton = panel.querySelector<HTMLButtonElement>('#reset-button');
    resetButton?.addEventListener('click', () => {
      options.onReset();
    });

    // Copy button
    const copyButton = panel.querySelector<HTMLButtonElement>('#copy-button');
    copyButton?.addEventListener('click', () => {
      options.onCopy();
    });

    // Export button
    const exportButton = panel.querySelector<HTMLButtonElement>('#export-button');
    exportButton?.addEventListener('click', () => {
      options.onExport();
    });

    // Store FPS display reference
    this.fpsDisplay = panel.querySelector<HTMLElement>('#fps-display');
  }

  /**
   * Update FPS display
   */
  updateFPS(fps: number): void {
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = `${fps} FPS`;
    }
  }

  /**
   * Update status display
   */
  updateStatus(status: string): void {
    const statusDisplay = this.element.querySelector<HTMLElement>('#status-display');
    if (statusDisplay) {
      statusDisplay.textContent = status;
    }
  }

  /**
   * Set playing state
   */
  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (this.playButton) {
      const playIcon = this.playButton.querySelector('.play-icon') as HTMLElement;
      const pauseIcon = this.playButton.querySelector('.pause-icon') as HTMLElement;
      const buttonText = this.playButton.querySelector('.button-text') as HTMLElement;

      if (playing) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
        buttonText.textContent = 'Pause';
      } else {
        playIcon.style.display = 'inline';
        pauseIcon.style.display = 'none';
        buttonText.textContent = 'Play';
      }
    }
  }

  /**
   * Enable video controls
   */
  enableVideoControls(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.control-button');
    buttons.forEach((btn) => {
      btn.disabled = false;
    });
  }

  /**
   * Disable video controls
   */
  disableVideoControls(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.control-button');
    buttons.forEach((btn) => {
      btn.disabled = true;
    });
  }

  /**
   * Get current control values
   */
  getValues(): ControlValues {
    return { ...this.values };
  }

  /**
   * Set control values
   */
  setValues(values: Partial<ControlValues>): void {
    this.values = { ...this.values, ...values };
    // Update UI to reflect new values
    this.updateUI();
  }

  /**
   * Update UI to reflect current values
   */
  private updateUI(): void {
    const slider = this.element.querySelector<HTMLInputElement>('#resolution-slider');
    const resolutionValue = this.element.querySelector<HTMLSpanElement>('#resolution-value');
    const charsetSelect = this.element.querySelector<HTMLSelectElement>('#charset-select');
    const invertToggle = this.element.querySelector<HTMLInputElement>('#invert-toggle');

    if (slider) slider.value = this.values.cols.toString();
    if (resolutionValue) resolutionValue.textContent = this.values.cols.toString();
    if (charsetSelect) charsetSelect.value = this.values.ramp;
    if (invertToggle) invertToggle.checked = this.values.invert;

    const colorRadios = this.element.querySelectorAll<HTMLInputElement>('input[name="colorMode"]');
    colorRadios.forEach((radio) => {
      radio.checked = radio.value === this.values.colorMode;
    });
  }

  /**
   * Get the controls element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Destroy the controls
   */
  destroy(): void {
    this.element.remove();
  }
}
