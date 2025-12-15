import { describe, it, expect } from 'vitest';
import { mergeConfig, defaultConfig } from '../config/loader.js';

describe('Config loader', () => {
  describe('mergeConfig', () => {
    it('should use defaults for missing values', () => {
      const config = mergeConfig({ input: './src', output: './dist' });

      expect(config.input).toBe('./src');
      expect(config.output).toBe('./dist');
      expect(config.images?.quality).toBe(defaultConfig.images?.quality);
      expect(config.js?.minify).toBe(defaultConfig.js?.minify);
    });

    it('should override defaults with user values', () => {
      const config = mergeConfig({
        input: './assets',
        output: './build',
        images: { quality: 90, avif: true },
        js: { minify: false },
      });

      expect(config.images?.quality).toBe(90);
      expect(config.images?.avif).toBe(true);
      expect(config.images?.webp).toBe(true); // Default preserved
      expect(config.js?.minify).toBe(false);
    });

    it('should handle nested options correctly', () => {
      const config = mergeConfig({
        input: './input',
        output: './output',
        cache: { enabled: false },
        watch: { debounce: 500 },
      });

      expect(config.cache?.enabled).toBe(false);
      expect(config.cache?.directory).toBe(defaultConfig.cache?.directory);
      expect(config.watch?.debounce).toBe(500);
      expect(config.watch?.ignore).toEqual(defaultConfig.watch?.ignore);
    });
  });

  describe('defaultConfig', () => {
    it('should have sensible defaults', () => {
      expect(defaultConfig.images?.quality).toBeGreaterThan(0);
      expect(defaultConfig.images?.quality).toBeLessThanOrEqual(100);
      expect(defaultConfig.js?.minify).toBe(true);
      expect(defaultConfig.css?.minify).toBe(true);
      expect(defaultConfig.cache?.enabled).toBe(true);
    });
  });
});
