const imagemin = require('imagemin');
const imageminWebp = require('imagemin-webp');

class ImageCompressor {
  constructor(options = {}) {
    this.options = options;
  }

  async compress(inputPath, outputPath) {
    const result = await imagemin([inputPath], {
      destination: outputPath,
      plugins: [
        imageminWebp(this.options.webp || { quality: 75 }),
        // Add other image optimization plugins as needed
      ],
    });

    return result;
  }
}

module.exports = ImageCompressor;
