import VoiceMicButton from './VoiceMicButton.jsx';

export default function MicroTab({ onVoiceCommand, mqttConnected, busy }) {
  return (
    <div className="tab-content tab-content--micro" role="tabpanel" aria-label="Điều khiển giọng nói">
      {!mqttConnected && (
        <p className="error-banner" role="alert">⚠ MQTT chưa kết nối — đang thử kết nối lại...</p>
      )}
      <VoiceMicButton
        onCommand={onVoiceCommand}
        disabled={!mqttConnected || busy}
      />
    </div>
  );
}
