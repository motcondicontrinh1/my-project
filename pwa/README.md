# Cửa Cuốn — PWA

Mobile-first React PWA that controls the rolling door over MQTT (HiveMQ Cloud) using WebSocket Secure.

Implements Tasks 8 and 9 of the plan.

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 5 |
| Framework | React 18 |
| MQTT | mqtt.js 5 over WSS, port 8884 |
| PWA | vite-plugin-pwa (Workbox-generated SW) |
| Lang | Vietnamese (`vi`) |

## Setup

```powershell
cd pwa
npm install
Copy-Item .env.example .env.local
# edit .env.local with your HiveMQ + topic prefix + UI PIN
npm run dev
```

Open `http://localhost:5173/` on your phone (same Wi-Fi as the dev machine) — replace `localhost` with the dev machine's LAN IP. The dev server binds to all interfaces.

## Environment variables

All vars must be prefixed `VITE_` to reach the bundle.

| Var | Description |
|---|---|
| `VITE_MQTT_URL` | `wss://<cluster>.s1.eu.hivemq.cloud:8884/mqtt` |
| `VITE_MQTT_USERNAME` | HiveMQ user |
| `VITE_MQTT_PASSWORD` | HiveMQ password |
| `VITE_TOPIC_PREFIX` | Must match firmware's `TOPIC_PREFIX` (e.g. `home/hoa-door-7f3a`) |
| `VITE_UI_PIN` | 4–8 char gate PIN |

> ⚠ **Security caveat (per plan, Task 9):** these credentials end up in the frontend bundle. Acceptable for early testing only. The "Future Improvements" section calls for a backend that holds the broker credentials and proxies authenticated requests.

## Build & preview

```powershell
npm run build       # emits dist/
npm run preview     # serves dist/ on a LAN-accessible host
npm run lint        # runs ESLint on src/
```

`dist/` includes the service worker (`sw.js`, `workbox-*.js`) and the web app manifest, so the page is installable to the home screen on Android/iOS.

## Deploy to Vercel (Task 10)

1. Push the repo (or this `pwa/` subfolder) to GitHub.
2. Vercel → New Project → import the repo.
3. **Root directory** = `pwa` (if the repo is the bundle root).
4. **Framework preset** = Vite.
5. Add the same `VITE_*` env vars in **Project Settings → Environment Variables**.
6. Deploy.
7. Open the Vercel URL on a family phone, tap the browser's **Add to Home Screen**.

## UI behaviour (per plan, Task 8)

- **PIN gate**: app is locked behind `VITE_UI_PIN` until unlocked.
- **Status bar**: Thiết bị (ONLINE/OFFLINE), MQTT (Connected/Disconnected), Lệnh gần nhất.
- **Mở cửa** (green): asks "Bạn chắc chắn muốn MỞ CỬA?" before sending.
- **Dừng** (amber, oversized): single tap, no confirmation. Emergency-stop UX.
- **Đóng cửa** (red): asks "Bạn chắc chắn muốn ĐÓNG CỬA?" before sending.
- The footer reminds the user that the displayed status reflects only what was sent, not the actual door position. (No physical sensor in v1.)

## Icons

The current `vite.config.js` references `icon-192.png`, `icon-512.png`, and `icon-512-maskable.png` in the manifest, but only `favicon.svg` is committed. Generate the PNGs (e.g. with [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)) and drop them into `pwa/public/` before publishing.

## Developer Mode (Power-Loss Troubleshooting)

The PWA has a developer-only Troubleshooting panel that surfaces device telemetry and infers a state label with safety-first guidance. It is **off by default** so the family-facing UI stays clean.

### Enable

Add a URL query flag:

| URL | Effect |
|---|---|
| `?dev=1` or `?trace=1` | Show the Troubleshooting panel and subscribe to dev MQTT topics |
| `?preview=1` | Suppress the "missing config" banner so the UI can be inspected without real broker creds |
| `?preview=1&dev=1` | Both — main test scenario from the plan |

Examples:

- `http://127.0.0.1:5173/?dev=1`
- `http://127.0.0.1:5173/?preview=1&dev=1`

### What the panel shows

- **Browser MQTT** — is the PWA's mqtt.js client currently connected
- **Device status** — last retained `ONLINE` / `OFFLINE` from `<prefix>/device/status`
- **Last command sent** — wall-clock time the PWA published to `<prefix>/command`
- **Last command ack** — parsed JSON from `<prefix>/device/last-command` (firmware v0.2+ publishes `{cmd, result, pulse_ms, uptime}`)
- **Heartbeat** — age of the last `<prefix>/device/heartbeat` (firmware sends every ~12 s)
- **Diagnostics** — reset reason, IP, firmware version, uptime at last reconnect

### Inferred state

The panel shows one of:

| State | Severity | When |
|---|---|---|
| `Healthy` | ok | Device ONLINE, recent heartbeat, no unconfirmed commands |
| `Broker/browser disconnected` | high | mqtt.js is not connected to the broker |
| `Device offline` | high | Device retained OFFLINE (LWT fired). Guidance specialises if a command was sent in the last 60 s — likely house power, router, or ESP32 power loss |
| `Device rebooted after command` | medium | Diagnostics arrived after a command with uptime ≤ 30 s |
| `Telemetry stale` | medium | No heartbeat in `HEARTBEAT_STALE_MS` (30 s) despite ONLINE status |
| `Command unconfirmed` | medium | Command sent ≥ 5 s ago with no matching ack |

The panel never claims actual door position — there is no physical sensor in v1. All guidance starts from "use the physical remote / wall button if available".

### Verbose event log

When dev mode is on, the panel includes an **Event log** that captures every interesting moment as it happens:

- MQTT lifecycle (connecting / connected / subscribed / reconnecting / closed / offline / error / end)
- Every inbound message (`mqtt-rx`) with topic + raw payload
- Every outbound command (sent / published / publish failed)
- Telemetry parses (`telemetry`) — heartbeats at `debug`, status / diagnostics / acks at `info`, parse failures at `warn`
- UI events — PIN unlock, confirm requested / confirmed / cancelled
- State transitions — every change in the inferred Troubleshooting state

The log is a 300-entry ring buffer kept in memory. While dev mode is on, every entry is also mirrored to the browser console with the matching level (`console.log` / `warn` / `error`), so you can filter and inspect with the regular DevTools tools.

Use the level filter pills (`all` / `info` / `warn` / `error` / `debug`) to narrow the list, and **Clear** to reset the buffer.

### Manual MQTT testing (without hardware)

Use [MQTTX](https://mqttx.app/) or HiveMQ Cloud's web client to publish to `<prefix>/device/status` and friends; the PWA picks them up live. Useful payloads:

```text
# topic: <prefix>/device/status         (retained)
ONLINE
OFFLINE

# topic: <prefix>/device/heartbeat
{"uptime":1234,"rssi":-67,"heap":120000,"millis":1234567}

# topic: <prefix>/device/diagnostics    (retained)
{"reason":"POWERON","ip":"192.168.1.42","fw":"0.2.0","uptime":1}

# topic: <prefix>/device/last-command
{"cmd":"OPEN","result":"OK","pulse_ms":500,"uptime":1234}
```

Stop publishing heartbeats and watch the panel transition to `Telemetry stale` after 30 s, then publish a retained `OFFLINE` to `<prefix>/device/status` and watch it switch to `Device offline`.

## Project layout

```
pwa/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── .env.example
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── lib/
    │   ├── mqtt.js
    │   ├── telemetry.js          # JSON payload parsers (last-command, heartbeat, diagnostics)
    │   ├── inference.js          # Pure state inference for the dev panel
    │   ├── logger.js             # Ring-buffer event logger + useLogs hook
    │   └── useUrlFlags.js        # Reads ?dev / ?trace / ?preview flags
    └── components/
        ├── PinGate.jsx
        ├── StatusBar.jsx
        ├── Controls.jsx
        ├── ConfirmDialog.jsx
        └── TroubleshootPanel.jsx # Renders only when ?dev=1 / ?trace=1
```
