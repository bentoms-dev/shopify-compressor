/**
 * Shopify Compressor Pro - Extended Type Definitions
 */

import type { ShopifyCompressorConfig, OptimizationReport } from './types.js';
import type { LicenseTier } from './license/manager.js';

// ============================================
// Pro Configuration
// ============================================

export interface ProOptions {
  /** License key (can also be set via SCOMP_PRO_LICENSE_KEY env var) */
  licenseKey?: string;

  /** Parallel processing options */
  parallel?: ParallelOptions;

  /** Report generation options */
  reports?: ReportOptions;

  /** Asset budget enforcement */
  budgets?: BudgetOptions;

  /** Advanced image options */
  advancedImages?: AdvancedImageOptions;

  /** CI/CD integration options */
  ci?: CiOptions;
}

export interface ParallelOptions {
  /** Enable parallel processing */
  enabled?: boolean;
  /** Number of concurrent workers (default: CPU count - 1) */
  concurrency?: number;
}

export interface ReportOptions {
  /** Enable report generation */
  enabled?: boolean;
  /** Report output formats */
  formats?: ReportFormat[];
  /** Output directory for reports */
  outputDir?: string;
  /** Include historical comparison */
  history?: boolean;
  /** Report filename (without extension) */
  filename?: string;
}

export type ReportFormat = 'html' | 'json' | 'markdown';

export interface BudgetOptions {
  /** Enable budget enforcement */
  enabled?: boolean;
  /** Fail build if budgets are exceeded */
  failOnExceed?: boolean;
  /** Per-file-type budgets */
  rules?: BudgetRule[];
}

export interface BudgetRule {
  /** File type or glob pattern */
  pattern: string;
  /** Maximum total size for matched files (e.g. '50KB', '1MB') */
  maxTotalSize?: string;
  /** Maximum individual file size */
  maxFileSize?: string;
  /** Maximum number of files */
  maxFiles?: number;
  /** Minimum compression ratio (0-1) */
  minCompressionRatio?: number;
}

export interface BudgetResult {
  /** The rule that was evaluated */
  rule: BudgetRule;
  /** Whether the budget passed */
  passed: boolean;
  /** Actual values */
  actual: {
    totalSize?: number;
    maxFileSize?: number;
    fileCount?: number;
    compressionRatio?: number;
  };
  /** Budget limits */
  limit: {
    totalSize?: number;
    maxFileSize?: number;
    maxFiles?: number;
    minCompressionRatio?: number;
  };
  /** Human-readable message */
  message: string;
}

export interface AdvancedImageOptions {
  /** Enable smart crop with focal point detection */
  smartCrop?: boolean;
  /** Auto-generate OG/social media images */
  socialPresets?: boolean;
  /** Extract dominant color palette */
  extractPalette?: boolean;
  /** Number of palette colors to extract */
  paletteColors?: number;
  /** Generate thumbnail presets */
  thumbnailSizes?: ThumbnailPreset[];
}

export interface ThumbnailPreset {
  name: string;
  width: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CiOptions {
  /** Enable CI mode (non-interactive, structured output) */
  enabled?: boolean;
  /** Output format for CI */
  outputFormat?: 'json' | 'github-actions' | 'gitlab';
  /** Annotations (e.g. GitHub Actions problem matchers) */
  annotations?: boolean;
}

// ============================================
// Pro Config (extends base)
// ============================================

export interface ShopifyCompressorProConfig extends ShopifyCompressorConfig {
  /** Pro-specific options */
  pro?: ProOptions;
}

// ============================================
// Pro Report
// ============================================

export interface ProOptimizationReport extends OptimizationReport {
  /** Budget evaluation results */
  budgets?: BudgetResult[];
  /** Whether all budgets passed */
  budgetsPassed?: boolean;
  /** Historical comparison */
  history?: ReportHistoryEntry;
  /** Build metadata */
  meta?: {
    timestamp: string;
    version: string;
    licenseTier: LicenseTier;
    nodeVersion: string;
    platform: string;
    concurrency: number;
  };
}

export interface ReportHistoryEntry {
  /** Previous build timestamp */
  previousBuild: string;
  /** Size delta */
  sizeDelta: number;
  /** File count delta */
  filesDelta: number;
  /** Savings delta */
  savingsDelta: number;
}

// ============================================
// Worker Messages (for parallel processing)
// ============================================

export interface WorkerTask {
  id: string;
  type: 'image' | 'js' | 'css' | 'svg' | 'liquid' | 'json';
  inputPath: string;
  outputPath: string;
  options: Record<string, unknown>;
}

export interface WorkerResult {
  id: string;
  success: boolean;
  result?: {
    input: string;
    output: string;
    originalSize: number;
    compressedSize: number;
    savings: number;
    ratio: number;
    time: number;
  };
  error?: string;
}
