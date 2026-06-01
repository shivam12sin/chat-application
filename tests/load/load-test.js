/**
 * k6 Load Testing Script for Chat Platform
 * Run: k6 run --vus 100 --duration 5m load-test.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const messageDuration = new Trend('message_duration');
const wsConnections = new Counter('ws_connections');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// Test scenarios
export const options = {
    scenarios: {
        // Normal load: 50 users
        normal_load: {
            executor: 'constant-vus',
            vus: 50,
            duration: '5m',
            startTime: '0s',
        },
        // Peak load: Ramp up to 200 users
        peak_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 100 },
                { duration: '5m', target: 200 },
                { duration: '2m', target: 0 },
            ],
            startTime: '5m',
        },
        // Stress test: 500 users
        stress_test: {
            executor: 'constant-vus',
            vus: 500,
            duration: '3m',
            startTime: '14m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        http_req_failed: ['rate<0.01'],
        errors: ['rate<0.05'],
        login_duration: ['p(95)<300'],
        message_duration: ['p(95)<200'],
    },
};

// Setup: Create test users
export function setup() {
    const users = [];
    for (let i = 0; i < 10; i++) {
        const user = {
            username: `loadtest_user_${Date.now()}_${i}`,
            email: `loadtest${Date.now()}${i}@test.com`,
            password: 'TestPassword123',
        };

        const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(user), {
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 201) {
            const body = JSON.parse(res.body);
            users.push({
                ...user,
                id: body.user.id,
                accessToken: body.accessToken,
                refreshToken: body.refreshToken,
            });
        }
    }
    return { users };
}

// Main test function
export default function (data) {
    const user = data.users[__VU % data.users.length];

    group('Authentication', function () {
        // Login
        const loginStart = Date.now();
        const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
            email: user.email,
            password: user.password,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        loginDuration.add(Date.now() - loginStart);

        const loginSuccess = check(loginRes, {
            'login successful': (r) => r.status === 200,
            'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
        });

        errorRate.add(!loginSuccess);

        if (!loginSuccess) return;

        const tokens = JSON.parse(loginRes.body);
        const authHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokens.accessToken}`,
        };

        sleep(1);

        group('API Requests', function () {
            // Get rooms
            const roomsRes = http.get(`${BASE_URL}/api/rooms`, { headers: authHeaders });
            check(roomsRes, { 'rooms fetched': (r) => r.status === 200 });

            sleep(0.5);

            // Get messages from room 1
            const messagesRes = http.get(`${BASE_URL}/api/messages/room/1`, { headers: authHeaders });
            check(messagesRes, { 'messages fetched': (r) => r.status === 200 });

            sleep(0.5);

            // Health check
            const healthRes = http.get(`${BASE_URL}/health`);
            check(healthRes, { 'health check passed': (r) => r.status === 200 });
        });

        group('Token Refresh', function () {
            const refreshRes = http.post(`${BASE_URL}/api/auth/refresh`, JSON.stringify({
                refreshToken: tokens.refreshToken,
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

            check(refreshRes, { 'token refreshed': (r) => r.status === 200 });
        });
    });

    sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

// WebSocket test (separate scenario)
export function websocketTest(data) {
    const user = data.users[__VU % data.users.length];

    const res = ws.connect(`${WS_URL}/socket.io/?token=${user.accessToken}&EIO=4&transport=websocket`, {}, function (socket) {
        wsConnections.add(1);

        socket.on('open', function () {
            socket.send(JSON.stringify({ type: 'join', roomId: 1 }));
        });

        socket.on('message', function (msg) {
            // Handle incoming messages
        });

        socket.on('error', function (e) {
            errorRate.add(1);
        });

        // Keep connection open for 30 seconds
        socket.setTimeout(function () {
            socket.close();
        }, 30000);
    });

    check(res, { 'websocket connected': (r) => r && r.status === 101 });
}

// Teardown: Cleanup (optional)
export function teardown(data) {
    // Could delete test users here if needed
    console.log(`Test completed with ${data.users.length} test users`);
}
