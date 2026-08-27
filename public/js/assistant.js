function getUnitSymbol(unit) {
  return unit === 'imperial' ? '°F' : '°C';
}

function getWindUnit(unit) {
  return unit === 'imperial' ? 'mph' : 'm/s';
}

const WeatherAssistant = {
  /**
   * Process a natural language question and return an intelligent response.
   * @param {string} query
   * @param {WeatherNow} weather
   * @param {ForecastDay[]} forecast
   * @param {HourlySlot[]} hourlySlots
   * @param {AirQuality|null} aqi
   * @param {'metric'|'imperial'} unit
   * @returns {{ answer: string, confidence: number, topic: string, icon: string }}
   */
  ask(query, weather, forecast, hourlySlots, aqi, unit = 'metric') {
    if (!query || !query.trim()) {
      return {
        answer: 'Please type a question about current conditions, forecasts, or activity recommendations.',
        confidence: 100,
        topic: 'help',
        icon: 'messageCircle',
      };
    }

    if (!weather) {
      return {
        answer: 'Please search for a location first so I can inspect real-time meteorology and forecasts for you.',
        confidence: 100,
        topic: 'no_data',
        icon: 'search',
      };
    }

    const q = query.toLowerCase().trim();
    const sym = getUnitSymbol(unit);
    const wSpeedUnit = getWindUnit(unit);

    // 1. Umbrella / Rain Question
    if (q.includes('umbrella') || q.includes('rain') || q.includes('shower') || q.includes('drizzle')) {
      const isRainingNow = weather.condition.toLowerCase().includes('rain') || weather.condition.toLowerCase().includes('drizzle');
      const upcomingRain = hourlySlots?.slice(0, 5).find(s => s.pop > 0.35 || s.condition.toLowerCase().includes('rain'));

      if (isRainingNow) {
        return {
          answer: `Yes, keep an umbrella handy! Precipitation is actively recorded in ${weather.city} with ${weather.humidity}% humidity.`,
          confidence: 96,
          topic: 'rain',
          icon: 'umbrella',
        };
      } else if (upcomingRain) {
        const timeStr = new Date((upcomingRain.dt + (weather.timezone || 0)) * 1000).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', hour12: true });
        return {
          answer: `It's not raining now, but rain probability reaches ${Math.round(upcomingRain.pop * 100)}% around ${timeStr}. Bringing an umbrella is recommended.`,
          confidence: 92,
          topic: 'rain',
          icon: 'umbrella',
        };
      } else {
        return {
          answer: `No umbrella needed today in ${weather.city}. Skies are expected to stay clear of significant rain over the coming hours.`,
          confidence: 94,
          topic: 'rain',
          icon: 'sun',
        };
      }
    }

    // 2. Running / Jogging
    if (q.includes('run') || q.includes('jog')) {
      const score = calculateActivityScore(weather, aqi, 'running', unit);
      const best = findBestTimeWindow(hourlySlots, 'running', unit, weather.timezone || 0);
      return {
        answer: `Running score for ${weather.city} is ${score.total}/100 (${score.rating}). ${score.recommendation}${best ? ` Optimal window today is ${best.startTime} – ${best.endTime}.` : ''}`,
        confidence: 95,
        topic: 'running',
        icon: 'run',
      };
    }

    // 3. Cricket / Outdoor Sports
    if (q.includes('cricket') || q.includes('football') || q.includes('soccer') || q.includes('match') || q.includes('game')) {
      const score = calculateActivityScore(weather, aqi, 'cricket', unit);
      return {
        answer: `Outdoor sports score is ${score.total}/100 (${score.rating}). Current temp is ${weather.temp}${sym}, wind is ${weather.windSpeed} ${wSpeedUnit}, and visibility is ${weather.visibility ?? 10} km. ${score.recommendation}`,
        confidence: 93,
        topic: 'cricket',
        icon: 'cricket',
      };
    }

    // 4. Cycling / Biking
    if (q.includes('cycle') || q.includes('cycling') || q.includes('bike') || q.includes('biking')) {
      const score = calculateActivityScore(weather, aqi, 'cycling', unit);
      return {
        answer: `Cycling score is ${score.total}/100 (${score.rating}). Wind is at ${weather.windSpeed} ${wSpeedUnit} (${weather.windDirection || 'calm'}). ${score.recommendation}`,
        confidence: 94,
        topic: 'cycling',
        icon: 'bike',
      };
    }

    // 5. Laundry / Drying Clothes
    if (q.includes('laundry') || q.includes('dry') || q.includes('clothes') || q.includes('washing')) {
      const dry = calculateLaundryDrying(weather, unit);
      return {
        answer: `Laundry condition: ${dry.rating}. ${dry.recommendation} (Temperature: ${weather.temp}${sym}, Humidity: ${weather.humidity}%, Cloud cover: ${weather.clouds ?? 0}%).`,
        confidence: 91,
        topic: 'laundry',
        icon: 'shirt',
      };
    }

    // 6. Air Quality / AQI / Smog / Pollution
    if (q.includes('air') || q.includes('aqi') || q.includes('pollution') || q.includes('smog') || q.includes('breath')) {
      if (aqi) {
        return {
          answer: `Air Quality Index in ${weather.city} is ${aqi.aqi} (${aqi.label}). PM2.5 is ${aqi.pm2_5} μg/m³ and PM10 is ${aqi.pm10} μg/m³. Advisory: ${aqi.advisory}`,
          confidence: 98,
          topic: 'aqi',
          icon: 'leaf',
        };
      } else {
        return {
          answer: `Air quality metrics are currently unavailable for this coordinate in ${weather.city}. Atmospheric visibility is ${weather.visibility ?? 10} km.`,
          confidence: 85,
          topic: 'aqi',
          icon: 'leaf',
        };
      }
    }

    // 7. Clothing / What to wear
    if (q.includes('wear') || q.includes('jacket') || q.includes('coat') || q.includes('clothes') || q.includes('dress')) {
      const t = unit === 'imperial' ? (weather.temp - 32) * 5 / 9 : weather.temp;
      let wearAdvice = '';
      if (t >= 28) {
        wearAdvice = 'Wear light, breathable cotton clothing and sunglasses. Stay hydrated.';
      } else if (t >= 18) {
        wearAdvice = 'Comfortable light layers, t-shirt, or light shirt. Perfect weather.';
      } else if (t >= 10) {
        wearAdvice = 'A light jacket, sweater, or hoodie is recommended.';
      } else if (t >= 0) {
        wearAdvice = 'A warm winter coat, scarf, and thermal layers are advised.';
      } else {
        wearAdvice = 'Heavy winter parka, gloves, and insulated headwear required.';
      }
      return {
        answer: `With current temperature of ${weather.temp}${sym} (feels like ${weather.feelsLike}${sym}): ${wearAdvice}`,
        confidence: 92,
        topic: 'clothing',
        icon: 'shirt',
      };
    }

    // 8. Tomorrow's Forecast
    if (q.includes('tomorrow') || q.includes('next day')) {
      if (forecast && forecast.length > 0) {
        const tm = forecast[0];
        return {
          answer: `Tomorrow (${tm.day}, ${tm.date}) in ${weather.city} will see highs of ${tm.tempHigh}${sym} and lows of ${tm.tempLow}${sym} with ${tm.description}.`,
          confidence: 95,
          topic: 'forecast',
          icon: 'calendar',
        };
      }
    }

    // 9. Temperature / How hot / How cold
    if (q.includes('temp') || q.includes('hot') || q.includes('cold') || q.includes('warm')) {
      return {
        answer: `Current temperature in ${weather.city} is ${weather.temp}${sym} (feels like ${weather.feelsLike}${sym}), with today's high reaching ${weather.tempMax}${sym} and low dropping to ${weather.tempMin}${sym}.`,
        confidence: 98,
        topic: 'temperature',
        icon: 'thermometer',
      };
    }

    // 10. Default General Intelligent Synthesis
    const score = calculateActivityScore(weather, aqi, 'walk', unit);
    return {
      answer: `Currently in ${weather.city}: ${weather.temp}${sym} with ${weather.description}. Humidity is ${weather.humidity}% and wind speed is ${weather.windSpeed} ${wSpeedUnit}. Overall outdoor score is ${score.total}/100 (${score.rating}). ${score.recommendation}`,
      confidence: 88,
      topic: 'general',
      icon: 'sparkles',
    };
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.WeatherAssistant = WeatherAssistant;
}
