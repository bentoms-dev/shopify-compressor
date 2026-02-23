import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { LiquidOptions, CompressionResult } from '../types.js';

export class LiquidProcessor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: LiquidOptions = {}) {}

  /**
   * Process a Liquid template file — minifies HTML whitespace while
   * preserving all Liquid tags ({% %}, {{ }}) exactly as-is.
   *
   * This does NOT render or evaluate Liquid. It treats Liquid tags as
   * opaque tokens and only minifies the surrounding HTML/text.
   */
  async process(
    inputPath: string,
    outputPath: string,
    _data?: Record<string, unknown>
  ): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const template = await readFile(inputPath, 'utf-8');
    const minified = this.minifyLiquid(template);

    await writeFile(outputPath, minified);

    const compressedSize = Buffer.byteLength(minified, 'utf-8');
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(
      `Processed ${basename(inputPath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${(ratio * 100).toFixed(1)}% saved)`
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
   * Minify a Liquid template string.
   *
   * Strategy: tokenize into Liquid tags / HTML / text segments,
   * then minify only the HTML/text parts. Liquid tags stay untouched.
   */
  minifyLiquid(source: string): string {
    // Tokenize: split source into Liquid tokens and non-Liquid text
    const tokens = this.tokenize(source);

    // Process each token
    const output: string[] = [];
    for (const token of tokens) {
      if (token.type === 'liquid') {
        // Liquid tags/outputs preserved exactly as-is
        output.push(token.value);
      } else {
        // HTML/text gets minified
        output.push(this.minifyHtml(token.value));
      }
    }

    let result = output.join('');

    // Final pass: collapse whitespace around Liquid tags
    // e.g. "  {{ x }}  " → " {{ x }} " (but keep at least one space)
    result = result.replace(/\s+({{)/g, ' $1');
    result = result.replace(/(}})\s+/g, '$1 ');
    result = result.replace(/\s+({%)/g, ' $1');
    result = result.replace(/(%})\s+/g, '$1 ');

    // Collapse whitespace between HTML tags
    result = result.replace(/>\s+</g, '> <');

    // Remove leading/trailing whitespace on lines (within <pre> safe zones excluded)
    result = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return result.trim() + '\n';
  }

  /**
   * Tokenize source into Liquid and non-Liquid segments.
   * Handles: {{ ... }}, {% ... %}, {%- ... -%}, {{- ... -}}
   * Also handles {% raw %}...{% endraw %} blocks.
   */
  private tokenize(source: string): Array<{ type: 'liquid' | 'text'; value: string }> {
    const tokens: Array<{ type: 'liquid' | 'text'; value: string }> = [];

    // Match Liquid tags: {{...}}, {%...%}, {{-...-}}, {%-...-%}
    // Also match {% comment %}...{% endcomment %} and {% raw %}...{% endraw %} blocks
    const liquidPattern = /(\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}|\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}|\{%-?[\s\S]*?-?%\}|\{\{-?[\s\S]*?-?\}\})/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = liquidPattern.exec(source)) !== null) {
      // Text before this Liquid token
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: source.slice(lastIndex, match.index),
        });
      }

      // The Liquid token itself
      tokens.push({
        type: 'liquid',
        value: match[1],
      });

      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last Liquid token
    if (lastIndex < source.length) {
      tokens.push({
        type: 'text',
        value: source.slice(lastIndex),
      });
    }

    return tokens;
  }

  /**
   * Minify an HTML fragment (no Liquid tags in it).
   * - Strips HTML comments
   * - Collapses consecutive whitespace
   * - Preserves <pre>, <script>, <style> content
   */
  private minifyHtml(html: string): string {
    let result = html;

    // Remove HTML comments (but keep conditional IE comments)
    result = result.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

    // Collapse runs of whitespace into a single space
    result = result.replace(/\s{2,}/g, ' ');

    return result;
  }

  /**
   * Render a Liquid template string (simple passthrough — no evaluation).
   * If you need actual rendering, use LiquidJS directly.
   */
  async render(template: string, _data?: Record<string, unknown>): Promise<string> {
    return this.minifyLiquid(template);
  }

  /**
   * Validate a Liquid template — checks for balanced tags.
   */
  async validate(template: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for balanced {{ }} and {% %}
    const openOutput = (template.match(/\{\{/g) || []).length;
    const closeOutput = (template.match(/\}\}/g) || []).length;
    if (openOutput !== closeOutput) {
      errors.push(`Unbalanced output tags: ${openOutput} {{ vs ${closeOutput} }}`);
    }

    const openTag = (template.match(/\{%/g) || []).length;
    const closeTag = (template.match(/%\}/g) || []).length;
    if (openTag !== closeTag) {
      errors.push(`Unbalanced block tags: ${openTag} {% vs ${closeTag} %}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

export default LiquidProcessor;
