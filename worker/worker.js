// Cloudflare Worker — PIN-authenticated MQTT command proxy.
// Zero runtime dependencies. Minimal MQTT 3.1.1 binary framing over WebSocket.

const VALID_CMDS = new Set(['OPEN', 'STOP', 'CLOSE']);
const rateMap = new Map(); // IP → {count, resetAt}

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // Always iterate to prevent length-based timing leak
    let d = 1;
    for (let i = 0; i < ab.length; i++) d |= ab[i] ^ ab[i];
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function checkRate(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60000 };
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= 10;
}

// --- MQTT 3.1.1 minimal framing ---

function encodeUTF8(str) {
  const bytes = new TextEncoder().encode(str);
  const buf = new Uint8Array(2 + bytes.length);
  buf[0] = (bytes.length >> 8) & 0xff;
  buf[1] = bytes.length & 0xff;
  buf.set(bytes, 2);
  return buf;
}

function encodeRemainingLength(len) {
  const out = [];
  do {
    let byte = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) byte |= 0x80;
    out.push(byte);
  } while (len > 0);
  return new Uint8Array(out);
}

function buildConnect(clientId, username, password) {
  const proto = new Uint8Array([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]); // "MQTT"
  const level = new Uint8Array([0x04]); // 3.1.1
  const flags = new Uint8Array([0xc2]); // username+password+clean
  const keep = new Uint8Array([0x00, 0x3c]); // 60s
  const cid = encodeUTF8(clientId);
  const usr = encodeUTF8(username);
  const pwd = encodeUTF8(password);
  const payload = new Uint8Array(proto.length + level.length + flags.length + keep.length + cid.length + usr.length + pwd.length);
  let off = 0;
  for (const part of [proto, level, flags, keep, cid, usr, pwd]) {
    payload.set(part, off);
    off += part.length;
  }
  const rl = encodeRemainingLength(payload.length);
  const pkt = new Uint8Array(1 + rl.length + payload.length);
  pkt[0] = 0x10;
  pkt.set(rl, 1);
  pkt.set(payload, 1 + rl.length);
  return pkt;
}

function buildPublish(topic, message) {
  const topicBytes = encodeUTF8(topic);
  const msgBytes = new TextEncoder().encode(message);
  const payloadLen = topicBytes.length + msgBytes.length;
  const rl = encodeRemainingLength(payloadLen);
  const pkt = new Uint8Array(1 + rl.length + payloadLen);
  pkt[0] = 0x30; // QoS 0, no retain
  pkt.set(rl, 1);
  pkt.set(topicBytes, 1 + rl.length);
  pkt.set(msgBytes, 1 + rl.length + topicBytes.length);
  return pkt;
}

async function mqttPublish(env, topic, message) {
  const ws = new WebSocket(env.MQTT_URL, 'mqtt');
  const clientId = `cf-${Date.now().toString(36)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);

    ws.addEventListener('open', () => {
      ws.send(buildConnect(clientId, env.MQTT_USERNAME, env.MQTT_PASSWORD));
    });

    ws.addEventListener('message', async (ev) => {
      const data = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(await ev.data.arrayBuffer());
      // CONNACK: 0x20 0x02 XX RC
      if (data[0] === 0x20 && data.length >= 4) {
        if (data[3] !== 0x00) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`CONNACK rc=${data[3]}`));
          return;
        }
        ws.send(buildPublish(topic, message));
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.addEventListener('error', (e) => { clearTimeout(timeout); reject(e); });
    ws.addEventListener('close', () => { clearTimeout(timeout); });
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors(env) });
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRate(ip)) {
      return new Response('Rate limit exceeded', { status: 429, headers: cors(env) });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors(env) });
    }

    const { pin, cmd } = body;
    if (!pin || !cmd || !VALID_CMDS.has(cmd)) {
      return new Response('Bad request: need {pin, cmd}', { status: 400, headers: cors(env) });
    }

    if (!timingSafeEqual(pin, env.UI_PIN)) {
      return new Response('Unauthorized', { status: 401, headers: cors(env) });
    }

    const topic = `${env.TOPIC_PREFIX}/command`;
    try {
      await mqttPublish(env, topic, cmd);
    } catch (e) {
      return new Response(`Broker error: ${e.message}`, { status: 500, headers: cors(env) });
    }

    return new Response('OK', { status: 200, headers: cors(env) });
  },
};
