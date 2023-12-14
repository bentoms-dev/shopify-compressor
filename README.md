 # Shopify Compressor

A simple JavaScript bundler with support for Liquid, CSS, and SCSS files.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Sample Files](#sample-files)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This project is a JavaScript bundler that allows you to compress and bundle JavaScript, Liquid, CSS, and SCSS files into a single output file for Shopify. It utilizes UglifyJS for JavaScript minification, LiquidJS for processing Liquid files, and node-sass for compiling SCSS to CSS.

## Features

- Bundles and compresses Shopify files such as  JavaScript, Liquid, CSS, and SCSS files.
- Support for Liquid templating in HTML files.
- Easily configurable and extendable for additional file types.

## Installation

To use this bundler in your project, you can install it via npm. Run the following command:

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

#License

This project is licensed under the MIT License - see the LICENSE file for details.



