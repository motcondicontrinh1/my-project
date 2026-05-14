// Pure inference: given current telemetry, decide a state label and a
// safety-first guidance string. Never claims exact cause; uses "likely" and
// surfaces evidence timestamps in the UI separately.
//
// Priority order (highest first):
//   1. Browser/MQTT disconnected
//   2. Device retained OFFLINE
//   3. Recent reboot after a recent command
//   4. Heartbeat stale (no message within HEARTBEAT_STALE_MS)
//   5. Command sent but no ack within COMMAND_ACK_TIMEOUT_MS
//   6. Healthy
//
// All thresholds are conservative — better to say "stale" than to claim health
// the device cannot prove without a physical sensor.

export const HEARTBEAT_STALE_MS    = 30_000;   // ESP32 sends every ~12s; 30s = 2-3 missed.
export const COMMAND_ACK_TIMEOUT_MS = 5_000;   // After 5s of no ack, flag.
export const RECENT_BOOT_UPTIME_S   = 30;      // Diagnostics uptime <= 30s = "just rebooted".

export function inferState({
  mqttConnected,
  deviceStatus,           // 'ONLINE' | 'OFFLINE' | null
  lastHeartbeat,          // { receivedAt, ... } | null
  lastCommandSentAt,      // ms since epoch | null
  lastCommandAck,         // { cmd, receivedAt, ... } | null
  lastDiagnostics,        // { reason, uptime, receivedAt, ... } | null
  now = Date.now(),
}) {
  if (!mqttConnected) {
    return {
      state: 'Broker/browser disconnected',
      severity: 'high',
      guidance: 'Check phone internet / broker connection first. Cannot send or confirm commands until the browser is connected.',
    };
  }

  if (deviceStatus === 'OFFLINE') {
    const wasAfterCommand = lastCommandSentAt && (now - lastCommandSentAt) < 60_000;
    return {
      state: 'Device offline',
      severity: 'high',
      guidance: wasAfterCommand
        ? 'Likely house power, router, or ESP32 power loss. Use physical remote/wall button if available. Check house power and router power before inspecting the door.'
        : 'Device is offline. Use physical remote/wall button if you need to operate the door. Check ESP32 power and home router.',
    };
  }

  // Recent reboot after a recent command — surface even if device now reports ONLINE.
  if (
    lastDiagnostics &&
    Number.isFinite(lastDiagnostics.uptime) &&
    lastDiagnostics.uptime <= RECENT_BOOT_UPTIME_S &&
    lastCommandSentAt &&
    lastDiagnostics.receivedAt > lastCommandSentAt
  ) {
    return {
      state: 'Device rebooted after command',
      severity: 'medium',
      guidance: `Device rebooted (reason: ${lastDiagnostics.reason ?? 'unknown'}) after the last command. Check ESP32 power supply and USB charger. The command may not have completed.`,
    };
  }

  if (lastHeartbeat && (now - lastHeartbeat.receivedAt) > HEARTBEAT_STALE_MS) {
    return {
      state: 'Telemetry stale',
      severity: 'medium',
      guidance: 'Device reports ONLINE but has not sent a heartbeat recently. Connection to the broker may be unstable. Do not assume the device is responsive.',
    };
  }

  if (
    lastCommandSentAt &&
    (now - lastCommandSentAt) > COMMAND_ACK_TIMEOUT_MS &&
    (!lastCommandAck || lastCommandAck.receivedAt < lastCommandSentAt)
  ) {
    return {
      state: 'Command unconfirmed',
      severity: 'medium',
      guidance: 'Command may not have reached the device. Do not assume the door moved. Try again, or use the physical remote.',
    };
  }

  return {
    state: 'Healthy',
    severity: 'ok',
    guidance: 'Device is online and responsive. Note: physical door position is unknown — no door sensor in v1.',
  };
}
