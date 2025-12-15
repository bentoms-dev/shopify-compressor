// Shopify Compressor Configuration

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
