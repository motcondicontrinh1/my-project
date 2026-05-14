// Lightweight in-memory event logger with subscribers and an optional
// console mirror. Designed for the developer-mode Troubleshooting panel:
//
//   - Bounded ring buffer (no unbounded growth)
//   - Pure module state — single instance per JS bundle
//   - When `verbose` is on (set by App when dev mode is enabled), every entry
//     is also written to the browser console with the matching level
//
// Usage:
//   import { logger, setVerbose, useLogs, clearLogs } from './logger.js';
//   logger.info('mqtt', 'connected');
//   logger.error('cmd', 'publish failed', err);

import { useEffect, useState } from 'react';

const MAX_LOGS = 300;

let entries = [];
let seq = 0;
let verbose = false;
const subs = new Set();

function emit(level, category, message, payload) {
  const entry = {
    seq: ++seq,
    t: Date.now(),
    level,
    category,
    message,
    payload,
  };

  entries = entries.length >= MAX_LOGS
    ? [...entries.slice(entries.length - MAX_LOGS + 1), entry]
    : [...entries, entry];

  if (verbose) {
    const fn =
      level === 'error' ? console.error :
      level === 'warn'  ? console.warn  :
                          console.log;
    if (payload !== undefined) fn(`[${category}] ${message}`, payload);
    else                       fn(`[${category}] ${message}`);
  }

  for (const cb of subs) cb(entries);
}

export const logger = {
  debug: (category, message, payload) => emit('debug', category, message, payload),
  info:  (category, message, payload) => emit('info',  category, message, payload),
  warn:  (category, message, payload) => emit('warn',  category, message, payload),
  error: (category, message, payload) => emit('error', category, message, payload),
};

export function setVerbose(v) {
  verbose = !!v;
}

export function isVerbose() {
  return verbose;
}

export function getLogs() {
  return entries;
}

export function subscribeLogs(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function clearLogs() {
  entries = [];
  for (const cb of subs) cb(entries);
}

// React hook to read the live log buffer.
export function useLogs() {
  const [logs, setLogs] = useState(getLogs);
  useEffect(() => subscribeLogs(setLogs), []);
  return logs;
}
