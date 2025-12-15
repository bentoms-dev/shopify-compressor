import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { JsOptions, CompressionResult } from '../types.js';

export class JsMinifier {
  private options: JsOptions;

  constructor(options: JsOptions = {}) {
    this.options = {
      minify: true,
      sourcemap: false,
      target: 'es2020',
      bundle: false,
      treeShaking: true,
      ...options,
    };
  }

  /**
   * Minify a JavaScript file
   */
  async minify(inputPath: string, outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    await esbuild.build({
      entryPoints: [inputPath],
      outfile: outputPath,
      bundle: this.options.bundle,
      minify: this.options.minify,
      sourcemap: this.options.sourcemap ? 'linked' : false,
      target: this.options.target,
      treeShaking: this.options.treeShaking,
      platform: 'browser',
      format: 'esm',
      write: true,
      metafile: true,
    });

    const compressedSize = await getFileSize(outputPath);
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(
      `Minified ${basename(inputPath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${(ratio * 100).toFixed(1)}% saved)`
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
   * Bundle multiple JavaScript files into one
   */
  async bundle(inputPaths: string[], outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();

    // Calculate total original size
    let totalOriginalSize = 0;
    for (const inputPath of inputPaths) {
      totalOriginalSize += await getFileSize(inputPath);
    }

    await mkdir(dirname(outputPath), { recursive: true });

    // Create a virtual entry point that imports all files
    const entryContent = inputPaths
      .map((p, i) => `import * as _${i} from '${p}'; export { _${i} };`)
      .join('\n');

    await esbuild.build({
      stdin: {
        contents: entryContent,
        resolveDir: dirname(inputPaths[0]),
        loader: 'js',
      },
      outfile: outputPath,
      bundle: true,
      minify: this.options.minify,
      sourcemap: this.options.sourcemap ? 'linked' : false,
      target: this.options.target,
      treeShaking: this.options.treeShaking,
      platform: 'browser',
      format: 'esm',
      write: true,
    });

    const compressedSize = await getFileSize(outputPath);
    const { savings, ratio } = calculateSavings(totalOriginalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(
      `Bundled ${inputPaths.length} files: ${formatBytes(totalOriginalSize)} → ${formatBytes(compressedSize)}`
    );

    return {
      input: inputPaths.join(', '),
      output: outputPath,
      originalSize: totalOriginalSize,
      compressedSize,
      savings,
      ratio,
      time,
    };
  }

  /**
   * Minify JavaScript code string
   */
  async minifyCode(code: string): Promise<string> {
    const result = await esbuild.transform(code, {
      minify: this.options.minify,
      target: this.options.target,
      loader: 'js',
    });

    return result.code;
  }
}

export default JsMinifier;
