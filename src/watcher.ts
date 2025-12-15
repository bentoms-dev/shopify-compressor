import chokidar, { FSWatcher } from 'chokidar';
import { logger } from './utils/logger.js';
import type { WatchOptions, WatchEvent, WatchCallback } from './types.js';

export class Watcher {
  private options: WatchOptions;
  private watcher: FSWatcher | null = null;
  private callbacks: WatchCallback[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: WatchOptions = {}) {
    this.options = {
      paths: ['./input'],
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      debounce: 300,
      ...options,
    };
  }

  /**
   * Start watching for file changes
   */
  start(): void {
    if (this.watcher) {
      logger.warn('Watcher is already running');
      return;
    }

    const paths = this.options.paths || ['./input'];

    this.watcher = chokidar.watch(paths, {
      ignored: this.options.ignore,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', path => this.handleEvent('add', path))
      .on('change', path => this.handleEvent('change', path))
      .on('unlink', path => this.handleEvent('unlink', path))
      .on('error', error => logger.error(`Watcher error: ${error}`))
      .on('ready', () => {
        logger.info('👀 Watching for file changes...');
        logger.debug(`Watching: ${paths.join(', ')}`);
      });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      logger.info('Watcher stopped');
    }
  }

  /**
   * Register a callback for file changes
   */
  onChange(callback: WatchCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Handle a file system event
   */
  private handleEvent(type: WatchEvent['type'], path: string): void {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);

      const event: WatchEvent = {
        type,
        path,
        timestamp: new Date(),
      };

      logger.debug(`File ${type}: ${path}`);

      // Notify all callbacks
      for (const callback of this.callbacks) {
        try {
          callback(event);
        } catch (error) {
          logger.error(`Callback error: ${error}`);
        }
      }
    }, this.options.debounce);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Check if watcher is running
   */
  isRunning(): boolean {
    return this.watcher !== null;
  }

  /**
   * Get watched paths
   */
  getWatchedPaths(): string[] {
    if (!this.watcher) return [];
    const watched = this.watcher.getWatched();
    return Object.keys(watched);
  }
}

export default Watcher;
