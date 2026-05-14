# ESP32 Rolling Door — Firmware

Single Arduino sketch (`door_controller/door_controller.ino`) that implements both:

- **Task 1** — Wi-Fi Access Point + local web page at `http://192.168.4.1`
- **Task 7** — Wi-Fi STA + MQTTS to HiveMQ Cloud

Both run together. The local AP is always available as a fallback when the home Wi-Fi or HiveMQ Cloud is down.

## Pin map

| Function | GPIO | Relay input |
|----------|------|-------------|
| Mở / Lên (OPEN) | `GPIO16` | IN1 |
| Dừng (STOP) | `GPIO17` | IN2 |
| Đóng / Xuống (CLOSE) | `GPIO18` | IN3 |

Low-trigger module: `HIGH = OFF`, `LOW = ON`. Default pulse `500 ms`.

## Prerequisites

- Arduino IDE 2.x
- ESP32 board package (Espressif): Boards Manager → "esp32"
- Library: **PubSubClient** by Nick O'Leary (Library Manager)
  (`WiFi`, `WiFiClientSecure`, and `WebServer` come with the ESP32 core.)

## Setup

1. Copy the secrets template:

   ```powershell
   Copy-Item secrets.example.h secrets.h
   ```

2. Edit `secrets.h` and fill in:
   - `AP_SSID` / `AP_PASSWORD` — local access point credentials
   - `WIFI_SSID` / `WIFI_PASSWORD` — your home Wi-Fi
   - `MQTT_BROKER` / `MQTT_USERNAME` / `MQTT_PASSWORD` — HiveMQ Cloud cluster (Task 6)
   - `TOPIC_PREFIX` — must match the PWA's `VITE_TOPIC_PREFIX`

   `secrets.h` is gitignored.

3. Open `door_controller/door_controller.ino` in Arduino IDE.

4. Select board: **Tools → Board → ESP32 Arduino → ESP32 Dev Module** (or your specific board).

5. Select the COM port: **Tools → Port**.

6. Upload (`Ctrl+U`).

## Verify (without a relay)

1. Open Serial Monitor at **115200 baud**.
2. Phone connects to Wi-Fi `CUA_CUON_ESP32` (or your `AP_SSID`).
3. Browse to `http://192.168.4.1`.
4. Tap **MỞ**, **DỪNG**, **ĐÓNG** — Serial Monitor logs each command.
5. If the home Wi-Fi credentials in `secrets.h` are valid, Serial Monitor also prints `STA IP:` and `MQTT connecting...`.

## Verify with the relay (Task 2)

Wire as documented in the plan:

```text
ESP32 5V/VIN → Relay VCC
ESP32 GND    → Relay GND
GPIO16       → IN1
GPIO17       → IN2
GPIO18       → IN3
```

Each command should click exactly one relay for ~500 ms. No two relays ON at the same time.

## Verify over MQTT (Task 7)

Use [MQTTX](https://mqttx.app/) connected to your HiveMQ Cloud cluster:

- Publish `OPEN`, `STOP`, or `CLOSE` to `<TOPIC_PREFIX>/command`.
- Subscribe to `<TOPIC_PREFIX>/device/status` (expect `ONLINE` retained).
- Subscribe to `<TOPIC_PREFIX>/device/last-command` (expect `OPEN_SENT` etc. when commands fire).

## Safety reminders (from the plan)

- The relay must only bridge the existing wall-panel button terminals using **COM + NO**, in parallel with the existing buttons.
- Never wire to the motor, capacitor, or 220V mains.
- Power the rolling-door system off before opening the wall panel.
- The firmware drives every relay pin HIGH (OFF) before `pinMode(OUTPUT)` to prevent any boot-time glitch from clicking a relay.

## Production notes

- `netClient.setInsecure()` skips TLS certificate validation. For a hardened deployment, replace with `netClient.setCACert(HIVEMQ_ROOT_CA)` using the ISRG Root X1 cert (or whichever HiveMQ uses).
- Consider increasing the keepalive (`mqtt.setKeepAlive(...)`) and adding a hardware watchdog (`esp_task_wdt_init`) once the device is permanently mounted.
