const express = require('express');
const fetch = require('node-fetch');
const cache = require('../middleware/cache');
const { validateCity, validateCoords } = require('../middleware/validate');

const router = express.Router();
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const OWM_GEO  = 'https://api.openweathermap.org/geo/1.0';

// ─── Error mapper ─────────────────────────────────────────────────────────────
function mapOWMError(status, json) {
  if (status === 404) return { code: 'CITY_NOT_FOUND', message: 'City not found. Please check the spelling and try again.' };
  if (status === 401) return { code: 'AUTH_ERROR',     message: 'Server configuration error — invalid API key.' };
  if (status === 429) return { code: 'RATE_LIMIT',     message: 'OpenWeatherMap rate limit reached. Please try again later.' };
  return { code: 'OWM_ERROR', message: json?.message || 'An error occurred fetching weather data.' };
}

// ─── Haversine Distance helper ────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Geocoding helper ─────────────────────────────────────────────────────────
// Resolves city names accurately with multi-match and proximity bias
async function resolveCity(cityQuery, key, userLat = null, userLon = null) {
  try {
    const geoUrl = `${OWM_GEO}/direct?q=${encodeURIComponent(cityQuery)}&limit=5&appid=${key}`;
    const res = await fetch(geoUrl);
    if (!res.ok) return null;
    let list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    // If user coordinates are provided and no explicit state/country match filter,
    // sort by proximity to user
    if (userLat !== null && userLon !== null && !isNaN(userLat) && !isNaN(userLon) && list.length > 1) {
      list = list.map(item => ({
        ...item,
        distanceKm: haversineDistance(Number(userLat), Number(userLon), item.lat, item.lon)
      })).sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return list[0]; // Best matching candidate { name, lat, lon, country, state }
  } catch {
    // fallback if geo fails
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/geocode/suggest?q=Maraiya&lat=25.5&lon=85.1
router.get('/geocode/suggest', async (req, res) => {
  const { q, lat, lon } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.json([]);
  }

  const query = q.trim();
  const key = process.env.OWM_API_KEY;

  // Cache suggestions for 30 minutes
  const cacheKey = `suggest:${query.toLowerCase()}:${lat || ''}:${lon || ''}`;
  const cached = cache.get('suggest', { q: cacheKey });
  if (cached) {
    return res.json(cached);
  }

  try {
    const geoUrl = `${OWM_GEO}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${key}`;
    const response = await fetch(geoUrl);
    if (!response.ok) {
      return res.json([]);
    }

    let list = await response.json();
    if (!Array.isArray(list)) return res.json([]);

    const hasUserCoords = lat !== undefined && lon !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lon));
    const uLat = hasUserCoords ? Number(lat) : null;
    const uLon = hasUserCoords ? Number(lon) : null;

    const formatted = list.map(item => {
      const dist = hasUserCoords ? Math.round(haversineDistance(uLat, uLon, item.lat, item.lon)) : null;
      return {
        name: item.name,
        state: item.state || null,
        country: item.country || '',
        lat: item.lat,
        lon: item.lon,
        distanceKm: dist
      };
    });

    // If user proximity available, sort by nearest
    if (hasUserCoords && formatted.length > 1) {
      formatted.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
    }

    // Deduplicate by name + state + country
    const seen = new Set();
    const unique = formatted.filter(item => {
      const key = `${item.name}-${item.state || ''}-${item.country}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cache.set('suggest', { q: cacheKey }, unique);
    return res.json(unique);
  } catch (err) {
    return res.json([]);
  }
});

// GET /api/weather?city=London&state=England&lat=51.5&lon=-0.1&unit=metric
router.get('/weather', validateCity, async (req, res) => {
  const { city, state, unit, lat: qLat, lon: qLon, userLat, userLon } = req.query;
  const key = process.env.OWM_API_KEY;

  // If exact coordinates are passed directly (e.g. from autocomplete selection)
  if (qLat && qLon && !isNaN(Number(qLat)) && !isNaN(Number(qLon))) {
    const lat = Number(qLat);
    const lon = Number(qLon);
    const cached = cache.get('weather-coords-exact', { lat, lon, unit });
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    const url = `${OWM_BASE}/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${key}`;
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      const { code, message } = mapOWMError(response.status, json);
      return res.status(response.status === 404 ? 404 : 502).json({ error: true, code, message });
    }

    if (city) json.name = city;
    if (state) json.state = state;

    cache.set('weather-coords-exact', { lat, lon, unit }, json);
    return res.json(json);
  }

  // Cache hit by city?
  const cached = cache.get('weather', { city, unit });
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  const geo = await resolveCity(city, key, userLat, userLon);
  let url;
  if (geo) {
    url = `${OWM_BASE}/weather?lat=${geo.lat}&lon=${geo.lon}&units=${unit}&appid=${key}`;
  } else {
    url = `${OWM_BASE}/weather?q=${encodeURIComponent(city)}&units=${unit}&appid=${key}`;
  }

  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) {
    const { code, message } = mapOWMError(response.status, json);
    return res.status(response.status === 404 ? 404 : 502).json({ error: true, code, message });
  }

  if (geo) {
    json.name = geo.name;
    if (geo.state) json.state = geo.state;
  }

  cache.set('weather', { city, unit }, json);
  return res.json(json);
});

// GET /api/forecast?city=London&state=England&lat=51.5&lon=-0.1&unit=metric
router.get('/forecast', validateCity, async (req, res) => {
  const { city, state, unit, lat: qLat, lon: qLon, userLat, userLon } = req.query;
  const key = process.env.OWM_API_KEY;

  // If exact coordinates are passed directly (e.g. from autocomplete selection)
  if (qLat && qLon && !isNaN(Number(qLat)) && !isNaN(Number(qLon))) {
    const lat = Number(qLat);
    const lon = Number(qLon);
    const cached = cache.get('forecast-coords-exact', { lat, lon, unit });
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    const url = `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&units=${unit}&cnt=40&appid=${key}`;
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      const { code, message } = mapOWMError(response.status, json);
      return res.status(response.status === 404 ? 404 : 502).json({ error: true, code, message });
    }

    if (json.city) {
      if (city) json.city.name = city;
      json.city.coord = { lat, lon };
    }

    cache.set('forecast-coords-exact', { lat, lon, unit }, json);
    return res.json(json);
  }

  // Cache hit?
  const cached = cache.get('forecast', { city, unit });
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  const geo = await resolveCity(city, key, userLat, userLon);
  let url;
  if (geo) {
    url = `${OWM_BASE}/forecast?lat=${geo.lat}&lon=${geo.lon}&units=${unit}&cnt=40&appid=${key}`;
  } else {
    url = `${OWM_BASE}/forecast?q=${encodeURIComponent(city)}&units=${unit}&cnt=40&appid=${key}`;
  }

  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) {
    const { code, message } = mapOWMError(response.status, json);
    return res.status(response.status === 404 ? 404 : 502).json({ error: true, code, message });
  }

  if (geo && json.city) {
    json.city.name = geo.name;
    json.city.coord = { lat: geo.lat, lon: geo.lon };
    json.city.country = geo.country;
  }

  cache.set('forecast', { city, unit }, json);
  return res.json(json);
});

// GET /api/coords?lat=51.5&lon=-0.1&unit=metric
router.get('/coords', validateCoords, async (req, res) => {
  const { lat, lon, unit } = req.query;
  const key = process.env.OWM_API_KEY;
  const weatherUrl  = `${OWM_BASE}/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${key}`;
  const forecastUrl = `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&units=${unit}&cnt=40&appid=${key}`;

  const cacheParams = { lat, lon, unit };

  // Try cache first
  const cachedWeather   = cache.get('weather-coords',  cacheParams);
  const cachedForecast  = cache.get('forecast-coords', cacheParams);

  if (cachedWeather && cachedForecast) {
    return res.json({ weather: cachedWeather, forecast: cachedForecast, _cached: true });
  }

  const [wRes, fRes] = await Promise.all([fetch(weatherUrl), fetch(forecastUrl)]);
  const [wJson, fJson] = await Promise.all([wRes.json(), fRes.json()]);

  if (!wRes.ok) {
    const { code, message } = mapOWMError(wRes.status, wJson);
    return res.status(wRes.status === 404 ? 404 : 502).json({ error: true, code, message });
  }

  cache.set('weather-coords',  cacheParams, wJson);
  cache.set('forecast-coords', cacheParams, fJson);

  return res.json({ weather: wJson, forecast: fJson });
});

// GET /api/air-pollution?lat=51.5&lon=-0.1
router.get('/air-pollution', validateCoords, async (req, res) => {
  const { lat, lon } = req.query;
  const key = process.env.OWM_API_KEY;

  const cached = cache.get('air-pollution', { lat, lon });
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  const url = `${OWM_BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) {
    const { code, message } = mapOWMError(response.status, json);
    return res.status(response.status === 404 ? 404 : 502).json({ error: true, code, message });
  }

  cache.set('air-pollution', { lat, lon }, json);
  return res.json(json);
});

module.exports = router;
