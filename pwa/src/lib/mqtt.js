// MQTT client for the rolling-door PWA — Task 9 of the plan, plus the
// developer-only telemetry topics from the Power-Loss Troubleshooting plan.
//
// Always subscribed:
//   <prefix>/device/status        (ONLINE / OFFLINE)
//   <prefix>/device/last-command  (JSON ack from firmware v0.2+, or legacy
//                                  "OPEN_SENT" / "STOP_SENT" / "CLOSE_SENT")
//
// Subscribed only when includeDevTopics is true:
//   <prefix>/device/heartbeat     (JSON: uptime, rssi, heap, millis)
//   <prefix>/device/diagnostics   (JSON: reason, ip, fw, uptime)  — retained
//
// Publishes to <prefix>/command : OPEN | STOP | CLOSE.
//
// Security caveat (per plan, Task 9): MQTT credentials are present in the
// frontend bundle. Acceptable for early testing only.

import mqtt from 'mqtt';
import { logger } from './logger.js';

const VALID_COMMANDS = new Set(['OPEN', 'STOP', 'CLOSE']);

export function createDoorClient({ url, username, password, topicPrefix, includeDevTopics = false }) {
  if (!url || !topicPrefix) {
    throw new Error('createDoorClient: url and topicPrefix are required');
  }

  const TOPIC_COMMAND      = `${topicPrefix}/command`;
  const TOPIC_STATUS       = `${topicPrefix}/device/status`;
  const TOPIC_LAST_COMMAND = `${topicPrefix}/device/last-command`;
  const TOPIC_HEARTBEAT    = `${topicPrefix}/device/heartbeat`;
  const TOPIC_DIAGNOSTICS  = `${topicPrefix}/device/diagnostics`;

  const baseSubs = [TOPIC_STATUS, TOPIC_LAST_COMMAND];
  const devSubs  = [TOPIC_HEARTBEAT, TOPIC_DIAGNOSTICS];
  const allSubs  = includeDevTopics ? [...baseSubs, ...devSubs] : baseSubs;

  logger.info('mqtt', `connecting to ${url}`, { topicPrefix, includeDevTopics });

  const client = mqtt.connect(url, {
    username,
    password,
    clean: true,
    keepalive: 30,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    clientId: `pwa-${Math.random().toString(16).slice(2, 10)}`,
  });

  const listeners = {
    connected:    new Set(),
    disconnected: new Set(),
    deviceStatus: new Set(),
    lastCommand:  new Set(),
    heartbeat:    new Set(),
    diagnostics:  new Set(),
    error:        new Set(),
  };

  function emit(event, ...args) {
    listeners[event]?.forEach((cb) => {
      try { cb(...args); } catch (e) { logger.error('mqtt', `listener for ${event} threw`, e); }
    });
  }

  client.on('connect', () => {
    logger.info('mqtt', 'connected');
    client.subscribe(allSubs, { qos: 1 }, (err, granted) => {
      if (err) {
        logger.error('mqtt', 'subscribe failed', err);
        emit('error', err);
      } else {
        logger.info('mqtt', `subscribed ${granted?.length ?? 0} topic(s)`, allSubs);
      }
    });
    emit('connected');
  });

  client.on('reconnect', () => { logger.warn('mqtt', 'reconnecting');     emit('disconnected'); });
  client.on('close',     () => { logger.warn('mqtt', 'connection closed'); emit('disconnected'); });
  client.on('offline',   () => { logger.warn('mqtt', 'offline');           emit('disconnected'); });
  client.on('error',     (e) => { logger.error('mqtt', e?.message ?? 'error', e); emit('error', e); });

  client.on('message', (topic, payload) => {
    const msg = payload.toString();
    logger.debug('mqtt-rx', topic, msg);
    if      (topic === TOPIC_STATUS)        emit('deviceStatus', msg);
    else if (topic === TOPIC_LAST_COMMAND)  emit('lastCommand',  msg);
    else if (topic === TOPIC_HEARTBEAT)     emit('heartbeat',    msg);
    else if (topic === TOPIC_DIAGNOSTICS)   emit('diagnostics',  msg);
  });

  return {
    sendCommand(cmd) {
      if (!VALID_COMMANDS.has(cmd)) {
        const err = new Error(`Invalid command: ${cmd}`);
        logger.error('cmd', err.message);
        return Promise.reject(err);
      }
      logger.info('cmd', `→ ${cmd}`);
      return new Promise((resolve, reject) => {
        client.publish(TOPIC_COMMAND, cmd, { qos: 1, retain: false }, (err) => {
          if (err) {
            logger.error('cmd', `publish ${cmd} failed`, err);
            reject(err);
          } else {
            logger.debug('cmd', `${cmd} published`);
            resolve();
          }
        });
      });
    },
    on(event, cb) {
      if (!listeners[event]) throw new Error(`Unknown event: ${event}`);
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    isConnected() { return client.connected; },
    end() {
      logger.info('mqtt', 'client.end()');
      client.end(true);
    },
  };
}
