/**
 * model.js — Transforms raw OWM JSON into clean internal objects.
 * The rest of the app only touches WeatherNow and ForecastDay.
 */

/**
 * @typedef {Object} WeatherNow
 * @property {string} city
 * @property {string} country
 * @property {number} temp
 * @property {number} feelsLike
 * @property {number} tempMin
 * @property {number} tempMax
 * @property {number} humidity
 * @property {number} windSpeed
 * @property {string} windDirection
 * @property {number} pressure
 * @property {number} visibility   - in km
 * @property {number} clouds       - percentage
 * @property {string} condition    - e.g. "Rain"
 * @property {string} description  - e.g. "light rain"
 * @property {string} icon         - OWM icon code
 * @property {string} iconUrl
 * @property {number} lat
 * @property {number} lon
 * @property {number} timestamp    - Unix seconds
 */

/**
 * @typedef {Object} ForecastDay
 * @property {string} day          - e.g. "Mon"
 * @property {string} date         - e.g. "Aug 26"
 * @property {number} tempHigh
 * @property {number} tempLow
 * @property {string} condition
 * @property {string} description
 * @property {string} icon
 * @property {string} iconUrl
 */

/** Wind degree → compass direction */
function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Parse OWM /weather response into WeatherNow.
 * @param {object} json
 * @returns {WeatherNow}
 */
function parseCurrentWeather(json) {
  const icon = json.weather[0].icon;
  return {
    city:        json.name,
    state:       json.state || null,
    country:     json.sys?.country || json.country || '',
    temp:        Math.round(json.main.temp),
    feelsLike:   Math.round(json.main.feels_like),
    tempMin:     Math.round(json.main.temp_min),
    tempMax:     Math.round(json.main.temp_max),
    humidity:    json.main.humidity,
    windSpeed:   Math.round(json.wind.speed * 10) / 10,
    windDeg:     json.wind.deg ?? 0,
    windGust:    json.wind.gust ? Math.round(json.wind.gust * 10) / 10 : null,
    windDirection: json.wind.deg !== undefined ? degToCompass(json.wind.deg) : '',
    pressure:    json.main.pressure,
    visibility:  json.visibility !== undefined ? Math.round(json.visibility / 100) / 10 : null,
    clouds:      json.clouds?.all ?? null,
    sunrise:     json.sys?.sunrise ? json.sys.sunrise : null,
    sunset:      json.sys?.sunset ? json.sys.sunset : null,
    timezone:    json.timezone ?? 0,
    condition:   json.weather[0].main,
    description: json.weather[0].description,
    icon,
    iconUrl:     `https://openweathermap.org/img/wn/${icon}@2x.png`,
    lat:         json.coord.lat,
    lon:         json.coord.lon,
    timestamp:   json.dt,
  };
}

/**
 * Parse OWM /forecast response into an array of ForecastDay (5 days).
 * OWM returns 3-hour slots; we collapse them into daily entries.
 * @param {object} json
 * @returns {ForecastDay[]}
 */
function parseForecast(json) {
  // Group 3-hour slots by calendar day
  const byDay = {};
  for (const slot of json.list) {
    const date = new Date(slot.dt * 1000);
    const key  = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(slot);
  }

  const today = new Date().toISOString().slice(0, 10);

  return Object.entries(byDay)
    .filter(([day]) => day !== today)   // skip partial today data
    .slice(0, 5)
    .map(([key, slots]) => {
      const temps = slots.map(s => s.main.temp);
      // Pick midday slot for icon/description (12:00 preferred)
      const midday = slots.find(s => {
        const h = new Date(s.dt * 1000).getHours();
        return h >= 11 && h <= 14;
      }) || slots[Math.floor(slots.length / 2)];

      const date = new Date(key + 'T12:00:00');
      const icon = midday.weather[0].icon;

      return {
        day:         date.toLocaleDateString('en-US', { weekday: 'short' }),
        date:        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tempHigh:    Math.round(Math.max(...temps)),
        tempLow:     Math.round(Math.min(...temps)),
        condition:   midday.weather[0].main,
        description: midday.weather[0].description,
        icon,
        iconUrl:     `https://openweathermap.org/img/wn/${icon}@2x.png`,
      };
    });
}

/**
 * @typedef {Object} AirQuality
 * @property {number} aqi           - 1 to 5
 * @property {string} label         - "Good", "Fair", "Moderate", "Poor", "Very Poor"
 * @property {string} colorClass    - "aqi-good", "aqi-fair", "aqi-moderate", "aqi-poor", "aqi-very-poor"
 * @property {string} advisory      - Health advisory string
 * @property {number} pm2_5
 * @property {number} pm10
 * @property {number} o3
 * @property {number} no2
 * @property {number} so2
 * @property {number} co
 */

const AQI_MAP = {
  1: { label: 'Good',      colorClass: 'aqi-good',      advisory: 'Air quality is satisfactory and poses little or no risk.' },
  2: { label: 'Fair',      colorClass: 'aqi-fair',      advisory: 'Air quality is acceptable; sensitive groups may experience minor effects.' },
  3: { label: 'Moderate',  colorClass: 'aqi-moderate',  advisory: 'Members of sensitive groups may experience mild health effects.' },
  4: { label: 'Poor',      colorClass: 'aqi-poor',      advisory: 'Everyone may begin to experience health effects; limit prolonged outdoor exposure.' },
  5: { label: 'Very Poor', colorClass: 'aqi-very-poor', advisory: 'Health warnings of emergency conditions. The entire population is affected.' },
};

/**
 * Parse OWM /air_pollution response into AirQuality.
 * @param {object} json
 * @returns {AirQuality|null}
 */
function parseAirQuality(json) {
  if (!json || !json.list || !json.list.length) return null;
  const item = json.list[0];
  const aqiIndex = item.main?.aqi || 1;
  const info = AQI_MAP[aqiIndex] || AQI_MAP[1];
  const comp = item.components || {};

  return {
    aqi:        aqiIndex,
    label:      info.label,
    colorClass: info.colorClass,
    advisory:   info.advisory,
    pm2_5:      comp.pm2_5 !== undefined ? Math.round(comp.pm2_5 * 10) / 10 : 0,
    pm10:       comp.pm10  !== undefined ? Math.round(comp.pm10 * 10) / 10  : 0,
    o3:         comp.o3    !== undefined ? Math.round(comp.o3 * 10) / 10    : 0,
    no2:        comp.no2   !== undefined ? Math.round(comp.no2 * 10) / 10   : 0,
    so2:        comp.so2   !== undefined ? Math.round(comp.so2 * 10) / 10   : 0,
    co:         comp.co    !== undefined ? Math.round(comp.co * 10) / 10    : 0,
  };
}
