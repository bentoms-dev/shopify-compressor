// index.js

const fs = require('fs');
const UglifyJS = require('uglify-js');
const Liquid = require('liquidjs');
const sass = require('node-sass');

function compileSassToCss(sassContent) {
  return sass.renderSync({ data: sassContent }).css.toString();
}

function bundleAndCompress(inputFiles, outputFile) {
  const liquid = new Liquid();

  const files = inputFiles.map((filename) => {
    const content = fs.readFileSync(filename, 'utf8');

    if (filename.endsWith('.liquid')) {
      return liquid.parseAndRenderSync(content);
    } else if (filename.endsWith('.scss')) {
      return compileSassToCss(content);
    }

    return content;
  });

  const result = UglifyJS.minify(files);

  if (result.error) {
    console.error('Error during bundling and compression:', result.error);
    process.exit(1);
  }

  fs.writeFileSync(outputFile, result.code);
  console.log('Your Shopify files have been succecssfully compiled.');
}

module.exports = bundleAndCompress;
