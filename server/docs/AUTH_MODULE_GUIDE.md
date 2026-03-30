# Auth Module Implementation Guide
## Gig Shirudo — Team CodeBlooded

---

## Overview

This guide covers implementing the **custom JWT authentication system** for the Gig Shirudo backend. We use our own auth (not Supabase Auth) with server-side session management for token revocation support.

**Key Tables Used:**
- `users` — Worker accounts
- `user_sessions` — JWT session tracking (for revocation)
- `verifications` — KYC data (optional, created after registration)

---

## File Structure to Create

```
server/src/
├── config/
│   └── db.js                 ✅ Already exists
├── controllers/
│   └── auth.controller.js    📝 CREATE
├── middleware/
│   └── auth.middleware.js    📝 CREATE
├── routes/
│   └── auth.routes.js        📝 CREATE
├── services/
│   └── auth.service.js       📝 CREATE (optional, for business logic)
├── utils/
│   └── helpers.js            📝 CREATE (token generation, hashing)
└── index.js                  ✅ Update to register routes
```

---

## 1. Environment Variables

Ensure `.env` has these (already in `.env.example`):

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

**Generate a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Utils — `src/utils/helpers.js`

```javascript
const crypto = require('crypto');

/**
 * Hash a token using SHA-256
 * IMPORTANT: Store hashed tokens in DB, never raw tokens
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a random token (for refresh tokens, etc.)
 */
const generateRandomToken = (bytes = 32) => {
    return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Standard API response format
 */
const apiResponse = (res, statusCode, success, message, data = null) => {
    return res.status(statusCode).json({
        success,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    hashToken,
    generateRandomToken,
    apiResponse
};
```

---

## 3. Auth Controller — `src/controllers/auth.controller.js`

### 3.1 Register (Signup)

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { hashToken, apiResponse } = require('../utils/helpers');

/**
 * POST /api/auth/register
 * 
 * Request Body:
 * {
 *   "name": "Rahul Kumar",
 *   "email": "rahul@example.com",
 *   "password": "securePassword123",
 *   "phone": "9876543210",
 *   "platform_id": 1,          // Optional: Swiggy/Zomato platform ID
 *   "city_id": 1,              // Optional: City ID
 *   "weekly_income": 5000      // Optional: For premium calculation
 * }
 */
const register = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { name, email, password, phone, platform_id, city_id, weekly_income } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password) {
            return apiResponse(res, 400, false, 'Name, email and password are required');
        }

        // 2. Check if email already exists (active users only)
        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return apiResponse(res, 409, false, 'Email already registered');
        }

        // 3. Hash password (cost factor 12)
        const password_hash = await bcrypt.hash(password, 12);

        // 4. Insert user
        const result = await client.query(`
            INSERT INTO users (name, email, password_hash, phone, platform_id, city_id, weekly_income)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, email, phone, platform_id, city_id, weekly_income, 
                      legitimacy_score, is_verified, created_at
        `, [name, email, password_hash, phone, platform_id, city_id, weekly_income]);

        const user = result.rows[0];

        // 5. Create initial trust metrics row
        await client.query(`
            INSERT INTO user_trust_metrics (user_id) VALUES ($1)
        `, [user.id]);

        // 6. Generate tokens and create session
        const sessionData = await createSession(user.id, req);

        return apiResponse(res, 201, true, 'Registration successful', {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                is_verified: user.is_verified
            },
            ...sessionData
        });

    } catch (error) {
        console.error('Registration error:', error);
        return apiResponse(res, 500, false, 'Registration failed', { error: error.message });
    } finally {
        client.release();
    }
};
```

### 3.2 Login

```javascript
/**
 * POST /api/auth/login
 * 
 * Request Body:
 * {
 *   "email": "rahul@example.com",
 *   "password": "securePassword123"
 * }
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return apiResponse(res, 400, false, 'Email and password are required');
        }

        // 1. Find user (active only - deleted_at IS NULL)
        const result = await pool.query(`
            SELECT id, name, email, password_hash, phone, platform_id, city_id,
                   weekly_income, legitimacy_score, is_verified
            FROM users 
            WHERE email = $1 AND deleted_at IS NULL
        `, [email]);

        if (result.rows.length === 0) {
            return apiResponse(res, 401, false, 'Invalid email or password');
        }

        const user = result.rows[0];

        // 2. Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return apiResponse(res, 401, false, 'Invalid email or password');
        }

        // 3. Update last_login_at
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
        );

        // 4. Create session and tokens
        const sessionData = await createSession(user.id, req);

        return apiResponse(res, 200, true, 'Login successful', {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                is_verified: user.is_verified,
                legitimacy_score: user.legitimacy_score
            },
            ...sessionData
        });

    } catch (error) {
        console.error('Login error:', error);
        return apiResponse(res, 500, false, 'Login failed');
    }
};
```

### 3.3 Create Session Helper

```javascript
/**
 * Creates a new session with access and refresh tokens
 * Stores token HASHES in DB (not raw tokens)
 */
const createSession = async (userId, req) => {
    // 1. Generate session ID (UUID)
    const sessionResult = await pool.query('SELECT uuid_generate_v4() as session_id');
    const sessionId = sessionResult.rows[0].session_id;

    // 2. Create access token (short-lived)
    const accessToken = jwt.sign(
        { 
            session_id: sessionId,
            user_id: userId 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 3. Create refresh token (longer-lived)
    const refreshToken = jwt.sign(
        { 
            session_id: sessionId,
            user_id: userId,
            type: 'refresh'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // 4. Hash tokens for storage (SECURITY: never store raw tokens)
    const accessTokenHash = hashToken(accessToken);
    const refreshTokenHash = hashToken(refreshToken);

    // 5. Extract device info from request
    const deviceInfo = {
        user_agent: req.headers['user-agent'] || 'unknown',
        device_type: detectDeviceType(req.headers['user-agent']),
        ip: req.ip || req.connection?.remoteAddress
    };

    // 6. Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 7. Insert session into DB
    await pool.query(`
        INSERT INTO user_sessions 
            (id, user_id, access_token_hash, refresh_token_hash, device_info, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sessionId, userId, accessTokenHash, refreshTokenHash, deviceInfo, req.ip, expiresAt]);

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
    };
};

// Simple device type detection
const detectDeviceType = (userAgent) => {
    if (!userAgent) return 'unknown';
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
};
```

### 3.4 Logout

```javascript
/**
 * POST /api/auth/logout
 * Requires: Authorization header with Bearer token
 * 
 * Revokes the current session
 */
const logout = async (req, res) => {
    try {
        // req.session is set by auth middleware
        await pool.query(
            'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1',
            [req.session.id]
        );

        return apiResponse(res, 200, true, 'Logged out successfully');

    } catch (error) {
        console.error('Logout error:', error);
        return apiResponse(res, 500, false, 'Logout failed');
    }
};

/**
 * POST /api/auth/logout-all
 * Requires: Authorization header with Bearer token
 * 
 * Revokes ALL sessions for the user (logout from all devices)
 */
const logoutAll = async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
            [req.user.id]
        );

        return apiResponse(res, 200, true, `Logged out from ${result.rowCount} device(s)`);

    } catch (error) {
        console.error('Logout all error:', error);
        return apiResponse(res, 500, false, 'Logout failed');
    }
};
```

### 3.5 Refresh Token

```javascript
/**
 * POST /api/auth/refresh
 * 
 * Request Body:
 * {
 *   "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
 * }
 */
const refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return apiResponse(res, 400, false, 'Refresh token required');
        }

        // 1. Verify the refresh token
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
        } catch (err) {
            return apiResponse(res, 401, false, 'Invalid or expired refresh token');
        }

        if (decoded.type !== 'refresh') {
            return apiResponse(res, 401, false, 'Invalid token type');
        }

        // 2. Check session exists and is valid
        const refreshTokenHash = hashToken(refresh_token);
        const sessionResult = await pool.query(`
            SELECT s.*, u.deleted_at as user_deleted
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1 
              AND s.refresh_token_hash = $2
              AND s.revoked_at IS NULL 
              AND s.expires_at > NOW()
              AND u.deleted_at IS NULL
        `, [decoded.session_id, refreshTokenHash]);

        if (sessionResult.rows.length === 0) {
            return apiResponse(res, 401, false, 'Session invalid or expired');
        }

        const session = sessionResult.rows[0];

        // 3. Generate new access token
        const newAccessToken = jwt.sign(
            { 
                session_id: session.id,
                user_id: session.user_id 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 4. Update session with new access token hash
        const newAccessTokenHash = hashToken(newAccessToken);
        await pool.query(`
            UPDATE user_sessions 
            SET access_token_hash = $1, last_used_at = NOW()
            WHERE id = $2
        `, [newAccessTokenHash, session.id]);

        return apiResponse(res, 200, true, 'Token refreshed', {
            access_token: newAccessToken,
            expires_in: process.env.JWT_EXPIRES_IN || '7d'
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        return apiResponse(res, 500, false, 'Token refresh failed');
    }
};
```

### 3.6 Get Current User (Me)

```javascript
/**
 * GET /api/auth/me
 * Requires: Authorization header with Bearer token
 * 
 * Returns current user's profile
 */
const getMe = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.name, u.email, u.phone,
                u.weekly_income, u.legitimacy_score, u.is_verified,
                u.created_at, u.last_login_at,
                p.name as platform_name,
                c.name as city_name,
                v.status as verification_status,
                utm.total_trust_score
            FROM users u
            LEFT JOIN platforms p ON u.platform_id = p.id
            LEFT JOIN cities c ON u.city_id = c.id
            LEFT JOIN verifications v ON u.id = v.user_id
            LEFT JOIN user_trust_metrics utm ON u.id = utm.user_id
            WHERE u.id = $1 AND u.deleted_at IS NULL
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return apiResponse(res, 404, false, 'User not found');
        }

        return apiResponse(res, 200, true, 'User profile', result.rows[0]);

    } catch (error) {
        console.error('Get me error:', error);
        return apiResponse(res, 500, false, 'Failed to fetch profile');
    }
};

module.exports = {
    register,
    login,
    logout,
    logoutAll,
    refreshToken,
    getMe
};
```

---

## 4. Auth Middleware — `src/middleware/auth.middleware.js`

```javascript
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { hashToken, apiResponse } = require('../utils/helpers');

/**
 * Authentication Middleware
 * 
 * Verifies JWT token and validates session in database.
 * Attaches user and session to req object.
 * 
 * Usage: router.get('/protected', authMiddleware, controller.method)
 */
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return apiResponse(res, 401, false, 'Access token required');
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify JWT signature and decode
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return apiResponse(res, 401, false, 'Token expired');
            }
            return apiResponse(res, 401, false, 'Invalid token');
        }

        // 3. Hash the token and verify against DB
        const tokenHash = hashToken(token);

        // 4. Check session is valid (not revoked, not expired)
        const result = await pool.query(`
            SELECT 
                s.id as session_id, s.user_id, s.expires_at,
                u.id, u.name, u.email, u.is_verified, u.legitimacy_score,
                u.deleted_at
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1 
              AND s.access_token_hash = $2
              AND s.revoked_at IS NULL 
              AND s.expires_at > NOW()
              AND u.deleted_at IS NULL
        `, [decoded.session_id, tokenHash]);

        if (result.rows.length === 0) {
            return apiResponse(res, 401, false, 'Session invalid or expired');
        }

        const data = result.rows[0];

        // 5. Update last_used_at (non-blocking)
        pool.query(
            'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
            [data.session_id]
        ).catch(err => console.error('Failed to update session last_used_at:', err));

        // 6. Attach user and session to request
        req.user = {
            id: data.user_id,
            name: data.name,
            email: data.email,
            is_verified: data.is_verified,
            legitimacy_score: data.legitimacy_score
        };

        req.session = {
            id: data.session_id,
            expires_at: data.expires_at
        };

        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        return apiResponse(res, 500, false, 'Authentication failed');
    }
};

/**
 * Optional Auth Middleware
 * 
 * Same as authMiddleware but doesn't fail if no token provided.
 * Useful for endpoints that behave differently for logged-in users.
 */
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    // If token provided, validate it
    return authMiddleware(req, res, next);
};

/**
 * Verified User Middleware
 * 
 * Use AFTER authMiddleware. Requires user to be KYC verified.
 */
const verifiedMiddleware = (req, res, next) => {
    if (!req.user.is_verified) {
        return apiResponse(res, 403, false, 'Account verification required');
    }
    next();
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    verifiedMiddleware
};
```

---

## 5. Routes — `src/routes/auth.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Public routes (no auth required)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes (auth required)
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

module.exports = router;
```

---

## 6. Update `src/index.js`

Add the auth routes to the Express app:

```javascript
// ... existing code ...

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));

// ... rest of the code ...
```

---

## 7. API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create new user account |
| POST | `/api/auth/login` | ❌ | Login and get tokens |
| POST | `/api/auth/refresh` | ❌ | Get new access token using refresh token |
| GET | `/api/auth/me` | ✅ | Get current user profile |
| POST | `/api/auth/logout` | ✅ | Revoke current session |
| POST | `/api/auth/logout-all` | ✅ | Revoke all user sessions |

---

## 8. Request/Response Examples

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul Kumar",
    "email": "rahul@example.com",
    "password": "SecurePass123!",
    "phone": "9876543210",
    "platform_id": 1,
    "city_id": 1,
    "weekly_income": 5000
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 1,
      "name": "Rahul Kumar",
      "email": "rahul@example.com",
      "phone": "9876543210",
      "is_verified": false
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": "7d"
  },
  "timestamp": "2026-03-30T18:00:00.000Z"
}
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rahul@example.com",
    "password": "SecurePass123!"
  }'
```

### Protected Request
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## 9. Security Checklist

- [ ] JWT tokens are signed with a strong secret (32+ chars)
- [ ] Passwords hashed with bcrypt (cost factor 12)
- [ ] Token HASHES stored in DB, never raw tokens
- [ ] All user queries include `AND deleted_at IS NULL`
- [ ] All session queries include `AND revoked_at IS NULL AND expires_at > NOW()`
- [ ] Refresh tokens have `type: 'refresh'` to prevent misuse
- [ ] Rate limiting on login/register (implement later with `express-rate-limit`)

---

## 10. Database Queries Reference

**Soft delete pattern (ALWAYS use):**
```sql
SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL
```

**Session validation:**
```sql
SELECT * FROM user_sessions 
WHERE id = $1 
  AND access_token_hash = $2
  AND revoked_at IS NULL 
  AND expires_at > NOW()
```

**Revoke session:**
```sql
UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1
```

---

## 11. Testing Checklist

1. **Register** — Create a new user, verify JWT returned
2. **Duplicate email** — Should return 409 Conflict
3. **Login** — With correct credentials
4. **Login fail** — With wrong password (401)
5. **Get /me** — With valid token
6. **Get /me** — With expired/invalid token (401)
7. **Logout** — Verify session revoked, token no longer works
8. **Refresh** — Get new access token
9. **Logout all** — Verify all sessions revoked

---

## Questions?

Refer to:
- `server/database/migrations/schema_final.sql` — Database schema
- `server/backend_api_blueprint.md` — Detailed table documentation (Section 2.2)

---

*Last updated: March 2026*
