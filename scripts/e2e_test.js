#!/usr/bin/env node
const axios = require('axios');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');
const yargs = require('yargs/yargs');

const argv = yargs(process.argv.slice(2)).default({
  users: 50,
  messages: 5,
  delay: 200,
  stagger: 100,
  target: 'http://localhost:3000'
}).argv;

const TARGET = argv.target;

async function registerAndLogin(i) {
  const ts = Date.now();
  const username = `e2e_${ts}_${i}`;
  const email = `${username}@example.com`;
  const password = 'Test1234!';

  try {
    await axios.post(`${TARGET}/api/auth/register`, { username, email, password });
  } catch (e) {
    // ignore
  }

  const login = await axios.post(`${TARGET}/api/auth/login`, { email, password });
  return { id: login.data.user.id, username: login.data.user.username, token: login.data.token };
}

async function createRoom(creatorToken, memberIds) {
  const res = await axios.post(`${TARGET}/api/rooms`, { roomType: 'group', name: `e2e_room_${Date.now()}`, members: memberIds }, { headers: { Authorization: `Bearer ${creatorToken}` } });
  return res.data.room;
}

async function run() {
  const users = parseInt(argv.users, 10);
  console.log(`E2E test: users=${users} messages=${argv.messages} delay=${argv.delay} stagger=${argv.stagger}`);

  // 1) Register + login users
  const accounts = [];
  for (let i = 0; i < users; i++) {
    try {
      const a = await registerAndLogin(i);
      accounts.push(a);
    } catch (err) {
      console.error('Auth error for user', i, err.message);
      process.exit(1);
    }
  }

  const ids = accounts.map(a => a.id);

  // 2) Create a room with all users (creator = first user)
  const room = await createRoom(accounts[0].token, ids.slice(1));
  console.log('Created room', room.id);

  // 3) Connect sockets
  const sockets = [];
  const received = {};
  const acks = { sent: 0, ok: 0, failed: 0 };

  for (let i = 0; i < users; i++) {
    received[i] = { count: 0, messages: [] };
  }

  function connectClient(i) {
    return new Promise((resolve) => {
      const acc = accounts[i];
      const socket = io(TARGET, { transports: ['websocket'], auth: { token: acc.token } });

      socket.on('connect', () => {
        // join room
        socket.emit('room:join', { roomId: room.id });
        socket.on('message:new', (msg) => {
          received[i].count++;
          received[i].messages.push(msg);
        });
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        console.error('connect_error', i, err.message);
      });
    });
  }

  for (let i = 0; i < users; i++) {
    // stagger connections
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, i * argv.stagger));
    // eslint-disable-next-line no-await-in-loop
    const s = await connectClient(i);
    sockets.push(s);
  }

  console.log('All clients connected');

  // 4) Each client sends messages; wait for acks and for recipients to receive
  const sendPromises = [];
  for (let i = 0; i < users; i++) {
    const socket = sockets[i];
    for (let m = 0; m < argv.messages; m++) {
      sendPromises.push(new Promise((res) => {
        const tempId = uuidv4();
        acks.sent++;
        const sendAt = Date.now();
        socket.emit('message:send', { roomId: room.id, content: `E2E msg ${m} from ${accounts[i].username}`, tempId }, (ack) => {
          const rtt = Date.now() - sendAt;
          if (ack && ack.success) acks.ok++; else acks.failed++;
          // small delay between sends
          setTimeout(res, argv.delay);
        });
      }));
    }
  }

  await Promise.all(sendPromises);
  console.log('All messages sent and acks received');

  // give extra time for delivery events to propagate
  await new Promise(r => setTimeout(r, 2000));

  // 5) Summarize
  const totalReceived = Object.values(received).reduce((s, r) => s + r.count, 0);
  console.log('\n=== E2E Summary ===');
  console.log(`users: ${users}`);
  console.log(`room: ${room.id}`);
  console.log(`messages per user: ${argv.messages}`);
  console.log(`acks sent: ${acks.sent}, ok: ${acks.ok}, failed: ${acks.failed}`);
  console.log(`total messages delivered (events observed): ${totalReceived}`);

  // Expected deliveries: each message should be delivered to (users-1) recipients
  const expected = users * argv.messages * (users - 1);
  console.log(`expected deliveries (users * messages * (users-1)): ${expected}`);
  console.log(`delivery percentage: ${(totalReceived / expected * 100).toFixed(2)}%`);

  // teardown
  sockets.forEach(s => s.disconnect());
  console.log('Disconnected all sockets');
}

run().catch(err => { console.error('E2E test failed:', err && err.message); process.exit(1); });
