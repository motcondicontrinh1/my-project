// Sends a door command to the Cloudflare Worker proxy.
// The Worker holds MQTT credentials — they never reach the browser.

const VALID = new Set(['OPEN', 'STOP', 'CLOSE']);

export async function sendCommand(cmd, pin, workerUrl) {
  if (!VALID.has(cmd)) throw new Error(`Invalid command: ${cmd}`);
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, cmd }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Worker ${res.status}: ${text}`);
  }
}
