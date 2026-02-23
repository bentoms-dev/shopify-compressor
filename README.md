<p align="center">
  <img src="sc-cover.jpg" alt="Shopify Compressor Pro" width="100%">
</p>

# Shopify Compressor Pro

Advanced asset optimiwation for Shopify themes. Everything in the [free version](https://github.com/bentoms-dev/shopify-compressor), plus parallel processing, rich build reports, asset budgets, and more.

[![npm version](https://img.shields.io/npm/v/shopify-compressor-pro.svg)](https://www.npmjs.com/package/shopify-compressor-pro)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## Free vs Pro

| Feature | Free | Pro |
|---------|:----:|:---:|
| Image compression (WebP, AVIF) | ✅ | ✅ |
| JS/CSS minification (esbuild + LightningCSS) | ✅ | ✅ |
| SCSS/Sass compilation | ✅ | ✅ |
| SVG optimisation (SVGO) | ✅ | ✅ |
| Liquid template processing | ✅ | ✅ |
| Watch mode | ✅ | ✅ |
| Smart file caching | ✅ | ✅ |
| CLI + programmatic API | ✅ | ✅ |
| **Parallel processing** | ❌ | ✅ |
| **HTML / JSON / Markdown reports** | ❌ | ✅ |
| **Asset budget enforcement** | ❌ | ✅ |
| **Build-over-build history** | ❌ | ✅ |
| **CI/CD integration** | ❌ | ✅ (Team+) |
| **Critical CSS extraction** | ❌ | ✅ (Team+) |
| **Dead code detection** | ❌ | ✅ (Enterprise) |

## Installation

```bash
npm install shopify-compressor-pro
```

## License Activation

Purchase a license at [bentoms.lemonsqueezy.com](https://bentoms.lemonsqueezy.com/checkout/buy/783054c3-a94d-4260-bd7e-129b20e18e3e), then:

```bash
# Activate on this machine
scomp-pro activate <your-license-key>

# Check status
scomp-pro status

# Deactivate (to transfer to another machine)
scomp-pro deactivate
```

You can also set the `SCOMP_PRO_LICENSE_KEY` environment variable for CI/CD.

## Quick Start

### CLI Usage

```bash
# Initialize a Pro config file
scomp-pro init

# Build with parallel processing + HTML report
scomp-pro build --report html

# Build with asset budgets
scomp-pro build --budget "js:50KB,css:30KB" --fail-on-budget

# Watch for changes
scomp-pro watch

# Compress a single file
scomp-pro compress hero.png hero.webp

# Bundle JavaScript
scomp-pro bundle js bundle.js src/*.js
```

### Programmatic Usage

```javascript
import { ShopifyCompressorPro } from 'shopify-compressor-pro';

const compressor = new ShopifyCompressorPro({
  input: './assets',
  output: './dist',
  images: {
    quality: 80,
    webp: true,
    avif: true,
    sizes: [480, 768, 1024],
  },
  js: { minify: true },
  css: { minify: true },

  // Pro features
  pro: {
    parallel: {
      enabled: true,
      concurrency: 4,
    },
    reports: {
      enabled: true,
      formats: ['html', 'json'],
      outputDir: './reports',
      history: true,
    },
    budgets: {
      enabled: true,
      failOnExceed: true,
      rules: [
        { pattern: 'js', maxTotalSize: '100KB' },
        { pattern: 'css', maxTotalSize: '50KB' },
        { pattern: 'images', maxFileSize: '500KB' },
        { pattern: '*', minCompressionRatio: 0.1 },
      ],
    },
  },
});

const report = await compressor.build();

console.log(`Processed ${report.totalFiles} files`);
console.log(`Saved ${report.totalSavings} bytes`);
console.log(`Budgets: ${report.budgetsPassed ? 'All passed' : 'Some exceeded'}`);
```

## Configuration

Create a `shopify-compressor.config.js` file (run `scomp-pro init` to generate one):

```javascript
/** @type {import('shopify-compressor-pro').ShopifyCompressorProConfig} */
export default {
  input: './assets',
  output: './assets/dist',

  // All standard options from shopify-compressor...
  images: { quality: 80, webp: true },
  js: { minify: true },
  css: { minify: true },
  svg: { multipass: true },

  // ⚡ Pro features
  pro: {
    // Parallel processing — uses all available CPU cores
    parallel: {
      enabled: true,
      // concurrency: 4,  // Set manually, or defaults to CPU count - 1
    },

    // Build reports
    reports: {
      enabled: true,
      formats: ['html'],           // 'html', 'json', 'markdown'
      outputDir: './reports',
      history: true,                // Track build-over-build changes
    },

    // Asset budgets — enforce size limits
    budgets: {
      enabled: true,
      failOnExceed: true,           // Exit code 1 if exceeded (great for CI)
      rules: [
        { pattern: 'js', maxTotalSize: '100KB' },
        { pattern: 'css', maxTotalSize: '50KB' },
        { pattern: 'images', maxFileSize: '500KB' },
        { pattern: '*.js', maxFileSize: '30KB' },
        { pattern: '*', minCompressionRatio: 0.1 },
      ],
    },
  },
};
```

## Pro Features

### Parallel Processing

Processes files concurrently across multiple CPU cores. On a typical 8-core machine, expect **3-5x faster builds** on large themes with 100+ assets.

```bash
# CLI
scomp-pro build --parallel --concurrency 8

# Config
pro: {
  parallel: { enabled: true, concurrency: 8 }
}
```

### Build Reports

Generate rich HTML dashboards, JSON data, or Markdown summaries after each build.

```bash
# HTML report
scomp-pro build --report html

# Multiple formats
scomp-pro build --report html,json,markdown

# Custom output directory
scomp-pro build --report html --report-dir ./build-reports
```

The HTML report includes:
- Overall compression summary with visual stats
- File-by-file breakdown with savings bars
- Per-type analysis (images, JS, CSS, SVG, Liquid)
- Build-over-build comparison (size deltas)
- Budget pass/fail status

### Asset Budgets

Define maximum sizes per file type and fail CI builds when exceeded.

```bash
# CLI shorthand
scomp-pro build --budget "js:50KB,css:30KB" --fail-on-budget

# Config (more flexible)
pro: {
  budgets: {
    enabled: true,
    failOnExceed: true,
    rules: [
      { pattern: 'js', maxTotalSize: '100KB' },
      { pattern: 'css', maxTotalSize: '50KB' },
      { pattern: 'images', maxFileSize: '500KB' },
      { pattern: '*.js', maxFileSize: '30KB' },
      { pattern: '*', minCompressionRatio: 0.1 },
      { pattern: 'images', maxFiles: 50 },
    ],
  },
}
```

Budget rules support:
- `maxTotalSize` — Maximum combined size for all matched files
- `maxFileSize` — Maximum size for any individual file
- `maxFiles` — Maximum number of files
- `minCompressionRatio` — Minimum compression ratio (0–1)

Patterns: `js`, `css`, `images`, `svg`, `liquid`, `*.ext`, `*` (all), or glob paths.

### CI/CD Integration

Set the license key as an environment variable:

```yaml
# GitHub Actions
env:
  SCOMP_PRO_LICENSE_KEY: ${{ secrets.SCOMP_PRO_KEY }}

steps:
  - run: npx shopify-compressor-pro build --report json --budget "js:100KB,css:50KB" --fail-on-budget
```

```yaml
# GitLab CI
variables:
  SCOMP_PRO_LICENSE_KEY: $SCOMP_PRO_KEY

build:
  script:
    - npx shopify-compressor-pro build --report json --fail-on-budget
```

## CLI Commands

### License Management

| Command | Description |
|---------|-------------|
| `scomp-pro activate <key>` | Activate a license key |
| `scomp-pro deactivate` | Deactivate and remove license |
| `scomp-pro status` | Show license status and features |

### Build & Process

| Command | Description |
|---------|-------------|
| `scomp-pro build [options]` | Build all assets with Pro features |
| `scomp-pro watch [options]` | Watch and rebuild on changes |
| `scomp-pro compress <input> [output]` | Compress a single file |
| `scomp-pro bundle <js\|css> <output> <files...>` | Bundle files |
| `scomp-pro init [--shopify]` | Generate config file |
| `scomp-pro info` | Show project/license info |

### Pro Build Options

| Flag | Description |
|------|-------------|
| `--parallel` | Enable parallel processing |
| `--concurrency <n>` | Number of workers |
| `--report [formats]` | Generate reports (html,json,markdown) |
| `--report-dir <path>` | Report output directory |
| `--budget <rules>` | Asset budgets (e.g. `js:50KB,css:30KB`) |
| `--fail-on-budget` | Exit code 1 on budget exceed |

## API Reference

### ShopifyCompressorPro

```typescript
import { ShopifyCompressorPro } from 'shopify-compressor-pro';

const pro = new ShopifyCompressorPro(config);

// License
await pro.activate('LICENSE-KEY');
await pro.deactivate();
pro.getLicenseInfo();

// Build (with parallel + reports + budgets)
const report = await pro.build();

// Watch
await pro.watch();
await pro.stopWatch();

// Individual operations (same as base)
await pro.compressImage(input, output);
await pro.minifyJs(input, output);
await pro.bundleJs([...files], output);
await pro.minifyCss(input, output);
await pro.bundleCss([...files], output);
await pro.optimizeSvg(input, output);
await pro.processLiquidFile(input, output, data);
```

### Pro-specific APIs

```typescript
import {
  ParallelProcessor,
  ReportGenerator,
  BudgetEnforcer,
  LicenseManager,
} from 'shopify-compressor-pro';
```

## License Tiers

| | Individual | Team | Enterprise |
|---|:---:|:---:|:---:|
| **Price** | €29/year | €99/year | €249/year |
| **Machines** | 3 | 10 | Unlimited |
| Parallel processing | ✅ | ✅ | ✅ |
| Build reports | ✅ | ✅ | ✅ |
| Asset budgets | ✅ | ✅ | ✅ |
| CI/CD integration | ❌ | ✅ | ✅ |
| Critical CSS | ❌ | ✅ | ✅ |
| Dead code detection | ❌ | ❌ | ✅ |
| Liquid optimisation | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

Purchase at [bentoms.lemonsqueezy.com](https://bentoms.lemonsqueezy.com/checkout/buy/783054c3-a94d-4260-bd7e-129b20e18e3e)

## License

This is proprietary software. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built on top of [shopify-compressor](https://github.com/bentoms-dev/shopify-compressor) (MIT).

- [sharp](https://sharp.pixelplumbing.com/) — High-performance image processing
- [esbuild](https://esbuild.github.io/) — Extremely fast JavaScript bundler
- [LightningCSS](https://lightningcss.dev/) — Blazing fast CSS transformer
- [SVGO](https://github.com/svg/svgo) — SVG optimizer
- [LiquidJS](https://liquidjs.com/) — Liquid template engine

---

Made with ❤️ by [Ben Toms](https://github.com/bentoms-dev)
