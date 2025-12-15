/**
 * Shopify Compressor v2.0.0
 * A powerful asset compressor and optimizer for Shopify themes
 *
 * @packageDocumentation
 */

// Main class
export { ShopifyCompressor, ShopifyCompressor as default } from './core.js';

// Compressors
export { ImageCompressor } from './compressors/image.js';
export { JsMinifier } from './compressors/js.js';
export { CssMinifier } from './compressors/css.js';
export { SvgOptimizer } from './compressors/svg.js';
export { LiquidProcessor } from './compressors/liquid.js';

// Utilities
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

// Types
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
