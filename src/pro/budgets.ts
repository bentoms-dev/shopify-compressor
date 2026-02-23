/**
 * Shopify Compressor Pro - Asset Budget Enforcer
 *
 * Define size/count budgets per file type and fail builds when exceeded.
 */

import { logger } from '../utils/logger.js';
import { formatBytes } from '../utils/files.js';
import type { CompressionResult } from '../types.js';
import type { BudgetOptions, BudgetRule, BudgetResult } from '../pro-types.js';

// ============================================
// Size Parser
// ============================================

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  bytes: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

/**
 * Parse a human-readable size string to bytes
 * e.g. '50KB' -> 51200, '1.5MB' -> 1572864
 */
export function parseSize(sizeStr: string): number {
  const match = sizeStr.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) {
    throw new Error(`Invalid size format: "${sizeStr}". Use formats like "50KB", "1MB", "512B".`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (!(unit in SIZE_UNITS)) {
    throw new Error(`Unknown size unit: "${match[2]}". Use B, KB, MB, or GB.`);
  }

  return Math.round(value * SIZE_UNITS[unit]);
}

// ============================================
// Budget Enforcer
// ============================================

export class BudgetEnforcer {
  private options: Required<BudgetOptions>;

  constructor(options: BudgetOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      failOnExceed: options.failOnExceed ?? true,
      rules: options.rules ?? [],
    };
  }

  /**
   * Evaluate all budget rules against the build results
   */
  evaluate(results: CompressionResult[]): BudgetResult[] {
    if (!this.options.enabled || this.options.rules.length === 0) {
      return [];
    }

    const budgetResults: BudgetResult[] = [];

    for (const rule of this.options.rules) {
      const matched = this.matchFiles(results, rule.pattern);
      const result = this.evaluateRule(rule, matched);
      budgetResults.push(result);

      if (result.passed) {
        logger.debug(`✅ Budget passed: ${rule.pattern} — ${result.message}`);
      } else {
        logger.warn(`❌ Budget exceeded: ${rule.pattern} — ${result.message}`);
      }
    }

    return budgetResults;
  }

  /**
   * Check if all budgets passed
   */
  allPassed(results: BudgetResult[]): boolean {
    return results.every(r => r.passed);
  }

  /**
   * Should the build fail?
   */
  shouldFail(results: BudgetResult[]): boolean {
    return this.options.failOnExceed && !this.allPassed(results);
  }

  // ==========================================
  // Private
  // ==========================================

  /**
   * Match files against a pattern
   * Supports: 'images', 'js', 'css', 'svg', 'liquid', '*.ext', or glob-like
   */
  private matchFiles(results: CompressionResult[], pattern: string): CompressionResult[] {
    const lowerPattern = pattern.toLowerCase();

    // Match by type keyword
    const typePatterns: Record<string, string[]> = {
      images: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff'],
      js: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
      css: ['.css', '.scss', '.sass'],
      svg: ['.svg'],
      liquid: ['.liquid'],
    };

    if (lowerPattern in typePatterns) {
      const extensions = typePatterns[lowerPattern];
      return results.filter(r =>
        extensions.some(ext => r.output.toLowerCase().endsWith(ext))
      );
    }

    // Match by extension (e.g. '*.js')
    if (lowerPattern.startsWith('*.')) {
      const ext = lowerPattern.slice(1); // '.js'
      return results.filter(r => r.output.toLowerCase().endsWith(ext));
    }

    // Match by glob-like path pattern
    if (lowerPattern.includes('*') || lowerPattern.includes('/')) {
      const regex = this.globToRegex(lowerPattern);
      return results.filter(r => regex.test(r.output));
    }

    // Match all
    if (lowerPattern === '*' || lowerPattern === 'all') {
      return results;
    }

    return [];
  }

  /**
   * Evaluate a single budget rule
   */
  private evaluateRule(rule: BudgetRule, files: CompressionResult[]): BudgetResult {
    const messages: string[] = [];
    let passed = true;

    const actual: BudgetResult['actual'] = {};
    const limit: BudgetResult['limit'] = {};

    // Check max total size
    if (rule.maxTotalSize) {
      const maxBytes = parseSize(rule.maxTotalSize);
      const totalSize = files.reduce((sum, f) => sum + f.compressedSize, 0);
      actual.totalSize = totalSize;
      limit.totalSize = maxBytes;

      if (totalSize > maxBytes) {
        passed = false;
        messages.push(
          `Total size ${formatBytes(totalSize)} exceeds budget of ${rule.maxTotalSize}`
        );
      } else {
        messages.push(
          `Total size ${formatBytes(totalSize)} within budget of ${rule.maxTotalSize}`
        );
      }
    }

    // Check max individual file size
    if (rule.maxFileSize) {
      const maxBytes = parseSize(rule.maxFileSize);
      const largest = files.reduce(
        (max, f) => (f.compressedSize > max.compressedSize ? f : max),
        files[0] || { compressedSize: 0, output: '' }
      );
      actual.maxFileSize = largest.compressedSize;
      limit.maxFileSize = maxBytes;

      if (largest.compressedSize > maxBytes) {
        passed = false;
        messages.push(
          `File "${largest.output}" (${formatBytes(largest.compressedSize)}) exceeds per-file budget of ${rule.maxFileSize}`
        );
      } else {
        messages.push(
          `Largest file ${formatBytes(largest.compressedSize)} within per-file budget of ${rule.maxFileSize}`
        );
      }
    }

    // Check max file count
    if (rule.maxFiles !== undefined) {
      actual.fileCount = files.length;
      limit.maxFiles = rule.maxFiles;

      if (files.length > rule.maxFiles) {
        passed = false;
        messages.push(`${files.length} files exceeds max of ${rule.maxFiles}`);
      } else {
        messages.push(`${files.length} files within max of ${rule.maxFiles}`);
      }
    }

    // Check minimum compression ratio
    if (rule.minCompressionRatio !== undefined) {
      const totalOrig = files.reduce((sum, f) => sum + f.originalSize, 0);
      const totalComp = files.reduce((sum, f) => sum + f.compressedSize, 0);
      const ratio = totalOrig > 0 ? (totalOrig - totalComp) / totalOrig : 0;
      actual.compressionRatio = ratio;
      limit.minCompressionRatio = rule.minCompressionRatio;

      if (ratio < rule.minCompressionRatio) {
        passed = false;
        messages.push(
          `Compression ratio ${(ratio * 100).toFixed(1)}% below minimum of ${(rule.minCompressionRatio * 100).toFixed(1)}%`
        );
      } else {
        messages.push(
          `Compression ratio ${(ratio * 100).toFixed(1)}% meets minimum of ${(rule.minCompressionRatio * 100).toFixed(1)}%`
        );
      }
    }

    return {
      rule,
      passed,
      actual,
      limit,
      message: messages.join('; '),
    };
  }

  /**
   * Simple glob to regex converter
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*');
    return new RegExp(escaped, 'i');
  }
}

export default BudgetEnforcer;
