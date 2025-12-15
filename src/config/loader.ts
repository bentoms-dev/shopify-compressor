import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';
import type { ShopifyCompressorConfig } from '../types.js';

const CONFIG_FILES = [
  'shopify-compressor.config.js',
  'shopify-compressor.config.mjs',
  'shopify-compressor.config.cjs',
  'shopify-compressor.config.ts',
  '.shopifycompressorrc',
  '.shopifycompressorrc.json',
  '.shopifycompressorrc.js',
];

/**
 * Default configuration
 */
export const defaultConfig: Partial<ShopifyCompressorConfig> = {
  images: {
    quality: 80,
    webp: true,
    avif: false,
    progressive: true,
    lazyPlaceholder: false,
    placeholderBlur: 20,
  },
  js: {
    minify: true,
    sourcemap: false,
    target: 'es2020',
    bundle: false,
    treeShaking: true,
  },
  css: {
    minify: true,
    sourcemap: false,
    nesting: true,
  },
  svg: {
    multipass: true,
    removeViewBox: false,
  },
  liquid: {
    globals: {},
  },
  cache: {
    enabled: true,
    directory: '.shopify-compressor-cache',
  },
  watch: {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    debounce: 300,
  },
  verbose: false,
  dryRun: false,
  clean: false,
};

/**
 * Load configuration from file
 */
export async function loadConfig(
  configPath?: string,
  cwd: string = process.cwd()
): Promise<ShopifyCompressorConfig | null> {
  // If specific config path provided, load it
  if (configPath) {
    const fullPath = resolve(cwd, configPath);
    if (!existsSync(fullPath)) {
      logger.warn(`Config file not found: ${fullPath}`);
      return null;
    }
    return loadConfigFile(fullPath);
  }

  // Search for config file in cwd
  for (const filename of CONFIG_FILES) {
    const fullPath = join(cwd, filename);
    if (existsSync(fullPath)) {
      logger.debug(`Found config file: ${fullPath}`);
      return loadConfigFile(fullPath);
    }
  }

  logger.debug('No config file found, using defaults');
  return null;
}

/**
 * Load a specific config file
 */
async function loadConfigFile(filePath: string): Promise<ShopifyCompressorConfig> {
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (ext === 'json' || filePath.endsWith('rc')) {
    // JSON config
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  if (ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'ts') {
    // JavaScript/TypeScript config
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    return module.default || module;
  }

  throw new Error(`Unsupported config file format: ${filePath}`);
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig: Partial<ShopifyCompressorConfig>
): ShopifyCompressorConfig {
  return {
    input: userConfig.input || './input',
    output: userConfig.output || './output',
    images: { ...defaultConfig.images, ...userConfig.images },
    js: { ...defaultConfig.js, ...userConfig.js },
    css: { ...defaultConfig.css, ...userConfig.css },
    svg: { ...defaultConfig.svg, ...userConfig.svg },
    liquid: { ...defaultConfig.liquid, ...userConfig.liquid },
    cache: { ...defaultConfig.cache, ...userConfig.cache },
    watch: { ...defaultConfig.watch, ...userConfig.watch },
    verbose: userConfig.verbose ?? defaultConfig.verbose,
    dryRun: userConfig.dryRun ?? defaultConfig.dryRun,
    clean: userConfig.clean ?? defaultConfig.clean,
  };
}

/**
 * Define a config (for type hints in JS config files)
 */
export function defineConfig(
  config: Partial<ShopifyCompressorConfig>
): Partial<ShopifyCompressorConfig> {
  return config;
}

export default { loadConfig, mergeConfig, defineConfig, defaultConfig };
