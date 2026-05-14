// Parsers for the three JSON telemetry payloads from firmware v0.2+.
// Each one tolerates malformed payloads and falls back to a string-only form
// so the PWA never crashes on a stray byte from the broker.

const COMMANDS = new Set(['OPEN', 'STOP', 'CLOSE']);

export function parseLastCommand(raw) {
  const receivedAt = Date.now();
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  // v0.2+ JSON: {"cmd":"OPEN","result":"OK","pulse_ms":500,"uptime":1234}
  try {
    const obj = JSON.parse(raw);
    if (obj && COMMANDS.has(obj.cmd)) {
      return {
        cmd:        obj.cmd,
        result:     typeof obj.result === 'string' ? obj.result : null,
        pulseMs:    Number.isFinite(obj.pulse_ms) ? obj.pulse_ms : null,
        uptime:     Number.isFinite(obj.uptime)   ? obj.uptime   : null,
        receivedAt,
        raw,
      };
    }
  } catch {
    // fall through to legacy parser
  }

  // Legacy firmware v0.1: "OPEN_SENT" / "STOP_SENT" / "CLOSE_SENT"
  const trimmed = raw.trim();
  const cmd = trimmed.replace(/_(SENT|ACK)$/i, '');
  if (COMMANDS.has(cmd)) {
    return { cmd, result: null, pulseMs: null, uptime: null, receivedAt, raw };
  }

  return { cmd: null, result: null, pulseMs: null, uptime: null, receivedAt, raw };
}

export function parseHeartbeat(raw) {
  const receivedAt = Date.now();
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const obj = JSON.parse(raw);
    return {
      uptime:  Number.isFinite(obj.uptime) ? obj.uptime : null,
      rssi:    Number.isFinite(obj.rssi)   ? obj.rssi   : null,
      heap:    Number.isFinite(obj.heap)   ? obj.heap   : null,
      millis:  Number.isFinite(obj.millis) ? obj.millis : null,
      receivedAt,
      raw,
    };
  } catch {
    return { uptime: null, rssi: null, heap: null, millis: null, receivedAt, raw };
  }
}

export function parseDiagnostics(raw) {
  const receivedAt = Date.now();
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const obj = JSON.parse(raw);
    return {
      reason: typeof obj.reason === 'string' ? obj.reason : null,
      ip:     typeof obj.ip     === 'string' ? obj.ip     : null,
      fw:     typeof obj.fw     === 'string' ? obj.fw     : null,
      uptime: Number.isFinite(obj.uptime) ? obj.uptime : null,
      receivedAt,
      raw,
    };
  } catch {
    return { reason: null, ip: null, fw: null, uptime: null, receivedAt, raw };
  }
}
