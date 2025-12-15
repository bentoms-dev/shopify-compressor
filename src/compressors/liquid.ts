import { Liquid } from 'liquidjs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';
import { logger } from '../utils/logger.js';
import { getFileSize, formatBytes, calculateSavings } from '../utils/files.js';
import type { LiquidOptions, CompressionResult } from '../types.js';

export class LiquidProcessor {
  private engine: Liquid;
  private options: LiquidOptions;

  constructor(options: LiquidOptions = {}) {
    this.options = options;
    this.engine = new Liquid({
      cache: true,
      strictFilters: false,
      strictVariables: false,
      globals: options.globals || {},
    });

    // Register custom filters
    if (options.filters) {
      for (const [name, fn] of Object.entries(options.filters)) {
        this.engine.registerFilter(name, fn as (...args: unknown[]) => unknown);
      }
    }

    // Register Shopify-specific filters
    this.registerShopifyFilters();
  }

  /**
   * Register common Shopify Liquid filters
   */
  private registerShopifyFilters(): void {
    // Asset URL filter
    this.engine.registerFilter('asset_url', (input: string) => {
      return `{{ '${input}' | asset_url }}`;
    });

    // Asset IMG URL filter
    this.engine.registerFilter('asset_img_url', (input: string, size?: string) => {
      const sizeParam = size ? `, '${size}'` : '';
      return `{{ '${input}' | asset_img_url${sizeParam} }}`;
    });

    // Image URL filter
    this.engine.registerFilter('img_url', (input: string, size?: string) => {
      const sizeParam = size || 'master';
      return `{{ ${input} | img_url: '${sizeParam}' }}`;
    });

    // Money filter
    this.engine.registerFilter('money', (input: number) => {
      return `$${(input / 100).toFixed(2)}`;
    });

    // Money with currency
    this.engine.registerFilter('money_with_currency', (input: number) => {
      return `$${(input / 100).toFixed(2)} USD`;
    });

    // JSON filter
    this.engine.registerFilter('json', (input: unknown) => {
      return JSON.stringify(input);
    });

    // Handle filter (slugify)
    this.engine.registerFilter('handle', (input: string) => {
      return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    });

    // Pluralize filter
    this.engine.registerFilter('pluralize', (count: number, singular: string, plural: string) => {
      return count === 1 ? singular : plural;
    });

    // Within filter (for collection URLs)
    this.engine.registerFilter('within', (url: string, collection: { url: string }) => {
      return `${collection.url}${url}`;
    });

    // Link to filter
    this.engine.registerFilter('link_to', (text: string, url: string, title?: string) => {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${url}"${titleAttr}>${text}</a>`;
    });

    // Stylesheet tag
    this.engine.registerFilter('stylesheet_tag', (url: string) => {
      return `<link rel="stylesheet" href="${url}">`;
    });

    // Script tag
    this.engine.registerFilter('script_tag', (url: string) => {
      return `<script src="${url}"></script>`;
    });

    // Image tag
    this.engine.registerFilter('img_tag', (url: string, alt?: string) => {
      const altAttr = alt ? ` alt="${alt}"` : '';
      return `<img src="${url}"${altAttr}>`;
    });
  }

  /**
   * Process a Liquid template file
   */
  async process(
    inputPath: string,
    outputPath: string,
    data: Record<string, unknown> = {}
  ): Promise<CompressionResult> {
    const startTime = performance.now();
    const originalSize = await getFileSize(inputPath);

    await mkdir(dirname(outputPath), { recursive: true });

    const template = await readFile(inputPath, 'utf-8');
    const rendered = await this.engine.parseAndRender(template, {
      ...this.options.globals,
      ...data,
    });

    await writeFile(outputPath, rendered);

    const compressedSize = Buffer.byteLength(rendered, 'utf-8');
    const { savings, ratio } = calculateSavings(originalSize, compressedSize);
    const time = performance.now() - startTime;

    logger.debug(`Processed ${basename(inputPath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);

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
   * Render a Liquid template string
   */
  async render(template: string, data: Record<string, unknown> = {}): Promise<string> {
    return this.engine.parseAndRender(template, {
      ...this.options.globals,
      ...data,
    });
  }

  /**
   * Validate a Liquid template
   */
  async validate(template: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.engine.parse(template);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Get the Liquid engine for advanced usage
   */
  getEngine(): Liquid {
    return this.engine;
  }
}

export default LiquidProcessor;
