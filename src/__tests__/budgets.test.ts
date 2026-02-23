import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetEnforcer, parseSize } from '../pro/budgets.js';
import type { CompressionResult } from '../types.js';

describe('parseSize', () => {
  it('should parse bytes', () => {
    expect(parseSize('100B')).toBe(100);
    expect(parseSize('100Bytes')).toBe(100);
  });

  it('should parse kilobytes', () => {
    expect(parseSize('50KB')).toBe(50 * 1024);
    expect(parseSize('1.5KB')).toBe(Math.round(1.5 * 1024));
  });

  it('should parse megabytes', () => {
    expect(parseSize('1MB')).toBe(1024 * 1024);
    expect(parseSize('2.5MB')).toBe(Math.round(2.5 * 1024 * 1024));
  });

  it('should parse gigabytes', () => {
    expect(parseSize('1GB')).toBe(1024 * 1024 * 1024);
  });

  it('should be case-insensitive', () => {
    expect(parseSize('50kb')).toBe(50 * 1024);
    expect(parseSize('50Kb')).toBe(50 * 1024);
  });

  it('should handle whitespace', () => {
    expect(parseSize('  50 KB  ')).toBe(50 * 1024);
  });

  it('should throw on invalid format', () => {
    expect(() => parseSize('abc')).toThrow('Invalid size format');
    expect(() => parseSize('')).toThrow('Invalid size format');
  });

  it('should throw on unknown unit', () => {
    expect(() => parseSize('50XB')).toThrow('Unknown size unit');
  });
});

describe('BudgetEnforcer', () => {
  const mockResults: CompressionResult[] = [
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
    {
      input: 'src/styles.css',
      output: 'dist/styles.css',
      originalSize: 30000,
      compressedSize: 10000,
      savings: 20000,
      ratio: 0.667,
      time: 20,
    },
    {
      input: 'src/hero.jpg',
      output: 'dist/hero.jpg',
      originalSize: 500000,
      compressedSize: 200000,
      savings: 300000,
      ratio: 0.6,
      time: 100,
    },
  ];

  it('should return empty results when disabled', () => {
    const enforcer = new BudgetEnforcer({ enabled: false });
    const results = enforcer.evaluate(mockResults);
    expect(results).toEqual([]);
  });

  it('should return empty results when no rules', () => {
    const enforcer = new BudgetEnforcer({ enabled: true, rules: [] });
    const results = enforcer.evaluate(mockResults);
    expect(results).toEqual([]);
  });

  it('should pass when total JS size is within budget', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxTotalSize: '100KB' }],
    });
    // 40000 + 20000 = 60000 < 102400
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('should fail when total JS size exceeds budget', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxTotalSize: '50KB' }],
    });
    // 40000 + 20000 = 60000 > 51200
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('should check maxFileSize per individual file', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxFileSize: '30KB' }],
    });
    // largest JS file is 40000 > 30720
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('should check maxFiles count', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxFiles: 1 }],
    });
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('should check minCompressionRatio', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: '*', minCompressionRatio: 0.5 }],
    });
    // all files have ratio >= 0.6
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('should fail minCompressionRatio when too low', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: '*', minCompressionRatio: 0.7 }],
    });
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('should match by extension pattern', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: '*.css', maxTotalSize: '5KB' }],
    });
    // CSS is 10000 > 5120
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });

  it('should evaluate multiple rules', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [
        { pattern: 'js', maxTotalSize: '100KB' },
        { pattern: 'css', maxTotalSize: '5KB' },
      ],
    });
    const results = enforcer.evaluate(mockResults);
    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true); // JS passes
    expect(results[1].passed).toBe(false); // CSS fails
  });

  it('allPassed should return true when all pass', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxTotalSize: '100KB' }],
    });
    const results = enforcer.evaluate(mockResults);
    expect(enforcer.allPassed(results)).toBe(true);
  });

  it('allPassed should return false when any fail', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      rules: [{ pattern: 'js', maxTotalSize: '10KB' }],
    });
    const results = enforcer.evaluate(mockResults);
    expect(enforcer.allPassed(results)).toBe(false);
  });

  it('shouldFail should respect failOnExceed setting', () => {
    const enforcer = new BudgetEnforcer({
      enabled: true,
      failOnExceed: false,
      rules: [{ pattern: 'js', maxTotalSize: '10KB' }],
    });
    const results = enforcer.evaluate(mockResults);
    expect(enforcer.shouldFail(results)).toBe(false);
  });
});
