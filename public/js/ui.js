/**
 * ui.js — Pure DOM rendering functions for WeatherWave.
 * Manages rendering for Hero Card, 7-Pack Stats, AQI Spectrum, and 5-Day Forecast.
 */

// ── Root & Core Elements ──────────────────────────────────────────────────────
const $body           = document.getElementById('app-body');
const $emptyState     = document.getElementById('empty-state');
const $weatherContent = document.getElementById('weather-content');
const $loadingOverlay = document.getElementById('loading-overlay');
const $errorToast     = document.getElementById('error-toast');
const $toastMessage   = document.getElementById('toast-message');
const $toastClose     = document.getElementById('toast-close');
const $toastIcon      = document.getElementById('toast-icon');
const $inputError        = document.getElementById('input-error');
const $searchBar         = document.getElementById('search-form');
const $searchSuggestions = document.getElementById('search-suggestions');
const $weatherFx         = document.getElementById('weather-fx');

// ── Hero Card References ──────────────────────────────────────────────────────
const $heroCity           = document.getElementById('hero-city');
const $heroCountry        = document.getElementById('hero-country');
const $heroDate           = document.getElementById('hero-date');
const $heroConditionBadge = document.getElementById('hero-condition-badge');
const $heroUpdatedTime    = document.getElementById('hero-updated-time');
const $heroTemp           = document.getElementById('hero-temp');
const $heroUnitLabel      = document.getElementById('hero-unit-label');
const $heroConditionDesc  = document.getElementById('hero-condition-desc');
const $heroFeelsSummary   = document.getElementById('hero-feels-summary');
const $heroIcon           = document.getElementById('hero-icon');
const $heroHigh           = document.getElementById('hero-high');
const $heroLow            = document.getElementById('hero-low');

// ── Stats Grid References ─────────────────────────────────────────────────────
const $feelsVal       = document.getElementById('stat-feels-val');
const $feelsDesc      = document.getElementById('stat-feels-desc');
const $humidityVal    = document.getElementById('stat-humidity-val');
const $humidityBar    = document.getElementById('humidity-bar');
const $humidityDesc   = document.getElementById('stat-humidity-desc');
const $windVal        = document.getElementById('stat-wind-val');
const $windDesc       = document.getElementById('stat-wind-desc');
const $compassArrow   = document.getElementById('compass-arrow');
const $pressureVal    = document.getElementById('stat-pressure-val');
const $pressureDesc   = document.getElementById('stat-pressure-desc');
const $visibilityVal  = document.getElementById('stat-visibility-val');
const $visibilityDesc = document.getElementById('stat-visibility-desc');
const $cloudsVal      = document.getElementById('stat-clouds-val');
const $cloudsBar      = document.getElementById('clouds-bar');
const $cloudsDesc     = document.getElementById('stat-clouds-desc');
const $sunRiseVal     = document.getElementById('sun-rise-val');
const $sunSetVal      = document.getElementById('sun-set-val');
const $sunDuration    = document.getElementById('sun-duration');

// ── AQI References ────────────────────────────────────────────────────────────
const $aqiSection   = document.getElementById('aqi-section');
const $aqiBadge     = document.getElementById('aqi-badge');
const $aqiNumber    = document.getElementById('aqi-number');
const $aqiLabel     = document.getElementById('aqi-label');
const $aqiAdvisory  = document.getElementById('aqi-advisory');
const $aqiPointer   = document.getElementById('aqi-pointer');
const $polPm25      = document.getElementById('pol-pm25');
const $polPm10      = document.getElementById('pol-pm10');
const $polO3        = document.getElementById('pol-o3');
const $polNo2       = document.getElementById('pol-no2');
const $polSo2       = document.getElementById('pol-so2');
const $polCo        = document.getElementById('pol-co');

// ── AQI Tooltip References ────────────────────────────────────────────────────
const $aqiMeterTrack   = document.getElementById('aqi-meter-track');
const $aqiTooltip      = document.getElementById('aqi-tooltip');
const $aqiTooltipValue = document.getElementById('aqi-tooltip-value');
const $aqiTooltipLabel = document.getElementById('aqi-tooltip-label');

// ── AQI Tooltip Interactive Hover Logic ───────────────────────────────────────
(function initAqiTooltip() {
  if (!$aqiMeterTrack || !$aqiTooltip) return;

  const AQI_CATEGORIES = [
    { max: 50,  label: 'Good',     color: 'hsl(152, 68%, 55%)' },
    { max: 100, label: 'Fair',     color: 'hsl(70, 85%, 55%)' },
    { max: 200, label: 'Moderate', color: 'hsl(38, 95%, 58%)' },
    { max: 300, label: 'Poor',     color: 'hsl(356, 90%, 62%)' },
    { max: 500, label: 'Hazardous',color: 'hsl(280, 80%, 65%)' },
  ];

  function getCategoryForValue(val) {
    for (const cat of AQI_CATEGORIES) {
      if (val <= cat.max) return cat;
    }
    return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
  }

  $aqiMeterTrack.addEventListener('mousemove', (e) => {
    const rect = $aqiMeterTrack.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const aqiValue = Math.round(pct * 500);
    const category = getCategoryForValue(aqiValue);

    $aqiTooltipValue.textContent = aqiValue;
    $aqiTooltipLabel.textContent = category.label;
    $aqiTooltipValue.style.color = category.color;

    // Position tooltip horizontally at cursor position
    $aqiTooltip.style.left = `${x}px`;
  });
})();

// ── Forecast & Recent Searches ────────────────────────────────────────────────
const $forecastStrip = document.getElementById('forecast-strip');
const $chipBar       = document.getElementById('chip-bar');
const $recentSection = document.getElementById('recent-section');
const $unitC         = document.getElementById('unit-c');
const $unitF         = document.getElementById('unit-f');

// ── Loading ───────────────────────────────────────────────────────────────────
function setLoading(isLoading) {
  $loadingOverlay.classList.toggle('hidden', !isLoading);
}

// ── Error Toast ───────────────────────────────────────────────────────────────
let toastTimer = null;

function showError(message, icon = '⚠️') {
  $toastIcon.textContent    = icon;
  $toastMessage.textContent = message;
  $errorToast.classList.remove('hidden', 'toast-exit');
  void $errorToast.offsetWidth; // trigger reflow
  $errorToast.style.animation = '';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => clearError(), 6000);
}

function clearError() {
  $errorToast.classList.add('toast-exit');
  setTimeout(() => $errorToast.classList.add('hidden'), 280);
}

// ── Input Validation Display ──────────────────────────────────────────────────
function showInputError(msg) {
  $inputError.textContent = msg;
  $inputError.classList.remove('hidden');
  if ($searchBar) $searchBar.classList.add('error');
}

function clearInputError() {
  $inputError.classList.add('hidden');
  if ($searchBar) $searchBar.classList.remove('error');
}

// ── Dynamic Background per Condition ──────────────────────────────────────────
const CONDITION_MAP = {
  'clear':        'weather-clear',
  'clouds':       'weather-clouds',
  'rain':         'weather-rain',
  'drizzle':      'weather-rain',
  'thunderstorm': 'weather-storm',
  'snow':         'weather-snow',
  'mist':         'weather-mist',
  'smoke':        'weather-mist',
  'haze':         'weather-mist',
  'dust':         'weather-mist',
  'fog':          'weather-mist',
  'sand':         'weather-mist',
  'ash':          'weather-mist',
  'squall':       'weather-storm',
  'tornado':      'weather-storm',
};

function setBackground(condition) {
  const weatherClasses = ['weather-clear','weather-clouds','weather-rain','weather-storm','weather-snow','weather-mist','weather-default'];
  weatherClasses.forEach(c => $body.classList.remove(c));
  const cls = CONDITION_MAP[(condition || '').toLowerCase()] || 'weather-default';
  $body.classList.add(cls);
  renderWeatherEffects(condition);
}

// ── Live Background Weather Animation Effects ─────────────────────────────────
function renderWeatherEffects(condition) {
  if (!$weatherFx) return;
  $weatherFx.innerHTML = '';
  const cond = (condition || '').toLowerCase();

  // 1. ☀️ Sunny / Clear -> Slow spinning glowing sun
  if (cond === 'clear') {
    const sunContainer = document.createElement('div');
    sunContainer.className = 'fx-sun-container';
    sunContainer.innerHTML = `
      <div class="fx-sun-rays"></div>
      <div class="fx-sun-core"></div>
    `;
    $weatherFx.appendChild(sunContainer);
  }

  // 2. 🌧️ Rain / Drizzle -> Falling raindrops
  else if (cond === 'rain' || cond === 'drizzle') {
    const rainContainer = document.createElement('div');
    rainContainer.className = 'fx-rain-container';
    const dropCount = 45;
    for (let i = 0; i < dropCount; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
      drop.style.animationDelay = `${Math.random() * 2}s`;
      drop.style.height = `${25 + Math.random() * 25}px`;
      drop.style.opacity = `${0.3 + Math.random() * 0.5}`;
      rainContainer.appendChild(drop);
    }
    $weatherFx.appendChild(rainContainer);
  }

  // 3. ☁️ Clouds -> Soft drifting cloud SVGs
  else if (cond === 'clouds') {
    const cloudsContainer = document.createElement('div');
    cloudsContainer.className = 'fx-clouds-container';
    const cloudSvg = `
      <svg width="240" height="90" viewBox="0 0 240 90" fill="currentColor">
        <path d="M40 70 A25 25 0 0 1 60 35 A45 45 0 0 1 140 25 A35 35 0 0 1 190 45 A25 25 0 0 1 200 70 Z" />
      </svg>
    `;
    const cloudConfigs = [
      { top: '8%',  scale: 1.3, duration: '45s', delay: '0s',   opacity: 0.18 },
      { top: '22%', scale: 0.9, duration: '60s', delay: '-15s', opacity: 0.12 },
      { top: '42%', scale: 1.5, duration: '50s', delay: '-30s', opacity: 0.15 },
      { top: '65%', scale: 1.1, duration: '68s', delay: '-8s',  opacity: 0.10 },
    ];
    cloudConfigs.forEach(cfg => {
      const cloud = document.createElement('div');
      cloud.className = 'drifting-cloud';
      cloud.innerHTML = cloudSvg;
      cloud.style.top = cfg.top;
      cloud.style.transform = `scale(${cfg.scale})`;
      cloud.style.animationDuration = cfg.duration;
      cloud.style.animationDelay = cfg.delay;
      cloud.style.opacity = cfg.opacity;
      cloud.style.color = '#94a3b8';
      cloudsContainer.appendChild(cloud);
    });
    $weatherFx.appendChild(cloudsContainer);
  }

  // 4. ⚡ Thunderstorm -> Rain + Lightning Flash Screen
  else if (cond === 'thunderstorm' || cond === 'squall' || cond === 'tornado') {
    const thunderContainer = document.createElement('div');
    thunderContainer.className = 'fx-thunder-container';
    
    // Lightning flash screen
    const flash = document.createElement('div');
    flash.className = 'lightning-flash-screen';
    thunderContainer.appendChild(flash);

    // Fast rain drops
    const rainContainer = document.createElement('div');
    rainContainer.className = 'fx-rain-container';
    for (let i = 0; i < 55; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDuration = `${0.45 + Math.random() * 0.4}s`;
      drop.style.animationDelay = `${Math.random() * 1.5}s`;
      drop.style.height = `${35 + Math.random() * 25}px`;
      rainContainer.appendChild(drop);
    }
    thunderContainer.appendChild(rainContainer);
    $weatherFx.appendChild(thunderContainer);
  }

  // 5. ❄️ Snow -> Drifting gentle snowflakes
  else if (cond === 'snow') {
    const snowContainer = document.createElement('div');
    snowContainer.className = 'fx-snow-container';
    const flakes = ['❄', '❅', '•'];
    for (let i = 0; i < 35; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';
      flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.animationDuration = `${4 + Math.random() * 6}s`;
      flake.style.animationDelay = `${Math.random() * 5}s`;
      flake.style.fontSize = `${0.8 + Math.random() * 0.8}rem`;
      flake.style.opacity = `${0.4 + Math.random() * 0.6}`;
      snowContainer.appendChild(flake);
    }
    $weatherFx.appendChild(snowContainer);
  }
}

// ── Format Helpers ────────────────────────────────────────────────────────────
function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function fmtTime(ts, timezoneSec = 0) {
  if (!ts) return '—';
  // Use UTC + timezone offset to display city's local time accurately
  const localDate = new Date((ts + timezoneSec) * 1000);
  return localDate.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function unitSymbol(unit) {
  return unit === 'imperial' ? '°F' : '°C';
}

function windUnit(unit) {
  return unit === 'imperial' ? 'mph' : 'm/s';
}

// ── Reset to Home Screen ──────────────────────────────────────────────────────
function showHomeScreen() {
  $weatherContent.classList.add('hidden');
  $emptyState.classList.remove('hidden');
  clearInputError();
  clearError();
  setBackground('');
}

// ── Render Current Weather ────────────────────────────────────────────────────
function renderCurrentWeather(data, unit) {
  $emptyState.classList.add('hidden');
  $weatherContent.classList.remove('hidden');

  // Location & Header
  $heroCity.textContent           = data.city;
  $heroCountry.textContent        = data.state ? `, ${data.state}, ${data.country}` : (data.country ? `, ${data.country}` : '');
  $heroDate.textContent           = fmtDate(data.timestamp);
  $heroConditionBadge.textContent = data.condition;
  
  if (data.timezone !== undefined) {
    $heroUpdatedTime.textContent = `Local Time ${fmtTime(Math.floor(Date.now() / 1000), data.timezone)}`;
  } else {
    $heroUpdatedTime.textContent = 'Live Updated';
  }

  // Hero Temperatures
  const sym = unitSymbol(unit);
  $heroTemp.textContent          = data.temp;
  $heroUnitLabel.textContent     = sym;
  $heroConditionDesc.textContent = data.description;
  $heroIcon.src                  = data.iconUrl;
  $heroIcon.alt                  = data.description;
  $heroHigh.textContent          = `↑ ${data.tempMax}${sym}`;
  $heroLow.textContent           = `↓ ${data.tempMin}${sym}`;

  // Feels Like Summary
  const tempDiff = data.feelsLike - data.temp;
  if (tempDiff > 2) {
    $heroFeelsSummary.textContent = `Feels ${tempDiff}° warmer due to humidity`;
  } else if (tempDiff < -2) {
    $heroFeelsSummary.textContent = `Feels ${Math.abs(tempDiff)}° cooler due to wind`;
  } else {
    $heroFeelsSummary.textContent = `Feels similar to actual temperature (${data.feelsLike}${sym})`;
  }

  // ── Key Statistics Cards ──
  // 1. Feels Like
  $feelsVal.textContent = `${data.feelsLike}${sym}`;
  $feelsDesc.textContent = tempDiff > 0 ? `Humidity factor +${tempDiff}°` : (tempDiff < 0 ? `Wind factor ${tempDiff}°` : 'Comfortable balance');

  // 2. Humidity
  $humidityVal.textContent = `${data.humidity}%`;
  if ($humidityBar) $humidityBar.style.width = `${Math.min(100, Math.max(0, data.humidity))}%`;
  if (data.humidity < 40) {
    $humidityDesc.textContent = 'Dry atmosphere';
  } else if (data.humidity <= 65) {
    $humidityDesc.textContent = 'Comfortable moisture';
  } else {
    $humidityDesc.textContent = 'High relative humidity';
  }

  // 3. Wind
  $windVal.textContent = `${data.windSpeed} ${windUnit(unit)}${data.windDirection ? ' ' + data.windDirection : ''}`;
  if ($compassArrow) {
    $compassArrow.style.transform = `rotate(${data.windDeg}deg)`;
  }
  $windDesc.textContent = data.windGust ? `Gusts up to ${data.windGust} ${windUnit(unit)}` : 'Steady air flow';

  // 4. Pressure
  $pressureVal.textContent = `${data.pressure} hPa`;
  if (data.pressure < 1000) {
    $pressureDesc.textContent = 'Low pressure (Precipitation likely)';
  } else if (data.pressure > 1020) {
    $pressureDesc.textContent = 'High pressure (Fair skies)';
  } else {
    $pressureDesc.textContent = 'Normal atmospheric pressure';
  }

  // 5. Visibility
  $visibilityVal.textContent = data.visibility !== null ? `${data.visibility} km` : '—';
  if (data.visibility !== null) {
    if (data.visibility >= 10) $visibilityDesc.textContent = 'Clear visual range';
    else if (data.visibility >= 5) $visibilityDesc.textContent = 'Moderate visibility';
    else $visibilityDesc.textContent = 'Reduced visibility (Haze/Fog)';
  }

  // 6. Cloud Cover
  $cloudsVal.textContent = data.clouds !== null ? `${data.clouds}%` : '—';
  if ($cloudsBar) $cloudsBar.style.width = `${data.clouds || 0}%`;
  if (data.clouds !== null) {
    if (data.clouds < 20) $cloudsDesc.textContent = 'Clear / Sunny skies';
    else if (data.clouds <= 60) $cloudsDesc.textContent = 'Partly cloudy';
    else $cloudsDesc.textContent = 'Overcast cloud cover';
  }

  // 7. Sun & Daylight
  if (data.sunrise && data.sunset) {
    $sunRiseVal.textContent = fmtTime(data.sunrise, data.timezone);
    $sunSetVal.textContent  = fmtTime(data.sunset, data.timezone);
    const daylightHours = Math.round(((data.sunset - data.sunrise) / 3600) * 10) / 10;
    $sunDuration.textContent = `${daylightHours} hours of daylight`;
  } else {
    $sunRiseVal.textContent = '—';
    $sunSetVal.textContent  = '—';
    $sunDuration.textContent = 'Daylight cycle';
  }

  // Background atmosphere
  setBackground(data.condition);

  // Unit toggle state
  $unitC.classList.toggle('active', unit === 'metric');
  $unitF.classList.toggle('active', unit === 'imperial');
  $unitC.setAttribute('aria-pressed', String(unit === 'metric'));
  $unitF.setAttribute('aria-pressed', String(unit === 'imperial'));

  // Hero card subtle scale animation
  const heroCard = document.getElementById('hero-card');
  if (heroCard) {
    heroCard.classList.remove('anim-scale-in');
    void heroCard.offsetWidth;
    heroCard.classList.add('anim-scale-in');
  }
}

// ── Render Air Quality Index (AQI) ────────────────────────────────────────────
function renderAirQuality(data) {
  if (!data) {
    if ($aqiSection) $aqiSection.classList.add('hidden');
    return;
  }

  if ($aqiSection) $aqiSection.classList.remove('hidden');

  $aqiNumber.textContent   = data.aqi;
  $aqiLabel.textContent    = data.label;
  $aqiAdvisory.textContent = data.advisory;

  // Badge class
  $aqiBadge.className = `aqi-badge ${data.colorClass}`;

  // Continuous Pointer on Spectrum Meter (1 to 5 mapped to 10% - 90%)
  if ($aqiPointer) {
    const percentages = { 1: 10, 2: 30, 3: 50, 4: 70, 5: 90 };
    $aqiPointer.style.left = `${percentages[data.aqi] || 10}%`;
  }

  // Pollutants
  $polPm25.textContent = data.pm2_5;
  $polPm10.textContent = data.pm10;
  $polO3.textContent   = data.o3;
  $polNo2.textContent  = data.no2;
  $polSo2.textContent  = data.so2;
  $polCo.textContent   = data.co;
}

// ── Render 5-Day Forecast ─────────────────────────────────────────────────────
function renderForecast(days, unit) {
  $forecastStrip.innerHTML = '';
  const sym = unitSymbol(unit);

  days.forEach((day, i) => {
    const card = document.createElement('article');
    card.className = 'forecast-card';
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <div class="forecast-day">${day.day}</div>
      <div class="forecast-date">${day.date}</div>
      <img class="forecast-icon" src="${day.iconUrl}" alt="${day.description}" loading="lazy" />
      <div class="forecast-temps-row">
        <span class="forecast-temp-high">${day.tempHigh}${sym}</span>
        <span class="forecast-temp-low">${day.tempLow}${sym}</span>
      </div>
      <div class="forecast-desc">${day.description}</div>
    `;
    $forecastStrip.appendChild(card);
  });
}

// ── Render Recent Searches ────────────────────────────────────────────────────
function renderRecentChips(cities, onSelect, onRemove, onClearAll) {
  $chipBar.innerHTML = '';

  if (!cities.length) {
    $recentSection.classList.add('hidden');
    return;
  }

  $recentSection.classList.remove('hidden');

  cities.forEach((city, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.setAttribute('role', 'listitem');
    chip.style.animationDelay = `${i * 0.04}s`;

    const label = document.createElement('button');
    label.textContent = city;
    label.setAttribute('aria-label', `Search for ${city}`);
    label.style.cssText = 'background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:0';
    label.addEventListener('click', () => onSelect(city));

    const remove = document.createElement('button');
    remove.className = 'chip-remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove ${city} from recent searches`);
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(city);
    });

    chip.appendChild(label);
    chip.appendChild(remove);
    $chipBar.appendChild(chip);
  });
}

// ── Render Location Suggestions Dropdown ──────────────────────────────────────
function renderSuggestions(items, activeIndex, onSelect) {
  if (!$searchSuggestions) return;
  $searchSuggestions.innerHTML = '';

  if (!items || !items.length) {
    hideSuggestions();
    return;
  }

  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = `suggestion-item${i === activeIndex ? ' active' : ''}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', String(i === activeIndex));

    const left = document.createElement('div');
    left.className = 'suggestion-left';

    const icon = document.createElement('span');
    icon.className = 'suggestion-icon';
    icon.textContent = '📍';

    const city = document.createElement('span');
    city.className = 'suggestion-city';
    city.textContent = item.name;

    left.appendChild(icon);
    left.appendChild(city);

    if (item.state) {
      const state = document.createElement('span');
      state.className = 'suggestion-state';
      state.textContent = item.state;
      left.appendChild(state);
    }

    if (item.country) {
      const country = document.createElement('span');
      country.className = 'suggestion-country';
      country.textContent = item.country;
      left.appendChild(country);
    }

    el.appendChild(left);

    if (item.distanceKm !== null && item.distanceKm !== undefined) {
      const dist = document.createElement('span');
      dist.className = 'suggestion-distance';
      dist.textContent = `${item.distanceKm} km away`;
      el.appendChild(dist);
    }

    el.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent input blur before select
      onSelect(item);
    });

    $searchSuggestions.appendChild(el);
  });

  $searchSuggestions.classList.remove('hidden');
}

function hideSuggestions() {
  if (!$searchSuggestions) return;
  $searchSuggestions.classList.add('hidden');
  $searchSuggestions.innerHTML = '';
}
