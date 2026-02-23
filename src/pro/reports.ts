/**
 * Shopify Compressor Pro - Report Generator
 *
 * Generates rich HTML, JSON, and Markdown build reports with
 * before/after comparisons, and optional historical trends.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger.js';
import { formatBytes } from '../utils/files.js';
import type { CompressionResult } from '../types.js';
import type {
  ReportOptions,
  ProOptimizationReport,
  ReportHistoryEntry,
} from '../pro-types.js';

// ============================================
// Report Generator
// ============================================

export class ReportGenerator {
  private options: Required<ReportOptions>;

  constructor(options: ReportOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      formats: options.formats ?? ['html'],
      outputDir: options.outputDir ?? './reports',
      history: options.history ?? true,
      filename: options.filename ?? 'build-report',
    };
  }

  /**
   * Generate reports in all configured formats
   */
  async generate(report: ProOptimizationReport): Promise<string[]> {
    if (!this.options.enabled) return [];

    await mkdir(this.options.outputDir, { recursive: true });

    const outputs: string[] = [];

    // Load history for comparison
    let history: ReportHistoryEntry | undefined;
    if (this.options.history) {
      history = await this.loadHistory();
      report.history = history;
    }

    for (const format of this.options.formats) {
      const filePath = join(
        this.options.outputDir,
        `${this.options.filename}.${format === 'markdown' ? 'md' : format}`
      );

      switch (format) {
        case 'html':
          await writeFile(filePath, this.generateHtml(report));
          break;
        case 'json':
          await writeFile(filePath, this.generateJson(report));
          break;
        case 'markdown':
          await writeFile(filePath, this.generateMarkdown(report));
          break;
      }

      outputs.push(filePath);
      logger.info(`Report generated: ${filePath}`);
    }

    // Save current build as history
    if (this.options.history) {
      await this.saveHistory(report);
    }

    return outputs;
  }

  // ==========================================
  // JSON Report
  // ==========================================

  private generateJson(report: ProOptimizationReport): string {
    return JSON.stringify(report, null, 2);
  }

  // ==========================================
  // Markdown Report
  // ==========================================

  private generateMarkdown(report: ProOptimizationReport): string {
    const lines: string[] = [];

    lines.push('# Shopify Compressor Pro — Build Report');
    lines.push('');
    lines.push(`**Date:** ${new Date().toISOString()}`);
    lines.push(`**Files processed:** ${report.totalFiles}`);
    lines.push(`**Build time:** ${(report.totalTime / 1000).toFixed(2)}s`);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Original size | ${formatBytes(report.totalOriginalSize)} |`);
    lines.push(`| Compressed size | ${formatBytes(report.totalCompressedSize)} |`);
    lines.push(`| Total savings | ${formatBytes(report.totalSavings)} |`);
    lines.push(`| Compression ratio | ${(report.overallRatio * 100).toFixed(1)}% |`);
    lines.push('');

    // History comparison
    if (report.history) {
      lines.push('## Comparison with Previous Build');
      lines.push('');
      const delta = report.history.sizeDelta;
      const direction = delta > 0 ? '📈 Increased' : delta < 0 ? '📉 Decreased' : '➡️ No change';
      lines.push(`- Size change: ${direction} by ${formatBytes(Math.abs(delta))}`);
      lines.push(`- File count change: ${report.history.filesDelta > 0 ? '+' : ''}${report.history.filesDelta}`);
      lines.push('');
    }

    // Budget results
    if (report.budgets && report.budgets.length > 0) {
      lines.push('## Budget Results');
      lines.push('');
      lines.push(`**Overall:** ${report.budgetsPassed ? '✅ All budgets passed' : '❌ Some budgets exceeded'}`);
      lines.push('');
      lines.push('| Rule | Status | Details |');
      lines.push('|------|--------|---------|');
      for (const budget of report.budgets) {
        const status = budget.passed ? '✅' : '❌';
        lines.push(`| ${budget.rule.pattern} | ${status} | ${budget.message} |`);
      }
      lines.push('');
    }

    // By type breakdown
    const types = ['images', 'js', 'css', 'svg', 'liquid'] as const;
    for (const type of types) {
      const results = report.byType[type];
      if (results && results.length > 0) {
        lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        lines.push('');
        lines.push('| File | Original | Compressed | Savings |');
        lines.push('|------|----------|------------|---------|');
        for (const r of results) {
          lines.push(
            `| ${r.input} | ${formatBytes(r.originalSize)} | ${formatBytes(r.compressedSize)} | ${(r.ratio * 100).toFixed(1)}% |`
          );
        }
        lines.push('');
      }
    }

    // Errors
    if (report.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const err of report.errors) {
        lines.push(`- **${err.file}**: ${err.error}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ==========================================
  // HTML Report
  // ==========================================

  private generateHtml(report: ProOptimizationReport): string {
    const budgetRows = (report.budgets || [])
      .map(
        b => `
          <tr class="${b.passed ? '' : 'exceeded'}">
            <td><code>${this.escapeHtml(b.rule.pattern)}</code></td>
            <td>${b.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>'}</td>
            <td>${this.escapeHtml(b.message)}</td>
          </tr>`
      )
      .join('');

    const fileRows = (type: CompressionResult[]) =>
      type
        .map(
          r => `
          <tr>
            <td class="file-path">${this.escapeHtml(r.input)}</td>
            <td>${formatBytes(r.originalSize)}</td>
            <td>${formatBytes(r.compressedSize)}</td>
            <td>
              <div class="bar-wrap">
                <div class="bar" style="width: ${Math.max(2, r.ratio * 100)}%"></div>
                <span>${(r.ratio * 100).toFixed(1)}%</span>
              </div>
            </td>
            <td>${r.time.toFixed(0)}ms</td>
          </tr>`
        )
        .join('');

    const allResults = [
      ...(report.byType.images || []),
      ...(report.byType.js || []),
      ...(report.byType.css || []),
      ...(report.byType.svg || []),
      ...(report.byType.liquid || []),
    ];

    const typeSummary = (['images', 'js', 'css', 'svg', 'liquid'] as const)
      .filter(t => (report.byType[t]?.length || 0) > 0)
      .map(t => {
        const items = report.byType[t]!;
        const totalOrig = items.reduce((s, r) => s + r.originalSize, 0);
        const totalComp = items.reduce((s, r) => s + r.compressedSize, 0);
        const ratio = totalOrig > 0 ? (totalOrig - totalComp) / totalOrig : 0;
        return `
          <div class="type-card">
            <h3>${t.toUpperCase()}</h3>
            <div class="type-stat">${items.length} files</div>
            <div class="type-stat">${formatBytes(totalOrig)} → ${formatBytes(totalComp)}</div>
            <div class="type-ratio">${(ratio * 100).toFixed(1)}% saved</div>
          </div>`;
      })
      .join('');

    const historySection = report.history
      ? `
      <section class="history">
        <h2>📊 Comparison with Previous Build</h2>
        <div class="history-grid">
          <div class="delta-card ${report.history.sizeDelta <= 0 ? 'positive' : 'negative'}">
            <span class="delta-label">Size Delta</span>
            <span class="delta-value">${report.history.sizeDelta <= 0 ? '↓' : '↑'} ${formatBytes(Math.abs(report.history.sizeDelta))}</span>
          </div>
          <div class="delta-card">
            <span class="delta-label">File Count Delta</span>
            <span class="delta-value">${report.history.filesDelta > 0 ? '+' : ''}${report.history.filesDelta}</span>
          </div>
        </div>
      </section>`
      : '';

    const budgetSection =
      report.budgets && report.budgets.length > 0
        ? `
      <section class="budgets">
        <h2>💰 Asset Budgets</h2>
        <div class="budget-status ${report.budgetsPassed ? 'pass' : 'fail'}">
          ${report.budgetsPassed ? '✅ All budgets passed' : '❌ Some budgets exceeded'}
        </div>
        <table class="budget-table">
          <thead>
            <tr><th>Rule</th><th>Status</th><th>Details</th></tr>
          </thead>
          <tbody>${budgetRows}</tbody>
        </table>
      </section>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Compressor Pro — Build Report</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --surface2: #1a1a28;
      --border: #2a2a3a;
      --text: #e4e4ef;
      --text-muted: #8888a0;
      --accent: #6c5ce7;
      --accent2: #a855f7;
      --green: #00d68f;
      --red: #ff6b6b;
      --orange: #ffa94d;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      text-align: center;
      padding: 2rem 0 3rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }
    header h1 {
      font-size: 2rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: .5rem;
    }
    header .subtitle { color: var(--text-muted); font-size: .9rem; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
    }
    .stat-card .label { color: var(--text-muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
    .stat-card .value { font-size: 1.8rem; font-weight: 700; margin-top: .25rem; }
    .stat-card .value.green { color: var(--green); }
    .type-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .type-card {
      background: var(--surface2);
      border-radius: 10px;
      padding: 1.2rem;
      text-align: center;
    }
    .type-card h3 { font-size: .85rem; color: var(--accent2); margin-bottom: .5rem; }
    .type-stat { font-size: .85rem; color: var(--text-muted); }
    .type-ratio { font-size: 1.1rem; font-weight: 600; color: var(--green); margin-top: .3rem; }
    section { margin-bottom: 2.5rem; }
    section h2 { font-size: 1.3rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    thead th {
      text-align: left;
      padding: .75rem 1rem;
      background: var(--surface);
      border-bottom: 2px solid var(--border);
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: .75rem;
      letter-spacing: .05em;
    }
    tbody td {
      padding: .6rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    .file-path { font-family: 'SF Mono', Consolas, monospace; font-size: .8rem; }
    .bar-wrap {
      display: flex;
      align-items: center;
      gap: .5rem;
    }
    .bar {
      height: 6px;
      background: linear-gradient(90deg, var(--green), var(--accent));
      border-radius: 3px;
      min-width: 2px;
    }
    .badge {
      display: inline-block;
      padding: .15rem .6rem;
      border-radius: 20px;
      font-size: .75rem;
      font-weight: 600;
    }
    .badge.pass { background: rgba(0,214,143,.15); color: var(--green); }
    .badge.fail { background: rgba(255,107,107,.15); color: var(--red); }
    .budget-status {
      padding: .8rem 1.2rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    .budget-status.pass { background: rgba(0,214,143,.1); color: var(--green); }
    .budget-status.fail { background: rgba(255,107,107,.1); color: var(--red); }
    tr.exceeded td { background: rgba(255,107,107,.05); }
    .history-grid { display: flex; gap: 1rem; }
    .delta-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem 1.5rem;
      flex: 1;
    }
    .delta-card.positive { border-color: var(--green); }
    .delta-card.negative { border-color: var(--red); }
    .delta-label { display: block; font-size: .8rem; color: var(--text-muted); }
    .delta-value { display: block; font-size: 1.3rem; font-weight: 700; margin-top: .25rem; }
    .error-list { list-style: none; }
    .error-list li {
      padding: .5rem 1rem;
      background: rgba(255,107,107,.08);
      border-left: 3px solid var(--red);
      border-radius: 0 6px 6px 0;
      margin-bottom: .5rem;
      font-size: .85rem;
    }
    footer {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: .8rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Shopify Compressor Pro</h1>
      <p class="subtitle">Build Report — ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
    </header>

    <section>
      <div class="summary-grid">
        <div class="stat-card">
          <div class="label">Files Processed</div>
          <div class="value">${report.totalFiles}</div>
        </div>
        <div class="stat-card">
          <div class="label">Original Size</div>
          <div class="value">${formatBytes(report.totalOriginalSize)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Compressed Size</div>
          <div class="value">${formatBytes(report.totalCompressedSize)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Savings</div>
          <div class="value green">${formatBytes(report.totalSavings)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Compression</div>
          <div class="value green">${(report.overallRatio * 100).toFixed(1)}%</div>
        </div>
        <div class="stat-card">
          <div class="label">Build Time</div>
          <div class="value">${(report.totalTime / 1000).toFixed(2)}s</div>
        </div>
      </div>

      <div class="type-grid">
        ${typeSummary}
      </div>
    </section>

    ${historySection}

    ${budgetSection}

    <section>
      <h2>📁 File Details</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Original</th>
            <th>Compressed</th>
            <th>Savings</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${fileRows(allResults)}
        </tbody>
      </table>
    </section>

    ${
      report.errors.length > 0
        ? `
    <section>
      <h2>⚠️ Errors</h2>
      <ul class="error-list">
        ${report.errors.map(e => `<li><strong>${this.escapeHtml(e.file)}</strong>: ${this.escapeHtml(e.error)}</li>`).join('')}
      </ul>
    </section>`
        : ''
    }

    <footer>
      <p>Generated by Shopify Compressor Pro${report.meta ? ` v${report.meta.version}` : ''} — ${new Date().toISOString()}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  // ==========================================
  // History
  // ==========================================

  private getHistoryPath(): string {
    return join(this.options.outputDir, '.build-history.json');
  }

  private async loadHistory(): Promise<ReportHistoryEntry | undefined> {
    const historyPath = this.getHistoryPath();
    try {
      if (!existsSync(historyPath)) return undefined;

      const content = await readFile(historyPath, 'utf-8');
      const prev = JSON.parse(content) as {
        timestamp: string;
        totalCompressedSize: number;
        totalFiles: number;
        totalSavings: number;
      };

      // Will be calculated after current build
      return {
        previousBuild: prev.timestamp,
        sizeDelta: 0,
        filesDelta: 0,
        savingsDelta: 0,
      };
    } catch {
      return undefined;
    }
  }

  private async saveHistory(report: ProOptimizationReport): Promise<void> {
    const historyPath = this.getHistoryPath();

    // Update the history entry with actual deltas
    try {
      if (existsSync(historyPath)) {
        const content = await readFile(historyPath, 'utf-8');
        const prev = JSON.parse(content);

        if (report.history) {
          report.history.sizeDelta =
            report.totalCompressedSize - (prev.totalCompressedSize || 0);
          report.history.filesDelta = report.totalFiles - (prev.totalFiles || 0);
          report.history.savingsDelta = report.totalSavings - (prev.totalSavings || 0);
        }
      }
    } catch {
      // Ignore
    }

    await mkdir(dirname(historyPath), { recursive: true });
    await writeFile(
      historyPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalCompressedSize: report.totalCompressedSize,
        totalOriginalSize: report.totalOriginalSize,
        totalFiles: report.totalFiles,
        totalSavings: report.totalSavings,
      })
    );
  }

  // ==========================================
  // Utilities
  // ==========================================

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default ReportGenerator;
