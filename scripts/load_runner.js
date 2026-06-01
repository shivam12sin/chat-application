#!/usr/bin/env node
const axios = require('axios');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const argv = require('yargs/yargs')(process.argv.slice(2)).default({
  concurrency: 50,
  messages: 5,
  delay: 500,
  stagger: 0
}).argv;

const TARGET = process.env.TARGET || 'http://localhost:3000';

async function runClient(id, metrics) {
  const username = `lr_${Date.now()}_${id}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';

  try {
    await axios.post(`${TARGET}/api/auth/register`, { username, email, password });
  } catch (e) {
    // ignore already exists
  }

  const login = await axios.post(`${TARGET}/api/auth/login`, { email, password });
  const token = login.data.token;

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = io(TARGET, { transports: ['websocket'], auth: { token } });
    let connectedAt = null;
    let msgsSent = 0;
    let failed = false;

    socket.on('connect_error', (err) => {
      failed = true;
      metrics.connectErrors++;
    });

    socket.on('connect', async () => {
      connectedAt = Date.now();
      metrics.connected++;
      try {
        socket.emit('room:join', { roomId: 1 });

        for (let i = 0; i < argv.messages; i++) {
          const tempId = uuidv4();
          const sendAt = Date.now();
          await new Promise((res) => {
            socket.emit('message:send', { roomId: 1, content: `load msg ${i} from ${username}`, tempId }, (ack) => {
              const rtt = Date.now() - sendAt;
              metrics.latencies.push(rtt);
              msgsSent++;
              metrics.messagesSent++;
              if (!ack || !ack.success) {
                metrics.messageAcksFailed++;
              } else {
                metrics.messageAcksOK++;
              }
              res();
            });
          });
          await new Promise(r => setTimeout(r, argv.delay));
        }
      } catch (err) {
        failed = true;
        metrics.clientErrors++;
      } finally {
        socket.disconnect();
        const finishedAt = Date.now();
        metrics.clientResults.push({ id, connected: !failed && connectedAt !== null, connectMs: connectedAt ? (connectedAt - startedAt) : null, durationMs: finishedAt - startedAt, msgsSent });
        if (failed) metrics.failedClients++;
        resolve();
      }
    });
  });
}

async function main() {
  const concurrency = parseInt(argv.concurrency, 10);
  const stagger = parseInt(argv.stagger, 10) || 0;
  console.log(`Starting load runner: concurrency=${concurrency} messages=${argv.messages} stagger=${stagger}ms`);

  const metrics = {
    connected: 0,
    connectErrors: 0,
    clientErrors: 0,
    failedClients: 0,
    messagesSent: 0,
    clientResults: [],
    latencies: [],
    messageAcksOK: 0,
    messageAcksFailed: 0
  };

  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    tasks.push(new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await runClient(i, metrics);
        } catch (err) {
          console.error(`client ${i} failed:`, err && err.message ? err.message : err);
        } finally {
          resolve();
        }
      }, i * stagger);
    }));
  }

  await Promise.all(tasks);

  // Summarize metrics
  const total = concurrency;
  const succeeded = total - metrics.failedClients;
  const avgConnectMs = metrics.clientResults.filter(r => r.connectMs != null).reduce((s, r) => s + r.connectMs, 0) / Math.max(1, metrics.clientResults.filter(r => r.connectMs != null).length);
  const avgDurationMs = metrics.clientResults.reduce((s, r) => s + r.durationMs, 0) / Math.max(1, metrics.clientResults.length);
  // Latency percentiles
  const latencies = metrics.latencies.slice().sort((a, b) => a - b);
  function pct(p) {
    if (latencies.length === 0) return null;
    const idx = Math.floor((p / 100) * latencies.length + 0.5) - 1;
    const i = Math.max(0, Math.min(latencies.length - 1, idx));
    return latencies[i];
  }

  console.log('\n=== Load Runner Summary ===');
  console.log(`clients requested: ${total}`);
  console.log(`clients succeeded (no errors): ${succeeded}`);
  console.log(`clients failed: ${metrics.failedClients}`);
  console.log(`connect errors: ${metrics.connectErrors}`);
  console.log(`client errors: ${metrics.clientErrors}`);
  console.log(`messages sent (total): ${metrics.messagesSent}`);
  console.log(`message acks OK: ${metrics.messageAcksOK}`);
  console.log(`message acks failed: ${metrics.messageAcksFailed}`);
  console.log(`avg connect time (ms): ${Math.round(avgConnectMs)}`);
  console.log(`avg client duration (ms): ${Math.round(avgDurationMs)}`);
  console.log(`latency samples: ${latencies.length}`);
  console.log(`P50 ms: ${pct(50)}`);
  console.log(`P95 ms: ${pct(95)}`);
  console.log(`P99 ms: ${pct(99)}`);
  console.log('sample client results (first 10):', metrics.clientResults.slice(0, 10));
  console.log('Load runner completed');
}

main().catch(err => { console.error(err); process.exit(1); });
