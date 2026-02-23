/**
 * Shopify Compressor - Type Definitions
 */

// ============================================
// Configuration Types
// ============================================

export interface ImageOptions {
  /** Output quality (1-100) */
  quality?: number;
  /** Generate WebP versions */
  webp?: boolean;
  /** Generate AVIF versions */
  avif?: boolean;
  /** Responsive image sizes to generate */
  sizes?: number[];
  /** Enable progressive loading */
  progressive?: boolean;
  /** Enable lazy load placeholder generation */
  lazyPlaceholder?: boolean;
  /** Placeholder blur amount */
  placeholderBlur?: number;
}

export interface JsOptions {
  /** Enable minification */
  minify?: boolean;
  /** Enable source maps */
  sourcemap?: boolean;
  /** Target environment */
  target?: string;
  /** Bundle all imports */
  bundle?: boolean;
  /** Enable tree shaking */
  treeShaking?: boolean;
}

export interface CssOptions {
  /** Enable minification */
  minify?: boolean;
  /** Enable source maps */
  sourcemap?: boolean;
  /** Browser targets for autoprefixer */
  targets?: string[];
  /** Enable CSS nesting */
  nesting?: boolean;
}

export interface SvgOptions {
  /** Enable multipass optimization */
  multipass?: boolean;
  /** Plugins to use */
  plugins?: string[];
  /** Remove viewBox attribute */
  removeViewBox?: boolean;
}

export interface LiquidOptions {
  /** Liquid globals */
  globals?: Record<string, unknown>;
  /** Custom filters */
  filters?: Record<string, (...args: unknown[]) => unknown>;
  /** Custom tags */
  tags?: Record<string, unknown>;
}

export interface CacheOptions {
  /** Enable caching */
  enabled?: boolean;
  /** Cache directory */
  directory?: string;
}

export interface WatchOptions {
  /** Directories to watch */
  paths?: string[];
  /** File patterns to ignore */
  ignore?: string[];
  /** Debounce delay in ms */
  debounce?: number;
}

export interface ShopifyCompressorConfig {
  /** Input directory or files */
  input: string | string[];
  /** Output directory */
  output: string;
  /** Image optimization options */
  images?: ImageOptions;
  /** JavaScript options */
  js?: JsOptions;
  /** CSS options */
  css?: CssOptions;
  /** SVG options */
  svg?: SvgOptions;
  /** Liquid templating options */
  liquid?: LiquidOptions;
  /** Caching options */
  cache?: CacheOptions;
  /** Watch mode options */
  watch?: WatchOptions;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Dry run mode - don't write files */
  dryRun?: boolean;
  /** Clean output directory before build */
  clean?: boolean;
  /** Theme mode - copy full Shopify theme structure, compressing supported files */
  themeMode?: boolean;
}

// ============================================
// Result Types
// ============================================

export interface CompressionResult {
  /** Input file path */
  input: string;
  /** Output file path */
  output: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes */
  compressedSize: number;
  /** Compression ratio (0-1) */
  ratio: number;
  /** Savings in bytes */
  savings: number;
  /** Processing time in ms */
  time: number;
}

export interface ImageCompressionResult extends CompressionResult {
  /** Image format */
  format: string;
  /** Original dimensions */
  originalDimensions: { width: number; height: number };
  /** Output dimensions */
  outputDimensions: { width: number; height: number };
  /** Generated variants (WebP, AVIF, responsive sizes) */
  variants?: CompressionResult[];
}

export interface BundleResult {
  /** Output file path */
  output: string;
  /** Input files that were bundled */
  inputs: string[];
  /** Total original size */
  originalSize: number;
  /** Final bundle size */
  bundleSize: number;
  /** Processing time in ms */
  time: number;
}

export interface OptimizationReport {
  /** Total files processed */
  totalFiles: number;
  /** Total original size in bytes */
  totalOriginalSize: number;
  /** Total compressed size in bytes */
  totalCompressedSize: number;
  /** Overall savings in bytes */
  totalSavings: number;
  /** Overall compression ratio */
  overallRatio: number;
  /** Total processing time in ms */
  totalTime: number;
  /** Results by file type */
  byType: {
    images?: CompressionResult[];
    js?: CompressionResult[];
    css?: CompressionResult[];
    svg?: CompressionResult[];
    liquid?: CompressionResult[];
    json?: CompressionResult[];
  };
  /** Any errors encountered */
  errors: Array<{ file: string; error: string }>;
}

// ============================================
// Supported Formats
// ============================================

export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff';
export type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export const SUPPORTED_IMAGE_FORMATS: ImageFormat[] = [
  'jpeg',
  'jpg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
];

export const SUPPORTED_JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
export const SUPPORTED_CSS_EXTENSIONS = ['.css', '.scss', '.sass'];
export const SUPPORTED_LIQUID_EXTENSIONS = ['.liquid'];
export const SUPPORTED_SVG_EXTENSIONS = ['.svg'];
export const SUPPORTED_JSON_EXTENSIONS = ['.json'];

// ============================================
// Event Types (for watch mode)
// ============================================

export type WatchEventType = 'add' | 'change' | 'unlink';

export interface WatchEvent {
  type: WatchEventType;
  path: string;
  timestamp: Date;
}

export type WatchCallback = (event: WatchEvent) => void | Promise<void>;

// ============================================
// Logger Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  success: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
