/**
 * api.js — All HTTP calls go to /api/* (our Express proxy).
 * The OWM API key never appears here — it lives server-side.
 */

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
 * Core fetch wrapper.
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
  const json = await response.json();

  if (!response.ok) {
    // Server returned a structured error — propagate it
    const err = new Error(json.message || 'Request failed');
    err.code = json.code || 'UNKNOWN';
    err.status = response.status;
    throw err;
  }

  return json;
}

/**
 * Fetch geocoding autocomplete suggestions.
 * @param {string} query
 * @param {number|null} [userLat]
 * @param {number|null} [userLon]
 * @param {AbortSignal} [signal]
 */
async function fetchSuggestions(query, userLat = null, userLon = null, signal = null) {
  let url = `/api/geocode/suggest?q=${encodeURIComponent(query)}`;
  if (userLat !== null && userLon !== null) {
    url += `&lat=${userLat}&lon=${userLon}`;
  }
  return apiFetch(url, signal);
}

/**
 * Fetch current weather by location or query options.
 * @param {string|object} location - City string or { city, state, lat, lon, userLat, userLon }
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchWeather(location, unit = 'metric', signal = null) {
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
  return apiFetch(url, signal);
}

/**
 * Fetch 5-day / 3-hour forecast by location or query options.
 * @param {string|object} location
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchForecast(location, unit = 'metric', signal = null) {
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
  return apiFetch(url, signal);
}

/**
 * Fetch current weather + forecast by coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {'metric'|'imperial'} unit
 * @param {AbortSignal} [signal]
 */
async function fetchByCoords(lat, lon, unit = 'metric', signal = null) {
  const url = `/api/coords?lat=${lat}&lon=${lon}&unit=${unit}`;
  return apiFetch(url, signal);
}

/**
 * Fetch air pollution / AQI data by coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} [signal]
 */
async function fetchAirPollution(lat, lon, signal = null) {
  const url = `/api/air-pollution?lat=${lat}&lon=${lon}`;
  return apiFetch(url, signal);
}
