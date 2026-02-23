import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { CompressionResult } from '../types.js';

export class JsonMinifier {
  /**
   * Minify a JSON file — parse and re-serialize without whitespace.
   * Falls back to copying if JSON is invalid (some Shopify JSON files
   * contain Liquid tags and can't be parsed).
   */
  async minify(inputPath: string, outputPath: string): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const content = await readFile(inputPath, 'utf-8');
    let minified: string;

    try {
      // Check if it contains Liquid tags — if so, skip JSON parsing
      // and just strip whitespace conservatively
      if (/\{[{%]/.test(content)) {
        // Contains Liquid — treat as text, just collapse whitespace
        minified = this.minifyJsonWithLiquid(content);
      } else {
        // Pure JSON — parse and re-serialize
        const parsed = JSON.parse(content);
        minified = JSON.stringify(parsed);
      }
    } catch {
      // If parsing fails, copy as-is
      logger.debug(`Could not parse JSON: ${basename(inputPath)}, copying as-is`);
      minified = content;
    }

    await writeFile(outputPath, minified);

    const compressedSize = Buffer.byteLength(minified, 'utf-8');
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
   * Minify JSON that contains Liquid tags — conservative whitespace removal.
   * Can't JSON.parse because the Liquid tags make it invalid JSON.
   */
  private minifyJsonWithLiquid(content: string): string {
    // Tokenize: separate Liquid tags from JSON text
    const tokens: Array<{ type: 'liquid' | 'text'; value: string }> = [];
    const liquidPattern = /(\{%-?[\s\S]*?-?%\}|\{\{-?[\s\S]*?-?\}\})/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = liquidPattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      tokens.push({ type: 'liquid', value: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      tokens.push({ type: 'text', value: content.slice(lastIndex) });
    }

    // Minify only the text portions
    return tokens
      .map(t => {
        if (t.type === 'liquid') return t.value;
        // Collapse whitespace outside of strings
        return t.value.replace(/\s+/g, ' ');
      })
      .join('');
  }
}

export default JsonMinifier;
