/**
 * ASCII Hero Demo
 * Demonstrates the hero background component with sample data
 */

import '../components/ASCIIHero/ASCIIHero.css';
import { ASCIIHero } from '../components/ASCIIHero';
import type { ASCIIAnimation } from '../components/ASCIIHero';

// Generate sample animation data (for demo without preprocessor)
function generateSampleAnimation(): ASCIIAnimation {
  const cols = 80;
  const rows = 30;
  const fps = 24;
  const frameCount = 48; // 2 second loop
  const ramp = ' .:+*#@';

  const frames: ASCIIAnimation['frames'] = [];

  // Generate a wave animation
  for (let f = 0; f < frameCount; f++) {
    const phase = (f / frameCount) * Math.PI * 2;
    let chars = '';

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Create a wave pattern
        const dx = (x - cols / 2) / cols;
        const dy = (y - rows / 2) / rows;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wave = Math.sin(dist * 10 - phase) * 0.5 + 0.5;

        // Add some noise
        const noise = Math.sin(x * 0.3 + f * 0.1) * Math.cos(y * 0.2 + f * 0.15) * 0.2 + 0.5;
        const value = wave * 0.7 + noise * 0.3;

        const charIndex = Math.min(Math.floor(value * ramp.length), ramp.length - 1);
        chars += ramp[charIndex];
      }
    }

    if (f === 0) {
      frames.push({ type: 'full', chars });
    } else {
      // For demo, store all as full frames (delta compression would be used in production)
      frames.push({ type: 'full', chars });
    }
  }

  return {
    meta: {
      version: 1,
      cols,
      rows,
      fps,
      frameCount,
      duration: frameCount / fps,
      colorMode: 'mono',
      ramp
    },
    frames
  };
}

// Demo initialization
export function initHeroDemo(): void {
  const container = document.getElementById('hero-demo');
  if (!container) {
    console.error('Hero demo container not found');
    return;
  }

  // For demo, we'll use inline animation data
  // In production, you'd use: new ASCIIHero(container, { src: '/ascii-data/hero.bin' })

  // Create hero structure manually for demo
  container.innerHTML = `
    <div class="ascii-hero" id="demo-hero">
      <pre class="ascii-hero__ascii" id="demo-ascii"></pre>
      <div class="ascii-hero__overlay">
        <div class="demo-content">
          <h1>ASCII Hero Background</h1>
          <p>Pre-processed animation for near-zero runtime cost</p>
          <button id="toggle-btn">Pause</button>
        </div>
      </div>
    </div>
  `;

  // Generate and play sample animation
  const animation = generateSampleAnimation();
  const asciiElement = document.getElementById('demo-ascii') as HTMLPreElement;

  // Simple player for demo
  let frameIndex = 0;
  let playing = true;
  let lastTime = 0;
  const frameDuration = 1000 / animation.meta.fps;

  function tick(time: number): void {
    if (!playing) {
      requestAnimationFrame(tick);
      return;
    }

    if (time - lastTime >= frameDuration) {
      const frame = animation.frames[frameIndex];
      if (frame.type === 'full') {
        // Format with line breaks
        const lines: string[] = [];
        for (let i = 0; i < frame.chars.length; i += animation.meta.cols) {
          lines.push(frame.chars.slice(i, i + animation.meta.cols));
        }
        asciiElement.textContent = lines.join('\n');
      }

      frameIndex = (frameIndex + 1) % animation.frames.length;
      lastTime = time;
    }

    requestAnimationFrame(tick);
  }

  // Start animation
  requestAnimationFrame(tick);

  // Fade in
  setTimeout(() => {
    asciiElement.classList.add('ascii-hero__ascii--visible');
  }, 100);

  // Toggle button
  const toggleBtn = document.getElementById('toggle-btn');
  toggleBtn?.addEventListener('click', () => {
    playing = !playing;
    toggleBtn.textContent = playing ? 'Pause' : 'Play';
  });
}

// Auto-init if demo container exists
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroDemo);
} else {
  initHeroDemo();
}
