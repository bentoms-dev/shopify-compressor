/**
 * Shopify Compressor Pro - Core
 *
 * Extends the base ShopifyCompressor with Pro features:
 * - Parallel processing
 * - HTML/JSON/Markdown reports
 * - Asset budget enforcement
 */

import { cpus } from 'os';
import ora from 'ora';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { ShopifyCompressor } from './core.js';
import { ImageCompressor } from './compressors/image.js';
import { JsMinifier } from './compressors/js.js';
import { CssMinifier } from './compressors/css.js';
import { SvgOptimizer } from './compressors/svg.js';
import { LiquidProcessor } from './compressors/liquid.js';
import { JsonMinifier } from './compressors/json.js';
import { FileCache } from './utils/cache.js';
import { logger, setLogLevel } from './utils/logger.js';
import {
  hasGlobChars,
  findFiles,
  groupFilesByType,
  getOutputPath,
  formatBytes,
  getFileType,
  copyFilePreserving,
} from './utils/files.js';
import { loadConfig, mergeConfig } from './config/loader.js';
import { LicenseManager } from './license/manager.js';
import { ParallelProcessor } from './pro/parallel.js';
import { ReportGenerator } from './pro/reports.js';
import { BudgetEnforcer } from './pro/budgets.js';

import type { CompressionResult, OptimizationReport } from './types.js';
import type {
  ShopifyCompressorProConfig,
  ProOptimizationReport,
  WorkerTask,
} from './pro-types.js';

// ============================================
// Pro Defaults
// ============================================

const PRO_DEFAULTS: ShopifyCompressorProConfig['pro'] = {
  parallel: {
    enabled: true,
    concurrency: Math.max(1, cpus().length - 1),
  },
  reports: {
    enabled: false,
    formats: ['html'],
    outputDir: './reports',
    history: true,
    filename: 'build-report',
  },
  budgets: {
    enabled: false,
    failOnExceed: true,
    rules: [],
  },
};

// ============================================
// Pro Class
// ============================================

export class ShopifyCompressorPro {
  private config: ShopifyCompressorProConfig;
  private baseCompressor: ShopifyCompressor;
  private licenseManager: LicenseManager;
  private parallelProcessor: ParallelProcessor | null = null;
  private reportGenerator: ReportGenerator | null = null;
  private budgetEnforcer: BudgetEnforcer | null = null;

  // Internal compressors (needed for parallel processing)
  private imageCompressor: ImageCompressor;
  private jsMinifier: JsMinifier;
  private cssMinifier: CssMinifier;
  private svgOptimizer: SvgOptimizer;
  private liquidProcessor: LiquidProcessor;
  private jsonMinifier: JsonMinifier;
  private cache: FileCache;

  constructor(config: Partial<ShopifyCompressorProConfig> = {}) {
    // Merge base config
    const baseConfig = mergeConfig(config);
    this.config = {
      ...baseConfig,
      pro: {
        ...PRO_DEFAULTS,
        ...config.pro,
        parallel: { ...PRO_DEFAULTS!.parallel, ...config.pro?.parallel },
        reports: { ...PRO_DEFAULTS!.reports, ...config.pro?.reports },
        budgets: { ...PRO_DEFAULTS!.budgets, ...config.pro?.budgets },
      },
    };

    // Set log level
    if (this.config.verbose) {
      setLogLevel('debug');
    }

    // Initialize base compressor (for fallback & individual operations)
    this.baseCompressor = new ShopifyCompressor(config);

    // Initialize license manager
    this.licenseManager = new LicenseManager();

    // Initialize compressors
    this.imageCompressor = new ImageCompressor(this.config.images);
    this.jsMinifier = new JsMinifier(this.config.js);
    this.cssMinifier = new CssMinifier(this.config.css);
    this.svgOptimizer = new SvgOptimizer(this.config.svg);
    this.liquidProcessor = new LiquidProcessor(this.config.liquid);
    this.jsonMinifier = new JsonMinifier();

    // Initialize cache
    this.cache = new FileCache(
      this.config.cache?.directory,
      this.config.cache?.enabled
    );

    // Initialize Pro features
    if (this.config.pro?.parallel?.enabled) {
      this.parallelProcessor = new ParallelProcessor(
        this.config.pro.parallel,
        {
          imageCompressor: this.imageCompressor,
          jsMinifier: this.jsMinifier,
          cssMinifier: this.cssMinifier,
          svgOptimizer: this.svgOptimizer,
          liquidProcessor: this.liquidProcessor,
          jsonMinifier: this.jsonMinifier,
        }
      );
    }

    if (this.config.pro?.reports?.enabled) {
      this.reportGenerator = new ReportGenerator(this.config.pro.reports);
    }

    if (this.config.pro?.budgets?.enabled) {
      this.budgetEnforcer = new BudgetEnforcer(this.config.pro.budgets);
    }
  }

  /**
   * Load configuration from file and create Pro instance
   */
  static async fromConfigFile(
    configPath?: string,
    cwd?: string
  ): Promise<ShopifyCompressorPro> {
    const config = await loadConfig(configPath, cwd);
    return new ShopifyCompressorPro(config || {});
  }

  /**
   * Initialize and validate the license
   */
  async initLicense(): Promise<boolean> {
    // Check for env var first
    const envKey = process.env.SCOMP_PRO_LICENSE_KEY || this.config.pro?.licenseKey;

    if (envKey) {
      try {
        await this.licenseManager.activate(envKey);
        return true;
      } catch {
        logger.debug('License key from env/config failed, trying stored license');
      }
    }

    // Try loading stored license
    const loaded = await this.licenseManager.load();
    if (loaded) {
      return await this.licenseManager.validate();
    }

    return false;
  }

  /**
   * Activate a license key
   */
  async activate(key: string) {
    return this.licenseManager.activate(key);
  }

  /**
   * Deactivate the current license
   */
  async deactivate() {
    return this.licenseManager.deactivate();
  }

  /**
   * Get license info
   */
  getLicenseInfo() {
    return this.licenseManager.getLicenseInfo();
  }

  /**
   * Run the full Pro build process
   */
  async build(): Promise<ProOptimizationReport> {
    const startTime = performance.now();

    // Validate license
    const hasLicense = await this.initLicense();
    if (!hasLicense) {
      logger.warn(
        'No valid Pro license found. Running with base features only.\n' +
        'Activate with: scomp-pro activate <license-key>'
      );
      // Fall back to base compressor
      const baseReport = await this.baseCompressor.build();
      return { ...baseReport };
    }

    const spinner = ora('Starting Pro build...').start();

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

      // In theme mode, find ALL files in the theme root
      const inputPatterns = this.config.themeMode
        ? ['./**/*']
        : Array.isArray(this.config.input)
          ? this.config.input
          : hasGlobChars(this.config.input)
            ? [this.config.input]
            : [this.config.input + '/**/*'];

      const themeIgnore = this.config.themeMode
        ? [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
            '**/.shopify-compressor-cache/**',
            '**/.shopify-compressor-pro/**',
            '**/reports/**',
            // Ignore the output directory itself to prevent recursion
            `${this.config.output}/**`,
          ]
        : ['**/node_modules/**', '**/dist/**'];

      const files = await findFiles(inputPatterns, {
        ignore: themeIgnore,
      });

      if (files.length === 0) {
        spinner.warn('No files found to process');
        return this.createEmptyReport();
      }

      // Group files by type
      const grouped = groupFilesByType(files);
      const supportedCount = files.length - (grouped.unknown?.length || 0);
      const copyCount = grouped.unknown?.length || 0;
      const totalCount = files.length;

      if (this.config.themeMode) {
        spinner.text = `Found ${totalCount} files (${supportedCount} to compress, ${copyCount} to copy)...`;
      } else {
        spinner.text = `Found ${totalCount} files to process...`;
      }

      let allResults: CompressionResult[];
      const errors: Array<{ file: string; error: string }> = [];

      // Use parallel processing if available and licensed
      if (
        this.parallelProcessor &&
        this.licenseManager.isFeatureAvailable('parallel-processing')
      ) {
        spinner.text = `Processing ${supportedCount} files in parallel (${this.parallelProcessor.getConcurrency()} workers)...`;

        const inputBase = this.getInputBase();
        const tasks: WorkerTask[] = [];

        // Build task list for supported files, skip cached files
        for (const [type, fileList] of Object.entries(grouped)) {
          if (type === 'unknown') continue;

          for (const file of fileList) {
            const ext = type === 'css' ? '.css' : undefined;
            const outputPath = getOutputPath(file, inputBase, this.config.output, ext);

            if (!(await this.cache.isChanged(file, outputPath))) {
              logger.debug(`Skipping unchanged: ${file}`);
              continue;
            }

            if (this.config.dryRun) {
              logger.info(`[DRY RUN] Would process: ${file}`);
              continue;
            }

            tasks.push({
              id: `${type}-${tasks.length}`,
              type: type as WorkerTask['type'],
              inputPath: file,
              outputPath,
              options: {},
            });
          }
        }

        // Process all tasks in parallel
        const workerResults = await this.parallelProcessor.processBatch(tasks);

        // Collect results and errors
        allResults = [];
        for (const wr of workerResults) {
          if (wr.success && wr.result) {
            allResults.push(wr.result);

            // Update cache
            await this.cache.set(wr.result.input, wr.result.output);
          } else if (!wr.success) {
            const task = tasks.find(t => t.id === wr.id);
            errors.push({
              file: task?.inputPath || wr.id,
              error: wr.error || 'Unknown error',
            });
          }
        }
      } else {
        // Fall back to sequential processing
        spinner.text = `Processing ${supportedCount} files sequentially...`;
        const report = await this.baseCompressor.build();
        allResults = [
          ...(report.byType.images || []),
          ...(report.byType.js || []),
          ...(report.byType.css || []),
          ...(report.byType.svg || []),
          ...(report.byType.liquid || []),
          ...(report.byType.json || []),
        ];
        errors.push(...report.errors);
      }

      // In theme mode, copy all unsupported files to preserve directory structure
      if (this.config.themeMode && grouped.unknown && grouped.unknown.length > 0) {
        spinner.text = `Copying ${grouped.unknown.length} uncompressed files...`;
        const inputBase = this.getInputBase();

        for (const file of grouped.unknown) {
          if (this.config.dryRun) {
            logger.info(`[DRY RUN] Would copy: ${file}`);
            continue;
          }

          try {
            await copyFilePreserving(file, inputBase, this.config.output);
            logger.debug(`Copied: ${file}`);
          } catch (error) {
            errors.push({ file, error: `Copy failed: ${error}` });
          }
        }
      }

      // Build the Pro report
      const report: ProOptimizationReport = this.buildReport(
        allResults,
        errors,
        startTime
      );

      // Save cache
      await this.cache.save();

      // Evaluate budgets
      if (
        this.budgetEnforcer &&
        this.licenseManager.isFeatureAvailable('asset-budgets')
      ) {
        spinner.text = 'Evaluating asset budgets...';
        report.budgets = this.budgetEnforcer.evaluate(allResults);
        report.budgetsPassed = this.budgetEnforcer.allPassed(report.budgets);
      }

      // Generate reports
      if (
        this.reportGenerator &&
        this.licenseManager.isFeatureAvailable('html-reports')
      ) {
        spinner.text = 'Generating reports...';
        await this.reportGenerator.generate(report);
      }

      const themeNote = this.config.themeMode
        ? ` (${copyCount} files copied)`
        : '';
      spinner.succeed(
        `Pro build complete! Processed ${report.totalFiles} files in ${(report.totalTime / 1000).toFixed(2)}s${themeNote}`
      );

      logger.success(
        `Saved ${formatBytes(report.totalSavings)} (${(report.overallRatio * 100).toFixed(1)}% reduction)`
      );

      if (this.config.themeMode) {
        logger.success(
          `Deploy-ready theme written to: ${this.config.output}\n` +
          `   Deploy with: shopify theme push --path=${this.config.output}`
        );
      }

      // Budget status
      if (report.budgets && report.budgets.length > 0) {
        if (report.budgetsPassed) {
          logger.success('All asset budgets passed ✅');
        } else {
          logger.warn('Some asset budgets exceeded ❌');
          if (this.budgetEnforcer?.shouldFail(report.budgets)) {
            throw new Error('Build failed: asset budgets exceeded');
          }
        }
      }

      return report;
    } catch (error) {
      spinner.fail('Pro build failed');
      throw error;
    }
  }

  /**
   * Start watch mode
   */
  async watch(): Promise<void> {
    return this.baseCompressor.watch();
  }

  /**
   * Stop watch mode
   */
  async stopWatch(): Promise<void> {
    return this.baseCompressor.stopWatch();
  }

  // ==========================================
  // Delegate individual operations to base
  // ==========================================

  async compressImage(inputPath: string, outputPath: string) {
    return this.baseCompressor.compressImage(inputPath, outputPath);
  }

  async minifyJs(inputPath: string, outputPath: string) {
    return this.baseCompressor.minifyJs(inputPath, outputPath);
  }

  async bundleJs(inputPaths: string[], outputPath: string) {
    return this.baseCompressor.bundleJs(inputPaths, outputPath);
  }

  async minifyCss(inputPath: string, outputPath: string) {
    return this.baseCompressor.minifyCss(inputPath, outputPath);
  }

  async bundleCss(inputPaths: string[], outputPath: string) {
    return this.baseCompressor.bundleCss(inputPaths, outputPath);
  }

  async optimizeSvg(inputPath: string, outputPath: string) {
    return this.baseCompressor.optimizeSvg(inputPath, outputPath);
  }

  async processLiquidFile(
    inputPath: string,
    outputPath: string,
    data?: Record<string, unknown>
  ) {
    return this.baseCompressor.processLiquidFile(inputPath, outputPath, data);
  }

  getConfig(): ShopifyCompressorProConfig {
    return this.config;
  }

  getCacheStats() {
    return this.baseCompressor.getCacheStats();
  }

  clearCache(): void {
    this.baseCompressor.clearCache();
  }

  // ==========================================
  // Private helpers
  // ==========================================

  private getInputBase(): string {
    if (Array.isArray(this.config.input)) {
      // Use the directory of the first pattern, stripping any glob characters
      return resolve(this.stripGlob(this.config.input[0]));
    }
    return resolve(this.stripGlob(this.config.input));
  }

  // Strip glob characters from a path to get the base directory
  private stripGlob(pattern: string): string {
    // Find the first segment containing a glob char
    const parts = pattern.split('/');
    const nonGlobParts: string[] = [];
    for (const part of parts) {
      if (/[*?{}\[\]]/.test(part)) break;
      nonGlobParts.push(part);
    }
    return nonGlobParts.join('/') || '.';
  }

  private buildReport(
    allResults: CompressionResult[],
    errors: Array<{ file: string; error: string }>,
    startTime: number
  ): ProOptimizationReport {
    // Group results by type for the report
    const byType: OptimizationReport['byType'] = {};

    for (const result of allResults) {
      const type = getFileType(result.output);
      switch (type) {
        case 'image':
          (byType.images ??= []).push(result);
          break;
        case 'js':
          (byType.js ??= []).push(result);
          break;
        case 'css':
          (byType.css ??= []).push(result);
          break;
        case 'svg':
          (byType.svg ??= []).push(result);
          break;
        case 'liquid':
          (byType.liquid ??= []).push(result);
          break;
        case 'json':
          (byType.json ??= []).push(result);
          break;
      }
    }

    const totalOriginalSize = allResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = allResults.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSavings = totalOriginalSize - totalCompressedSize;

    return {
      totalFiles: allResults.length,
      totalOriginalSize,
      totalCompressedSize,
      totalSavings,
      overallRatio: totalOriginalSize > 0 ? totalSavings / totalOriginalSize : 0,
      totalTime: performance.now() - startTime,
      byType,
      errors,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        licenseTier: this.licenseManager.getTier() || 'individual',
        nodeVersion: process.version,
        platform: process.platform,
        concurrency: this.parallelProcessor?.getConcurrency() ?? 1,
      },
    };
  }

  private createEmptyReport(): ProOptimizationReport {
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
}

export default ShopifyCompressorPro;
