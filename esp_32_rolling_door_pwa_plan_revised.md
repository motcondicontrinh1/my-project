# ESP32 Rolling Door PWA Controller — Revised Implementation Plan

## Overview

Build a safe rolling-door control system for a Vietnamese family using an ESP32, a 4-channel 5V low-trigger relay module, and a simple phone-friendly web app / PWA.

The system must keep the existing RF remote and wall button panel working normally. The ESP32 does **not** control the motor directly. It only uses relay dry contacts to simulate pressing the existing wall-panel buttons: **Mở / Dừng / Đóng**.

---

## Safety Principle

**Never wire the ESP32 or relay directly to the motor, capacitor, mains 220V, or motor power lines.**

Correct wiring path:

```text
Phone / PWA
   ↓
MQTT / Local Web
   ↓
ESP32
   ↓
Relay COM + NO dry contact
   ↓
Existing wall-panel button terminals
   ↓
Original door controller
   ↓
Door motor
```

Relay contacts are connected **in parallel** with the existing wall buttons, so the wall panel and RF remote continue to work even if the ESP32 is offline.

---

## Architecture

### Phase 1: Local test first

```text
Phone browser
   ↓ local Wi‑Fi
ESP32 local web page
   ↓ GPIO pulse
Relay module
   ↓ COM + NO
Wall-panel button terminals
```

Purpose: verify ESP32, relay, and button-pulse logic before adding cloud control.

### Phase 2: Cloud PWA control

```text
Phone / PWA
   ↓ WSS
HiveMQ Cloud MQTT broker
   ↓ MQTTS
ESP32
   ↓ Relay dry contact
Wall-panel button terminals
```

Purpose: control the door from outside the home network.

---

## Key Decisions

| Aspect | Decision |
|--------|----------|
| First milestone | ESP32 local web control |
| Final client | React PWA hosted on Vercel |
| Cloud communication | MQTT over WebSocket for PWA, MQTTS for ESP32 |
| MQTT broker | HiveMQ Cloud free serverless cluster |
| Hardware action | Relay dry-contact pulse to wall-panel button terminals |
| Existing controls | RF remote and wall panel remain functional |
| Relay module | 4-channel 5VDC opto-isolated low-trigger relay |
| Relay logic | LOW = ON, HIGH = OFF |
| Pulse duration | 300–800 ms, default 500 ms |
| Door status | Command/status only at first, not true door position |
| Future sensor | Reed switch / limit sensor for real open-close status |
| Security v1 | MQTT credentials + hard-to-guess topic prefix + UI PIN |
| Security later | Backend auth, per-user access, no MQTT credentials in frontend |

---

## GPIO Mapping

Use one consistent mapping across firmware, wiring, and documentation:

| Function | ESP32 GPIO | Relay input | Relay contact | Wall-panel button |
|----------|------------|-------------|---------------|-------------------|
| Mở / Lên | GPIO16 | IN1 | Relay 1 COM + NO | Open / Up button terminals |
| Dừng | GPIO17 | IN2 | Relay 2 COM + NO | Stop button terminals |
| Đóng / Xuống | GPIO18 | IN3 | Relay 3 COM + NO | Close / Down button terminals |
| Spare | unused | IN4 | Relay 4 | Leave empty |

Relay power:

```text
ESP32 5V / VIN  → Relay VCC
ESP32 GND       → Relay GND
```

For low-trigger relay modules:

```text
GPIO HIGH → relay OFF
GPIO LOW  → relay ON
```

Firmware must set all relay pins to OFF immediately on boot.

---

## MQTT Topics

Use a private prefix instead of generic public-looking topics.

Example:

```text
home/hoa-door-7f3a/command
home/hoa-door-7f3a/device/status
home/hoa-door-7f3a/device/last-command
```

### Command topic

`home/hoa-door-7f3a/command`

Allowed payloads:

```text
OPEN
STOP
CLOSE
```

### Device status topic

`home/hoa-door-7f3a/device/status`

Suggested payloads:

```text
ONLINE
OFFLINE
MQTT_CONNECTED
MQTT_DISCONNECTED
```

### Last-command topic

`home/hoa-door-7f3a/device/last-command`

Suggested payloads:

```text
OPEN_SENT
STOP_SENT
CLOSE_SENT
```

Important: until a physical door sensor is installed, the app should say **“Lệnh gần nhất”** or **“Last command”**, not **“Cửa đang mở/đóng”**.

---

## Task 0: Prepare tools and safety checklist

**Objective:** Get everything ready before wiring to the real door.

**Need:**

- ESP32 DevKit
- 4-channel 5V opto-isolated low-trigger relay module
- Jumper wires for ESP32 → relay
- Short electrical wire for relay → wall panel
- USB charger 5V 2A + micro-USB cable
- Multimeter with continuity mode
- Small screwdriver
- Electrical tape / heat shrink
- Plastic electrical box
- Domino / Wago / terminal blocks

**Safety checklist:**

1. Do not touch or wire anything while the rolling-door power is on.
2. Take photos of the original wall-panel wiring before touching anything.
3. Use a multimeter to identify each button pair.
4. Do not assume wire color means function.
5. Do not connect to motor lines or 220V lines.

---

## Task 1: ESP32 local web app

**Objective:** Make ESP32 host a simple local control page first.

**Steps:**

1. Install Arduino IDE.
2. Install ESP32 board package.
3. Upload a basic Blink test to confirm upload works.
4. Create ESP32 Wi‑Fi Access Point, for example:

```text
SSID: CUA_CUON_ESP32
Password: 12345678
URL: http://192.168.4.1
```

5. Create a local web page with 3 buttons:

```text
MỞ / LÊN
DỪNG
ĐÓNG / XUỐNG
```

6. Each button calls an ESP32 route:

```text
/open
/stop
/close
```

7. Each route pulses one GPIO for 500 ms.

**Test without relay:**

- Open Serial Monitor.
- Press each web button.
- Confirm ESP32 logs the correct command.

---

## Task 2: Relay bench test, not connected to door yet

**Objective:** Confirm relay module works safely before touching the wall panel.

**Wiring:**

```text
ESP32 5V/VIN → Relay VCC
ESP32 GND    → Relay GND
GPIO16       → IN1
GPIO17       → IN2
GPIO18       → IN3
```

**Steps:**

1. Power ESP32 by USB charger or computer USB.
2. Open local web page.
3. Press MỞ / LÊN.
4. Confirm Relay 1 clicks once and releases.
5. Press DỪNG.
6. Confirm Relay 2 clicks once and releases.
7. Press ĐÓNG / XUỐNG.
8. Confirm Relay 3 clicks once and releases.
9. Confirm no two relays are ON at the same time.

**Pass condition:**

Each command activates only its own relay for about 500 ms, then all relays return OFF.

---

## Task 3: Identify wall-panel button terminals

**Objective:** Find the two terminals of each existing wall button.

**Steps:**

1. Turn off power to the rolling-door system.
2. Open the wall panel.
3. Photograph the original wiring clearly.
4. Set multimeter to continuity mode.
5. For the OPEN / UP button:
   - Find the two terminals that become connected only when the button is pressed.
   - Mark them as `OPEN_A` and `OPEN_B`.
6. Repeat for STOP:
   - Mark `STOP_A` and `STOP_B`.
7. Repeat for CLOSE / DOWN:
   - Mark `CLOSE_A` and `CLOSE_B`.

**Do not remove existing wires unless absolutely necessary.**

---

## Task 4: Connect relay dry contacts to wall panel

**Objective:** Wire the relay contacts in parallel with the existing buttons.

**Wiring:**

| Relay | Contact pins | Connect to |
|-------|--------------|------------|
| Relay 1 | COM + NO | `OPEN_A` + `OPEN_B` |
| Relay 2 | COM + NO | `STOP_A` + `STOP_B` |
| Relay 3 | COM + NO | `CLOSE_A` + `CLOSE_B` |
| Relay 4 | unused | Leave empty |

Use **COM + NO**, not NC.

**Meaning:**

When Relay 1 closes COM + NO, it is the same as pressing the OPEN button manually.

---

## Task 5: Local full-system test

**Objective:** Test the real door using local ESP32 web control only.

**Steps:**

1. Keep the physical STOP button or RF remote nearby.
2. Power ESP32 and relay.
3. Confirm all relays are OFF after boot.
4. Test physical wall buttons first:
   - OPEN works.
   - STOP works.
   - CLOSE works.
5. Test RF remote still works.
6. Open ESP32 local web page.
7. Press OPEN briefly.
8. Immediately test STOP.
9. Press CLOSE briefly.
10. Confirm direction mapping is correct.

**Pass condition:**

- Wall panel still works.
- RF remote still works.
- ESP32 web buttons work.
- No wrong direction.
- No relay stays stuck ON.

---

## Task 6: Set up HiveMQ Cloud broker

**Objective:** Add remote control from outside the home network.

**Steps:**

1. Sign up for HiveMQ Cloud.
2. Create a free serverless cluster.
3. Create MQTT credentials.
4. Note:
   - Broker host
   - Port 8883 for ESP32 MQTTS
   - Port 8884 for PWA WSS
   - Username
   - Password
5. Test with MQTTX:
   - Subscribe to command topic.
   - Publish test messages.

**Security note:**

Do not use simple topics like `door/command`. Use a unique prefix such as:

```text
home/hoa-door-7f3a/command
```

---

## Task 7: ESP32 firmware — Wi‑Fi + MQTT

**Objective:** ESP32 connects to home Wi‑Fi and HiveMQ Cloud.

**Steps:**

1. Add home Wi‑Fi SSID and password.
2. Use `WiFiClientSecure`.
3. Use `PubSubClient` or another MQTT client.
4. Connect to HiveMQ on port 8883.
5. Subscribe to command topic.
6. On successful connection, publish `ONLINE`.
7. Add reconnect logic.
8. Keep local web page as fallback if possible.

**Test:**

Use MQTTX to publish:

```text
OPEN
STOP
CLOSE
```

ESP32 should log the command and pulse the corresponding relay.

---

## Task 8: React PWA setup

**Objective:** Build a simple mobile-first PWA for the family.

**Steps:**

1. Create project:

```bash
npm create vite@latest door-control -- --template react
```

2. Build one screen with:

```text
Mở cửa
Dừng
Đóng cửa
```

3. Add clear colors:

```text
Mở cửa: green / blue
Dừng: yellow / orange, large and central
Đóng cửa: red
```

4. Add connection status:

```text
Thiết bị: Online / Offline
MQTT: Connected / Disconnected
Lệnh gần nhất: OPEN / STOP / CLOSE
```

5. Add a confirmation step for OPEN and CLOSE:

```text
Bạn chắc chắn muốn MỞ CỬA?
Bạn chắc chắn muốn ĐÓNG CỬA?
```

6. Add a simple PIN gate in UI before showing controls.

**Note:** UI PIN is not strong security by itself, but it prevents accidental taps and casual access.

---

## Task 9: React PWA MQTT connection

**Objective:** PWA sends commands through HiveMQ over WebSocket.

**Steps:**

1. Install MQTT.js:

```bash
npm install mqtt
```

2. Connect using WSS on port 8884.
3. Publish commands to:

```text
home/hoa-door-7f3a/command
```

4. Subscribe to:

```text
home/hoa-door-7f3a/device/status
home/hoa-door-7f3a/device/last-command
```

5. Show connection and last command in UI.

**Important security limitation:**

If the PWA connects directly to MQTT, MQTT credentials will be present in the frontend bundle. This is acceptable only for early testing. For a production-level system, add a backend API or authentication layer later.

---

## Task 10: Deploy PWA to Vercel

**Objective:** Make the PWA accessible from family phones.

**Steps:**

1. Push React project to GitHub.
2. Connect GitHub repo to Vercel.
3. Add environment variables in Vercel.
4. Deploy.
5. Open the Vercel URL on phones.
6. Add to Home Screen on Android/iOS.
7. Test commands while on mobile data.

**Test:**

Phone on mobile data → PWA → HiveMQ → ESP32 → relay click.

---

## Task 11: Final hardware installation

**Objective:** Install the ESP32 and relay safely.

**Steps:**

1. Place ESP32 + relay inside a plastic electrical box.
2. Keep relay terminal wiring neat and labeled.
3. Use terminal blocks / Wago / domino for wire joins.
4. Avoid loose Dupont wires for permanent wall-panel connections.
5. Use USB charger 5V 2A to power ESP32 permanently.
6. Confirm ESP32 reconnects after power loss.
7. Confirm all relays are OFF after reboot.
8. Close the box only after full testing.

---

## Hardware Status

| Item | Status |
|------|--------|
| ESP32 DevKit | Have |
| Jumper wires F-to-F | Have |
| 4-channel relay module 5VDC opto low-trigger | Shipping |
| USB charger 5V 2A + cable | Need |
| Short electrical wire 0.5–0.75 mm² | Need |
| Multimeter | Need / confirm |
| Domino / Wago / terminal blocks | Need |
| Plastic electrical box | Need |
| Electrical tape / heat shrink | Need |

---

## Testing Matrix

| Test | Expected result |
|------|-----------------|
| ESP32 boot | All relays OFF |
| Local web OPEN | Relay 1 clicks once |
| Local web STOP | Relay 2 clicks once |
| Local web CLOSE | Relay 3 clicks once |
| MQTT OPEN | Relay 1 clicks once |
| MQTT STOP | Relay 2 clicks once |
| MQTT CLOSE | Relay 3 clicks once |
| Physical OPEN button | Door opens normally |
| Physical STOP button | Door stops normally |
| Physical CLOSE button | Door closes normally |
| RF remote | Still works normally |
| Internet down | Physical controls still work |
| ESP32 power loss | Physical controls still work |
| ESP32 reboot | No relay accidentally turns ON |

---

## Estimated Latency

| Mode | Expected latency |
|------|------------------|
| Local ESP32 web page | ~50–200 ms |
| PWA via HiveMQ Cloud | ~100–500 ms |

Actual latency depends on Wi‑Fi, internet, HiveMQ region, and phone connection.

---

## Future Improvements

- Magnetic reed switch to detect real door open/closed state.
- Activity log.
- Per-user authentication.
- Backend API so MQTT credentials are not exposed in frontend.
- Push notification if door is left open.
- Auto-close timer with safety confirmation.
- Physical emergency stop input.
- Watchdog timer and fail-safe reboot handling.

---

## Implementation Order

Recommended order:

```text
1. Local ESP32 web app without relay
2. Relay bench test
3. Identify wall-panel terminals
4. Local full-system test
5. HiveMQ setup
6. ESP32 MQTT firmware
7. React PWA
8. Vercel deployment
9. Final installation
10. Future sensor/security upgrades
```

This order reduces risk because the real door is only connected after the ESP32 and relay behavior are already tested.

