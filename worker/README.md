# Door Control Worker

Cloudflare Worker that acts as a secure proxy between the PWA and HiveMQ Cloud MQTT broker.

## What it does

1. Accepts `POST /command` with `{pin, cmd}` JSON body
2. Validates PIN server-side (constant-time comparison)
3. Rate limits: 10 requests/minute per IP
4. Connects to HiveMQ over WebSocket, publishes the command via MQTT 3.1.1
5. Returns success/error to the PWA

MQTT credentials never leave the Worker. The browser only knows the Worker URL and the user's PIN.

## Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put MQTT_URL
npx wrangler secret put MQTT_USERNAME
npx wrangler secret put MQTT_PASSWORD
npx wrangler secret put UI_PIN
```

Update `ALLOWED_ORIGIN` in `wrangler.toml` to your Vercel deployment URL, then:

```bash
npm run deploy
```

Copy the deployed URL (e.g. `https://door-control-worker.<subdomain>.workers.dev`) to:
- `VITE_WORKER_URL` in `pwa/.env.local`
- Vercel environment variables

## Local dev

```bash
npm run dev
```

This starts a local Worker at `http://localhost:8787`. Point `VITE_WORKER_URL` there for testing.

## Security notes

- PIN is compared using constant-time logic to prevent timing attacks
- MQTT credentials are stored as Cloudflare secrets, never in source or client bundle
- Rate limiting prevents brute-force PIN attempts
- CORS restricts requests to the configured origin
