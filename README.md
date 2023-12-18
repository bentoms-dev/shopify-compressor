# Shopify Compressor

A versatile asset compressor for Shopify, supporting various file types and bundling features.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Sample Files](#sample-files)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Shopify Compressor is an asset compressor designed for Shopify projects. It offers a range of features to bundle and compress JavaScript, Liquid, CSS, and SCSS files into a single output file, improving performance and optimizing assets for Shopify stores. It leverages popular tools such as UglifyJS, LiquidJS, and node-sass for efficient file processing.

## Features

- Bundles and compresses JavaScript, Liquid, CSS, and SCSS files.
- Support for Liquid templating in HTML files.
- Image conversion to WebP format for improved image optimization.
- Quality adjustment for image compression.
- Responsive image generation for various screen sizes.
- CSS and JS minification for smaller file sizes.
- Asset versioning for cache busting.
- Configurable compression levels for different asset types.
- Image optimization reports for detailed insights.

## Installation

Install the Shopify Compressor in your project using npm:

```bash
npm install shopify-compressor
```

## Usage

After installation, you can use the bundler in your project by running the following command

```bash
npm run bundle input/*.js input/*.liquid input/*.css input/*.scss output/bundle.js
```
Adjust the input and output file paths based on your project structure.

## Sample Files

The input directory includes sample files for testing:

* file1.js: Sample JavaScript file.
* file2.js: Another sample JavaScript file.
* file3.liquid: Sample Liquid file.
* styles.css: Sample CSS file.
* styles.scss: Sample SCSS file.

Feel free to use these files for testing and experimentation.

# Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

# License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/bentoms-dev/shopify-compressor/blob/master/LICENSE) file for details.



