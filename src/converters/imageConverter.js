const sharp = require('sharp');

class ImageConverter {
  constructor(options = {}) {
    this.options = options;
  }

  async convert(inputPath, outputPath) {
    const { format, quality } = this.options;
    const supportedFormats = ['jpeg', 'png', 'webp'];

    if (!format || !supportedFormats.includes(format)) {
      throw new Error(`Unsupported image format: ${format}`);
    }

    const result = await sharp(inputPath)
      .toFormat(format, { quality: quality || 85 })
      .toFile(outputPath);

    return result;
  }
}

module.exports = ImageConverter;
