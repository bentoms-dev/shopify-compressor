import { transform, Features } from 'lightningcss';
import * as sass from 'sass';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename, extname } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { CssOptions, CompressionResult } from '../types.js';

export class CssMinifier {
  private options: CssOptions;

  constructor(options: CssOptions = {}) {
    this.options = {
      minify: true,
      sourcemap: false,
      targets: ['> 0.5%', 'last 2 versions', 'not dead'],
      nesting: true,
      ...options,
    };
  }

  /**
   * Minify a CSS file
   */
  async minify(inputPath: string, outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    let cssContent: string;
    const ext = extname(inputPath).toLowerCase();

    // Compile SCSS/Sass if needed
    if (ext === '.scss' || ext === '.sass') {
      const result = sass.compile(inputPath, {
        style: 'expanded',
        sourceMap: this.options.sourcemap,
      });
      cssContent = result.css;
    } else {
      cssContent = await readFile(inputPath, 'utf-8');
    }

    // Process with LightningCSS
    const { code, map } = transform({
      filename: basename(inputPath),
      code: new TextEncoder().encode(cssContent),
      minify: this.options.minify,
      sourceMap: this.options.sourcemap,
      drafts: {
        customMedia: true,
      },
      nonStandard: {
        deepSelectorCombinator: true,
      },
      include: Features.Nesting | Features.MediaQueries,
      targets: {
        chrome: 100,
        firefox: 100,
        safari: 15,
      },
    });

    await writeFile(outputPath, code);

    if (this.options.sourcemap && map) {
      await writeFile(`${outputPath}.map`, map);
    }

    const compressedSize = code.length;
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
   * Bundle multiple CSS files into one
   */
  async bundle(inputPaths: string[], outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();

    let totalOriginalSize = 0;
    const cssContents: string[] = [];

    for (const inputPath of inputPaths) {
      totalOriginalSize += await getFileSize(inputPath);

      const ext = extname(inputPath).toLowerCase();
      let content: string;

      if (ext === '.scss' || ext === '.sass') {
        const result = sass.compile(inputPath, { style: 'expanded' });
        content = result.css;
      } else {
        content = await readFile(inputPath, 'utf-8');
      }

      cssContents.push(`/* Source: ${basename(inputPath)} */\n${content}`);
    }

    await mkdir(dirname(outputPath), { recursive: true });

    const combinedCss = cssContents.join('\n\n');

    const { code } = transform({
      filename: basename(outputPath),
      code: new TextEncoder().encode(combinedCss),
      minify: this.options.minify,
      sourceMap: this.options.sourcemap,
      include: Features.Nesting | Features.MediaQueries,
      targets: {
        chrome: 100,
        firefox: 100,
        safari: 15,
      },
    });

    await writeFile(outputPath, code);

    const compressedSize = code.length;
    const { savings, ratio } = calculateSavings(totalOriginalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(
      `Bundled ${inputPaths.length} CSS files: ${formatBytes(totalOriginalSize)} → ${formatBytes(compressedSize)}`
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
   * Minify CSS code string
   */
  minifyCode(code: string): string {
    const { code: minified } = transform({
      filename: 'inline.css',
      code: new TextEncoder().encode(code),
      minify: true,
    });

    return new TextDecoder().decode(minified);
  }

  /**
   * Compile SCSS to CSS
   */
  compileSass(inputPath: string): string {
    const result = sass.compile(inputPath, {
      style: this.options.minify ? 'compressed' : 'expanded',
    });
    return result.css;
  }
}

export default CssMinifier;
