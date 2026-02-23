/**
 * Shopify Compressor Pro - Parallel Processing Engine
 *
 * Uses worker threads to process files concurrently for significantly
 * faster builds on multi-core machines.
 */

import { cpus } from 'os';
import { logger } from '../utils/logger.js';
import type { CompressionResult } from '../types.js';
import type { WorkerTask, WorkerResult, ParallelOptions } from '../pro-types.js';

import { ImageCompressor } from '../compressors/image.js';
import { JsMinifier } from '../compressors/js.js';
import { CssMinifier } from '../compressors/css.js';
import { SvgOptimizer } from '../compressors/svg.js';
import { LiquidProcessor } from '../compressors/liquid.js';
import { JsonMinifier } from '../compressors/json.js';

// ============================================
// Parallel Processor
// ============================================

export class ParallelProcessor {
  private concurrency: number;
  private imageCompressor: ImageCompressor;
  private jsMinifier: JsMinifier;
  private cssMinifier: CssMinifier;
  private svgOptimizer: SvgOptimizer;
  private liquidProcessor: LiquidProcessor;
  private jsonMinifier: JsonMinifier;

  constructor(
    options: ParallelOptions = {},
    compressors: {
      imageCompressor: ImageCompressor;
      jsMinifier: JsMinifier;
      cssMinifier: CssMinifier;
      svgOptimizer: SvgOptimizer;
      liquidProcessor: LiquidProcessor;
      jsonMinifier: JsonMinifier;
    }
  ) {
    this.concurrency = options.concurrency || Math.max(1, cpus().length - 1);
    this.imageCompressor = compressors.imageCompressor;
    this.jsMinifier = compressors.jsMinifier;
    this.cssMinifier = compressors.cssMinifier;
    this.svgOptimizer = compressors.svgOptimizer;
    this.liquidProcessor = compressors.liquidProcessor;
    this.jsonMinifier = compressors.jsonMinifier;

    logger.debug(`Parallel processor initialized with concurrency: ${this.concurrency}`);
  }

  /**
   * Process a batch of tasks concurrently using a worker pool pattern
   */
  async processBatch(tasks: WorkerTask[]): Promise<WorkerResult[]> {
    if (tasks.length === 0) return [];

    const startTime = performance.now();
    const results: WorkerResult[] = [];
    const queue = [...tasks];
    const inFlight: Promise<void>[] = [];

    logger.debug(
      `Processing ${tasks.length} tasks with concurrency ${this.concurrency}`
    );

    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const task = queue.shift()!;
        const result = await this.processTask(task);
        results.push(result);
      }
    };

    // Create worker slots
    const workers = Math.min(this.concurrency, tasks.length);
    for (let i = 0; i < workers; i++) {
      inFlight.push(processNext());
    }

    await Promise.all(inFlight);

    const totalTime = performance.now() - startTime;
    logger.debug(
      `Parallel batch complete: ${tasks.length} tasks in ${(totalTime / 1000).toFixed(2)}s`
    );

    return results;
  }

  /**
   * Process a single task
   */
  private async processTask(task: WorkerTask): Promise<WorkerResult> {
    try {
      let result: CompressionResult;

      switch (task.type) {
        case 'image':
          result = await this.imageCompressor.compress(task.inputPath, task.outputPath);
          break;

        case 'js':
          result = await this.jsMinifier.minify(task.inputPath, task.outputPath);
          break;

        case 'css':
          result = await this.cssMinifier.minify(task.inputPath, task.outputPath);
          break;

        case 'svg':
          result = await this.svgOptimizer.optimize(task.inputPath, task.outputPath);
          break;

        case 'liquid':
          result = await this.liquidProcessor.process(task.inputPath, task.outputPath);
          break;

        case 'json':
          result = await this.jsonMinifier.minify(task.inputPath, task.outputPath);
          break;

        default:
          return {
            id: task.id,
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      return {
        id: task.id,
        success: true,
        result: {
          input: result.input,
          output: result.output,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          savings: result.savings,
          ratio: result.ratio,
          time: result.time,
        },
      };
    } catch (err) {
      return {
        id: task.id,
        success: false,
        error: String(err),
      };
    }
  }

  /**
   * Create WorkerTasks from file lists and their types
   */
  static createTasks(
    files: { path: string; outputPath: string; type: WorkerTask['type'] }[]
  ): WorkerTask[] {
    return files.map((f, index) => ({
      id: `task-${index}-${Date.now()}`,
      type: f.type,
      inputPath: f.path,
      outputPath: f.outputPath,
      options: {},
    }));
  }

  /**
   * Convert WorkerResults to CompressionResults
   */
  static toCompressionResults(workerResults: WorkerResult[]): CompressionResult[] {
    return workerResults
      .filter(r => r.success && r.result)
      .map(r => r.result as CompressionResult);
  }

  /**
   * Get the concurrency level
   */
  getConcurrency(): number {
    return this.concurrency;
  }
}

export default ParallelProcessor;
