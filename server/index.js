const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// ─── Guard: Warn if API key is not set ────────────────────────────────────────
if (!process.env.OWM_API_KEY || process.env.OWM_API_KEY === 'your_openweathermap_api_key_here') {
  console.warn('\n⚠️  OWM_API_KEY is not set.');
  console.warn('    Copy .env.example → .env and paste your OpenWeatherMap API key.\n');
}

// ─── Static Frontend ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all: serve index.html for any unmatched route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌤  Weather Dashboard running at http://localhost:${PORT}\n`);
});

