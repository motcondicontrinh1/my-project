// Status bar: device online/offline + MQTT connection + last command sent.
// Until a real door sensor is installed, this never claims door position —
// only what was sent. (See plan, MQTT Topics section.)

const COMMAND_LABEL = {
  OPEN:  'MỞ',
  STOP:  'DỪNG',
  CLOSE: 'ĐÓNG',
};

export default function StatusBar({ mqttConnected, deviceStatus, lastCommand }) {
  const deviceOnline = deviceStatus === 'ONLINE';
  const cmdLabel = lastCommand?.cmd ? (COMMAND_LABEL[lastCommand.cmd] ?? lastCommand.cmd) : '—';

  return (
    <section className="status">
      <Row label="Thiết bị"
           value={deviceOnline ? 'Online' : 'Offline'}
           tone={deviceOnline ? 'ok' : 'warn'} />
      <Row label="MQTT"
           value={mqttConnected ? 'Connected' : 'Disconnected'}
           tone={mqttConnected ? 'ok' : 'warn'} />
      <Row label="Lệnh gần nhất"
           value={cmdLabel}
           tone="info" />
    </section>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className={`status-value tone-${tone}`}>{value}</span>
    </div>
  );
}
