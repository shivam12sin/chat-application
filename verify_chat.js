const io = require('socket.io-client');
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

// Helper to create a client
async function createClient(name) {
    const username = `user_${name}_${Date.now()}`;
    const email = `${username}@example.com`;
    const password = 'password123';

    console.log(`[${name}] Registering...`);
    try {
        await axios.post(`${API_URL}/auth/register`, {
            username,
            email,
            password,
            displayName: `${name} User`
        });
    } catch (e) {
        // Ignore if exists
    }

    console.log(`[${name}] Logging in...`);
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
    });

    const token = loginRes.data.token;
    const user = loginRes.data.user;

    const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false
    });

    await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
    });

    console.log(`[${name}] Connected (Socket ID: ${socket.id})`);

    return { socket, token, user };
}

async function verify() {
    try {
        console.log('--- STARTING MULTI-USER VERIFICATION ---');

        // 1. Setup Users
        const clientA = await createClient('Alice');
        const clientB = await createClient('Bob');

        // 2. Alice creates a room
        console.log('\n--- ROOM CREATION ---');
        const roomRes = await axios.post(`${API_URL}/rooms`, {
            roomType: 'group',
            name: `Chat Room ${Date.now()}`,
            members: [clientB.user.id] // Add Bob to the room
        }, {
            headers: { Authorization: `Bearer ${clientA.token}` }
        });
        const roomId = roomRes.data.room.id;
        console.log(`Alice created Room ${roomId} with Bob (ID: ${clientB.user.id})`);

        // 3. Both join room
        console.log('\n--- JOINING ROOM ---');
        clientA.socket.emit('room:join', { roomId });
        clientB.socket.emit('room:join', { roomId });
        await new Promise(r => setTimeout(r, 500)); // Wait for joins

        // 4. Test Typing Indicators
        console.log('\n--- TESTING TYPING INDICATORS ---');
        const typingPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Typing indicator timeout')), 5000);

            clientB.socket.on('typing:start', (data) => {
                if (data.roomId == roomId && data.userId == clientA.user.id) { // Note: loose equality for ID types
                    clearTimeout(timeout);
                    console.log('✓ Bob received: Alice is typing');
                    resolve();
                }
            });
        });

        console.log('Alice starts typing...');
        clientA.socket.emit('typing:start', { roomId });
        await typingPromise;

        // 5. Test Messaging (Alice -> Bob)
        console.log('\n--- TESTING MESSAGING (Alice -> Bob) ---');
        const messageContent = `Hello Bob! ${Date.now()}`;

        const receivePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Message receive timeout')), 5000);

            clientB.socket.on('message:new', (msg) => {
                if (msg.content === messageContent) {
                    clearTimeout(timeout);
                    console.log(`✓ Bob received message: "${msg.content}"`);
                    resolve(msg);
                }
            });
        });

        console.log(`Alice sending: "${messageContent}"`);
        clientA.socket.emit('message:send', {
            roomId,
            content: messageContent,
            tempId: 'temp-' + Date.now()
        }, (ack) => {
            if (ack.success) console.log('✓ Alice received server acknowledgment');
            else console.error('Alice failed to send:', ack);
        });

        const receivedMsg = await receivePromise;

        // 6. Test Read Receipts
        console.log('\n--- TESTING READ RECEIPTS ---');
        const readPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Read receipt timeout')), 5000);

            clientA.socket.on('message:status', (data) => {
                if (data.messageId === receivedMsg.id && data.status === 'read') {
                    clearTimeout(timeout);
                    console.log('✓ Alice received: Bob read the message');
                    resolve();
                }
            });
        });

        console.log('Bob marking message as read...');
        clientB.socket.emit('message:read', {
            messageId: receivedMsg.id,
            roomId
        });
        await readPromise;

        console.log('\n--- VERIFICATION SUCCESSFUL ---');
        clientA.socket.disconnect();
        clientB.socket.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
}

verify();
