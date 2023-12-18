// index.js
const ShopifyCompressor = require('shopify-compressor');
const Liquid = require('liquidjs');
const path = require('path');

// Initialize the compressor
const compressor = new ShopifyCompressor();

// Initialize Liquid templating engine
const engine = new Liquid();

// Input and output directories
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

// Sample JavaScript files to bundle
const jsFiles = [
  path.join(inputDir, 'file1.js'),
  path.join(inputDir, 'file2.js'),
];

// Sample Liquid file
const liquidFile = path.join(inputDir, 'file3.liquid');
const outputHtmlFile = path.join(outputDir, 'output.html');

// Compress and bundle JavaScript files
(async () => {
  try {
    const bundleOutput = path.join(outputDir, 'bundle.js');
    await compressor.bundleJavaScript(jsFiles, bundleOutput);
    console.log(`JavaScript files bundled successfully. Output: ${bundleOutput}`);

    // Process Liquid file
    const liquidContent = await compressor.readContent(liquidFile);
    const renderedHtml = await engine.parseAndRender(liquidContent);

    await compressor.writeContent(outputHtmlFile, renderedHtml);

    console.log(`Liquid file processed successfully. Output: ${outputHtmlFile}`);

    // Sample images to compress
    const imageFiles = [
      path.join(inputDir, 'image1.jpg'),
      path.join(inputDir, 'image2.png'),
    ];

    // Compress images
    const compressedImages = await compressor.compressImages(imageFiles, outputDir);
    console.log('Images compressed successfully. Details:', compressedImages);

    // Additional optimizations
    await compressor.minifyCss(path.join(inputDir, 'styles.css'), path.join(outputDir, 'styles.min.css'));
    await compressor.minifyJs(path.join(inputDir, 'script.js'), path.join(outputDir, 'script.min.js'));

    // Image format conversion
    await compressor.convertImage(path.join(inputDir, 'logo.png'), path.join(outputDir, 'logo.webp'), 'webp', { quality: 80 });

    // Responsive image generation
    await compressor.generateResponsiveImage(path.join(inputDir, 'hero.jpg'), path.join(outputDir, 'hero-responsive.jpg'), [480, 768, 1024]);

    // Asset versioning
    await compressor.versionAssets(path.join(inputDir, 'assets'), outputDir);

    // Image optimization reports
    const optimizationReport = await compressor.getOptimizationReport(imageFiles);
    console.log('Image optimization report:', optimizationReport);
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
