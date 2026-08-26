require('dotenv').config();

const express = require('express');
const limiter = require('./middleware/rateLimit');
const weatherRouter = require('./routes/weather');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// Apply rate limiter to API routes
app.use('/api', limiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
// Mount under both '/api' and '/' for seamless local & serverless routing
app.use('/api', weatherRouter);
app.use('/', weatherRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({
    error: true,
    code: 'SERVER_ERROR',
    message: 'An internal server error occurred.',
  });
});

module.exports = app;
