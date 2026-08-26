const NodeCache = require('node-cache');

// TTL: 10 minutes (600 seconds)
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

/**
 * Build a cache key from endpoint type + query params.
 * @param {string} type  - 'weather' | 'forecast' | 'coords' | 'air-pollution'
 * @param {object} params - { city?, lat?, lon?, unit? }
 * @returns {string}
 */
function buildKey(type, params = {}) {
  const { city, lat, lon, unit = 'metric' } = params;
  if (city) {
    return `${type}:${city.toLowerCase().trim()}:${unit}`;
  }
  if (lat !== undefined && lon !== undefined) {
    return `${type}:${lat}:${lon}:${unit}`;
  }
  return `${type}:${JSON.stringify(params)}`;
}

function get(type, params) {
  return cache.get(buildKey(type, params));
}

function set(type, params, data) {
  cache.set(buildKey(type, params), data);
}

module.exports = { get, set };
