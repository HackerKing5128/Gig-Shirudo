const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { hashToken, detectDeviceType } = require("../utils/helpers");

const getAccessExpiry = () => process.env.JWT_EXPIRES_IN || "7d";
const getRefreshExpiry = () => process.env.JWT_REFRESH_EXPIRES_IN || "30d";

const createSession = async ({ client, userId, req }) => {
  const sessionId = crypto.randomUUID();

  const accessToken = jwt.sign(
    { user_id: userId, session_id: sessionId, token_type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: getAccessExpiry() },
  );

  const refreshToken = jwt.sign(
    { user_id: userId, session_id: sessionId, token_type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: getRefreshExpiry() },
  );

  const accessPayload = jwt.decode(accessToken);
  const refreshPayload = jwt.decode(refreshToken);

  const expiresAt = new Date(accessPayload.exp * 1000);
  const refreshExpiresAt = new Date(refreshPayload.exp * 1000);

  await client.query(
    `INSERT INTO user_sessions
      (id, user_id, access_token_hash, refresh_token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      sessionId,
      userId,
      hashToken(accessToken),
      hashToken(refreshToken),
      {
        ua: req.get("user-agent") || "unknown",
        device_type: detectDeviceType(req.get("user-agent") || ""),
      },
      req.ip || null,
      expiresAt,
    ],
  );

  return {
    sessionId,
    accessToken,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
  };
};

module.exports = {
  createSession,
};
