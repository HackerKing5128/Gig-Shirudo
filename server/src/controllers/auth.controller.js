const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { apiResponse } = require("../utils/helpers");
const { createSession } = require("../services/auth.service");

const register = async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    platform_id,
    partner_id,
    city_id,
    weekly_income,
  } = req.body;

  if (!name || !email || !password) {
    return apiResponse(
      res,
      400,
      false,
      "name, email and password are required",
    );
  }

  if (password.length < 8) {
    return apiResponse(
      res,
      400,
      false,
      "password must be at least 8 characters",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `SELECT id FROM users
       WHERE email = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [email.toLowerCase().trim()],
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return apiResponse(res, 409, false, "email is already registered");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertedUser = await client.query(
      `INSERT INTO users
        (name, email, password_hash, phone, platform_id, partner_id, city_id, weekly_income)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, phone, platform_id, partner_id, city_id, weekly_income, is_verified, legitimacy_score, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        phone || null,
        platform_id || null,
        partner_id || null,
        city_id || null,
        weekly_income || null,
      ],
    );

    const user = insertedUser.rows[0];

    await client.query(
      `INSERT INTO user_trust_metrics (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    );

    const session = await createSession({
      client,
      userId: user.id,
      req,
    });

    await client.query("COMMIT");

    return apiResponse(res, 201, true, "registration successful", {
      user,
      auth: {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        session_id: session.sessionId,
        expires_at: session.expiresAt,
        refresh_expires_at: session.refreshExpiresAt,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error during user registration:", error);
    return apiResponse(res, 500, false, "registration failed");
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return apiResponse(res, 400, false, "email and password are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, name, email, password_hash, phone, platform_id, partner_id, city_id, weekly_income,
              is_verified, legitimacy_score, last_login_at
       FROM users
       WHERE email = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return apiResponse(res, 401, false, "invalid email or password");
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await client.query("ROLLBACK");
      return apiResponse(res, 401, false, "invalid email or password");
    }

    await client.query(
      `UPDATE users
       SET last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    const session = await createSession({
      client,
      userId: user.id,
      req,
    });

    await client.query("COMMIT");

    delete user.password_hash;

    return apiResponse(res, 200, true, "login successful", {
      user,
      auth: {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        session_id: session.sessionId,
        expires_at: session.expiresAt,
        refresh_expires_at: session.refreshExpiresAt,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiResponse(res, 500, false, "login failed", {
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  register,
  login,
};
