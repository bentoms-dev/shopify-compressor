const { promisify } = require('util');
const { cpus } = require('os');
const { pipeline } = require('stream');

const pipelineAsync = promisify(pipeline);

class ParallelProcessor {
  constructor(options = {}) {
    this.options = options;
    this.concurrency = options.concurrency || cpus().length;
  }

  async process(inputs, transformFunction, outputDirectory) {
    const promises = inputs.map(async (input) => {
      const output = `${outputDirectory}/${input.name}`;

      await pipelineAsync(
        fs.createReadStream(input.path),
        transformFunction(input.options),
        fs.createWriteStream(output)
      );

      return { input, output };
    });

    return Promise.all(promises);
  }
}

module.exports = ParallelProcessor;
