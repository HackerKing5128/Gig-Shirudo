const crypto = require("crypto");

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const apiResponse = (res, statusCode, success, message, data = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const detectDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone")
  ) {
    return "mobile";
  }
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "tablet";
  }
  if (!ua) {
    return "unknown";
  }
  return "desktop";
};

module.exports = {
  hashToken,
  apiResponse,
  detectDeviceType,
};
