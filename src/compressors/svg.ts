import { optimize, Config } from 'svgo';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { SvgOptions, CompressionResult } from '../types.js';

export class SvgOptimizer {
  private options: SvgOptions;

  constructor(options: SvgOptions = {}) {
    this.options = {
      multipass: true,
      removeViewBox: false,
      plugins: [],
      ...options,
    };
  }

  /**
   * Get SVGO config
   */
  private getConfig(): Config {
    return {
      multipass: this.options.multipass,
      plugins: [
        'preset-default',
        'removeDimensions',
        'sortAttrs',
      ],
    };
  }

  /**
   * Optimize an SVG file
   */
  async optimize(inputPath: string, outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const svgContent = await readFile(inputPath, 'utf-8');

    const result = optimize(svgContent, {
      path: inputPath,
      ...this.getConfig(),
    });

    await writeFile(outputPath, result.data);

    const compressedSize = Buffer.byteLength(result.data, 'utf-8');
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(
      `Optimized ${basename(inputPath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${(ratio * 100).toFixed(1)}% saved)`
    );

    return {
      input: inputPath,
      output: outputPath,
      originalSize,
      compressedSize,
      savings,
      ratio,
      time,
    };
  }

  /**
   * Optimize SVG code string
   */
  optimizeCode(svgCode: string): string {
    const result = optimize(svgCode, this.getConfig());
    return result.data;
  }

  /**
   * Convert SVG to data URL for inline usage
   */
  async toDataUrl(inputPath: string): Promise<string> {
    const svgContent = await readFile(inputPath, 'utf-8');
    const optimized = optimize(svgContent, this.getConfig());

    // Encode for data URL
    const encoded = encodeURIComponent(optimized.data)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');

    return `data:image/svg+xml,${encoded}`;
  }

  /**
   * Convert SVG to base64 data URL
   */
  async toBase64DataUrl(inputPath: string): Promise<string> {
    const svgContent = await readFile(inputPath, 'utf-8');
    const optimized = optimize(svgContent, this.getConfig());

    const base64 = Buffer.from(optimized.data).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
}

export default SvgOptimizer;
