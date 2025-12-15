import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ShopifyCompressor } from '../core.js';

const TEST_DIR = join(process.cwd(), '.test-temp');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

describe('ShopifyCompressor', () => {
  beforeEach(async () => {
    // Create test directories
    await mkdir(INPUT_DIR, { recursive: true });
    await mkdir(OUTPUT_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true });
    }
  });

  describe('JavaScript minification', () => {
    it('should minify JavaScript files', async () => {
      // Create a test JS file
      const inputPath = join(INPUT_DIR, 'test.js');
      const outputPath = join(OUTPUT_DIR, 'test.js');

      await writeFile(
        inputPath,
        `
        function hello(name) {
          const greeting = "Hello, " + name + "!";
          console.log(greeting);
          return greeting;
        }

        hello("World");
      `
      );

      const compressor = new ShopifyCompressor();
      const result = await compressor.minifyJs(inputPath, outputPath);

      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(existsSync(outputPath)).toBe(true);

      const minified = await readFile(outputPath, 'utf-8');
      expect(minified).not.toContain('const greeting');
    });
  });

  describe('CSS minification', () => {
    it('should minify CSS files', async () => {
      const inputPath = join(INPUT_DIR, 'test.css');
      const outputPath = join(OUTPUT_DIR, 'test.css');

      await writeFile(
        inputPath,
        `
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }

        .title {
          font-size: 24px;
          color: #333333;
          margin-bottom: 10px;
        }
      `
      );

      const compressor = new ShopifyCompressor();
      const result = await compressor.minifyCss(inputPath, outputPath);

      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const compressor = new ShopifyCompressor();
      const config = compressor.getConfig();

      expect(config.images?.quality).toBe(80);
      expect(config.images?.webp).toBe(true);
      expect(config.js?.minify).toBe(true);
      expect(config.css?.minify).toBe(true);
    });

    it('should merge user config with defaults', () => {
      const compressor = new ShopifyCompressor({
        images: { quality: 90, avif: true },
        js: { minify: false },
      });
      const config = compressor.getConfig();

      expect(config.images?.quality).toBe(90);
      expect(config.images?.avif).toBe(true);
      expect(config.images?.webp).toBe(true); // Default preserved
      expect(config.js?.minify).toBe(false);
    });
  });

  describe('Cache', () => {
    it('should track cache stats', () => {
      const compressor = new ShopifyCompressor({
        cache: { enabled: true },
      });

      const stats = compressor.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.entries).toBe(0);
    });

    it('should clear cache', () => {
      const compressor = new ShopifyCompressor();
      compressor.clearCache();
      const stats = compressor.getCacheStats();
      expect(stats.entries).toBe(0);
    });
  });
});
