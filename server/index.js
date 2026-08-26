require('dotenv').config();

const express = require('express');
const path = require('path');
const limiter = require('./middleware/rateLimit');
const weatherRouter = require('./routes/weather');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Guard: API key must be set ───────────────────────────────────────────────
if (!process.env.OWM_API_KEY || process.env.OWM_API_KEY === 'your_openweathermap_api_key_here') {
  console.error('\n❌  OWM_API_KEY is not set.');
  console.error('    Copy .env.example → .env and paste your OpenWeatherMap API key.\n');
  process.exit(1);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use('/api', limiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', weatherRouter);

// ─── Static Frontend ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all: serve index.html for any unmatched route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({
    error: true,
    code: 'SERVER_ERROR',
    message: 'An internal server error occurred.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌤  Weather Dashboard running at http://localhost:${PORT}\n`);
});
