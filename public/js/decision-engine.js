/**
 * decision-engine.js — WeatherWave Decision Engine.
 * Pure calculation functions — no DOM access.
 * Calculates activity scores, best time windows, and weather impact from real data.
 */

// ── Activity Definitions & Weight Profiles ────────────────────────────────────
const ACTIVITIES = {
  walk:        { key: 'walk',        label: 'Walk',           icon: 'walk',   weights: { temp: 0.25, rain: 0.30, wind: 0.15, aqi: 0.15, humidity: 0.10, visibility: 0.05 } },
  running:     { key: 'running',     label: 'Running',        icon: 'run',    weights: { temp: 0.20, rain: 0.25, wind: 0.10, aqi: 0.20, humidity: 0.20, visibility: 0.05 } },
  cycling:     { key: 'cycling',     label: 'Cycling',        icon: 'bike',   weights: { temp: 0.15, rain: 0.30, wind: 0.25, aqi: 0.10, humidity: 0.10, visibility: 0.10 } },
  cricket:     { key: 'cricket',     label: 'Cricket',        icon: 'cricket',weights: { temp: 0.15, rain: 0.35, wind: 0.20, aqi: 0.10, humidity: 0.15, visibility: 0.05 } },
  driving:     { key: 'driving',     label: 'Driving',        icon: 'car',    weights: { temp: 0.05, rain: 0.25, wind: 0.15, aqi: 0.05, humidity: 0.05, visibility: 0.45 } },
  laundry:     { key: 'laundry',     label: 'Laundry',        icon: 'shirt',  weights: { temp: 0.15, rain: 0.35, wind: 0.15, aqi: 0.00, humidity: 0.30, visibility: 0.05 } },
  gardening:   { key: 'gardening',   label: 'Gardening',      icon: 'flower', weights: { temp: 0.25, rain: 0.25, wind: 0.15, aqi: 0.15, humidity: 0.15, visibility: 0.05 } },
  photography: { key: 'photography', label: 'Photography',    icon: 'camera', weights: { temp: 0.05, rain: 0.25, wind: 0.15, aqi: 0.05, humidity: 0.05, visibility: 0.45 } },
  travel:      { key: 'travel',      label: 'Travel',         icon: 'plane',  weights: { temp: 0.10, rain: 0.30, wind: 0.20, aqi: 0.10, humidity: 0.10, visibility: 0.20 } },
  study:       { key: 'study',       label: 'Outdoor Study',  icon: 'book',   weights: { temp: 0.25, rain: 0.30, wind: 0.15, aqi: 0.15, humidity: 0.10, visibility: 0.05 } },
};

// ── Sub-Score Calculators ─────────────────────────────────────────────────────
// Each returns 0–100 based on how favorable the metric is for outdoor activity

/**
 * Temperature sub-score. Optimal: 18–26°C (metric) / 64–79°F (imperial)
 */
function tempScore(temp, unit) {
  const t = unit === 'imperial' ? (temp - 32) * 5 / 9 : temp; // normalize to °C
  if (t >= 18 && t <= 26) return 100;
  if (t >= 14 && t < 18)  return 75 + (t - 14) * 6.25;
  if (t > 26 && t <= 32)  return 100 - (t - 26) * 8.3;
  if (t >= 10 && t < 14)  return 50 + (t - 10) * 6.25;
  if (t > 32 && t <= 38)  return 50 - (t - 32) * 8.3;
  if (t >= 5 && t < 10)   return 25 + (t - 5) * 5;
  if (t > 38 && t <= 44)  return Math.max(0, 25 - (t - 38) * 4.2);
  if (t < 5)              return Math.max(0, 25 + t * 5);
  return 0;
}

/**
 * Rain probability sub-score. Lower is better for outdoor activity.
 * pop: 0–1 from API
 */
function rainScore(pop) {
  if (pop === null || pop === undefined) return 80; // no data = assume OK
  const pct = pop * 100;
  if (pct <= 10) return 100;
  if (pct <= 25) return 90 - (pct - 10) * 0.67;
  if (pct <= 50) return 80 - (pct - 25) * 1.2;
  if (pct <= 75) return 50 - (pct - 50) * 1.2;
  return Math.max(0, 20 - (pct - 75) * 0.8);
}

/**
 * Wind speed sub-score. Calm is better for most activities.
 * speed in m/s (metric) or mph (imperial)
 */
function windScore(speed, unit) {
  const s = unit === 'imperial' ? speed * 0.44704 : speed; // normalize to m/s
  if (s <= 3)  return 100;
  if (s <= 6)  return 90 - (s - 3) * 3.3;
  if (s <= 10) return 80 - (s - 6) * 5;
  if (s <= 15) return 60 - (s - 10) * 6;
  if (s <= 20) return 30 - (s - 15) * 4;
  return Math.max(0, 10 - (s - 20) * 2);
}

/**
 * AQI sub-score. OWM AQI: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
 */
function aqiScore(aqiIndex) {
  if (!aqiIndex || aqiIndex < 1) return 80; // no data
  const map = { 1: 100, 2: 80, 3: 55, 4: 30, 5: 10 };
  return map[aqiIndex] || 50;
}

/**
 * Humidity sub-score. Comfortable range: 30–60%.
 */
function humidityScore(humidity) {
  if (humidity >= 30 && humidity <= 60) return 100;
  if (humidity >= 20 && humidity < 30)  return 80 + (humidity - 20) * 2;
  if (humidity > 60 && humidity <= 75)  return 100 - (humidity - 60) * 2;
  if (humidity >= 10 && humidity < 20)  return 60 + (humidity - 10) * 2;
  if (humidity > 75 && humidity <= 90)  return 70 - (humidity - 75) * 2.67;
  if (humidity < 10)                    return 40 + humidity * 2;
  return Math.max(0, 30 - (humidity - 90) * 3);
}

/**
 * Visibility sub-score. Higher is better.
 * vis in km
 */
function visibilityScore(visKm) {
  if (visKm === null || visKm === undefined) return 80;
  if (visKm >= 10) return 100;
  if (visKm >= 7)  return 85 + (visKm - 7) * 5;
  if (visKm >= 4)  return 65 + (visKm - 4) * 6.67;
  if (visKm >= 2)  return 40 + (visKm - 2) * 12.5;
  if (visKm >= 1)  return 20 + (visKm - 1) * 20;
  return Math.max(0, visKm * 20);
}

// ── Core Score Calculator ─────────────────────────────────────────────────────

/**
 * Calculate activity score from weather + AQI data.
 * @param {WeatherNow} weather
 * @param {AirQuality|null} aqi
 * @param {string} activityKey — key from ACTIVITIES
 * @param {'metric'|'imperial'} unit
 * @returns {{ total: number, breakdown: Object, rating: string, recommendation: string }}
 */
function calculateActivityScore(weather, aqi, activityKey, unit) {
  const act = ACTIVITIES[activityKey] || ACTIVITIES.walk;
  const w = act.weights;

  // Calculate each sub-score
  const breakdown = {
    temp:       Math.round(tempScore(weather.temp, unit)),
    rain:       Math.round(rainScore(weather.pop ?? null)),
    wind:       Math.round(windScore(weather.windSpeed, unit)),
    aqi:        Math.round(aqiScore(aqi ? aqi.aqi : null)),
    humidity:   Math.round(humidityScore(weather.humidity)),
    visibility: Math.round(visibilityScore(weather.visibility)),
  };

  // Weighted total
  const total = Math.round(
    breakdown.temp       * w.temp +
    breakdown.rain       * w.rain +
    breakdown.wind       * w.wind +
    breakdown.aqi        * w.aqi +
    breakdown.humidity   * w.humidity +
    breakdown.visibility * w.visibility
  );

  const rating = getRating(total);
  const recommendation = generateRecommendation(total, weather, act, breakdown, unit);

  return { total, breakdown, rating, recommendation };
}

/**
 * Map score to rating label.
 */
function getRating(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Poor';
  return 'Avoid';
}

/**
 * Get CSS color class for a rating.
 */
function getRatingColor(score) {
  if (score >= 85) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 50) return 'score-moderate';
  if (score >= 30) return 'score-poor';
  return 'score-avoid';
}

/**
 * Generate natural language recommendation.
 */
function generateRecommendation(total, weather, activity, breakdown, unit) {
  const label = activity.label.toLowerCase();
  const parts = [];

  if (total >= 85) {
    parts.push(`Excellent conditions for ${label}.`);
  } else if (total >= 70) {
    parts.push(`Good conditions for ${label}.`);
  } else if (total >= 50) {
    parts.push(`Moderate conditions for ${label}. Some factors may limit comfort.`);
  } else if (total >= 30) {
    parts.push(`Poor conditions for ${label}. Consider postponing if possible.`);
  } else {
    parts.push(`Conditions are not suitable for ${label}. Best to stay indoors.`);
  }

  // Add specific insights based on weakest factors
  const factors = Object.entries(breakdown).sort((a, b) => a[1] - b[1]);
  const weakest = factors[0];

  if (weakest[1] < 50) {
    const messages = {
      temp:       `Temperature (${weather.temp}${unit === 'imperial' ? '°F' : '°C'}) is outside the comfort range.`,
      rain:       'Rain probability is elevated. Carry rain protection.',
      wind:       `Wind speed (${weather.windSpeed} ${unit === 'imperial' ? 'mph' : 'm/s'}) may cause discomfort.`,
      aqi:        'Air quality is limiting outdoor conditions.',
      humidity:   `Humidity (${weather.humidity}%) is outside the comfortable range.`,
      visibility: 'Reduced visibility may affect safety.',
    };
    if (messages[weakest[0]]) parts.push(messages[weakest[0]]);
  }

  return parts.join(' ');
}

// ── Best Time Window Calculator ───────────────────────────────────────────────

/**
 * Find the best time window for an activity from hourly forecast data.
 * @param {HourlySlot[]} hourlySlots — parsed 3-hour forecast slots
 * @param {string} activityKey
 * @param {'metric'|'imperial'} unit
 * @param {number} timezone — timezone offset in seconds from UTC
 * @returns {{ startTime: string, endTime: string, score: number, conditions: Object }|null}
 */
function findBestTimeWindow(hourlySlots, activityKey, unit, timezone) {
  if (!hourlySlots || hourlySlots.length === 0) return null;

  const act = ACTIVITIES[activityKey] || ACTIVITIES.walk;
  const w = act.weights;

  // Only look at today's remaining slots
  const now = Date.now() / 1000;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndTs = todayEnd.getTime() / 1000;

  const todaySlots = hourlySlots.filter(s => s.dt >= now && s.dt <= todayEndTs + 86400);

  if (todaySlots.length === 0) return null;

  // Score each slot
  const scoredSlots = todaySlots.map(slot => {
    const breakdown = {
      temp:       tempScore(slot.temp, unit),
      rain:       rainScore(slot.pop),
      wind:       windScore(slot.windSpeed, unit),
      aqi:        80, // AQI doesn't change per-hour in our data
      humidity:   humidityScore(slot.humidity),
      visibility: visibilityScore(slot.visibility || 10),
    };

    const total = Math.round(
      breakdown.temp       * w.temp +
      breakdown.rain       * w.rain +
      breakdown.wind       * w.wind +
      breakdown.aqi        * w.aqi +
      breakdown.humidity   * w.humidity +
      breakdown.visibility * w.visibility
    );

    return { ...slot, score: total, breakdown };
  });

  // Find the best contiguous window (1–3 slots = 3–9 hours)
  let bestStart = 0;
  let bestScore = -1;

  for (let i = 0; i < scoredSlots.length; i++) {
    // Average score of this slot and the next (if available)
    let windowScore = scoredSlots[i].score;
    let count = 1;
    if (i + 1 < scoredSlots.length) {
      windowScore += scoredSlots[i + 1].score;
      count++;
    }
    windowScore = windowScore / count;

    if (windowScore > bestScore) {
      bestScore = windowScore;
      bestStart = i;
    }
  }

  const startSlot = scoredSlots[bestStart];
  const endSlot = scoredSlots[Math.min(bestStart + 1, scoredSlots.length - 1)];

  const fmtSlotTime = (dt) => {
    const d = new Date((dt + timezone) * 1000);
    return d.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return {
    startTime: fmtSlotTime(startSlot.dt),
    endTime: fmtSlotTime(endSlot.dt + 10800), // +3 hours (end of last slot)
    score: Math.round(bestScore),
    conditions: {
      temp: getRating(startSlot.breakdown.temp),
      rain: getRating(startSlot.breakdown.rain),
      wind: getRating(startSlot.breakdown.wind),
      humidity: getRating(startSlot.breakdown.humidity),
    },
    slots: scoredSlots,
  };
}

// ── Weather Impact Calculator ─────────────────────────────────────────────────

/**
 * Calculate quick impact status for all activities.
 * @param {WeatherNow} weather
 * @param {AirQuality|null} aqi
 * @param {'metric'|'imperial'} unit
 * @returns {Array<{ key, label, icon, score, rating, colorClass }>}
 */
function calculateWeatherImpact(weather, aqi, unit) {
  return Object.values(ACTIVITIES).map(act => {
    const result = calculateActivityScore(weather, aqi, act.key, unit);
    return {
      key: act.key,
      label: act.label,
      icon: act.icon,
      score: result.total,
      rating: result.rating,
      colorClass: getRatingColor(result.total),
    };
  });
}
