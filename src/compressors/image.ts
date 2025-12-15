import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename, extname } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { ImageOptions, ImageCompressionResult, OutputFormat, CompressionResult } from '../types.js';

export interface ProcessedImage {
  buffer: Buffer;
  info: sharp.OutputInfo;
  format: string;
}

// Helper to convert Buffer to Uint8Array for writeFile compatibility
const toUint8Array = (buffer: Buffer): Uint8Array => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

export class ImageCompressor {
  private options: ImageOptions;

  constructor(options: ImageOptions = {}) {
    this.options = {
      quality: 80,
      webp: true,
      avif: false,
      progressive: true,
      lazyPlaceholder: false,
      placeholderBlur: 20,
      ...options,
    };
  }

  /**
   * Compress a single image
   */
  async compress(inputPath: string, outputPath: string): Promise<ImageCompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const inputBuffer = await readFile(inputPath);
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const format = extname(outputPath).slice(1).toLowerCase() as OutputFormat;
    const quality = this.options.quality || 80;

    let outputBuffer: Buffer;
    let outputInfo: sharp.OutputInfo;

    // Process based on output format
    switch (format) {
      case 'webp':
        ({ data: outputBuffer, info: outputInfo } = await image
          .webp({ quality, effort: 6 })
          .toBuffer({ resolveWithObject: true }));
        break;

      case 'avif':
        ({ data: outputBuffer, info: outputInfo } = await image
          .avif({ quality, effort: 6 })
          .toBuffer({ resolveWithObject: true }));
        break;

      case 'jpeg':
        ({ data: outputBuffer, info: outputInfo } = await image
          .jpeg({
            quality,
            progressive: this.options.progressive,
            mozjpeg: true,
          })
          .toBuffer({ resolveWithObject: true }));
        break;

      case 'png':
        ({ data: outputBuffer, info: outputInfo } = await image
          .png({
            quality,
            compressionLevel: 9,
            palette: true,
          })
          .toBuffer({ resolveWithObject: true }));
        break;

      default:
        // Keep original format but optimize
        ({ data: outputBuffer, info: outputInfo } = await image
          .toBuffer({ resolveWithObject: true }));
    }

    await writeFile(outputPath, toUint8Array(outputBuffer));

    const compressedSize = outputBuffer.length;
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);
    const time = performance.now() - startTime;

    const result: ImageCompressionResult = {
      input: inputPath,
      output: outputPath,
      originalSize,
      compressedSize,
      savings,
      ratio,
      time,
      format: outputInfo.format,
      originalDimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      outputDimensions: {
        width: outputInfo.width,
        height: outputInfo.height,
      },
      variants: [],
    };

    // Generate variants if requested
    if (this.options.webp && format !== 'webp') {
      const webpResult = await this.generateVariant(inputPath, outputPath, 'webp');
      result.variants?.push(webpResult);
    }

    if (this.options.avif && format !== 'avif') {
      const avifResult = await this.generateVariant(inputPath, outputPath, 'avif');
      result.variants?.push(avifResult);
    }

    // Generate responsive sizes
    if (this.options.sizes && this.options.sizes.length > 0) {
      for (const size of this.options.sizes) {
        const responsiveResult = await this.generateResponsive(inputPath, outputPath, size);
        result.variants?.push(responsiveResult);
      }
    }

    // Generate lazy load placeholder
    if (this.options.lazyPlaceholder) {
      await this.generatePlaceholder(inputPath, outputPath);
    }

    logger.debug(
      `Compressed ${basename(inputPath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${(ratio * 100).toFixed(1)}% saved)`
    );

    return result;
  }

  /**
   * Generate a format variant (WebP or AVIF)
   */
  private async generateVariant(
    inputPath: string,
    outputPath: string,
    format: 'webp' | 'avif'
  ): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    const variantPath = outputPath.replace(/\.[^.]+$/, `.${format}`);
    const inputBuffer = await readFile(inputPath);
    const image = sharp(inputBuffer);
    const quality = this.options.quality || 80;

    let outputBuffer: Buffer;

    if (format === 'webp') {
      outputBuffer = await image.webp({ quality, effort: 6 }).toBuffer();
    } else {
      outputBuffer = await image.avif({ quality, effort: 6 }).toBuffer();
    }

    await writeFile(variantPath, toUint8Array(outputBuffer));

    const compressedSize = outputBuffer.length;
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);

    logger.debug(`Generated ${format.toUpperCase()} variant: ${basename(variantPath)}`);

    return {
      input: inputPath,
      output: variantPath,
      originalSize,
      compressedSize,
      savings,
      ratio,
      time: performance.now() - startTime,
    };
  }

  /**
   * Generate a responsive image at a specific width
   */
  private async generateResponsive(
    inputPath: string,
    outputPath: string,
    width: number
  ): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    const ext = extname(outputPath);
    const responsivePath = outputPath.replace(ext, `-${width}w${ext}`);

    const inputBuffer = await readFile(inputPath);
    const outputBuffer = await sharp(inputBuffer)
      .resize(width, null, { withoutEnlargement: true })
      .toBuffer();

    await writeFile(responsivePath, toUint8Array(outputBuffer));

    const compressedSize = outputBuffer.length;
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);

    logger.debug(`Generated responsive variant: ${basename(responsivePath)}`);

    return {
      input: inputPath,
      output: responsivePath,
      originalSize,
      compressedSize,
      savings,
      ratio,
      time: performance.now() - startTime,
    };
  }

  /**
   * Generate a low-quality placeholder for lazy loading
   */
  async generatePlaceholder(inputPath: string, outputPath: string): Promise<string> {
    const placeholderPath = outputPath.replace(/\.[^.]+$/, '-placeholder.webp');

    const inputBuffer = await readFile(inputPath);
    const placeholder = await sharp(inputBuffer)
      .resize(20, null, { withoutEnlargement: true })
      .blur(this.options.placeholderBlur || 20)
      .webp({ quality: 20 })
      .toBuffer();

    await writeFile(placeholderPath, toUint8Array(placeholder));

    logger.debug(`Generated placeholder: ${basename(placeholderPath)}`);

    return placeholderPath;
  }

  /**
   * Get base64 data URL for inline placeholder
   */
  async getBase64Placeholder(inputPath: string): Promise<string> {
    const inputBuffer = await readFile(inputPath);
    const placeholder = await sharp(inputBuffer)
      .resize(10, null, { withoutEnlargement: true })
      .blur(10)
      .webp({ quality: 10 })
      .toBuffer();

    return `data:image/webp;base64,${placeholder.toString('base64')}`;
  }
}

export default ImageCompressor;
