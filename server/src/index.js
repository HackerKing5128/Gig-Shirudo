const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

console.log("🔧 Loading from:", path.join(__dirname, "..", ".env"));

const express = require("express");
const cors = require("cors");
const { pool } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as server_time");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      server_time: result.rows[0].server_time,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// API Routes (to be added)
// app.use('/api/auth', require('./routes/auth.routes'));
// app.use('/api/users', require('./routes/user.routes'));
// app.use('/api/platforms', require('./routes/platform.routes'));
// app.use('/api/cities', require('./routes/city.routes'));
// app.use('/api/plans', require('./routes/plan.routes'));
// app.use('/api/policies', require('./routes/policy.routes'));
// app.use('/api/claims', require('./routes/claim.routes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Gig Shirudo API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
