# Aether Software Development Testing Showcase

This guide is designed as a presentation-ready summary to showcase different software testing methodologies implemented in the **Aether** real-time chat platform. 

For a software development class, it is important to show that a project is tested at **different levels of the testing pyramid**. Aether implements three major tiers of testing:
1. **Unit Testing:** Low-level tests that verify individual functions in absolute isolation.
2. **Integration Testing:** Mid-level tests that verify how multiple components (like HTTP routes, middlewares, and databases) collaborate.
3. **Performance & Load Testing:** Non-functional testing that verifies how the application behaves under simulated real-world concurrent user loads.

---

## 🧪 Tier 1: Unit Testing (Isolation & Code Correctness)
*Target File:* `backend/tests/unit/sanitize.test.ts`
*Testing Framework:* **Vitest**

Unit testing focuses on testing small, stateless helper functions. In this showcase, we test `backend/src/utils/sanitize.ts`, which escapes HTML special characters to prevent **Cross-Site Scripting (XSS)** vulnerabilities.

### 🔍 Key Implementation & Teacher Insights
- **XSS Prevention Testing:** The unit tests feed malicious inputs (like `<script>` tags, inline event handlers like `onerror`, and dangerous `javascript:` protocols) and verify that they are neutralized by the code.
- **Finding Code Limitations:** Writing these unit tests exposed an implementation detail: the utility strips the `javascript:` keyword but leaves the rest of the URL string (e.g., `javascript:alert(1)` becomes `alert(1)`). This is a great discussion point to show your teacher about *discovering edge cases through testing*.

### 💻 Code Snippet
```typescript
describe('Sanitization Utilities', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const input = '<div>Hello & "Welcome"\'s / `world` =</div>';
            const expected = '&lt;div&gt;Hello &amp; &quot;Welcome&quot;&#39;s &#x2F; &#x60;world&#x60; &#x3D;&lt;&#x2F;div&gt;';
            expect(escapeHtml(input)).toBe(expected);
        });
    });

    describe('sanitizeString', () => {
        it('should remove script tags and their inner content', () => {
            const input = 'Hello <script>alert("XSS")</script> World';
            const expected = 'Hello  World';
            expect(sanitizeString(input)).toBe(expected);
        });
    });
});
```

---

## 🔗 Tier 2: Integration Testing (Middleware & API Routes)
*Target File:* `backend/tests/integration/reactions.test.ts`
*Testing Tools:* **Vitest** & **Supertest**

Integration testing ensures that different system modules work together. In this showcase, we test the **Reactions API Router**. The test spins up an Express application instance in-memory, sends HTTP requests using `supertest`, mocks the database/repository layer, and bypasses authentication middleware.

### 🔍 Key Implementation & Teacher Insights
- **API Mocking:** Since we only want to test the HTTP router and controller logic, we use Vitest's `vi.mock` to mock `ReactionRepository` and prevent actual database writes.
- **Middleware Injection:** We mock the `authenticateTokenHTTP` middleware to automatically insert a mock user payload (`userId: 42`) into the request object, simulating a logged-in user.
- **HTTP Code Assertions:** We assert standard status codes (`200 OK`, `400 Bad Request`) and JSON response structures.

### 💻 Code Snippet
```typescript
// Mocking the authentication middleware to inject a dummy user
vi.mock('../../src/middleware/auth', () => ({
    authenticateTokenHTTP: (req: any, _res: any, next: any) => {
        req.user = { userId: 42, id: 42, username: 'testuser' };
        next();
    },
}));

describe('Reactions API (Integration)', () => {
    it('should return 400 Bad Request if emoji is missing on creation', async () => {
        const response = await request(app)
            .post('/api/reactions/100')
            .send({}); // Missing 'emoji' parameter

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Emoji is required');
    });
});
```

---

## ⚡ Tier 3: Performance & Load Testing (Concurrent Load)
*Target Configuration:* `load-test.yml` & `load-test-processor.js`
*Testing Tool:* **Artillery**

Load testing simulates multiple virtual users performing activities concurrently to measure system stability, latency, and throughput under stress. Aether is designed to support **10,000+ concurrent WebSocket connections**, making this test highly relevant.

### 🔍 Key Implementation & Teacher Insights
- **Ramp-Up Phases:** The test configuration defines realistic traffic phases: warming up at 5 users/sec, ramping up to 50 users/sec, and sustaining the peak load.
- **Custom JS Processor:** `load-test-processor.js` programmatically runs HTTP API calls using `axios` to register and log in each virtual user, generating a valid JWT auth token before establishing a WebSocket handshake.
- **WebSocket Scenario Flow:** Virtual users establish a Socket.io link, join a chat room (`room:join`), and loop 5 times sending messages (`message:send`) with random strings.

### 💻 Code Snippet (`load-test.yml`)
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 30
      arrivalRate: 5
      name: "Warm up (5 users/sec)"
    - duration: 60
      arrivalRate: 20
      rampTo: 50
      name: "Ramp up load (20-50 users/sec)"
scenarios:
  - name: "Chat Flow"
    engine: "socketio"
    flow:
      - socketio:
          connect:
            auth:
              token: "{{ token }}"
      - think: 1
      - emit:
          channel: "room:join"
          data: 
            roomId: 1
```

---

## 🚀 How to Run the Tests

You can run these tests directly from your terminal inside the `backend/` directory to show the test runners executing in real-time:

### 1. Run Backend Unit Tests
Runs all unit tests in the backend, including our new sanitization tests:
```bash
npm run test -- tests/unit/sanitize.test.ts
```

### 2. Run Backend Integration Tests
Runs our new API integration tests verifying Express routes, controllers, and middlewares:
```bash
npm run test -- tests/integration/reactions.test.ts
```

### 3. Run Performance/Load Tests
If you have **Artillery** installed (`npm install -g artillery`), run your local backend server, and execute this command in the root folder to spin up simulated concurrent chatters:
```bash
artillery run load-test.yml
```
