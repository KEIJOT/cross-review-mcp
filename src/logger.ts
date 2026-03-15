// src/logger.ts - Structured JSON logging

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';
let enabled = true;

export function configureLogger(options: { level?: LogLevel; enabled?: boolean }): void {
  if (options.level) minLevel = options.level;
  if (options.enabled !== undefined) enabled = options.enabled;
}

export function log(level: LogLevel, component: string, message: string, data?: Record<string, any>): void {
  if (!enabled) return;
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...data,
  };

  // Use stderr so it doesn't interfere with stdio MCP transport
  process.stderr.write(JSON.stringify(entry) + '\n');
}
