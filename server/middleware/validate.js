/**
 * Validate query params for city-based weather requests.
 */
function validateCity(req, res, next) {
  const city = (req.query.city || '').trim();
  const unit = req.query.unit || 'metric';

  if (!city) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_CITY',
      message: 'Please enter a city name.',
    });
  }

  if (city.length > 100) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_CITY',
      message: 'City name is too long.',
    });
  }

  if (!['metric', 'imperial'].includes(unit)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_UNIT',
      message: 'Unit must be "metric" or "imperial".',
    });
  }

  req.query.city = city;
  req.query.unit = unit;
  next();
}

/**
 * Validate query params for coordinate-based requests.
 */
function validateCoords(req, res, next) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const unit = req.query.unit || 'metric';

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_COORDS',
      message: 'Valid latitude and longitude are required.',
    });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      error: true,
      code: 'COORDS_OUT_OF_RANGE',
      message: 'Coordinates are out of valid range.',
    });
  }

  if (!['metric', 'imperial'].includes(unit)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_UNIT',
      message: 'Unit must be "metric" or "imperial".',
    });
  }

  req.query.unit = unit;
  next();
}

module.exports = { validateCity, validateCoords };
