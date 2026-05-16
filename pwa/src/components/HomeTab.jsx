import StatusBar    from './StatusBar.jsx';
import Controls     from './Controls.jsx';

export default function HomeTab({
  mqttConnected, deviceStatus, lastCommand,
  onCommand, busy, error,
}) {
  return (
    <div className="tab-content" role="tabpanel" aria-label="Home">
      <StatusBar
        mqttConnected={mqttConnected}
        deviceStatus={deviceStatus}
        lastCommand={lastCommand}
      />
      <Controls
        onCommand={onCommand}
        disabled={!mqttConnected || busy}
      />
      {error && <p className="error-banner" role="alert">{error}</p>}
      <footer className="foot">
        <p>Lệnh gần nhất chỉ phản ánh lệnh đã gửi, không phải vị trí thực tế của cửa.</p>
      </footer>
    </div>
  );
}
