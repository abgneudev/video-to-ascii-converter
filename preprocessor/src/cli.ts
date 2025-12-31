#!/usr/bin/env node
/**
 * ASCII Preprocessor CLI
 * Converts video files to pre-processed ASCII animation data
 *
 * Usage:
 *   npx ascii-process --input video.mp4 --output ascii-data.bin --cols 120 --fps 24
 */

import { program } from 'commander';
import ffmpeg from 'fluent-ffmpeg';
import { createCanvas, loadImage } from 'canvas';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { convertToASCII, type ConvertedFrame } from './asciiConverter.js';
import { computeDelta, createFullFrame } from './compress.js';
import { writeBinary, writeJSON, writeJSModule } from './outputFormats.js';
import type { ASCIIAnimation, ASCIIFrame, ProcessOptions } from './types.js';

const DEFAULT_RAMP = ' .:+*#@';

program
  .name('ascii-process')
  .description('Convert video to pre-processed ASCII animation data')
  .requiredOption('-i, --input <path>', 'Input video file path')
  .requiredOption('-o, --output <path>', 'Output file path')
  .option('-c, --cols <number>', 'Number of columns', '120')
  .option('-f, --fps <number>', 'Frames per second', '24')
  .option('-m, --color-mode <mode>', 'Color mode: mono, rgb, palette', 'mono')
  .option('-r, --ramp <chars>', 'ASCII character ramp', DEFAULT_RAMP)
  .option('--format <type>', 'Output format: binary, json, js', 'binary')
  .option('--loop-optimize', 'Optimize for seamless looping', false)
  .parse();

const opts = program.opts();

async function main() {
  const options: ProcessOptions = {
    inputPath: opts.input,
    outputPath: opts.output,
    cols: parseInt(opts.cols, 10),
    fps: parseInt(opts.fps, 10),
    colorMode: opts.colorMode as 'mono' | 'rgb' | 'palette',
    ramp: opts.ramp,
    format: opts.format as 'binary' | 'json' | 'js',
    loopOptimize: opts.loopOptimize
  };

  console.log('ASCII Preprocessor');
  console.log('==================');
  console.log(`Input: ${options.inputPath}`);
  console.log(`Output: ${options.outputPath}`);
  console.log(`Cols: ${options.cols}, FPS: ${options.fps}`);
  console.log(`Color mode: ${options.colorMode}`);
  console.log(`Format: ${options.format}`);
  console.log('');

  // Create temp directory for frames
  const tempDir = await mkdtemp(join(tmpdir(), 'ascii-'));
  console.log(`Extracting frames to: ${tempDir}`);

  try {
    // Get video info
    const videoInfo = await getVideoInfo(options.inputPath);
    console.log(`Video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(2)}s`);

    // Calculate target width for aspect ratio
    // Assume char aspect ~0.5 (chars are 2x tall as wide)
    const targetWidth = options.cols * 2;

    // Extract frames using ffmpeg
    console.log('Extracting frames...');
    await extractFrames(options.inputPath, tempDir, options.fps, targetWidth);

    // Get frame files
    const files = (await readdir(tempDir))
      .filter(f => f.endsWith('.png'))
      .sort();

    console.log(`Extracted ${files.length} frames`);

    // Convert frames to ASCII
    console.log('Converting to ASCII...');
    const frames: ASCIIFrame[] = [];
    let prevFrame: ConvertedFrame | null = null;
    let rows = 0;
    const includeColors = options.colorMode !== 'mono';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imgPath = join(tempDir, file);
      const img = await loadImage(imgPath);

      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      const converted = convertToASCII(
        { data: imageData.data, width: img.width, height: img.height },
        { cols: options.cols, ramp: options.ramp, colorMode: options.colorMode }
      );

      rows = converted.rows;

      // First frame is always full, rest use delta compression
      if (i === 0 || prevFrame === null) {
        frames.push(createFullFrame(converted, includeColors));
      } else {
        frames.push(computeDelta(prevFrame, converted, includeColors));
      }

      prevFrame = converted;

      // Progress
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        process.stdout.write(`\rProcessed ${i + 1}/${files.length} frames`);
      }
    }

    console.log('\n');

    // Build animation object
    const animation: ASCIIAnimation = {
      meta: {
        version: 1,
        cols: options.cols,
        rows,
        fps: options.fps,
        frameCount: frames.length,
        duration: frames.length / options.fps,
        colorMode: options.colorMode,
        ramp: options.ramp
      },
      frames
    };

    // Calculate compression stats
    const fullFrames = frames.filter(f => f.type === 'full').length;
    const deltaFrames = frames.filter(f => f.type === 'delta').length;
    console.log(`Full frames: ${fullFrames}, Delta frames: ${deltaFrames}`);

    // Write output
    console.log('Writing output...');
    switch (options.format) {
      case 'binary':
        writeBinary(animation, options.outputPath);
        break;
      case 'json':
        writeJSON(animation, options.outputPath);
        break;
      case 'js':
        writeJSModule(animation, options.outputPath);
        break;
    }

    console.log('Done!');

  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true });
  }
}

function getVideoInfo(inputPath: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: metadata.format.duration || 0
      });
    });
  });
}

function extractFrames(
  inputPath: string,
  outputDir: string,
  fps: number,
  targetWidth: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${targetWidth}:-1`,
        `-r ${fps}`
      ])
      .output(join(outputDir, 'frame-%04d.png'))
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
