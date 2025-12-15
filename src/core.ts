import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import ora from 'ora';

import { ImageCompressor } from './compressors/image.js';
import { JsMinifier } from './compressors/js.js';
import { CssMinifier } from './compressors/css.js';
import { SvgOptimizer } from './compressors/svg.js';
import { LiquidProcessor } from './compressors/liquid.js';
import { Watcher } from './watcher.js';
import { FileCache } from './utils/cache.js';
import { logger, setLogLevel } from './utils/logger.js';
import {
  findFiles,
  groupFilesByType,
  getOutputPath,
  formatBytes,
  getFileType,
} from './utils/files.js';
import { loadConfig, mergeConfig } from './config/loader.js';
import type {
  ShopifyCompressorConfig,
  CompressionResult,
  OptimizationReport,
  WatchEvent,
} from './types.js';

export class ShopifyCompressor {
  private config: ShopifyCompressorConfig;
  private imageCompressor: ImageCompressor;
  private jsMinifier: JsMinifier;
  private cssMinifier: CssMinifier;
  private svgOptimizer: SvgOptimizer;
  private liquidProcessor: LiquidProcessor;
  private cache: FileCache;
  private watcher: Watcher | null = null;

  constructor(config: Partial<ShopifyCompressorConfig> = {}) {
    this.config = mergeConfig(config);

    // Set log level
    if (this.config.verbose) {
      setLogLevel('debug');
    }

    // Initialize compressors
    this.imageCompressor = new ImageCompressor(this.config.images);
    this.jsMinifier = new JsMinifier(this.config.js);
    this.cssMinifier = new CssMinifier(this.config.css);
    this.svgOptimizer = new SvgOptimizer(this.config.svg);
    this.liquidProcessor = new LiquidProcessor(this.config.liquid);

    // Initialize cache
    this.cache = new FileCache(
      this.config.cache?.directory,
      this.config.cache?.enabled
    );
  }

  /**
   * Load configuration from file and create instance
   */
  static async fromConfigFile(
    configPath?: string,
    cwd?: string
  ): Promise<ShopifyCompressor> {
    const config = await loadConfig(configPath, cwd);
    return new ShopifyCompressor(config || {});
  }

  /**
   * Run the full build process
   */
  async build(): Promise<OptimizationReport> {
    const startTime = performance.now();
    const spinner = ora('Starting build...').start();

    try {
      // Load cache
      await this.cache.load();

      // Clean output directory if requested
      if (this.config.clean && existsSync(this.config.output)) {
        spinner.text = 'Cleaning output directory...';
        await rm(this.config.output, { recursive: true });
      }

      // Create output directory
      await mkdir(this.config.output, { recursive: true });

      // Find all input files
      spinner.text = 'Finding files...';
      const inputPatterns = Array.isArray(this.config.input)
        ? this.config.input
        : [this.config.input + '/**/*'];

      const files = await findFiles(inputPatterns, {
        ignore: ['**/node_modules/**', '**/dist/**'],
      });

      if (files.length === 0) {
        spinner.warn('No files found to process');
        return this.createEmptyReport();
      }

      // Group files by type
      const grouped = groupFilesByType(files);
      spinner.text = `Found ${files.length} files to process...`;

      const report: OptimizationReport = {
        totalFiles: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        totalSavings: 0,
        overallRatio: 0,
        totalTime: 0,
        byType: {},
        errors: [],
      };

      // Process images
      if (grouped.image.length > 0) {
        spinner.text = `Processing ${grouped.image.length} images...`;
        report.byType.images = await this.processImages(grouped.image);
      }

      // Process JavaScript
      if (grouped.js.length > 0) {
        spinner.text = `Processing ${grouped.js.length} JavaScript files...`;
        report.byType.js = await this.processJs(grouped.js);
      }

      // Process CSS
      if (grouped.css.length > 0) {
        spinner.text = `Processing ${grouped.css.length} CSS files...`;
        report.byType.css = await this.processCss(grouped.css);
      }

      // Process SVGs
      if (grouped.svg.length > 0) {
        spinner.text = `Processing ${grouped.svg.length} SVG files...`;
        report.byType.svg = await this.processSvg(grouped.svg);
      }

      // Process Liquid files
      if (grouped.liquid.length > 0) {
        spinner.text = `Processing ${grouped.liquid.length} Liquid files...`;
        report.byType.liquid = await this.processLiquid(grouped.liquid);
      }

      // Calculate totals
      const allResults = [
        ...(report.byType.images || []),
        ...(report.byType.js || []),
        ...(report.byType.css || []),
        ...(report.byType.svg || []),
        ...(report.byType.liquid || []),
      ];

      report.totalFiles = allResults.length;
      report.totalOriginalSize = allResults.reduce((sum, r) => sum + r.originalSize, 0);
      report.totalCompressedSize = allResults.reduce((sum, r) => sum + r.compressedSize, 0);
      report.totalSavings = report.totalOriginalSize - report.totalCompressedSize;
      report.overallRatio =
        report.totalOriginalSize > 0
          ? report.totalSavings / report.totalOriginalSize
          : 0;
      report.totalTime = performance.now() - startTime;

      // Save cache
      await this.cache.save();

      spinner.succeed(
        `Build complete! Processed ${report.totalFiles} files in ${(report.totalTime / 1000).toFixed(2)}s`
      );
      logger.success(
        `Saved ${formatBytes(report.totalSavings)} (${(report.overallRatio * 100).toFixed(1)}% reduction)`
      );

      return report;
    } catch (error) {
      spinner.fail('Build failed');
      throw error;
    }
  }

  /**
   * Start watch mode
   */
  async watch(): Promise<void> {
    logger.info('Starting watch mode...');

    // Initial build
    await this.build();

    // Set up watcher
    const watchPaths = this.config.watch?.paths || [
      Array.isArray(this.config.input) ? this.config.input[0] : this.config.input,
    ];

    this.watcher = new Watcher({
      paths: watchPaths,
      ignore: this.config.watch?.ignore,
      debounce: this.config.watch?.debounce,
    });

    this.watcher.onChange(async (event: WatchEvent) => {
      await this.handleFileChange(event);
    });

    this.watcher.start();
  }

  /**
   * Stop watch mode
   */
  async stopWatch(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }
  }

  /**
   * Handle a file change event
   */
  private async handleFileChange(event: WatchEvent): Promise<void> {
    const { type, path } = event;

    if (type === 'unlink') {
      logger.info(`File deleted: ${path}`);
      this.cache.invalidate(path);
      return;
    }

    logger.info(`File ${type === 'add' ? 'added' : 'changed'}: ${path}`);

    try {
      const fileType = getFileType(path);

      switch (fileType) {
        case 'image':
          await this.processImages([path]);
          break;
        case 'js':
          await this.processJs([path]);
          break;
        case 'css':
          await this.processCss([path]);
          break;
        case 'svg':
          await this.processSvg([path]);
          break;
        case 'liquid':
          await this.processLiquid([path]);
          break;
        default:
          logger.debug(`Skipping unsupported file type: ${path}`);
      }

      await this.cache.save();
    } catch (error) {
      logger.error(`Error processing ${path}: ${error}`);
    }
  }

  /**
   * Process image files
   */
  private async processImages(files: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const inputBase = this.getInputBase();

    for (const file of files) {
      const outputPath = getOutputPath(file, inputBase, this.config.output);

      // Check cache
      if (!(await this.cache.isChanged(file, outputPath))) {
        logger.debug(`Skipping unchanged: ${file}`);
        continue;
      }

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would compress: ${file}`);
        continue;
      }

      try {
        const result = await this.imageCompressor.compress(file, outputPath);
        await this.cache.set(file, outputPath);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to compress ${file}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Process JavaScript files
   */
  private async processJs(files: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const inputBase = this.getInputBase();

    for (const file of files) {
      const outputPath = getOutputPath(file, inputBase, this.config.output);

      if (!(await this.cache.isChanged(file, outputPath))) {
        logger.debug(`Skipping unchanged: ${file}`);
        continue;
      }

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would minify: ${file}`);
        continue;
      }

      try {
        const result = await this.jsMinifier.minify(file, outputPath);
        await this.cache.set(file, outputPath);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to minify ${file}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Process CSS files
   */
  private async processCss(files: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const inputBase = this.getInputBase();

    for (const file of files) {
      const outputPath = getOutputPath(file, inputBase, this.config.output, '.css');

      if (!(await this.cache.isChanged(file, outputPath))) {
        logger.debug(`Skipping unchanged: ${file}`);
        continue;
      }

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would minify: ${file}`);
        continue;
      }

      try {
        const result = await this.cssMinifier.minify(file, outputPath);
        await this.cache.set(file, outputPath);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to minify ${file}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Process SVG files
   */
  private async processSvg(files: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const inputBase = this.getInputBase();

    for (const file of files) {
      const outputPath = getOutputPath(file, inputBase, this.config.output);

      if (!(await this.cache.isChanged(file, outputPath))) {
        logger.debug(`Skipping unchanged: ${file}`);
        continue;
      }

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would optimize: ${file}`);
        continue;
      }

      try {
        const result = await this.svgOptimizer.optimize(file, outputPath);
        await this.cache.set(file, outputPath);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to optimize ${file}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Process Liquid files
   */
  private async processLiquid(files: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const inputBase = this.getInputBase();

    for (const file of files) {
      const outputPath = getOutputPath(file, inputBase, this.config.output);

      if (!(await this.cache.isChanged(file, outputPath))) {
        logger.debug(`Skipping unchanged: ${file}`);
        continue;
      }

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would process: ${file}`);
        continue;
      }

      try {
        const result = await this.liquidProcessor.process(file, outputPath);
        await this.cache.set(file, outputPath);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process ${file}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Get the base input directory
   */
  private getInputBase(): string {
    if (Array.isArray(this.config.input)) {
      return resolve(dirname(this.config.input[0]));
    }
    return resolve(this.config.input);
  }

  /**
   * Create an empty report
   */
  private createEmptyReport(): OptimizationReport {
    return {
      totalFiles: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      totalSavings: 0,
      overallRatio: 0,
      totalTime: 0,
      byType: {},
      errors: [],
    };
  }

  // ==========================================
  // Public API methods for individual operations
  // ==========================================

  /**
   * Compress a single image
   */
  async compressImage(inputPath: string, outputPath: string) {
    return this.imageCompressor.compress(inputPath, outputPath);
  }

  /**
   * Minify a JavaScript file
   */
  async minifyJs(inputPath: string, outputPath: string) {
    return this.jsMinifier.minify(inputPath, outputPath);
  }

  /**
   * Bundle JavaScript files
   */
  async bundleJs(inputPaths: string[], outputPath: string) {
    return this.jsMinifier.bundle(inputPaths, outputPath);
  }

  /**
   * Minify a CSS file
   */
  async minifyCss(inputPath: string, outputPath: string) {
    return this.cssMinifier.minify(inputPath, outputPath);
  }

  /**
   * Bundle CSS files
   */
  async bundleCss(inputPaths: string[], outputPath: string) {
    return this.cssMinifier.bundle(inputPaths, outputPath);
  }

  /**
   * Optimize an SVG file
   */
  async optimizeSvg(inputPath: string, outputPath: string) {
    return this.svgOptimizer.optimize(inputPath, outputPath);
  }

  /**
   * Process a Liquid template
   */
  async processLiquidFile(
    inputPath: string,
    outputPath: string,
    data?: Record<string, unknown>
  ) {
    return this.liquidProcessor.process(inputPath, outputPath, data);
  }

  /**
   * Get configuration
   */
  getConfig(): ShopifyCompressorConfig {
    return this.config;
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default ShopifyCompressor;
