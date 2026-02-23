/**
 * Shopify Compressor Pro v1.0.0
 * Advanced asset optimization for Shopify themes
 *
 * @packageDocumentation
 */

// Pro main class
export { ShopifyCompressorPro, ShopifyCompressorPro as default } from './pro-core.js';

// Base class (re-exported from shopify-compressor)
export { ShopifyCompressor } from './core.js';

// Pro features
export { ParallelProcessor } from './pro/parallel.js';
export { ReportGenerator } from './pro/reports.js';
export { BudgetEnforcer, parseSize } from './pro/budgets.js';

// License management
export { LicenseManager, ProLicenseError } from './license/manager.js';
export type { LicenseInfo, LicenseTier, ProFeature } from './license/manager.js';

// Compressors (re-exported)
export { ImageCompressor } from './compressors/image.js';
export { JsMinifier } from './compressors/js.js';
export { CssMinifier } from './compressors/css.js';
export { SvgOptimizer } from './compressors/svg.js';
export { LiquidProcessor } from './compressors/liquid.js';

// Utilities (re-exported)
export { FileCache } from './utils/cache.js';
export { logger, setLogLevel, getLogLevel } from './utils/logger.js';
export { Watcher } from './watcher.js';
export {
  getFileType,
  getFileSize,
  formatBytes,
  formatPercent,
  findFiles,
  groupFilesByType,
  isShopifyTheme,
} from './utils/files.js';

// Config
export { loadConfig, mergeConfig, defineConfig, defaultConfig } from './config/loader.js';

// Base types (re-exported)
export type {
  ShopifyCompressorConfig,
  ImageOptions,
  JsOptions,
  CssOptions,
  SvgOptions,
  LiquidOptions,
  CacheOptions,
  WatchOptions,
  CompressionResult,
  ImageCompressionResult,
  BundleResult,
  OptimizationReport,
  ImageFormat,
  OutputFormat,
} from './types.js';

// Pro types
export type {
  ShopifyCompressorProConfig,
  ProOptions,
  ParallelOptions,
  ReportOptions,
  ReportFormat,
  BudgetOptions,
  BudgetRule,
  BudgetResult,
  AdvancedImageOptions,
  ThumbnailPreset,
  CiOptions,
  ProOptimizationReport,
  ReportHistoryEntry,
  WorkerTask,
  WorkerResult,
} from './pro-types.js';

export type {
  WatchEvent,
  WatchEventType,
  WatchCallback,
  LogLevel,
  Logger,
} from './types.js';

export {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_JS_EXTENSIONS,
  SUPPORTED_CSS_EXTENSIONS,
  SUPPORTED_LIQUID_EXTENSIONS,
  SUPPORTED_SVG_EXTENSIONS,
} from './types.js';
