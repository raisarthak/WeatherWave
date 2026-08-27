/**
 * travel-utility.js — Commute Weather, Weather Journey & Detailed Laundry Drying Analyzer.
 */

// ── Commute & Journey Weather ──────────────────────────────────────────────────

/**
 * Fetch and compare weather between Origin and Destination.
 * @param {string} originCity
 * @param {string} destinationCity
 * @param {'metric'|'imperial'} unit
 * @returns {Promise<{ origin: WeatherNow, destination: WeatherNow, advice: string }>}
 */
async function compareJourneyWeather(originCity, destinationCity, unit = 'metric') {
  if (!originCity || !destinationCity) {
    throw new Error('Please provide both Origin and Destination locations.');
  }

  const [originRaw, destRaw] = await Promise.all([
    fetchWeather(originCity.trim(), unit),
    fetchWeather(destinationCity.trim(), unit),
  ]);

  const origin = parseCurrentWeather(originRaw);
  const destination = parseCurrentWeather(destRaw);

  const adviceParts = [];
  const tempDiff = destination.temp - origin.temp;
  const sym = unitSymbol(unit);

  if (Math.abs(tempDiff) >= 3) {
    adviceParts.push(
      `Destination is ${Math.abs(tempDiff)}${sym} ${tempDiff > 0 ? 'warmer' : 'cooler'} than your origin.`
    );
  } else {
    adviceParts.push('Temperatures at origin and destination are very similar.');
  }

  const destRain = destination.condition.toLowerCase().includes('rain') || destination.condition.toLowerCase().includes('drizzle');
  const origRain = origin.condition.toLowerCase().includes('rain');

  if (destRain && !origRain) {
    adviceParts.push('Rain is expected at your destination. Carry rain gear.');
  } else if (!destRain && origRain) {
    adviceParts.push('Skies are clearer at your destination.');
  }

  if (destination.visibility !== null && destination.visibility < 5) {
    adviceParts.push('Low visibility reported along your destination area.');
  }

  if (destination.windSpeed > 10) {
    adviceParts.push(`Breezy conditions at destination (${destination.windSpeed} ${windUnit(unit)}).`);
  }

  return {
    origin,
    destination,
    advice: adviceParts.join(' '),
  };
}

// ── Detailed Laundry Drying Analyzer ──────────────────────────────────────────

/**
 * Calculates estimated outdoor clothes drying time in hours based on physics heuristics:
 * - High temperature accelerates evaporation.
 * - Low humidity allows faster moisture absorption.
 * - Higher wind speeds disperse moisture layer.
 * - Direct sun (low cloud cover) provides radiant heat.
 * 
 * @param {WeatherNow} weather
 * @param {'metric'|'imperial'} unit
 * @returns {{ dryingHours: number, rating: string, recommendation: string, efficiency: number }}
 */
function calculateLaundryDrying(weather, unit = 'metric') {
  const t = unit === 'imperial' ? (weather.temp - 32) * 5 / 9 : weather.temp; // in °C
  const h = weather.humidity; // 0-100%
  const w = unit === 'imperial' ? weather.windSpeed * 0.44704 : weather.windSpeed; // in m/s
  const clouds = weather.clouds ?? 50; // %
  const isRaining = weather.condition.toLowerCase().includes('rain') || weather.condition.toLowerCase().includes('drizzle') || weather.condition.toLowerCase().includes('thunder');

  if (isRaining) {
    return {
      dryingHours: 0,
      rating: 'Not Recommended',
      recommendation: 'Precipitation active. Do not hang clothes outdoors.',
      efficiency: 0,
    };
  }

  // Base drying time at standard conditions (20°C, 50% hum, 2 m/s wind, 50% clouds) is ~3.5 hours
  let baseHours = 3.5;

  // Temperature modifier (-0.08 hours per degree above 20°C)
  const tempMod = (20 - t) * 0.08;

  // Humidity modifier (+0.04 hours per 1% humidity above 50%)
  const humMod = (h - 50) * 0.04;

  // Wind modifier (-0.2 hours per m/s above 2 m/s)
  const windMod = (2 - Math.min(8, w)) * 0.2;

  // Cloud modifier (+0.01 hours per 1% cloud above 50%)
  const cloudMod = (clouds - 50) * 0.01;

  let totalHours = Math.max(1.0, Math.min(10.0, baseHours + tempMod + humMod + windMod + cloudMod));
  totalHours = Math.round(totalHours * 10) / 10;

  let rating = 'Optimal';
  let efficiency = Math.round(Math.max(10, Math.min(100, (10 - totalHours) * 10 + 20)));

  if (totalHours <= 2.5) {
    rating = 'Fast Drying';
  } else if (totalHours <= 4.0) {
    rating = 'Good Drying';
  } else if (totalHours <= 6.0) {
    rating = 'Slow Drying';
  } else {
    rating = 'Poor Drying';
  }

  let recommendation = `Estimated drying time is ~${totalHours} hours.`;
  if (h > 75) recommendation += ' High air moisture will slow evaporation.';
  else if (w > 5) recommendation += ' Good wind flow will accelerate drying.';

  return {
    dryingHours: totalHours,
    rating,
    recommendation,
    efficiency,
  };
}
