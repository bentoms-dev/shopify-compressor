const zlib = require('zlib');
const { createReadStream, createWriteStream } = require('fs');

class StreamingCompressor {
  constructor(options = {}) {
    this.options = options;
  }

  async compress(inputPath, outputPath) {
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);
    const compressStream = zlib.createGzip(this.options);

    await pipelineAsync(readStream, compressStream, writeStream);

    return { input: inputPath, output: outputPath };
  }
}

module.exports = StreamingCompressor;
