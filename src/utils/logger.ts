import { consola } from 'consola';
import type { Logger, LogLevel } from '../types.js';

let currentLevel: LogLevel = 'info';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
  if (level === 'silent') {
    consola.level = -999;
  } else if (level === 'debug') {
    consola.level = 4;
  } else {
    consola.level = LOG_LEVELS[level];
  }
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export const logger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      consola.debug(message, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      consola.info(message, ...args);
    }
  },
  success: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      consola.success(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      consola.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      consola.error(message, ...args);
    }
  },
};

export default logger;
