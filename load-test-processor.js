const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

async function beforeScenario(userContext, events, done) {
    const username = `user_${uuidv4().substring(0, 8)}`;
    const password = 'password123';

    const email = `${username}@example.com`;

    try {
        // 1. Register
        await axios.post('http://localhost:3000/api/auth/register', {
            username,
            email,
            password
        });

        // 2. Login
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email,
            password
        });

        const token = response.data.token;
        const userId = response.data.user.id;

        // Set variables for the virtual user
        userContext.vars.token = token;
        userContext.vars.userId = userId;

        // Set auth token for socket connection
        userContext.vars.token = token;
        userContext.vars.userId = userId;

        console.log(`Generated token for user ${username}: ${token.substring(0, 10)}...`);

        done();
    } catch (err) {
        console.error('Auth failed:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
        done(err);
    }
}

module.exports = {
    beforeScenario
};

