import { useEffect, useMemo, useRef, useState } from 'react';
import { createDoorClient } from './lib/mqtt.js';
import { sendCommand }      from './lib/workerClient.js';
import { useUrlFlags }      from './lib/useUrlFlags.js';
import { logger, setVerbose } from './lib/logger.js';
import {
  parseLastCommand,
  parseHeartbeat,
  parseDiagnostics,
} from './lib/telemetry.js';
import PinGate          from './components/PinGate.jsx';
import StatusBar        from './components/StatusBar.jsx';
import Controls         from './components/Controls.jsx';
import ConfirmDialog    from './components/ConfirmDialog.jsx';
import TroubleshootPanel from './components/TroubleshootPanel.jsx';

const ENV = {
  workerUrl:   import.meta.env.VITE_WORKER_URL,
  url:         import.meta.env.VITE_MQTT_URL,
  username:    import.meta.env.VITE_MQTT_USERNAME,
  password:    import.meta.env.VITE_MQTT_PASSWORD,
  topicPrefix: import.meta.env.VITE_TOPIC_PREFIX,
  pin:         import.meta.env.VITE_UI_PIN ?? '0000',
};

const CONFIRM_COPY = {
  OPEN:  { title: 'Mở cửa',  message: 'Bạn chắc chắn muốn MỞ CỬA?',  confirmLabel: 'Mở',  tone: 'open'  },
  CLOSE: { title: 'Đóng cửa', message: 'Bạn chắc chắn muốn ĐÓNG CỬA?', confirmLabel: 'Đóng', tone: 'close' },
};

export default function App() {
  const flags = useUrlFlags();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState(null);

  // Enable console mirroring of every log entry as soon as we know dev mode.
  useEffect(() => {
    setVerbose(flags.dev);
    if (flags.dev) logger.info('app', 'verbose logging enabled', flags);
  }, [flags.dev, flags]);

  if (!unlocked) {
    return <PinGate expectedPin={ENV.pin} onUnlock={(p) => {
      logger.info('ui', 'PIN gate unlocked');
      setPin(p);
      setUnlocked(true);
    }} />;
  }
  return <DoorApp flags={flags} pin={pin} />;
}

function DoorApp({ flags, pin }) {
  const [mqttConnected,    setMqttConnected]    = useState(false);
  const [deviceStatus,     setDeviceStatus]     = useState(null);
  const [lastCommandAck,   setLastCommandAck]   = useState(null);
  const [lastCommandSentAt, setLastCommandSentAt] = useState(null);
  const [lastHeartbeat,    setLastHeartbeat]    = useState(null);
  const [lastDiagnostics,  setLastDiagnostics]  = useState(null);
  const [busy,             setBusy]             = useState(false);
  const [pending,          setPending]          = useState(null);
  const [error,            setError]            = useState(null);

  const clientRef = useRef(null);

  const configValid = useMemo(
    () => Boolean(ENV.workerUrl && ENV.url && ENV.topicPrefix),
    []
  );

  useEffect(() => {
    if (!configValid) {
      logger.warn('app', 'MQTT config missing, client not started');
      return undefined;
    }

    const client = createDoorClient({
      url:              ENV.url,
      username:         ENV.username,
      password:         ENV.password,
      topicPrefix:      ENV.topicPrefix,
      includeDevTopics: flags.dev,
    });
    clientRef.current = client;

    const offs = [
      client.on('connected',    () => { setMqttConnected(true);  setError(null); }),
      client.on('disconnected', () => { setMqttConnected(false); }),
      client.on('deviceStatus', (s) => {
        logger.info('telemetry', `device status: ${s}`);
        setDeviceStatus(s);
      }),
      client.on('lastCommand',  (raw) => {
        const parsed = parseLastCommand(raw);
        if (parsed?.cmd) logger.info('telemetry', `ack ${parsed.cmd}`, parsed);
        else             logger.warn('telemetry', 'last-command unparsed', raw);
        setLastCommandAck(parsed);
      }),
      client.on('heartbeat',    (raw) => {
        const parsed = parseHeartbeat(raw);
        if (parsed) logger.debug('telemetry', 'heartbeat', parsed);
        else        logger.warn('telemetry', 'heartbeat parse failed', raw);
        setLastHeartbeat(parsed);
      }),
      client.on('diagnostics',  (raw) => {
        const parsed = parseDiagnostics(raw);
        if (parsed) logger.info('telemetry', 'diagnostics', parsed);
        else        logger.warn('telemetry', 'diagnostics parse failed', raw);
        setLastDiagnostics(parsed);
      }),
      client.on('error',        (e) => {
        const msg = e?.message ?? String(e);
        logger.error('app', `mqtt error → UI: ${msg}`);
        setError(msg);
      }),
    ];

    return () => {
      offs.forEach((off) => off());
      client.end();
      clientRef.current = null;
    };
  }, [configValid, flags.dev]);

  function handleCommand(cmd) {
    if (cmd === 'STOP') {
      void send('STOP');
    } else {
      logger.info('ui', `confirm requested: ${cmd}`);
      setPending(cmd);
    }
  }

  async function send(cmd) {
    setBusy(true);
    const sentAt = Date.now();
    setLastCommandSentAt(sentAt);
    try {
      logger.info('cmd', '→ Worker ' + cmd);
      await sendCommand(cmd, pin, ENV.workerUrl);
      logger.debug('cmd', cmd + ' worker ok');
    } catch (e) {
      const msg = `Gửi lệnh thất bại: ${e.message}`;
      logger.error('cmd', msg, e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function confirmPending() {
    const cmd = pending;
    setPending(null);
    if (cmd) {
      logger.info('ui', `confirmed: ${cmd}`);
      void send(cmd);
    }
  }

  function cancelPending() {
    if (pending) logger.info('ui', `cancelled: ${pending}`);
    setPending(null);
  }

  // Preview mode hides the family-facing setup error unless dev mode is also on.
  // This lets designers iterate on the UI without real broker creds while still
  // letting developers see the configuration problem in dev mode.
  if (!configValid && !(flags.preview && !flags.dev)) {
    return (
      <main className="shell">
        <div className="brand">
          <span className="m-stripe" aria-hidden="true"><span /><span /><span /></span>
          <h1>Cửa Cuốn</h1>
        </div>
        <p className="error-banner">
          Thiếu cấu hình. Kiểm tra VITE_WORKER_URL và VITE_MQTT_URL trong .env.local
        </p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="brand">
        <span className="m-stripe" aria-hidden="true"><span /><span /><span /></span>
        <h1>Cửa Cuốn</h1>
      </header>

      <StatusBar
        mqttConnected={mqttConnected}
        deviceStatus={deviceStatus}
        lastCommand={lastCommandAck}
      />

      <Controls
        onCommand={handleCommand}
        disabled={!mqttConnected || busy}
      />

      {error && <p className="error-banner" role="alert">{error}</p>}

      {flags.dev && (
        <TroubleshootPanel
          mqttConnected={mqttConnected}
          deviceStatus={deviceStatus}
          lastCommandSentAt={lastCommandSentAt}
          lastCommandAck={lastCommandAck}
          lastHeartbeat={lastHeartbeat}
          lastDiagnostics={lastDiagnostics}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? CONFIRM_COPY[pending].title : ''}
        message={pending ? CONFIRM_COPY[pending].message : ''}
        confirmLabel={pending ? CONFIRM_COPY[pending].confirmLabel : ''}
        tone={pending ? CONFIRM_COPY[pending].tone : 'open'}
        onConfirm={confirmPending}
        onCancel={cancelPending}
      />

      <footer className="foot">
        <p>Lệnh gần nhất chỉ phản ánh lệnh đã gửi, không phải vị trí thực tế của cửa.</p>
      </footer>
    </main>
  );
}
