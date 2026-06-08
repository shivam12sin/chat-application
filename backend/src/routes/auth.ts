import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import Database from '../config/database';
import { tokenService } from '../services/TokenService';
import { authenticateTokenHTTP } from '../middleware/auth';
import { logInfo, logWarn } from '../config/logger';
import emailService from '../services/EmailService';
import jwt from 'jsonwebtoken';
import { MessageDeleteRepository } from '../repositories/MessageDeleteRepository';

const router = Router();

/**
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { username, email, password, displayName } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user exists
        const existingUser = await Database.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password with cost factor 12
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = await Database.query(
            `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, avatar_url, created_at`,
            [username, email, passwordHash, displayName || username]
        );

        const user = result.rows[0];

        // Add user to default room (ID: 1)
        try {
            await Database.query(
                `INSERT INTO room_members (room_id, user_id, role)
                 VALUES (1, $1, 'member')
                 ON CONFLICT DO NOTHING`,
                [user.id]
            );
        } catch (err) {
            console.error('Failed to add user to default room:', err);
        }

        // Generate token pair
        const tokens = await tokenService.generateTokenPair(user.id, user.username);

        logInfo('User registered', { userId: user.id, username: user.username });

        return res.status(201).json({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        });

    } catch (error: any) {
        if (error.code === '23505') {
            if (error.constraint === 'users_username_key') {
                return res.status(409).json({ error: 'Username already taken' });
            }
        }
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Login
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        // Find user by email or username
        const result = await Database.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [email]
        );

        if (result.rows.length === 0) {
            logWarn('Login failed - user not found', { identifier: email });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            logWarn('Login failed - invalid password', { userId: user.id });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 2FA CHECK
        if (user.two_factor_enabled) {
            const method = user.two_factor_method || 'totp';

            // Create a temporary token for verification step
            const tempToken = jwt.sign(
                {
                    userId: user.id,
                    type: '2fa_pending',
                    method
                },
                process.env.JWT_SECRET as string,
                { expiresIn: '5m' }
            );

            if (method === 'email') {
                // Generate and send email code
                const code = authenticator.generate(authenticator.generateSecret()); // Generate 6 digit code

                // Store hash
                const codeHash = await bcrypt.hash(code, 10);
                await Database.query(
                    `UPDATE users SET two_factor_secret = $1, two_factor_secret_expires_at = NOW() + INTERVAL '5 minutes' WHERE id = $2`,
                    [codeHash, user.id]
                );

                await emailService.sendTwoFactorCode(user.email, code);

                return res.json({
                    requires2FA: true,
                    method: 'email',
                    tempToken,
                    message: `Verification code sent to ${user.email}`
                });
            } else {
                // TOTP
                return res.json({
                    requires2FA: true,
                    method: 'totp',
                    tempToken
                });
            }
        }

        // Validate 2FA secret presence if TOTP is enabled but no secret (edge case)
        if (user.two_factor_enabled && user.two_factor_method === 'totp' && !user.two_factor_secret) {
            // Should not happen if flow is correct, but fail safe
            console.error('User has 2FA enabled but no secret');
        }

        // Generate token pair
        const tokens = await tokenService.generateTokenPair(user.id, user.username);

        logInfo('User logged in', { userId: user.id, username: user.username });

        return res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
});

// --------------------------------------------------------------------------
// 2FA Endpoints
// --------------------------------------------------------------------------

/**
 * Init 2FA Setup
 * Returns QR code (for TOTP) or sends email (for Email)
 */
router.post('/2fa/setup/init', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { method } = req.body; // 'totp' or 'email'

        if (method === 'totp') {
            const secret = authenticator.generateSecret();
            const userRes = await Database.query('SELECT email FROM users WHERE id = $1', [userId]);
            const email = userRes.rows[0].email;

            const otpauth = authenticator.keyuri(email, 'Aether Chat', secret);
            const qrCode = await QRCode.toDataURL(otpauth);

            return res.json({ secret, qrCode });
        } else if (method === 'email') {
            const userRes = await Database.query('SELECT email FROM users WHERE id = $1', [userId]);
            const email = userRes.rows[0].email;

            // Generate code
            const secret = authenticator.generateSecret();
            const code = authenticator.generate(secret); // Use otplib to generate 6-digit

            // Store hash for verification
            const codeHash = await bcrypt.hash(code, 10);
            await Database.query(
                `UPDATE users SET two_factor_secret = $1, two_factor_secret_expires_at = NOW() + INTERVAL '5 minutes' WHERE id = $2`,
                [codeHash, userId]
            );

            await emailService.sendTwoFactorCode(email, code);
            return res.json({ status: 'sent', email });
        } else {
            return res.status(400).json({ error: 'Invalid method' });
        }
    } catch (error) {
        console.error('2FA Init Error:', error);
        return res.status(500).json({ error: 'Failed to init 2FA' });
    }
});

/**
 * Verify & Enable 2FA
 */
router.post('/2fa/setup/verify', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { code, method, secret } = req.body;

        if (method === 'totp') {
            if (!secret) return res.status(400).json({ error: 'Secret required for TOTP setup' });

            const isValid = authenticator.verify({ token: code, secret });
            if (!isValid) return res.status(400).json({ error: 'Invalid authentication code' });

            await Database.query(
                `UPDATE users SET two_factor_enabled = true, two_factor_method = 'totp', two_factor_secret = $1 WHERE id = $2`,
                [secret, userId]
            );

            return res.json({ success: true });
        } else if (method === 'email') {
            const result = await Database.query(
                `SELECT two_factor_secret, two_factor_secret_expires_at FROM users WHERE id = $1`,
                [userId]
            );

            if (result.rows.length === 0 || !result.rows[0].two_factor_secret) {
                return res.status(400).json({ error: 'No verification pending' });
            }

            const { two_factor_secret, two_factor_secret_expires_at } = result.rows[0];

            if (new Date() > new Date(two_factor_secret_expires_at)) {
                return res.status(400).json({ error: 'Code expired' });
            }

            const isValid = await bcrypt.compare(code, two_factor_secret);
            if (!isValid) return res.status(400).json({ error: 'Invalid code' });

            // Enable 2FA - Clear the secret (it was temp)
            await Database.query(
                `UPDATE users SET two_factor_enabled = true, two_factor_method = 'email', two_factor_secret = NULL WHERE id = $1`,
                [userId]
            );

            return res.json({ success: true });
        } else {
            return res.status(400).json({ error: 'Invalid method' });
        }
    } catch (error) {
        console.error('2FA Verify Error:', error);
        return res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * Login 2FA Verify
 */
router.post('/2fa/login/verify', async (req: Request, res: Response) => {
    try {
        const { tempToken, code } = req.body;

        if (!tempToken || !code) return res.status(400).json({ error: 'Missing token or code' });

        // Verify temp token
        let decoded: any;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET as string);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        if (decoded.type !== '2fa_pending') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const userId = decoded.userId;
        const method = decoded.method;

        // Fetch user secret
        const result = await Database.query(
            `SELECT * FROM users WHERE id = $1`,
            [userId]
        );
        const user = result.rows[0];

        if (method === 'totp') {
            const isValid = authenticator.verify({ token: code, secret: user.two_factor_secret });
            if (!isValid) return res.status(401).json({ error: 'Invalid code' });
        } else if (method === 'email') {
            if (!user.two_factor_secret) return res.status(400).json({ error: 'No code generated' });

            if (user.two_factor_secret_expires_at && new Date() > new Date(user.two_factor_secret_expires_at)) {
                return res.status(401).json({ error: 'Code expired' });
            }

            const isValid = await bcrypt.compare(code, user.two_factor_secret);
            if (!isValid) return res.status(401).json({ error: 'Invalid code' });

            // Check if we should clear it? Probably fine to leave until next login overwrite
            await Database.query(`UPDATE users SET two_factor_secret = NULL WHERE id = $1`, [userId]);
        }

        // Success - Generate real tokens
        const tokens = await tokenService.generateTokenPair(user.id, user.username);

        logInfo('User logged in via 2FA', { userId: user.id });

        return res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        });

    } catch (error) {
        console.error('2FA Login Verify Error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const tokens = await tokenService.refreshTokens(refreshToken);

        if (!tokens) {
            logWarn('Token refresh failed - invalid token');
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        logInfo('Tokens refreshed');

        return res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Token refresh failed' });
    }
});

/**
 * Logout - invalidate current session
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await tokenService.invalidateRefreshToken(refreshToken);
        }

        return res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * Logout everywhere - invalidate all sessions
 */
router.post('/logout-all', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const count = await tokenService.invalidateAllSessions(userId);

        logInfo('User logged out everywhere', { userId, sessionsInvalidated: count });

        return res.json({
            message: 'All sessions invalidated',
            sessionsInvalidated: count,
        });

    } catch (error) {
        console.error('Logout all error:', error);
        return res.status(500).json({ error: 'Failed to invalidate sessions' });
    }
});

/**
 * Get active session count
 */
router.get('/sessions', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const count = await tokenService.getActiveSessionCount(userId);

        return res.json({ activeSessions: count });

    } catch (error) {
        console.error('Sessions error:', error);
        return res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * Verify password (for sensitive actions like unlocking chat)
 */
router.post('/verify-password', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        // Get user hash
        const result = await Database.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(password, result.rows[0].password_hash);

        if (isValid) {
            logInfo('Password verified for sensitive action', { userId });
        } else {
            logWarn('Password verification failed', { userId });
        }

        return res.json({ valid: isValid });

    } catch (error) {
        console.error('Password verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * Get 2FA Status
 */
router.get('/2fa/status', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const result = await Database.query(
            'SELECT two_factor_enabled, two_factor_method FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json({
            enabled: result.rows[0].two_factor_enabled || false,
            method: result.rows[0].two_factor_method
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

/**
 * Disable 2FA
 */
router.post('/2fa/disable', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { password } = req.body;

        const result = await Database.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (!await bcrypt.compare(password, result.rows[0].password_hash)) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        await Database.query(
            `UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_method = NULL WHERE id = $1`,
            [userId]
        );

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * DELETE Account - GPDR / Privacy Requirement
 * Permanently deletes user account and all associated data
 */
router.delete('/me', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete account' });
        }

        // Verify password before deletion
        const userRes = await Database.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const isValid = await bcrypt.compare(password, userRes.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Invalidate all sessions first
        await tokenService.invalidateAllSessions(userId);

        // PRIVACY CRITICAL: Hard delete all messages (ES + SQL)
        await MessageDeleteRepository.deleteAllMessagesForUser(userId);

        // Delete user (Cascading delete will handle contacts, room memberships, etc.)
        await Database.query('BEGIN');
        try {
            await Database.query('DELETE FROM users WHERE id = $1', [userId]);
            await Database.query('COMMIT');

            logInfo('User account deleted permanently', { userId });
            return res.json({ success: true, message: 'Account deleted successfully' });
        } catch (err) {
            await Database.query('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * Update user profile
 */
router.put('/profile', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { avatar_url, display_name } = req.body;

        if (!avatar_url && !display_name) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Build query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (avatar_url !== undefined) {
            updates.push(`avatar_url = $${paramCount}`);
            values.push(avatar_url);
            paramCount++;
        }

        if (display_name !== undefined) {
            updates.push(`display_name = $${paramCount}`);
            values.push(display_name);
            paramCount++;
        }

        values.push(userId);
        const query = `
            UPDATE users 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount}
            RETURNING id, username, email, display_name, avatar_url
        `;

        const result = await Database.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

export default router;
