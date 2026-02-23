import { describe, it, expect } from 'vitest';
import {
  getFileType,
  formatBytes,
  formatPercent,
  calculateSavings,
  groupFilesByType,
} from '../utils/files.js';

describe('File utilities', () => {
  describe('getFileType', () => {
    it('should identify image files', () => {
      expect(getFileType('photo.jpg')).toBe('image');
      expect(getFileType('photo.jpeg')).toBe('image');
      expect(getFileType('icon.png')).toBe('image');
      expect(getFileType('hero.webp')).toBe('image');
      expect(getFileType('banner.avif')).toBe('image');
      expect(getFileType('animation.gif')).toBe('image');
    });

    it('should identify JavaScript files', () => {
      expect(getFileType('app.js')).toBe('js');
      expect(getFileType('module.mjs')).toBe('js');
      expect(getFileType('util.cjs')).toBe('js');
      expect(getFileType('types.ts')).toBe('js');
    });

    it('should identify CSS files', () => {
      expect(getFileType('styles.css')).toBe('css');
      expect(getFileType('theme.scss')).toBe('css');
      expect(getFileType('base.sass')).toBe('css');
    });

    it('should identify SVG files', () => {
      expect(getFileType('icon.svg')).toBe('svg');
    });

    it('should identify Liquid files', () => {
      expect(getFileType('product.liquid')).toBe('liquid');
    });

    it('should identify JSON files', () => {
      expect(getFileType('data.json')).toBe('json');
    });

    it('should return unknown for unsupported files', () => {
      expect(getFileType('readme.md')).toBe('unknown');
      expect(getFileType('readme.txt')).toBe('unknown');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(500)).toBe('500 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('formatPercent', () => {
    it('should format percentages correctly', () => {
      expect(formatPercent(0)).toBe('0.0%');
      expect(formatPercent(0.5)).toBe('50.0%');
      expect(formatPercent(1)).toBe('100.0%');
      expect(formatPercent(0.333)).toBe('33.3%');
    });
  });

  describe('calculateSavings', () => {
    it('should calculate savings correctly', () => {
      const result = calculateSavings(1000, 700);
      expect(result.savings).toBe(300);
      expect(result.ratio).toBe(0.3);
    });

    it('should handle zero original size', () => {
      const result = calculateSavings(0, 0);
      expect(result.savings).toBe(0);
      expect(result.ratio).toBe(0);
    });
  });

  describe('groupFilesByType', () => {
    it('should group files by type', () => {
      const files = [
        'image.jpg',
        'image.png',
        'script.js',
        'styles.css',
        'icon.svg',
        'template.liquid',
        'readme.md',
      ];

      const groups = groupFilesByType(files);

      expect(groups.image).toEqual(['image.jpg', 'image.png']);
      expect(groups.js).toEqual(['script.js']);
      expect(groups.css).toEqual(['styles.css']);
      expect(groups.svg).toEqual(['icon.svg']);
      expect(groups.liquid).toEqual(['template.liquid']);
      expect(groups.unknown).toEqual(['readme.md']);
    });
  });
});
