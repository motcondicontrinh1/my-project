// ============================================================================
// ESP32 Rolling Door Controller
// ----------------------------------------------------------------------------
// Combines Task 1 (local AP + web) and Task 7 (Wi-Fi STA + MQTTS to HiveMQ),
// plus telemetry for the developer-only "Power-Loss Troubleshooting Mode":
//
//   - Retained ONLINE on connect, retained OFFLINE as last-will (LWT).
//   - Periodic heartbeat (uptime, RSSI, free heap, millis).
//   - Boot diagnostics (reset reason, IP, firmware version, uptime).
//   - JSON command ack (cmd, result, pulse_ms, uptime).
//
// Safety:
//   - Relay pins are driven HIGH (OFF, low-trigger module) BEFORE pinMode().
//   - Only one relay is ON at any time; pulse defaults to 500 ms.
//   - The local web page is always available as a fallback when the home Wi-Fi
//     or HiveMQ Cloud is down.
//
// Wiring (see plan, "GPIO Mapping"):
//   GPIO16 -> Relay IN1 -> Mở / Lên   (OPEN)
//   GPIO17 -> Relay IN2 -> Dừng       (STOP)
//   GPIO18 -> Relay IN3 -> Đóng / Xuống (CLOSE)
//
// Required Arduino libraries:
//   - WiFi              (built into the ESP32 core)
//   - WebServer         (built into the ESP32 core)
//   - PubSubClient      by Nick O'Leary
//   - WiFiClientSecure  (built into the ESP32 core)
//   - esp_system.h      (built into the ESP32 core; for esp_reset_reason)
// ============================================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <esp_system.h>

#include "secrets.h"

// ---- Firmware version -------------------------------------------------------
#define FW_VERSION "0.2.0"

// ---- Pin map ----------------------------------------------------------------
constexpr int PIN_OPEN  = 16;
constexpr int PIN_STOP  = 17;
constexpr int PIN_CLOSE = 18;
constexpr int RELAY_PINS[] = { PIN_OPEN, PIN_STOP, PIN_CLOSE };
constexpr size_t N_RELAYS = sizeof(RELAY_PINS) / sizeof(RELAY_PINS[0]);

// Low-trigger relay module: HIGH = OFF, LOW = ON.
constexpr int RELAY_OFF = HIGH;
constexpr int RELAY_ON  = LOW;

constexpr unsigned long PULSE_MS         = 500;
constexpr unsigned long WIFI_STA_TIMEOUT = 20000;
constexpr unsigned long MQTT_RETRY_MS    = 5000;
constexpr unsigned long HEARTBEAT_MS     = 12000;  // 10-15 s window per plan.

// ---- Topics -----------------------------------------------------------------
#define TOPIC_COMMAND       TOPIC_PREFIX "/command"
#define TOPIC_STATUS        TOPIC_PREFIX "/device/status"
#define TOPIC_LAST_COMMAND  TOPIC_PREFIX "/device/last-command"
#define TOPIC_HEARTBEAT     TOPIC_PREFIX "/device/heartbeat"
#define TOPIC_DIAGNOSTICS   TOPIC_PREFIX "/device/diagnostics"

// ---- Globals ----------------------------------------------------------------
WebServer        server(80);
WiFiClientSecure netClient;
PubSubClient     mqtt(netClient);
unsigned long    lastMqttAttempt   = 0;
unsigned long    lastHeartbeatMs   = 0;

// ---- Reset reason -----------------------------------------------------------
const char* resetReasonStr(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON:   return "POWERON";
    case ESP_RST_EXT:       return "EXT";
    case ESP_RST_SW:        return "SW";
    case ESP_RST_PANIC:     return "PANIC";
    case ESP_RST_INT_WDT:   return "INT_WDT";
    case ESP_RST_TASK_WDT:  return "TASK_WDT";
    case ESP_RST_WDT:       return "WDT";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
    case ESP_RST_BROWNOUT:  return "BROWNOUT";
    case ESP_RST_SDIO:      return "SDIO";
    default:                return "UNKNOWN";
  }
}

// ---- Telemetry --------------------------------------------------------------
void publishHeartbeat() {
  if (!mqtt.connected()) return;
  char buf[128];
  int n = snprintf(buf, sizeof(buf),
    "{\"uptime\":%lu,\"rssi\":%d,\"heap\":%u,\"millis\":%lu}",
    millis() / 1000UL,
    WiFi.RSSI(),
    (unsigned)ESP.getFreeHeap(),
    millis());
  if (n > 0) mqtt.publish(TOPIC_HEARTBEAT, buf, false);
}

void publishDiagnostics() {
  if (!mqtt.connected()) return;
  char buf[192];
  String ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : String("0.0.0.0");
  int n = snprintf(buf, sizeof(buf),
    "{\"reason\":\"%s\",\"ip\":\"%s\",\"fw\":\"%s\",\"uptime\":%lu}",
    resetReasonStr(esp_reset_reason()),
    ip.c_str(),
    FW_VERSION,
    millis() / 1000UL);
  if (n > 0) mqtt.publish(TOPIC_DIAGNOSTICS, buf, /*retained=*/true);
}

void publishAck(const char* cmd, const char* result, unsigned long pulseMs) {
  if (!mqtt.connected()) return;
  char buf[112];
  int n = snprintf(buf, sizeof(buf),
    "{\"cmd\":\"%s\",\"result\":\"%s\",\"pulse_ms\":%lu,\"uptime\":%lu}",
    cmd, result, pulseMs, millis() / 1000UL);
  if (n > 0) mqtt.publish(TOPIC_LAST_COMMAND, buf, false);
}

// ---- Relay helpers ----------------------------------------------------------
void allRelaysOff() {
  for (size_t i = 0; i < N_RELAYS; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
  }
}

void pulse(int pin) {
  // Make sure no other relay is left active before pulsing.
  allRelaysOff();
  digitalWrite(pin, RELAY_ON);
  delay(PULSE_MS);
  digitalWrite(pin, RELAY_OFF);
}

void doCommand(const char* name, int pin) {
  Serial.printf("CMD: %s\n", name);
  unsigned long t0 = millis();
  pulse(pin);
  unsigned long elapsed = millis() - t0;
  publishAck(name, "OK", elapsed);
}

void doOpen()  { doCommand("OPEN",  PIN_OPEN);  }
void doStop()  { doCommand("STOP",  PIN_STOP);  }
void doClose() { doCommand("CLOSE", PIN_CLOSE); }

// ---- Local web page (Task 1) ------------------------------------------------
const char INDEX_HTML[] PROGMEM = R"HTML(
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cửa Cuốn (cục bộ)</title>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; background: #000; color: #fff;
      font-family: -apple-system, system-ui, sans-serif; }
    main { max-width: 480px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1.5px; }
    p  { color: #bbb; margin: 0 0 24px; }
    button { display: block; width: 100%; min-height: 96px;
      margin: 12px 0; border: 0; color: #000; font-size: 28px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
      cursor: pointer; }
    .open  { background: #0fa336; color: #fff; }
    .stop  { background: #f4b400; min-height: 128px; font-size: 36px; }
    .close { background: #e22718; color: #fff; }
    #log { color: #7e7e7e; font-size: 13px; margin-top: 16px;
      font-family: ui-monospace, Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>Cửa Cuốn — Cục bộ</h1>
    <p>Trang điều khiển dự phòng. Sử dụng khi không có Internet.</p>
    <button class="open"  onclick="send('open')">MỞ / LÊN</button>
    <button class="stop"  onclick="send('stop')">DỪNG</button>
    <button class="close" onclick="send('close')">ĐÓNG / XUỐNG</button>
    <p id="log">—</p>
  </main>
  <script>
    async function send(path) {
      const log = document.getElementById('log');
      log.textContent = path.toUpperCase() + ' …';
      try {
        const r = await fetch('/' + path, { method: 'POST' });
        log.textContent = path.toUpperCase() + ' → ' + (await r.text());
      } catch (e) {
        log.textContent = path.toUpperCase() + ' → lỗi: ' + e.message;
      }
    }
  </script>
</body>
</html>
)HTML";

void handleRoot()  { server.send_P(200, "text/html; charset=utf-8", INDEX_HTML); }
void handleOpen()  { doOpen();  server.send(200, "text/plain", "OPEN_ACK");  }
void handleStop()  { doStop();  server.send(200, "text/plain", "STOP_ACK");  }
void handleClose() { doClose(); server.send(200, "text/plain", "CLOSE_ACK"); }

// ---- Wi-Fi ------------------------------------------------------------------
void setupWifi() {
  WiFi.mode(WIFI_AP_STA);

  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("AP SSID:  "); Serial.println(AP_SSID);
  Serial.print("AP IP:    "); Serial.println(WiFi.softAPIP());

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("STA connecting");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_STA_TIMEOUT) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\nSTA IP:   "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nSTA: not connected, AP-only mode for now.");
  }
}

// ---- MQTT (Task 7) ----------------------------------------------------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();

  Serial.printf("MQTT [%s]: %s\n", topic, msg.c_str());

  if      (msg == "OPEN")  doOpen();
  else if (msg == "STOP")  doStop();
  else if (msg == "CLOSE") doClose();
  else                     Serial.println("MQTT: unknown payload, ignored");
}

void mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqtt.connected()) return;
  if (millis() - lastMqttAttempt < MQTT_RETRY_MS) return;
  lastMqttAttempt = millis();

  Serial.print("MQTT connecting... ");
  String clientId = "esp32-door-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Publish OFFLINE as the LWT so the PWA learns when we drop off.
  bool ok = mqtt.connect(
    clientId.c_str(),
    MQTT_USERNAME, MQTT_PASSWORD,
    TOPIC_STATUS, /*willQos=*/1, /*willRetain=*/true, "OFFLINE"
  );

  if (ok) {
    Serial.println("connected");
    mqtt.publish(TOPIC_STATUS, "ONLINE", /*retained=*/true);
    mqtt.subscribe(TOPIC_COMMAND, 1);
    publishDiagnostics();
    publishHeartbeat();
    lastHeartbeatMs = millis();
  } else {
    Serial.printf("failed rc=%d\n", mqtt.state());
  }
}

// ---- Setup / Loop -----------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.printf("\nESP32 rolling-door controller v%s booting...\n", FW_VERSION);
  Serial.printf("Reset reason: %s\n", resetReasonStr(esp_reset_reason()));

  // CRITICAL: drive every relay pin HIGH (OFF) before switching to OUTPUT.
  // ESP32 pins boot as inputs with pull state undefined; setting the output
  // buffer to HIGH first avoids any LOW glitch when pinMode flips to OUTPUT.
  for (size_t i = 0; i < N_RELAYS; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
  }
  allRelaysOff();
  Serial.println("Relays: all OFF");

  setupWifi();

  server.on("/",      HTTP_GET,  handleRoot);
  server.on("/open",  HTTP_POST, handleOpen);
  server.on("/stop",  HTTP_POST, handleStop);
  server.on("/close", HTTP_POST, handleClose);
  server.begin();
  Serial.println("HTTP server: started on port 80");

  // For development: skip CA validation. For production, replace with
  //   netClient.setCACert(HIVEMQ_ROOT_CA);
  netClient.setInsecure();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);
}

void loop() {
  server.handleClient();
  mqttReconnect();
  mqtt.loop();

  // Heartbeat tick.
  if (mqtt.connected() && millis() - lastHeartbeatMs >= HEARTBEAT_MS) {
    publishHeartbeat();
    lastHeartbeatMs = millis();
  }
}
