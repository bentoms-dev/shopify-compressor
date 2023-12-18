const sharp = require('sharp');

class ProgressiveImageLoader {
  constructor(options = {}) {
    this.options = options;
  }

  async makeProgressive(inputPath, outputPath) {
    const result = await sharp(inputPath)
      .jpeg({ progressive: true, quality: this.options.quality || 85 })
      .toFile(outputPath);

    return result;
  }
}

module.exports = ProgressiveImageLoader;
