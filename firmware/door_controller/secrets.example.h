// Copy this file to `secrets.h` in the same folder and fill in real values.
// `secrets.h` is gitignored so credentials never leave your machine.

#pragma once

// ---- Local Access Point (Task 1 fallback) -----------------------------------
// Phone connects to this Wi-Fi to reach http://192.168.4.1
#define AP_SSID      "CUA_CUON_ESP32"
#define AP_PASSWORD  "12345678"        // >= 8 chars; change before deployment

// ---- Home Wi-Fi (Task 7) ----------------------------------------------------
#define WIFI_SSID    "your-home-ssid"
#define WIFI_PASSWORD "your-home-password"

// ---- HiveMQ Cloud broker (Task 7) -------------------------------------------
// Get these from your HiveMQ Cloud cluster overview.
#define MQTT_BROKER   "xxxxxxxxxxxxxxxxxxxxxxxx.s1.eu.hivemq.cloud"
#define MQTT_PORT     8883
#define MQTT_USERNAME "your-mqtt-user"
#define MQTT_PASSWORD "your-mqtt-password"

// ---- Topic prefix (must match the PWA's VITE_TOPIC_PREFIX) ------------------
// Use a hard-to-guess prefix. Do NOT use "door/command" or similar.
#define TOPIC_PREFIX  "home/hoa-door-7f3a"
