#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import ora from 'ora';

import { ShopifyCompressor } from './core.js';
import { loadConfig } from './config/loader.js';
import { logger, setLogLevel } from './utils/logger.js';
import { formatBytes, isShopifyTheme } from './utils/files.js';
import type { ShopifyCompressorConfig } from './types.js';

const VERSION = '2.0.0';

const program = new Command();

program
  .name('shopify-compressor')
  .description('A powerful asset compressor and optimizer for Shopify themes')
  .version(VERSION);

// Build command
program
  .command('build')
  .description('Build and compress all assets')
  .option('-i, --input <path>', 'Input directory or glob pattern', './input')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-c, --config <path>', 'Path to config file')
  .option('--clean', 'Clean output directory before build')
  .option('--no-cache', 'Disable caching')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--webp', 'Generate WebP variants for images')
  .option('--avif', 'Generate AVIF variants for images')
  .option('--no-minify', 'Disable minification')
  .action(async options => {
    try {
      if (options.verbose) {
        setLogLevel('debug');
      }

      // Load config file if exists
      const fileConfig = await loadConfig(options.config);

      // Merge with CLI options
      const config: Partial<ShopifyCompressorConfig> = {
        ...fileConfig,
        input: options.input || fileConfig?.input,
        output: options.output || fileConfig?.output,
        clean: options.clean ?? fileConfig?.clean,
        dryRun: options.dryRun ?? fileConfig?.dryRun,
        verbose: options.verbose ?? fileConfig?.verbose,
        cache: {
          ...fileConfig?.cache,
          enabled: options.cache !== false,
        },
        images: {
          ...fileConfig?.images,
          webp: options.webp ?? fileConfig?.images?.webp,
          avif: options.avif ?? fileConfig?.images?.avif,
        },
        js: {
          ...fileConfig?.js,
          minify: options.minify !== false,
        },
        css: {
          ...fileConfig?.css,
          minify: options.minify !== false,
        },
      };

      const compressor = new ShopifyCompressor(config);
      const report = await compressor.build();

      // Print summary
      console.log('');
      console.log('📊 Build Summary:');
      console.log(`   Files processed: ${report.totalFiles}`);
      console.log(`   Original size:   ${formatBytes(report.totalOriginalSize)}`);
      console.log(`   Compressed size: ${formatBytes(report.totalCompressedSize)}`);
      console.log(`   Total savings:   ${formatBytes(report.totalSavings)} (${(report.overallRatio * 100).toFixed(1)}%)`);
      console.log(`   Time:            ${(report.totalTime / 1000).toFixed(2)}s`);

      if (report.errors.length > 0) {
        console.log('');
        console.log('⚠️  Errors:');
        for (const error of report.errors) {
          console.log(`   ${error.file}: ${error.error}`);
        }
      }
    } catch (error) {
      logger.error(`Build failed: ${error}`);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch for file changes and rebuild automatically')
  .option('-i, --input <path>', 'Input directory to watch', './input')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async options => {
    try {
      if (options.verbose) {
        setLogLevel('debug');
      }

      const fileConfig = await loadConfig(options.config);
      const config: Partial<ShopifyCompressorConfig> = {
        ...fileConfig,
        input: options.input || fileConfig?.input,
        output: options.output || fileConfig?.output,
        verbose: options.verbose ?? fileConfig?.verbose,
        watch: {
          ...fileConfig?.watch,
          paths: [options.input || fileConfig?.input || './input'],
        },
      };

      const compressor = new ShopifyCompressor(config);
      await compressor.watch();

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n');
        logger.info('Stopping watch mode...');
        await compressor.stopWatch();
        process.exit(0);
      });
    } catch (error) {
      logger.error(`Watch failed: ${error}`);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a new shopify-compressor configuration')
  .option('-f, --force', 'Overwrite existing config file')
  .option('--shopify', 'Configure for Shopify theme directory structure')
  .action(async options => {
    const spinner = ora('Initializing configuration...').start();

    try {
      const configPath = join(process.cwd(), 'shopify-compressor.config.js');

      if (existsSync(configPath) && !options.force) {
        spinner.fail('Config file already exists. Use --force to overwrite.');
        process.exit(1);
      }

      // Detect if this is a Shopify theme
      const isTheme = options.shopify || isShopifyTheme(process.cwd());

      let configContent: string;

      if (isTheme) {
        configContent = `// Shopify Compressor Configuration
// Configured for Shopify theme development

/** @type {import('shopify-compressor').ShopifyCompressorConfig} */
export default {
  // Input: Shopify assets directory
  input: './assets',

  // Output: Processed assets (can be same as input for in-place optimization)
  output: './assets/dist',

  // Image optimization
  images: {
    quality: 80,
    webp: true,      // Generate WebP variants
    avif: false,     // Generate AVIF variants (better compression, less browser support)
    progressive: true,
    sizes: [480, 768, 1024, 1440], // Responsive image sizes
    lazyPlaceholder: true,
  },

  // JavaScript minification
  js: {
    minify: true,
    sourcemap: false,
    target: 'es2020',
    bundle: false,
  },

  // CSS/SCSS minification
  css: {
    minify: true,
    sourcemap: false,
  },

  // SVG optimization
  svg: {
    multipass: true,
    removeViewBox: false,
  },

  // Liquid processing (for snippet bundling)
  liquid: {
    globals: {
      // Add global Liquid variables here
    },
  },

  // Caching for faster rebuilds
  cache: {
    enabled: true,
    directory: '.shopify-compressor-cache',
  },

  // Watch mode settings
  watch: {
    paths: ['./assets'],
    ignore: ['**/node_modules/**', '**/dist/**'],
    debounce: 300,
  },

  // Build options
  verbose: false,
  clean: false,
};
`;
      } else {
        configContent = `// Shopify Compressor Configuration

/** @type {import('shopify-compressor').ShopifyCompressorConfig} */
export default {
  // Input directory or glob patterns
  input: './input',

  // Output directory
  output: './output',

  // Image optimization
  images: {
    quality: 80,
    webp: true,      // Generate WebP variants
    avif: false,     // Generate AVIF variants
    progressive: true,
    sizes: [],       // Responsive image sizes (e.g., [480, 768, 1024])
    lazyPlaceholder: false,
  },

  // JavaScript minification
  js: {
    minify: true,
    sourcemap: false,
    target: 'es2020',
    bundle: false,
    treeShaking: true,
  },

  // CSS/SCSS minification
  css: {
    minify: true,
    sourcemap: false,
    nesting: true,
  },

  // SVG optimization
  svg: {
    multipass: true,
    removeViewBox: false,
  },

  // Liquid templating
  liquid: {
    globals: {},
  },

  // Caching
  cache: {
    enabled: true,
    directory: '.shopify-compressor-cache',
  },

  // Watch mode
  watch: {
    paths: ['./input'],
    ignore: ['**/node_modules/**', '**/dist/**'],
    debounce: 300,
  },

  // Options
  verbose: false,
  dryRun: false,
  clean: false,
};
`;
      }

      await writeFile(configPath, configContent);
      spinner.succeed(`Created ${isTheme ? 'Shopify theme' : ''} config: shopify-compressor.config.js`);

      console.log('');
      console.log('Next steps:');
      console.log('  1. Edit shopify-compressor.config.js to match your project');
      console.log('  2. Run: npx shopify-compressor build');
      console.log('  3. Or watch mode: npx shopify-compressor watch');
    } catch (error) {
      spinner.fail(`Failed to create config: ${error}`);
      process.exit(1);
    }
  });

// Compress command (single file)
program
  .command('compress <input> [output]')
  .description('Compress a single file')
  .option('-q, --quality <number>', 'Quality (1-100)', '80')
  .option('--webp', 'Convert to WebP (images only)')
  .option('--avif', 'Convert to AVIF (images only)')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (input, output, options) => {
    try {
      if (options.verbose) {
        setLogLevel('debug');
      }

      const inputPath = resolve(input);
      const outputPath = output ? resolve(output) : inputPath.replace(/(\.[^.]+)$/, '.min$1');

      if (!existsSync(inputPath)) {
        logger.error(`File not found: ${inputPath}`);
        process.exit(1);
      }

      const compressor = new ShopifyCompressor({
        images: {
          quality: parseInt(options.quality, 10),
          webp: options.webp,
          avif: options.avif,
        },
      });

      const ext = inputPath.split('.').pop()?.toLowerCase();

      let result;
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'tiff'].includes(ext || '')) {
        result = await compressor.compressImage(inputPath, outputPath);
      } else if (['js', 'mjs', 'cjs', 'ts'].includes(ext || '')) {
        result = await compressor.minifyJs(inputPath, outputPath);
      } else if (['css', 'scss', 'sass'].includes(ext || '')) {
        result = await compressor.minifyCss(inputPath, outputPath);
      } else if (ext === 'svg') {
        result = await compressor.optimizeSvg(inputPath, outputPath);
      } else {
        logger.error(`Unsupported file type: ${ext}`);
        process.exit(1);
      }

      console.log('');
      console.log('✅ Compression complete:');
      console.log(`   Input:    ${result.input}`);
      console.log(`   Output:   ${result.output}`);
      console.log(`   Original: ${formatBytes(result.originalSize)}`);
      console.log(`   Compressed: ${formatBytes(result.compressedSize)}`);
      console.log(`   Savings:  ${formatBytes(result.savings)} (${(result.ratio * 100).toFixed(1)}%)`);
    } catch (error) {
      logger.error(`Compression failed: ${error}`);
      process.exit(1);
    }
  });

// Bundle command
program
  .command('bundle <type> <output>')
  .description('Bundle multiple files into one (js or css)')
  .argument('<files...>', 'Files to bundle')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (type, output, files, options) => {
    try {
      if (options.verbose) {
        setLogLevel('debug');
      }

      if (!['js', 'css'].includes(type)) {
        logger.error('Bundle type must be "js" or "css"');
        process.exit(1);
      }

      const inputPaths = files.map((f: string) => resolve(f));
      const outputPath = resolve(output);

      const compressor = new ShopifyCompressor();

      let result;
      if (type === 'js') {
        result = await compressor.bundleJs(inputPaths, outputPath);
      } else {
        result = await compressor.bundleCss(inputPaths, outputPath);
      }

      console.log('');
      console.log('✅ Bundle complete:');
      console.log(`   Files:    ${inputPaths.length}`);
      console.log(`   Output:   ${result.output}`);
      console.log(`   Original: ${formatBytes(result.originalSize)}`);
      console.log(`   Bundled:  ${formatBytes(result.compressedSize)}`);
      console.log(`   Savings:  ${formatBytes(result.savings)} (${(result.ratio * 100).toFixed(1)}%)`);
    } catch (error) {
      logger.error(`Bundle failed: ${error}`);
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show information about the current project')
  .action(async () => {
    console.log('');
    console.log('📦 Shopify Compressor v' + VERSION);
    console.log('');

    // Check for config file
    const config = await loadConfig();
    if (config) {
      console.log('✅ Config file found');
      console.log(`   Input:  ${config.input}`);
      console.log(`   Output: ${config.output}`);
    } else {
      console.log('⚠️  No config file found');
      console.log('   Run: shopify-compressor init');
    }

    console.log('');

    // Check if Shopify theme
    if (isShopifyTheme(process.cwd())) {
      console.log('🎨 Shopify theme detected');
    }

    console.log('');
    console.log('Supported formats:');
    console.log('   Images: jpg, jpeg, png, webp, avif, gif, tiff');
    console.log('   Scripts: js, mjs, cjs, ts, mts, cts');
    console.log('   Styles: css, scss, sass');
    console.log('   Other: svg, liquid');
  });

// Parse arguments
program.parse();
