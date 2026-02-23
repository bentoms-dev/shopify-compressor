import { stat, copyFile as fsCopyFile, mkdir } from 'fs/promises';
import { extname, basename, dirname, join, relative } from 'path';
import { glob } from 'glob';
import {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_JS_EXTENSIONS,
  SUPPORTED_CSS_EXTENSIONS,
  SUPPORTED_LIQUID_EXTENSIONS,
  SUPPORTED_SVG_EXTENSIONS,
  SUPPORTED_JSON_EXTENSIONS,
} from '../types.js';

export type FileType = 'image' | 'js' | 'css' | 'svg' | 'liquid' | 'json' | 'unknown';

/**
 * Check if a string contains glob characters
 */
export function hasGlobChars(str: string): boolean {
  return /[*?{}\[\]]/.test(str);
}

/**
 * Determine the type of file based on extension
 */
export function getFileType(filePath: string): FileType {
  const ext = extname(filePath).toLowerCase();

  if (SUPPORTED_IMAGE_FORMATS.some(format => ext === `.${format}`)) {
    return 'image';
  }
  if (SUPPORTED_JS_EXTENSIONS.includes(ext)) {
    return 'js';
  }
  if (SUPPORTED_CSS_EXTENSIONS.includes(ext)) {
    return 'css';
  }
  if (SUPPORTED_SVG_EXTENSIONS.includes(ext)) {
    return 'svg';
  }
  if (SUPPORTED_LIQUID_EXTENSIONS.includes(ext)) {
    return 'liquid';
  }
  if (SUPPORTED_JSON_EXTENSIONS.includes(ext)) {
    return 'json';
  }

  return 'unknown';
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format percentage
 */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Calculate compression stats
 */
export function calculateSavings(originalSize: number, compressedSize: number) {
  const savings = originalSize - compressedSize;
  const ratio = originalSize > 0 ? savings / originalSize : 0;
  return { savings, ratio };
}

/**
 * Get output path for a file
 */
export function getOutputPath(
  inputPath: string,
  inputBase: string,
  outputDir: string,
  newExtension?: string
): string {
  const relativePath = relative(inputBase, inputPath);
  const dir = dirname(relativePath);
  const name = basename(inputPath, extname(inputPath));
  const ext = newExtension || extname(inputPath);

  return join(outputDir, dir, `${name}${ext}`);
}

/**
 * Find files matching patterns
 */
export async function findFiles(
  patterns: string | string[],
  options: { ignore?: string[]; cwd?: string } = {}
): Promise<string[]> {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  const files = await glob(patternArray, {
    ignore: options.ignore || ['**/node_modules/**', '**/dist/**'],
    cwd: options.cwd,
    absolute: true,
    nodir: true,
  });

  return files;
}

/**
 * Group files by type
 */
export function groupFilesByType(files: string[]): Record<FileType, string[]> {
  const groups: Record<FileType, string[]> = {
    image: [],
    js: [],
    css: [],
    svg: [],
    liquid: [],
    json: [],
    unknown: [],
  };

  for (const file of files) {
    const type = getFileType(file);
    groups[type].push(file);
  }

  return groups;
}

/**
 * Ensure a path ends with the given extension
 */
export function ensureExtension(filePath: string, ext: string): string {
  if (!extname(filePath)) {
    return filePath + ext;
  }
  return filePath;
}

/**
 * Check if running in a Shopify theme directory
 */
export function isShopifyTheme(dir: string): boolean {
  const themeIndicators = [
    'config/settings_schema.json',
    'layout/theme.liquid',
    'templates',
    'sections',
    'snippets',
    'assets',
  ];

  // Check if at least 3 indicators exist
  let matches = 0;
  for (const indicator of themeIndicators) {
    try {
      const fs = require('fs');
      if (fs.existsSync(join(dir, indicator))) {
        matches++;
      }
    } catch {
      // Ignore errors
    }
  }

  return matches >= 3;
}

/**
 * Copy a file to an output directory, preserving relative path structure.
 * Creates parent directories as needed.
 */
export async function copyFilePreserving(
  inputPath: string,
  inputBase: string,
  outputDir: string
): Promise<string> {
  const relativePath = relative(inputBase, inputPath);
  const outputPath = join(outputDir, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await fsCopyFile(inputPath, outputPath);
  return outputPath;
}
