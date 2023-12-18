const sharp = require('sharp');

class LazyLoader {
  constructor(options = {}) {
    this.options = options;
  }

  async makeLazy(inputPath, outputPath) {
    const result = await sharp(inputPath)
      .resize(this.options.width, this.options.height)
      .blur(this.options.blur)
      .toFile(outputPath);

    return result;
  }
}

module.exports = LazyLoader;
