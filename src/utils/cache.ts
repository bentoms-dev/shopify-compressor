import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from './logger.js';

interface CacheEntry {
  hash: string;
  timestamp: number;
  outputPath: string;
}

interface CacheData {
  version: string;
  entries: Record<string, CacheEntry>;
}

const CACHE_VERSION = '1.0.0';

export class FileCache {
  private cacheFile: string;
  private data: CacheData;
  private enabled: boolean;

  constructor(cacheDir: string = '.shopify-compressor-cache', enabled: boolean = true) {
    this.cacheFile = join(cacheDir, 'cache.json');
    this.enabled = enabled;
    this.data = { version: CACHE_VERSION, entries: {} };
  }

  async load(): Promise<void> {
    if (!this.enabled) return;

    try {
      if (existsSync(this.cacheFile)) {
        const content = await readFile(this.cacheFile, 'utf-8');
        const loaded = JSON.parse(content) as CacheData;

        // Invalidate cache if version changed
        if (loaded.version === CACHE_VERSION) {
          this.data = loaded;
          logger.debug(`Cache loaded with ${Object.keys(this.data.entries).length} entries`);
        } else {
          logger.debug('Cache version mismatch, starting fresh');
        }
      }
    } catch {
      logger.debug('Could not load cache, starting fresh');
    }
  }

  async save(): Promise<void> {
    if (!this.enabled) return;

    try {
      await mkdir(dirname(this.cacheFile), { recursive: true });
      await writeFile(this.cacheFile, JSON.stringify(this.data, null, 2));
      logger.debug(`Cache saved with ${Object.keys(this.data.entries).length} entries`);
    } catch {
      logger.warn('Could not save cache');
    }
  }

  async computeHash(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('md5').update(new Uint8Array(content)).digest('hex');
  }

  async isChanged(filePath: string, outputPath: string): Promise<boolean> {
    if (!this.enabled) return true;

    const entry = this.data.entries[filePath];
    if (!entry) return true;

    // Check if output file exists
    if (!existsSync(outputPath)) return true;

    // Check if source file hash changed
    const currentHash = await this.computeHash(filePath);
    if (currentHash !== entry.hash) return true;

    // Check if source file is newer than cache entry
    try {
      const stats = await stat(filePath);
      if (stats.mtimeMs > entry.timestamp) {
        const newHash = await this.computeHash(filePath);
        return newHash !== entry.hash;
      }
    } catch {
      return true;
    }

    return false;
  }

  async set(filePath: string, outputPath: string): Promise<void> {
    if (!this.enabled) return;

    const hash = await this.computeHash(filePath);
    this.data.entries[filePath] = {
      hash,
      timestamp: Date.now(),
      outputPath,
    };
  }

  invalidate(filePath: string): void {
    delete this.data.entries[filePath];
  }

  clear(): void {
    this.data.entries = {};
  }

  getStats(): { entries: number; enabled: boolean } {
    return {
      entries: Object.keys(this.data.entries).length,
      enabled: this.enabled,
    };
  }
}

export default FileCache;
