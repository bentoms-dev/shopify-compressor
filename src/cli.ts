#!/usr/bin/env node

/**
 * Shopify Compressor Pro - CLI
 *
 * Extends the base CLI with Pro features:
 * - License activation/deactivation/status
 * - Parallel processing flags
 * - Report generation flags
 * - Asset budget enforcement
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import ora from 'ora';

import { ShopifyCompressorPro } from './pro-core.js';
import { LicenseManager } from './license/manager.js';
import { loadConfig } from './config/loader.js';
import { logger, setLogLevel } from './utils/logger.js';
import { formatBytes, isShopifyTheme } from './utils/files.js';
import type { ShopifyCompressorProConfig } from './pro-types.js';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('shopify-compressor-pro')
  .description(
    'Shopify Compressor Pro — Advanced asset optimization for Shopify themes'
  )
  .version(VERSION);

// ============================================
// License Commands
// ============================================

program
  .command('activate <license-key>')
  .description('Activate a Pro license key on this machine')
  .action(async (licenseKey: string) => {
    const spinner = ora('Activating license...').start();

    try {
      const manager = new LicenseManager();
      const info = await manager.activate(licenseKey);

      spinner.succeed('License activated successfully!');
      console.log('');
      console.log(`  License:  ${info.key}`);
      console.log(`  Tier:     ${info.tier}`);
      if (info.email) console.log(`  Email:    ${info.email}`);
      if (info.expiresAt) {
        console.log(`  Expires:  ${new Date(info.expiresAt).toLocaleDateString()}`);
      } else {
        console.log('  Expires:  Never (lifetime)');
      }
      console.log('');
      console.log('You can now use all Pro features. Run: scomp-pro build');
    } catch (error) {
      spinner.fail(`Activation failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('deactivate')
  .description('Deactivate the Pro license on this machine')
  .action(async () => {
    const spinner = ora('Deactivating license...').start();

    try {
      const manager = new LicenseManager();
      await manager.load();
      await manager.deactivate();

      spinner.succeed('License deactivated and removed from this machine.');
    } catch (error) {
      spinner.fail(`Deactivation failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show license status and Pro feature availability')
  .action(async () => {
    const manager = new LicenseManager();
    const loaded = await manager.load();

    console.log('');
    console.log('🔑 Shopify Compressor Pro — License Status');
    console.log('');

    if (!loaded) {
      console.log('  Status:  ❌ No license found');
      console.log('');
      console.log('  Activate with: scomp-pro activate <license-key>');
      console.log('  Purchase at:   https://bentoms.lemonsqueezy.com/checkout/buy/783054c3-a94d-4260-bd7e-129b20e18e3e');
      return;
    }

    const valid = await manager.validate();
    const info = manager.getLicenseInfo();

    if (info) {
      console.log(`  Status:  ${valid ? '✅ Active' : '❌ Invalid'}`);
      console.log(`  Key:     ${info.key}`);
      console.log(`  Tier:    ${info.tier}`);
      if (info.email) console.log(`  Email:   ${info.email}`);
      if (info.expiresAt) {
        const expiry = new Date(info.expiresAt);
        const daysLeft = Math.ceil(
          (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        console.log(`  Expires: ${expiry.toLocaleDateString()} (${daysLeft} days)`);
      } else {
        console.log('  Expires: Never (lifetime)');
      }
      console.log(
        `  Last OK: ${new Date(info.lastValidated).toLocaleString()}`
      );
    }

    console.log('');
    console.log('  Available Features:');

    const features = [
      { name: 'Parallel Processing', key: 'parallel-processing' as const },
      { name: 'HTML Reports', key: 'html-reports' as const },
      { name: 'JSON Reports', key: 'json-reports' as const },
      { name: 'Asset Budgets', key: 'asset-budgets' as const },
      { name: 'Advanced Images', key: 'advanced-image-pipeline' as const },
      { name: 'CI Integration', key: 'ci-integration' as const },
      { name: 'Critical CSS', key: 'critical-css' as const },
      { name: 'Dead Code Detection', key: 'dead-code-detection' as const },
      { name: 'Liquid Optimization', key: 'liquid-optimization' as const },
      { name: 'Dependency Graph', key: 'dependency-graph' as const },
    ];

    for (const f of features) {
      const available = manager.isFeatureAvailable(f.key);
      console.log(`    ${available ? '✅' : '🔒'} ${f.name}`);
    }

    console.log('');
  });

// ============================================
// Build Command (Pro)
// ============================================

program
  .command('build')
  .description('Build and compress all assets with Pro features')
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
  // Pro-specific flags
  .option('--theme', 'Force Shopify theme mode (copies full theme structure)')
  .option('--parallel', 'Enable parallel processing (Pro)')
  .option('--concurrency <n>', 'Number of parallel workers (Pro)', parseInt)
  .option('--report [formats]', 'Generate build reports: html,json,markdown (Pro)')
  .option('--report-dir <path>', 'Report output directory (Pro)', './reports')
  .option(
    '--budget <rules>',
    'Asset budgets in format "type:maxSize" e.g. "js:50KB,css:30KB" (Pro)'
  )
  .option('--fail-on-budget', 'Fail build if asset budgets are exceeded (Pro)')
  .action(async options => {
    try {
      if (options.verbose) {
        setLogLevel('debug');
      }

      // Auto-detect Shopify theme directory or use --theme flag
      const cwd = process.cwd();
      const isTheme = options.theme || isShopifyTheme(cwd);
      const defaultInput = isTheme ? '.' : './input';
      const defaultOutput = isTheme ? './dist' : './output';

      if (isTheme) {
        logger.info(
          'Shopify theme mode — building complete deployable theme'
        );
      }

      // Load config file if exists
      const fileConfig = (await loadConfig(options.config)) as
        | Partial<ShopifyCompressorProConfig>
        | null;

      // Parse report formats
      let reportFormats: string[] | undefined;
      if (options.report) {
        reportFormats =
          typeof options.report === 'string'
            ? options.report.split(',')
            : ['html'];
      }

      // Parse budget rules from CLI
      interface ParsedBudgetRule {
        pattern: string;
        maxTotalSize: string;
      }
      let budgetRules: ParsedBudgetRule[] | undefined;

      if (options.budget) {
        budgetRules = (options.budget as string).split(',').map((rule: string) => {
          const [pattern, maxSize] = rule.split(':');
          return { pattern, maxTotalSize: maxSize };
        });
      }

      // Merge with CLI options
      const config: Partial<ShopifyCompressorProConfig> = {
        ...fileConfig,
        input: options.input || fileConfig?.input || defaultInput,
        output: options.output || fileConfig?.output || defaultOutput,
        clean: options.clean ?? fileConfig?.clean,
        dryRun: options.dryRun ?? fileConfig?.dryRun,
        verbose: options.verbose ?? fileConfig?.verbose,
        themeMode: isTheme,
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
        pro: {
          ...fileConfig?.pro,
          parallel: {
            ...fileConfig?.pro?.parallel,
            enabled:
              options.parallel ?? fileConfig?.pro?.parallel?.enabled ?? true,
            concurrency:
              options.concurrency ?? fileConfig?.pro?.parallel?.concurrency,
          },
          reports: reportFormats
            ? {
              enabled: true,
              formats: reportFormats as ('html' | 'json' | 'markdown')[],
              outputDir: options.reportDir,
              ...fileConfig?.pro?.reports,
            }
            : fileConfig?.pro?.reports,
          budgets: budgetRules
            ? {
              enabled: true,
              failOnExceed: options.failOnBudget ?? true,
              rules: budgetRules,
            }
            : fileConfig?.pro?.budgets,
        },
      };

      const compressor = new ShopifyCompressorPro(config);
      const report = await compressor.build();

      // Print summary
      console.log('');
      console.log('📊 Pro Build Summary:');
      console.log(`   Files processed: ${report.totalFiles}`);
      console.log(
        `   Original size:   ${formatBytes(report.totalOriginalSize)}`
      );
      console.log(
        `   Compressed size: ${formatBytes(report.totalCompressedSize)}`
      );
      console.log(
        `   Total savings:   ${formatBytes(report.totalSavings)} (${(report.overallRatio * 100).toFixed(1)}%)`
      );
      console.log(
        `   Time:            ${(report.totalTime / 1000).toFixed(2)}s`
      );

      if (report.meta) {
        console.log(`   Concurrency:     ${report.meta.concurrency} workers`);
      }

      if (isTheme) {
        console.log('');
        console.log(`🎨 Deploy-ready theme: ${config.output}`);
        console.log(`   Deploy: shopify theme push --path=${config.output}`);
      }

      // Budget summary
      if (report.budgets && report.budgets.length > 0) {
        console.log('');
        console.log(
          `💰 Budgets: ${report.budgetsPassed ? '✅ All passed' : '❌ Some exceeded'}`
        );
        for (const budget of report.budgets) {
          console.log(
            `   ${budget.passed ? '✅' : '❌'} ${budget.rule.pattern}: ${budget.message}`
          );
        }
      }

      if (report.errors.length > 0) {
        console.log('');
        console.log('⚠️  Errors:');
        for (const error of report.errors) {
          console.log(`   ${error.file}: ${error.error}`);
        }
      }

      // Exit with error if budgets failed
      if (report.budgets && !report.budgetsPassed) {
        const proConfig = config.pro?.budgets;
        if (proConfig?.failOnExceed) {
          process.exit(1);
        }
      }
    } catch (error) {
      logger.error(`Build failed: ${error}`);
      process.exit(1);
    }
  });

// ============================================
// Watch Command
// ============================================

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
      const config: Partial<ShopifyCompressorProConfig> = {
        ...fileConfig,
        input: options.input || fileConfig?.input,
        output: options.output || fileConfig?.output,
        verbose: options.verbose ?? fileConfig?.verbose,
        watch: {
          ...fileConfig?.watch,
          paths: [options.input || fileConfig?.input || './input'],
        },
      };

      const compressor = new ShopifyCompressorPro(config);
      await compressor.watch();

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

// ============================================
// Init Command
// ============================================

program
  .command('init')
  .description('Initialize a new shopify-compressor-pro configuration')
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

      const isTheme = options.shopify || isShopifyTheme(process.cwd());

      const configContent = `// Shopify Compressor Pro Configuration
${isTheme ? '// Configured for Shopify theme development\n' : ''}
/** @type {import('shopify-compressor-pro').ShopifyCompressorProConfig} */
export default {
  input: '${isTheme ? '.' : './input'}',
  output: '${isTheme ? './dist' : './output'}',
  ${isTheme ? 'themeMode: true,  // Builds a complete deployable theme in output\n' : ''}

  images: {
    quality: 80,
    webp: true,
    avif: false,
    progressive: true,${isTheme ? "\n    sizes: [480, 768, 1024, 1440]," : "\n    sizes: [],"}
    lazyPlaceholder: ${isTheme ? 'true' : 'false'},
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
    paths: ['${isTheme ? '.' : './input'}'],
    ignore: ['**/node_modules/**', '**/dist/**'],
    debounce: 300,
  },

  // ⚡ Pro Features
  pro: {
    parallel: {
      enabled: true,
    },

    reports: {
      enabled: true,
      formats: ['html'],
      outputDir: './reports',
      history: true,
    },

    budgets: {
      enabled: false,
      failOnExceed: true,
      rules: [
        // { pattern: 'js', maxTotalSize: '100KB' },
        // { pattern: 'css', maxTotalSize: '50KB' },
        // { pattern: 'images', maxFileSize: '500KB' },
      ],
    },
  },

  verbose: false,
  dryRun: false,
  clean: false,
};
`;

      await writeFile(configPath, configContent);
      spinner.succeed(
        `Created ${isTheme ? 'Shopify theme ' : ''}Pro config: shopify-compressor.config.js`
      );

      console.log('');
      console.log('Next steps:');
      console.log('  1. Activate your license: scomp-pro activate <key>');
      console.log('  2. Edit shopify-compressor.config.js to match your project');
      console.log('  3. Run: scomp-pro build');
      console.log('  4. Or watch mode: scomp-pro watch');
    } catch (error) {
      spinner.fail(`Failed to create config: ${error}`);
      process.exit(1);
    }
  });

// ============================================
// Compress Command (single file)
// ============================================

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
      const outputPath = output
        ? resolve(output)
        : inputPath.replace(/(\.[^.]+)$/, '.min$1');

      if (!existsSync(inputPath)) {
        logger.error(`File not found: ${inputPath}`);
        process.exit(1);
      }

      const compressor = new ShopifyCompressorPro({
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
      console.log(
        `   Savings:  ${formatBytes(result.savings)} (${(result.ratio * 100).toFixed(1)}%)`
      );
    } catch (error) {
      logger.error(`Compression failed: ${error}`);
      process.exit(1);
    }
  });

// ============================================
// Bundle Command
// ============================================

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

      const compressor = new ShopifyCompressorPro();

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
      console.log(
        `   Savings:  ${formatBytes(result.savings)} (${(result.ratio * 100).toFixed(1)}%)`
      );
    } catch (error) {
      logger.error(`Bundle failed: ${error}`);
      process.exit(1);
    }
  });

// ============================================
// Info Command
// ============================================

program
  .command('info')
  .description('Show information about the current project and Pro license')
  .action(async () => {
    console.log('');
    console.log('📦 Shopify Compressor Pro v' + VERSION);
    console.log('');

    // License status
    const manager = new LicenseManager();
    const loaded = await manager.load();
    if (loaded) {
      const valid = await manager.validate();
      const info = manager.getLicenseInfo();
      console.log(
        `🔑 License: ${valid ? '✅ Active' : '❌ Invalid'} (${info?.tier || 'unknown'} tier)`
      );
    } else {
      console.log('🔑 License: Not activated');
    }

    // Check for config file
    const config = await loadConfig();
    if (config) {
      console.log('✅ Config file found');
      console.log(`   Input:  ${config.input}`);
      console.log(`   Output: ${config.output}`);
    } else {
      console.log('⚠️  No config file found');
      console.log('   Run: scomp-pro init');
    }

    console.log('');

    if (isShopifyTheme(process.cwd())) {
      console.log('🎨 Shopify theme detected');
    }

    console.log('');
    console.log('Supported formats:');
    console.log('   Images: jpg, jpeg, png, webp, avif, gif, tiff');
    console.log('   Scripts: js, mjs, cjs, ts, mts, cts');
    console.log('   Styles: css, scss, sass');
    console.log('   Other: svg, liquid, json');
    console.log('');
    console.log('Pro features:');
    console.log('   ⚡ Parallel processing');
    console.log('   📊 HTML/JSON/Markdown build reports');
    console.log('   💰 Asset budget enforcement');
    console.log('   🔄 Build-over-build history');
  });

// Parse arguments
program.parse();
