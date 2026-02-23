import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../pro/reports.js';
import type { ProOptimizationReport } from '../pro-types.js';

describe('ReportGenerator', () => {
  const mockReport: ProOptimizationReport = {
    totalFiles: 4,
    totalOriginalSize: 680000,
    totalCompressedSize: 270000,
    totalSavings: 410000,
    overallRatio: 0.603,
    totalTime: 2350,
    byType: {
      images: [
        {
          input: 'src/hero.jpg',
          output: 'dist/hero.jpg',
          originalSize: 500000,
          compressedSize: 200000,
          savings: 300000,
          ratio: 0.6,
          time: 100,
        },
      ],
      js: [
        {
          input: 'src/app.js',
          output: 'dist/app.js',
          originalSize: 100000,
          compressedSize: 40000,
          savings: 60000,
          ratio: 0.6,
          time: 50,
        },
        {
          input: 'src/utils.js',
          output: 'dist/utils.js',
          originalSize: 50000,
          compressedSize: 20000,
          savings: 30000,
          ratio: 0.6,
          time: 30,
        },
      ],
      css: [
        {
          input: 'src/styles.css',
          output: 'dist/styles.css',
          originalSize: 30000,
          compressedSize: 10000,
          savings: 20000,
          ratio: 0.667,
          time: 20,
        },
      ],
    },
    errors: [],
    budgets: [
      {
        rule: { pattern: 'js', maxTotalSize: '100KB' },
        passed: true,
        actual: { totalSize: 60000 },
        limit: { totalSize: 102400 },
        message: 'Total size 58.59 KB within budget of 100KB',
      },
    ],
    budgetsPassed: true,
    meta: {
      timestamp: '2026-02-10T12:00:00.000Z',
      version: '1.0.0',
      licenseTier: 'individual',
      nodeVersion: 'v20.0.0',
      platform: 'darwin',
      concurrency: 4,
    },
  };

  describe('constructor', () => {
    it('should create with default options', () => {
      const gen = new ReportGenerator();
      expect(gen).toBeDefined();
    });

    it('should create with custom options', () => {
      const gen = new ReportGenerator({
        formats: ['json', 'markdown'],
        outputDir: './custom-reports',
      });
      expect(gen).toBeDefined();
    });
  });

  describe('generateMarkdown (via generate)', () => {
    // We can't easily test file writing, but we can test the generator
    // doesn't throw with valid input
    it('should not throw with valid report', async () => {
      const gen = new ReportGenerator({
        enabled: true,
        formats: ['json'],
        outputDir: '/tmp/scomp-test-reports-' + Date.now(),
        history: false,
      });

      // Should not throw
      const outputs = await gen.generate(mockReport);
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toContain('.json');
    });
  });

  describe('disabled generator', () => {
    it('should return empty array when disabled', async () => {
      const gen = new ReportGenerator({ enabled: false });
      const outputs = await gen.generate(mockReport);
      expect(outputs).toEqual([]);
    });
  });
});
