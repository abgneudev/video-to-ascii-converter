/**
 * DropZone - Drag-drop file handler component
 * Handles video file uploads via drag-drop or file picker
 */

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ACCEPTED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface DropZoneOptions {
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  onError: (message: string) => void;
}

export class DropZone {
  private element: HTMLElement;
  private input: HTMLInputElement;
  private urlInput: HTMLInputElement;
  private onFile: (file: File) => void;
  private onUrl: (url: string) => void;
  private onError: (message: string) => void;

  constructor(container: HTMLElement, options: DropZoneOptions) {
    this.onFile = options.onFile;
    this.onUrl = options.onUrl;
    this.onError = options.onError;

    this.element = this.createDropZone();
    this.input = this.createFileInput();
    this.urlInput = this.element.querySelector('.drop-zone-url-input') as HTMLInputElement;
    this.element.appendChild(this.input);

    container.appendChild(this.element);

    this.setupEventListeners();
  }

  /**
   * Create the drop zone element
   */
  private createDropZone(): HTMLElement {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.innerHTML = `
      <div class="drop-zone-content">
        <svg class="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="drop-zone-text">Drag & drop video here</p>
        <p class="drop-zone-subtext">or click to browse</p>
        <p class="drop-zone-formats">Supports MP4, WebM, MOV, AVI</p>
      </div>
      <div class="drop-zone-url">
        <div class="drop-zone-divider"><span>or paste URL</span></div>
        <div class="drop-zone-url-wrapper">
          <input
            type="url"
            class="drop-zone-url-input"
            placeholder="https://cloudinary.com/video.mp4"
            aria-label="Video URL"
          />
          <button type="button" class="drop-zone-url-btn">Load</button>
        </div>
      </div>
    `;
    zone.setAttribute('role', 'region');
    zone.setAttribute('aria-label', 'Upload video file or enter URL');
    return zone;
  }

  /**
   * Create hidden file input
   */
  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_EXTENSIONS.join(',');
    input.className = 'drop-zone-input';
    input.setAttribute('aria-hidden', 'true');
    return input;
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Click on drop-zone-content to open file picker
    const content = this.element.querySelector('.drop-zone-content');
    content?.addEventListener('click', () => {
      this.input.click();
    });

    // Keyboard accessibility for file picker
    content?.setAttribute('tabindex', '0');
    content?.setAttribute('role', 'button');
    content?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        this.input.click();
      }
    });

    // File input change
    this.input.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) {
        this.handleFile(file);
      }
      // Reset input so same file can be selected again
      this.input.value = '';
    });

    // URL input and button
    const urlBtn = this.element.querySelector('.drop-zone-url-btn');
    urlBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleUrlSubmit();
    });

    this.urlInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e as KeyboardEvent).key === 'Enter') {
        this.handleUrlSubmit();
      }
    });

    // Prevent clicks on URL section from triggering file picker
    const urlSection = this.element.querySelector('.drop-zone-url');
    urlSection?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Drag events
    this.element.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    this.element.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.element.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.element.addEventListener('drop', (e) => this.handleDrop(e));
  }

  /**
   * Handle URL submission
   */
  private handleUrlSubmit(): void {
    const url = this.urlInput?.value.trim();
    if (!url) {
      this.onError('Please enter a video URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      this.onError('Please enter a valid URL');
      return;
    }

    // Check for video extension (optional, as some URLs don't have extensions)
    const hasVideoExt = ACCEPTED_EXTENSIONS.some(ext =>
      url.toLowerCase().includes(ext)
    );

    if (!hasVideoExt) {
      console.warn('URL may not be a video file. Attempting to load anyway...');
    }

    this.onUrl(url);
  }

  /**
   * Handle drag enter
   */
  private handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.element.classList.add('drop-zone--active');
  }

  /**
   * Handle drag over
   */
  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle drag leave
   */
  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Only remove active class if leaving the drop zone entirely
    const rect = this.element.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      this.element.classList.remove('drop-zone--active');
    }
  }

  /**
   * Handle file drop
   */
  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.element.classList.remove('drop-zone--active');

    const file = e.dataTransfer?.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  /**
   * Validate and process the file
   */
  private handleFile(file: File): void {
    // Check file type
    const isValidType = ACCEPTED_TYPES.includes(file.type) ||
      ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      this.onError(
        `Unsupported file format. Please use ${ACCEPTED_EXTENSIONS.join(', ')}`
      );
      return;
    }

    // Check file size (warn but allow)
    if (file.size > MAX_FILE_SIZE) {
      console.warn('File is larger than 100MB. Processing may be slow.');
    }

    this.onFile(file);
  }

  /**
   * Show the drop zone
   */
  show(): void {
    this.element.style.display = 'flex';
  }

  /**
   * Hide the drop zone
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Get the drop zone element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Destroy the drop zone
   */
  destroy(): void {
    this.element.remove();
  }
}
