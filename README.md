# ASCII Video Converter

A high-performance, real-time video-to-ASCII art converter that runs entirely in the browser. Convert any video into animated ASCII art with customizable character sets and color modes.

**[live demo](https://video-to-ascii-converter-jii4.vercel.app/)**

![ASCII Video Converter Screenshot](screenshot.png)

## Features

- **Real-time conversion** - Videos are processed frame-by-frame at up to 24 FPS
- **Multiple character sets** - Choose from Minimal, Standard, Detailed, Blocks, or Binary
- **Color modes** - Monochrome, Full Color, or Palette-quantized output
- **URL support** - Load videos directly from Cloudinary, CDNs, or any public URL
- **Export options** - Copy ASCII to clipboard or download as .txt file
- **Zero dependencies** - Pure TypeScript, no runtime libraries
- **Client-side only** - All processing happens in your browser, no server needed

## Character Sets

| Name | Characters | Best For |
|------|------------|----------|
| Minimal | ` .:+*#@` | Clean, readable output |
| Standard | ` .:-=+*#%@` | Balanced detail |
| Detailed | 70 characters | Maximum detail |
| Blocks | `░▒▓█` | Retro terminal look |
| Binary | `01` | Matrix-style effect |

## Usage

### Online

1. Visit the [live demo](https://ascii-video.vercel.app)
2. Drag & drop a video file or paste a video URL
3. Adjust resolution, character set, and color mode
4. Click Play to start the animation
5. Export or copy the result

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/ascii-video-converter.git
cd ascii-video-converter

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Standalone Hero Component

Want to use ASCII animation as a hero background on your website? Use the standalone component:

```html
<div id="hero"></div>
<script src="dist/ascii-hero-standalone.js"></script>
<script>
  ASCIIHero.init('#hero', {
    videoUrl: 'https://your-video-url.mp4',
    cols: 140,
    fps: 20,
    overlay: `
      <h1>Your Title</h1>
      <p>Your tagline</p>
    `
  });
</script>
```

See [dist/example.html](dist/example.html) for a complete example.

## API

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cols` | number | 80 | Number of ASCII columns (40-160) |
| `ramp` | string | 'minimal' | Character set: minimal, standard, detailed, blocks, binary |
| `colorMode` | string | 'mono' | Color mode: mono, color, palette |
| `invert` | boolean | false | Invert brightness mapping |

### Supported Formats

- **Video**: MP4, WebM, MOV, AVI
- **Sources**: Local files, Cloudinary, any CORS-enabled URL

## Performance

- Canvas-based rendering for color modes (zero DOM nodes)
- Typed arrays for efficient pixel processing
- Frame rate throttling to maintain smooth playback
- Web Worker support for off-main-thread processing

## Tech Stack

- **TypeScript** - Type-safe codebase
- **Vite** - Fast development and optimized builds
- **Canvas API** - Hardware-accelerated rendering
- **Web Workers** - Background processing

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

Built with TypeScript and Canvas API
