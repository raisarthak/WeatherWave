/**
 * api.js — Hybrid API Client for WeatherWave.
 * 
 * 1. Automatically uses Express proxy (/api/*) when running locally or on server environments.
 * 2. Automatically falls back to direct OpenWeatherMap API calls on static hosting (e.g. GitHub Pages).
 */

const DIRECT_OWM_KEY = 'dbd274e15fc7845da1ff9072927f0244';
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const OWM_GEO = 'https://api.openweathermap.org/geo/1.0';

let isStaticMode = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.protocol === 'file:'
);

let searchController = null;
let suggestController = null;

/**
 * Get a fresh AbortSignal for a new search session.
 * Cancels any previous search in progress.
 */
function createSearchSignal() {
  if (searchController) {
    searchController.abort();
  }
  searchController = new AbortController();
  return searchController.signal;
}

/**
 * Get a fresh AbortSignal for autocomplete suggestion queries.
 */
function createSuggestSignal() {
  if (suggestController) {
    suggestController.abort();
  }
  suggestController = new AbortController();
  return suggestController.signal;
}

/**
 * Core fetch wrapper with automatic static fallback.
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
async function apiFetch(url, signal = null) {
  const fetchOptions = {
    headers: { 'Accept': 'application/json' },
  };
  if (signal) {
    fetchOptions.signal = signal;
  }

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    let json = {};
    try {
      json = await response.json();
    } catch {
      // Non-JSON response (e.g. 404 HTML page)
    }
    const err = new Error(json.message || `Request failed with status ${response.status}`);
    err.code = json.code || 'UNKNOWN';
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Fetch geocoding autocomplete suggestions.
 * @param {string} query
 * @param {number|null} [userLat]
 * @param {number|null} [userLon]
 * @param {AbortSignal} [signal]
 */
async function fetchSuggestions(query, userLat = null, userLon = null, signal = null) {
  if (isStaticMode) {
    const geoUrl = `${OWM_GEO}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${DIRECT_OWM_KEY}`;
    return apiFetch(geoUrl, signal);
  }

  try {
    let url = `/api/geocode/suggest?q=${encodeURIComponent(query)}`;
    if (userLat !== null && userLon !== null) {
      url += `&lat=${userLat}&lon=${userLon}`;
    }
    return await apiFetch(url, signal);
  } catch (err) {
    if (err.status === 404) {
      isStaticMode = true;
      return fetchSuggestions(query, userLat, userLon, signal);
    }
    throw err;
  }
}

/**
 * Fetch current weather by location or query options.
 * @param {string|object} location - City string or { city, state, lat, lon, userLat, userLon }
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchWeather(location, unit = 'metric', signal = null) {
  if (isStaticMode) {
    let directUrl;
    if (typeof location === 'object' && location !== null && location.lat !== undefined && location.lon !== undefined) {
      directUrl = `${OWM_BASE}/weather?lat=${location.lat}&lon=${location.lon}&units=${unit}&appid=${DIRECT_OWM_KEY}`;
    } else {
      const q = typeof location === 'object' ? (location.city || location.name) : location;
      directUrl = `${OWM_BASE}/weather?q=${encodeURIComponent(q)}&units=${unit}&appid=${DIRECT_OWM_KEY}`;
    }
    return apiFetch(directUrl, signal);
  }

  let url;
  if (typeof location === 'object' && location !== null) {
    const params = new URLSearchParams({ unit });
    if (location.city) params.set('city', location.city);
    if (location.state) params.set('state', location.state);
    if (location.lat !== undefined) params.set('lat', location.lat);
    if (location.lon !== undefined) params.set('lon', location.lon);
    if (location.userLat !== undefined) params.set('userLat', location.userLat);
    if (location.userLon !== undefined) params.set('userLon', location.userLon);
    url = `/api/weather?${params.toString()}`;
  } else {
    url = `/api/weather?city=${encodeURIComponent(location)}&unit=${unit}`;
  }

  try {
    return await apiFetch(url, signal);
  } catch (err) {
    if (err.status === 404) {
      isStaticMode = true;
      return fetchWeather(location, unit, signal);
    }
    throw err;
  }
}

/**
 * Fetch 5-day / 3-hour forecast by location or query options.
 * @param {string|object} location
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchForecast(location, unit = 'metric', signal = null) {
  if (isStaticMode) {
    let directUrl;
    if (typeof location === 'object' && location !== null && location.lat !== undefined && location.lon !== undefined) {
      directUrl = `${OWM_BASE}/forecast?lat=${location.lat}&lon=${location.lon}&units=${unit}&appid=${DIRECT_OWM_KEY}`;
    } else {
      const q = typeof location === 'object' ? (location.city || location.name) : location;
      directUrl = `${OWM_BASE}/forecast?q=${encodeURIComponent(q)}&units=${unit}&appid=${DIRECT_OWM_KEY}`;
    }
    return apiFetch(directUrl, signal);
  }

  let url;
  if (typeof location === 'object' && location !== null) {
    const params = new URLSearchParams({ unit });
    if (location.city) params.set('city', location.city);
    if (location.state) params.set('state', location.state);
    if (location.lat !== undefined) params.set('lat', location.lat);
    if (location.lon !== undefined) params.set('lon', location.lon);
    if (location.userLat !== undefined) params.set('userLat', location.userLat);
    if (location.userLon !== undefined) params.set('userLon', location.userLon);
    url = `/api/forecast?${params.toString()}`;
  } else {
    url = `/api/forecast?city=${encodeURIComponent(location)}&unit=${unit}`;
  }

  try {
    return await apiFetch(url, signal);
  } catch (err) {
    if (err.status === 404) {
      isStaticMode = true;
      return fetchForecast(location, unit, signal);
    }
    throw err;
  }
}

/**
 * Fetch current weather + forecast by coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchByCoords(lat, lon, unit = 'metric', signal = null) {
  if (isStaticMode) {
    const [current, forecast] = await Promise.all([
      fetchWeather({ lat, lon }, unit, signal),
      fetchForecast({ lat, lon }, unit, signal),
    ]);
    return { current, forecast };
  }

  const url = `/api/coords?lat=${lat}&lon=${lon}&unit=${unit}`;
  try {
    return await apiFetch(url, signal);
  } catch (err) {
    if (err.status === 404) {
      isStaticMode = true;
      return fetchByCoords(lat, lon, unit, signal);
    }
    throw err;
  }
}

/**
 * Fetch air pollution / AQI data by coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} [signal]
 */
async function fetchAirPollution(lat, lon, signal = null) {
  if (isStaticMode) {
    const directUrl = `${OWM_BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${DIRECT_OWM_KEY}`;
    return apiFetch(directUrl, signal);
  }

  const url = `/api/air-pollution?lat=${lat}&lon=${lon}`;
  try {
    return await apiFetch(url, signal);
  } catch (err) {
    if (err.status === 404) {
      isStaticMode = true;
      return fetchAirPollution(lat, lon, signal);
    }
    throw err;
  }
}
