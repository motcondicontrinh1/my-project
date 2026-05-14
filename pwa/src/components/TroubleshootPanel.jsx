import { useEffect, useRef, useState } from 'react';
import { inferState } from '../lib/inference.js';
import { logger, useLogs, clearLogs } from '../lib/logger.js';

// Developer-only Troubleshooting panel. Renders behind ?dev=1 / ?trace=1.
// Surfaces raw evidence (timestamps, payloads) so a developer can verify the
// inference rather than trust the label.

function fmtAge(receivedAt, now) {
  if (!receivedAt) return '—';
  const ageMs = now - receivedAt;
  if (ageMs < 1000)  return `${ageMs} ms ago`;
  if (ageMs < 60_000) return `${(ageMs / 1000).toFixed(1)} s ago`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)} min ago`;
  return new Date(receivedAt).toLocaleTimeString();
}

function fmtTime(t) {
  return t ? new Date(t).toLocaleTimeString() : '—';
}

function fmtClock(t) {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function fmtPayload(p) {
  if (p === undefined || p === null) return '';
  if (typeof p === 'string') return p;
  if (p instanceof Error)    return p.message;
  try { return JSON.stringify(p); } catch { return String(p); }
}

export default function TroubleshootPanel({
  mqttConnected,
  deviceStatus,
  lastCommandSentAt,
  lastCommandAck,
  lastHeartbeat,
  lastDiagnostics,
}) {
  // Tick once per second so age strings and the inferred state stay live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const inference = inferState({
    mqttConnected,
    deviceStatus,
    lastHeartbeat,
    lastCommandSentAt,
    lastCommandAck,
    lastDiagnostics,
    now,
  });

  // Log every state transition, with the first observed state logged as init.
  const lastStateRef = useRef(null);
  useEffect(() => {
    if (lastStateRef.current === null) {
      logger.info('state', `init → ${inference.state}`, { severity: inference.severity });
    } else if (lastStateRef.current !== inference.state) {
      logger.info('state', `${lastStateRef.current} → ${inference.state}`, { severity: inference.severity });
    }
    lastStateRef.current = inference.state;
  }, [inference.state, inference.severity]);

  return (
    <section className="trouble" aria-label="Developer troubleshooting">
      <header className="trouble-header">
        <span className="trouble-eyebrow">Dev mode · troubleshooting</span>
        <span className={`trouble-state sev-${inference.severity}`}>{inference.state}</span>
      </header>

      <p className="trouble-guidance">{inference.guidance}</p>

      <dl className="trouble-grid">
        <Row label="Browser MQTT" value={mqttConnected ? 'connected' : 'disconnected'} tone={mqttConnected ? 'ok' : 'warn'} />
        <Row label="Device status" value={deviceStatus ?? '—'} tone={deviceStatus === 'ONLINE' ? 'ok' : (deviceStatus === 'OFFLINE' ? 'warn' : 'muted')} />
        <Row label="Last command sent" value={fmtTime(lastCommandSentAt)} tone="muted" />
        <Row label="Last command ack"
             value={lastCommandAck ? `${lastCommandAck.cmd ?? '?'} · ${fmtAge(lastCommandAck.receivedAt, now)}` : '—'}
             tone={lastCommandAck ? 'ok' : 'muted'} />
        <Row label="Heartbeat"
             value={lastHeartbeat ? fmtAge(lastHeartbeat.receivedAt, now) : 'never'}
             tone={lastHeartbeat && (now - lastHeartbeat.receivedAt) < 30_000 ? 'ok' : 'warn'} />
        <Row label="Diagnostics"
             value={lastDiagnostics
               ? `${lastDiagnostics.reason ?? '?'} · uptime ${lastDiagnostics.uptime ?? '?'}s · ${fmtAge(lastDiagnostics.receivedAt, now)}`
               : '—'}
             tone="muted" />
      </dl>

      {(lastHeartbeat || lastDiagnostics || lastCommandAck) && (
        <details className="trouble-raw">
          <summary>Raw payloads</summary>
          <pre>
{lastHeartbeat   ? `heartbeat   ${lastHeartbeat.raw}\n`     : ''}
{lastDiagnostics ? `diagnostics ${lastDiagnostics.raw}\n`   : ''}
{lastCommandAck  ? `last-cmd    ${lastCommandAck.raw}\n`    : ''}
          </pre>
        </details>
      )}

      <EventLog />
    </section>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="trouble-row">
      <dt className="trouble-label">{label}</dt>
      <dd className={`trouble-value tone-${tone}`}>{value}</dd>
    </div>
  );
}

function EventLog() {
  const logs = useLogs();
  const [levelFilter, setLevelFilter] = useState('all');

  const filtered = levelFilter === 'all'
    ? logs
    : logs.filter((e) => e.level === levelFilter);

  // Newest first.
  const ordered = [...filtered].reverse();

  return (
    <div className="event-log">
      <div className="event-log-header">
        <span className="trouble-eyebrow">Event log · {logs.length}/300</span>
        <div className="event-log-controls">
          {['all', 'info', 'warn', 'error', 'debug'].map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`event-filter${levelFilter === lvl ? ' active' : ''}`}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl}
            </button>
          ))}
          <button type="button" className="event-clear" onClick={clearLogs}>Clear</button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="event-empty">No events yet.</p>
      ) : (
        <ol className="event-list" aria-label="Event log">
          {ordered.map((e) => (
            <li key={e.seq} className={`event-row lvl-${e.level}`}>
              <span className="event-time">{fmtClock(e.t)}</span>
              <span className="event-level">{e.level}</span>
              <span className="event-cat">{e.category}</span>
              <span className="event-msg">{e.message}</span>
              {e.payload !== undefined && (
                <span className="event-payload">{fmtPayload(e.payload)}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
