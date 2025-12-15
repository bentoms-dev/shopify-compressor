<p align="center">
  <img src="sc-cover.jpg" alt="Shopify Compressor" width="100%">
</p>

# Shopify Compressor

A powerful, modern asset compressor and optimizer for Shopify themes. Supports WebP, AVIF, CSS/JS minification, SVG optimization, and Liquid templating.

[![npm version](https://img.shields.io/npm/v/shopify-compressor.svg)](https://www.npmjs.com/package/shopify-compressor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## Features

- **Modern Image Formats** - WebP and AVIF conversion with quality control
- **Responsive Images** - Auto-generate multiple sizes for srcset
- **Lightning Fast** - Uses esbuild for JS and LightningCSS for CSS
- **SCSS/Sass Support** - Built-in Sass compilation
- **SVG Optimization** - SVGO integration for smaller SVGs
- **Liquid Templates** - Process Shopify Liquid files with custom filters
- **Watch Mode** - Auto-rebuild on file changes
- **Smart Caching** - Skip unchanged files for faster builds
- **CLI & API** - Use from command line or programmatically
- **TypeScript** - Full type definitions included

## Installation

```bash
npm install shopify-compressor
```

Or use directly with npx:

```bash
npx shopify-compressor build
```

## Quick Start

### CLI Usage

```bash
# Initialize configuration
npx shopify-compressor init

# Build all assets
npx shopify-compressor build

# Watch for changes
npx shopify-compressor watch

# Compress a single file
npx shopify-compressor compress image.png output.webp

# Bundle JavaScript files
npx shopify-compressor bundle js bundle.js src/*.js
```

### Programmatic Usage

```javascript
import { ShopifyCompressor } from 'shopify-compressor';

const compressor = new ShopifyCompressor({
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
});

// Run full build
const report = await compressor.build();
console.log(`Saved ${report.totalSavings} bytes!`);

// Or process individual files
await compressor.compressImage('hero.jpg', 'hero.webp');
await compressor.minifyJs('app.js', 'app.min.js');
await compressor.minifyCss('styles.scss', 'styles.min.css');
```

## Configuration

Create a `shopify-compressor.config.js` file in your project root:

```javascript
/** @type {import('shopify-compressor').ShopifyCompressorConfig} */
export default {
  // Input directory or glob patterns
  input: './assets',

  // Output directory
  output: './assets/dist',

  // Image optimization
  images: {
    quality: 80,           // 1-100
    webp: true,            // Generate WebP variants
    avif: false,           // Generate AVIF variants
    progressive: true,     // Progressive JPEGs
    sizes: [480, 768, 1024], // Responsive sizes
    lazyPlaceholder: true, // Generate blur placeholders
  },

  // JavaScript
  js: {
    minify: true,
    sourcemap: false,
    target: 'es2020',
    bundle: false,
    treeShaking: true,
  },

  // CSS/SCSS
  css: {
    minify: true,
    sourcemap: false,
    nesting: true,
  },

  // SVG
  svg: {
    multipass: true,
    removeViewBox: false,
  },

  // Liquid
  liquid: {
    globals: {
      shop_name: 'My Store',
    },
  },

  // Caching
  cache: {
    enabled: true,
    directory: '.shopify-compressor-cache',
  },

  // Watch mode
  watch: {
    paths: ['./assets'],
    ignore: ['**/node_modules/**'],
    debounce: 300,
  },

  // Options
  verbose: false,
  dryRun: false,
  clean: false,
};
```

## CLI Commands

### `build`

Build and compress all assets.

```bash
shopify-compressor build [options]

Options:
  -i, --input <path>    Input directory (default: "./input")
  -o, --output <path>   Output directory (default: "./output")
  -c, --config <path>   Path to config file
  --clean               Clean output directory before build
  --no-cache            Disable caching
  --dry-run             Preview changes without writing
  -v, --verbose         Enable verbose logging
  --webp                Generate WebP variants
  --avif                Generate AVIF variants
  --no-minify           Disable minification
```

### `watch`

Watch for file changes and rebuild automatically.

```bash
shopify-compressor watch [options]

Options:
  -i, --input <path>    Input directory to watch
  -o, --output <path>   Output directory
  -c, --config <path>   Path to config file
  -v, --verbose         Enable verbose logging
```

### `compress`

Compress a single file.

```bash
shopify-compressor compress <input> [output] [options]

Options:
  -q, --quality <n>     Quality 1-100 (default: 80)
  --webp                Convert to WebP
  --avif                Convert to AVIF
```

### `bundle`

Bundle multiple files into one.

```bash
shopify-compressor bundle <js|css> <output> <files...>

Examples:
  shopify-compressor bundle js bundle.js src/a.js src/b.js
  shopify-compressor bundle css styles.css src/*.css
```

### `init`

Initialize a new configuration file.

```bash
shopify-compressor init [options]

Options:
  -f, --force     Overwrite existing config
  --shopify       Configure for Shopify theme structure
```

## API Reference

### ShopifyCompressor

Main class for asset compression.

```typescript
import { ShopifyCompressor } from 'shopify-compressor';

const compressor = new ShopifyCompressor(config);

// Full build
await compressor.build();

// Watch mode
await compressor.watch();
await compressor.stopWatch();

// Individual operations
await compressor.compressImage(input, output);
await compressor.minifyJs(input, output);
await compressor.bundleJs([...files], output);
await compressor.minifyCss(input, output);
await compressor.bundleCss([...files], output);
await compressor.optimizeSvg(input, output);
await compressor.processLiquidFile(input, output, data);

// Utilities
compressor.getConfig();
compressor.getCacheStats();
compressor.clearCache();
```

### Individual Compressors

Use specific compressors for fine-grained control:

```typescript
import {
  ImageCompressor,
  JsMinifier,
  CssMinifier,
  SvgOptimizer,
  LiquidProcessor,
} from 'shopify-compressor';

// Image compression with AVIF
const imageCompressor = new ImageCompressor({ quality: 85, avif: true });
await imageCompressor.compress('photo.jpg', 'photo.avif');

// JavaScript bundling
const jsMinifier = new JsMinifier({ bundle: true });
await jsMinifier.bundle(['a.js', 'b.js'], 'bundle.js');

// SCSS compilation
const cssMinifier = new CssMinifier();
await cssMinifier.minify('styles.scss', 'styles.min.css');

// SVG optimization
const svgOptimizer = new SvgOptimizer();
const dataUrl = await svgOptimizer.toDataUrl('icon.svg');

// Liquid rendering
const liquid = new LiquidProcessor({ globals: { shop: 'My Store' } });
const html = await liquid.render('Hello {{ shop }}!');
```

## Shopify Theme Integration

For Shopify theme development, use the `--shopify` flag when initializing:

```bash
npx shopify-compressor init --shopify
```

This configures optimal settings for Shopify's asset structure and includes Shopify-specific Liquid filters like `asset_url`, `img_url`, `money`, etc.

### Recommended Shopify Workflow

```javascript
// shopify-compressor.config.js
export default {
  input: './assets',
  output: './assets/dist',
  images: {
    webp: true,
    sizes: [480, 768, 1024, 1440],
    lazyPlaceholder: true,
  },
  watch: {
    paths: ['./assets'],
  },
};
```

Then in your Liquid templates:

```liquid
{% comment %} Use responsive images {% endcomment %}
<img
  src="{{ 'hero.jpg' | asset_url }}"
  srcset="
    {{ 'hero-480w.jpg' | asset_url }} 480w,
    {{ 'hero-768w.jpg' | asset_url }} 768w,
    {{ 'hero-1024w.jpg' | asset_url }} 1024w
  "
  loading="lazy"
/>

{% comment %} Use WebP with fallback {% endcomment %}
<picture>
  <source srcset="{{ 'hero.webp' | asset_url }}" type="image/webp">
  <img src="{{ 'hero.jpg' | asset_url }}" alt="Hero">
</picture>
```

## Build Reports

After each build, you'll see a detailed report:

```
✔ Build complete! Processed 42 files in 2.35s

 Build Summary:
   Files processed: 42
   Original size:   2.4 MB
   Compressed size: 890 KB
   Total savings:   1.51 MB (63%)
   Time:            2.35s
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [esbuild](https://esbuild.github.io/) - Extremely fast JavaScript bundler
- [LightningCSS](https://lightningcss.dev/) - Blazing fast CSS parser and transformer
- [SVGO](https://github.com/svg/svgo) - SVG optimizer
- [LiquidJS](https://liquidjs.com/) - Liquid template engine

---

Made with ❤️ by [Ben Toms](https://github.com/bentoms-dev)



