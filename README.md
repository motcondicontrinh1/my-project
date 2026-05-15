# HTML Agent — BMW M Bundle

A reusable template bundle for generating BMW M-styled, browser-openable HTML review artifacts. Designed for AI agents (Codex, etc.) that produce human-facing deliverables such as reports, annotated diffs, dashboards, comparisons, and visual summaries.

This repo also carries the **worked example** the bundle was built around — an ESP32 + React PWA rolling-door controller — both as a rendered HTML plan and as runnable code.

## What's Inside

```
├── AGENTS.md                              # Agent output rules
├── DESIGN.md                              # Visual direction & design tokens
├── styles.css                             # Shared stylesheet (link, don't inline)
├── INSTALL_SKILL.md                       # How to install the Codex skill
├── esp_32_rolling_door_pwa_plan_revised.md  # Source plan
├── esp32-rolling-door-plan.html           # Plan rendered as a review artifact
├── firmware/
│   ├── README.md
│   └── door_controller/
│       ├── door_controller.ino            # ESP32 sketch (Tasks 1 + 7)
│       └── secrets.example.h              # secrets.h template (gitignored)
├── pwa/
│   ├── README.md
│   ├── package.json                       # Vite + React 18 + mqtt.js + vite-plugin-pwa
│   ├── vite.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/favicon.svg
│   └── src/                               # App, components, mqtt client, styles
└── skills/
    └── html-review-artifacts/
        ├── SKILL.md                       # Skill definition
        ├── assets/                        # review-template.html skeleton
        ├── references/                    # validation-checklist.md
        └── agents/                        # Agent interface configs
```

## Two parts, one repo

### 1. The HTML review artifact bundle

The bundle (`AGENTS.md`, `DESIGN.md`, `styles.css`, `skills/`) is reusable in any project. Drop it in, point your agent at it, and ask for an HTML review artifact — it will link `./styles.css` and follow the design system automatically.

Quick manual start: copy `skills/html-review-artifacts/assets/review-template.html`, edit, open in a browser. No build step.

### 2. The ESP32 rolling-door worked example

The plan (`esp_32_rolling_door_pwa_plan_revised.md`) describes a safe, family-friendly rolling-door controller built from an ESP32, a 4-channel relay, HiveMQ Cloud, and a Vite + React PWA. It is rendered for review at `esp32-rolling-door-plan.html` and scaffolded as runnable code:

| Folder | Plan tasks | Status |
|---|---|---|
| `firmware/` | 1 (local web) + 7 (Wi-Fi + MQTTS) | Compiles in Arduino IDE; needs hardware to run |
| `pwa/` | 8 (UI) + 9 (MQTT WSS) | `npm install && npm run build` passes; needs HiveMQ + Vercel |

Tasks 0 and 2–5 (wiring, bench, install) and Tasks 6 and 10 (HiveMQ account, Vercel deploy) are out-of-scope for code-only execution and are documented in the plan / sub-READMEs.

See `firmware/README.md` and `pwa/README.md` for setup and run instructions.

## Design Principles

- **Black canvas, high-contrast text** — dark motorsport aesthetic.
- **Sharp rectangles** — no rounded decorative cards.
- **Sparse M tricolor accents** — light blue → dark blue → red, used only on logos, dividers, and badges.
- **Semantic HTML** — shallow structure using `main`, `nav`, `header`, `section`, `article`, `footer`.
- **No build step for the bundle** — every review artifact opens directly in a browser.

## License

Private bundle — not published.

