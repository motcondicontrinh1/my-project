// Cloudflare Worker — PIN-authenticated MQTT command proxy.
// Two endpoints:
//   POST /        body {pin, cmd}        — direct command (PWA + simple Siri shortcuts)
//   POST /voice   body {pin, transcript} — natural-language voice routing
//                                          regex fast path → Groq LLM fallback
//
// Required secrets: MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, UI_PIN
// Optional secrets: GROQ_API_KEY (enables LLM fallback on /voice)
// Required KV bindings: BANS (persists PIN-failure counts and 24h IP bans)
//
// Security:
//   - Rate limit: 10 requests/minute/IP (in-memory, per-isolate)
//   - Ban: 10 wrong PINs → 24h ban (KV-persisted across isolates)

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

// --- IP ban (10 wrong PINs → 24h ban, persisted in KV) ------------------

const BAN_THRESHOLD = 10;
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;
const KV_TTL_S = 24 * 60 * 60;

async function checkBan(ip, env) {
  if (!env.BANS) return null;
  try {
    const raw = await env.BANS.get(`ip:${ip}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.bannedUntil && entry.bannedUntil > Date.now()) {
      return entry.bannedUntil;
    }
    return null;
  } catch {
    return null; // fail open — don't lock user out on KV outage
  }
}

async function recordPinFailure(ip, env) {
  if (!env.BANS) return;
  try {
    const raw = await env.BANS.get(`ip:${ip}`);
    const entry = raw ? JSON.parse(raw) : { fails: 0 };
    entry.fails = (entry.fails || 0) + 1;
    if (entry.fails >= BAN_THRESHOLD) {
      entry.bannedUntil = Date.now() + BAN_DURATION_MS;
    }
    await env.BANS.put(`ip:${ip}`, JSON.stringify(entry), { expirationTtl: KV_TTL_S });
  } catch {
    /* ignore — best effort */
  }
}

async function clearPinFailures(ip, env) {
  if (!env.BANS) return;
  try { await env.BANS.delete(`ip:${ip}`); } catch { /* ignore */ }
}

// --- Voice command matching ----------------------------------------------

function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const PATTERNS = {
  STOP:  /\b(dung|stop)\b/i,
  OPEN:  /\b(mo|len)\b/i,
  CLOSE: /\b(dong|xuong)\b/i,
};

function matchByRegex(transcript) {
  if (!transcript) return null;
  const normalized = stripDiacritics(transcript.trim().toLowerCase());
  for (const [cmd, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(normalized)) return cmd;
  }
  return null;
}

const GROQ_SYSTEM_PROMPT =
  'Bạn là bộ phân loại lệnh điều khiển cửa cuốn. ' +
  'Người dùng nói tiếng Việt tự nhiên. Phân loại ý định thành đúng 1 trong 4 giá trị:\n' +
  '- OPEN: muốn mở cửa / kéo cửa lên / nâng cửa\n' +
  '- CLOSE: muốn đóng cửa / hạ cửa xuống\n' +
  '- STOP: muốn dừng cửa / ngừng chuyển động\n' +
  '- UNKNOWN: không liên quan đến cửa cuốn hoặc không rõ ý định\n' +
  'Trả lời CHÍNH XÁC JSON dạng {"intent":"<value>"} — không giải thích, không thêm gì.';

async function classifyByGroq(transcript, env) {
  if (!env.GROQ_API_KEY) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: GROQ_SYSTEM_PROMPT },
        { role: 'user',   content: transcript },
      ],
      max_tokens: 30,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  let parsed;
  try { parsed = JSON.parse(content); } catch { return null; }
  const intent = parsed.intent;
  return VALID_CMDS.has(intent) ? intent : null;
}

// --- MQTT 3.1.1 minimal framing ------------------------------------------

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
  const proto = new Uint8Array([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]);
  const level = new Uint8Array([0x04]);
  const flags = new Uint8Array([0xc2]);
  const keep = new Uint8Array([0x00, 0x3c]);
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
  pkt[0] = 0x30;
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

// --- Request handlers ----------------------------------------------------

async function handleDirect(body, env) {
  const { pin, cmd } = body;
  if (!pin || !cmd || !VALID_CMDS.has(cmd)) {
    return { status: 400, text: 'Bad request: need {pin, cmd}' };
  }
  if (!timingSafeEqual(pin, env.UI_PIN)) {
    return { status: 401, text: 'Unauthorized' };
  }
  try {
    await mqttPublish(env, `${env.TOPIC_PREFIX}/command`, cmd);
  } catch (e) {
    return { status: 500, text: `Broker error: ${e.message}` };
  }
  return { status: 200, text: 'OK' };
}

async function handleVoice(body, env) {
  const { pin, transcript } = body;
  if (!pin || typeof transcript !== 'string' || !transcript.trim()) {
    return { status: 400, text: 'Bad request: need {pin, transcript}' };
  }
  if (!timingSafeEqual(pin, env.UI_PIN)) {
    return { status: 401, text: 'Unauthorized' };
  }

  // Fast path: regex
  let cmd = matchByRegex(transcript);
  let route = 'regex';

  // Fallback: Groq LLM
  if (!cmd) {
    try {
      cmd = await classifyByGroq(transcript, env);
      route = 'llm';
    } catch (e) {
      return { status: 502, text: `LLM error: ${e.message}` };
    }
  }

  if (!cmd) {
    return { status: 422, text: `Không hiểu: "${transcript}"` };
  }

  try {
    await mqttPublish(env, `${env.TOPIC_PREFIX}/command`, cmd);
  } catch (e) {
    return { status: 500, text: `Broker error: ${e.message}` };
  }

  return { status: 200, text: cmd, route };
}

// --- Entry point ---------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors(env) });
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // IP ban check (24h after 10 wrong PINs)
    const bannedUntil = await checkBan(ip, env);
    if (bannedUntil) {
      const remainHours = Math.ceil((bannedUntil - Date.now()) / 3600000);
      return new Response(`IP banned (${remainHours}h remaining)`, { status: 403, headers: cors(env) });
    }

    if (!checkRate(ip)) {
      return new Response('Rate limit exceeded', { status: 429, headers: cors(env) });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors(env) });
    }

    const url = new URL(request.url);
    const result = url.pathname === '/voice'
      ? await handleVoice(body, env)
      : await handleDirect(body, env);

    // Track PIN failures for ban
    if (result.status === 401) {
      ctx.waitUntil(recordPinFailure(ip, env));
    } else if (result.status === 200) {
      ctx.waitUntil(clearPinFailures(ip, env));
    }

    const headers = { ...cors(env) };
    if (result.route) headers['X-Route'] = result.route;
    return new Response(result.text, { status: result.status, headers });
  },
};
