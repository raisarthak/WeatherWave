/**
 * app.js — Application controller for WeatherWave.
 * Wires up events, keyboard shortcuts, autocomplete suggestions, API pipeline, and view rendering.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  unit: 'metric',
  lastCity: null,
  lastLocation: null,
  lastWeather: null,
  lastForecast: null,
  lastAqi: null,
  userCoords: null, // { lat, lon } for proximity bias
};

let currentSuggestions = [];
let activeSuggestionIdx = -1;
let suggestDebounceTimer = null;

// ── Element refs ──────────────────────────────────────────────────────────────
const $headerBrand     = document.getElementById('header-brand');
const $cityInput       = document.getElementById('city-input');
const $searchBtn       = document.getElementById('search-btn');
const $searchForm      = document.getElementById('search-form');
const $geoBtn          = document.getElementById('geo-btn');
const $clearRecentsBtn = document.getElementById('clear-recents-btn');

// ── Reset to Home Screen ──────────────────────────────────────────────────────
function goToHomeScreen() {
  state.lastCity = null;
  state.lastLocation = null;
  state.lastWeather = null;
  state.lastForecast = null;
  state.lastAqi = null;
  $cityInput.value = '';
  hideSuggestions();
  showHomeScreen();
}

// ── Core search pipeline ──────────────────────────────────────────────────────
/**
 * @param {string|object} locationQuery - String (e.g. "Maraiya, Bihar") or { city, state, country, lat, lon }
 */
async function searchLocation(locationQuery) {
  hideSuggestions();
  clearInputError();

  let queryParam;
  let displayName;

  if (typeof locationQuery === 'object' && locationQuery !== null) {
    queryParam = {
      city: locationQuery.city || locationQuery.name,
      state: locationQuery.state,
      lat: locationQuery.lat,
      lon: locationQuery.lon,
      userLat: state.userCoords?.lat,
      userLon: state.userCoords?.lon,
    };
    displayName = `${queryParam.city}${queryParam.state ? ', ' + queryParam.state : ''}${locationQuery.country ? ', ' + locationQuery.country : ''}`;
  } else {
    const trimmed = (locationQuery || '').trim();
    if (!trimmed) {
      showInputError('Please enter a valid city name.');
      return;
    }
    queryParam = {
      city: trimmed,
      userLat: state.userCoords?.lat,
      userLon: state.userCoords?.lon,
    };
    displayName = trimmed;
  }

  setLoading(true);

  try {
    const signal = createSearchSignal();
    const [weatherRaw, forecastRaw] = await Promise.all([
      fetchWeather(queryParam, state.unit, signal),
      fetchForecast(queryParam, state.unit, signal),
    ]);

    const weather  = parseCurrentWeather(weatherRaw);
    const forecast = parseForecast(forecastRaw);

    state.lastCity     = displayName;
    state.lastLocation = queryParam;
    state.lastWeather  = weather;
    state.lastForecast = forecast;

    renderCurrentWeather(weather, state.unit);
    renderForecast(forecast, state.unit);

    // Canonical recent label: "City, State, Country" or "City, Country"
    const recentLabel = `${weather.city}${weather.state ? ', ' + weather.state : ''}${weather.country ? ', ' + weather.country : ''}`;
    RecentSearches.add(recentLabel);
    renderRecentChips(RecentSearches.get(), handleChipSelect, handleChipRemove, handleClearAllRecents);

    // Update search input to display canonical location
    $cityInput.value = recentLabel;

    // Fetch AQI using accurate coordinates
    if (weather.lat !== undefined && weather.lon !== undefined) {
      try {
        const aqiRaw = await fetchAirPollution(weather.lat, weather.lon, signal);
        const aqi    = parseAirQuality(aqiRaw);
        state.lastAqi = aqi;
        renderAirQuality(aqi);
      } catch {
        renderAirQuality(null);
      }
    }

  } catch (err) {
    if (err.name === 'AbortError') return; // intentionally cancelled

    const msg = err.message || 'An unexpected error occurred.';
    showError(msg, errorIcon(err.code));
  } finally {
    setLoading(false);
  }
}

// ── Geolocation pipeline ──────────────────────────────────────────────────────
async function searchByLocation() {
  hideSuggestions();
  setLoading(true);
  clearInputError();

  try {
    const { lat, lon } = await getCurrentPosition();
    state.userCoords   = { lat, lon }; // save proximity coords
    const signal       = createSearchSignal();
    const [coordData, aqiRaw] = await Promise.all([
      fetchByCoords(lat, lon, state.unit, signal),
      fetchAirPollution(lat, lon, signal).catch(() => null),
    ]);

    const weather  = parseCurrentWeather(coordData.weather);
    const forecast = parseForecast(coordData.forecast);
    const aqi      = aqiRaw ? parseAirQuality(aqiRaw) : null;

    const recentLabel = `${weather.city}${weather.state ? ', ' + weather.state : ''}${weather.country ? ', ' + weather.country : ''}`;
    state.lastCity     = recentLabel;
    state.lastLocation = { lat, lon, city: weather.city, state: weather.state };
    state.lastWeather  = weather;
    state.lastForecast = forecast;
    state.lastAqi      = aqi;

    renderCurrentWeather(weather, state.unit);
    renderForecast(forecast, state.unit);
    renderAirQuality(aqi);

    RecentSearches.add(recentLabel);
    renderRecentChips(RecentSearches.get(), handleChipSelect, handleChipRemove, handleClearAllRecents);

    $cityInput.value = recentLabel;

  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err.message || 'Location lookup failed.', '📍');
  } finally {
    setLoading(false);
  }
}

// ── Autocomplete Suggestion Logic ─────────────────────────────────────────────
async function handleInputChange() {
  const query = $cityInput.value.trim();
  if (query.length > 0) clearInputError();

  if (query.length < 2) {
    currentSuggestions = [];
    activeSuggestionIdx = -1;
    hideSuggestions();
    return;
  }

  clearTimeout(suggestDebounceTimer);
  suggestDebounceTimer = setTimeout(async () => {
    try {
      const signal = createSuggestSignal();
      const suggestions = await fetchSuggestions(query, state.userCoords?.lat, state.userCoords?.lon, signal);
      currentSuggestions = suggestions;
      activeSuggestionIdx = -1;

      if (suggestions && suggestions.length > 0) {
        renderSuggestions(suggestions, activeSuggestionIdx, onSuggestionSelected);
      } else {
        hideSuggestions();
      }
    } catch {
      hideSuggestions();
    }
  }, 220);
}

function onSuggestionSelected(item) {
  const label = `${item.name}${item.state ? ', ' + item.state : ''}${item.country ? ', ' + item.country : ''}`;
  $cityInput.value = label;
  hideSuggestions();
  searchLocation({
    city: item.name,
    state: item.state,
    country: item.country,
    lat: item.lat,
    lon: item.lon,
  });
}

// ── Unit toggle ───────────────────────────────────────────────────────────────
async function handleUnitToggle(newUnit) {
  if (newUnit === state.unit) return;
  state.unit = newUnit;

  if (!state.lastLocation && !state.lastCity) return; // nothing loaded yet

  setLoading(true);
  try {
    const signal = createSearchSignal();
    const query = state.lastLocation || state.lastCity;
    const [weatherRaw, forecastRaw] = await Promise.all([
      fetchWeather(query, state.unit, signal),
      fetchForecast(query, state.unit, signal),
    ]);
    state.lastWeather  = parseCurrentWeather(weatherRaw);
    state.lastForecast = parseForecast(forecastRaw);

    renderCurrentWeather(state.lastWeather, state.unit);
    renderForecast(state.lastForecast, state.unit);
    if (state.lastAqi) renderAirQuality(state.lastAqi);
  } catch (err) {
    if (err.name !== 'AbortError') showError(err.message);
  } finally {
    setLoading(false);
  }
}

// ── Chip handlers ─────────────────────────────────────────────────────────────
function handleChipSelect(cityLabel) {
  $cityInput.value = cityLabel;
  searchLocation(cityLabel);
}

function handleChipRemove(cityLabel) {
  RecentSearches.remove(cityLabel);
  renderRecentChips(RecentSearches.get(), handleChipSelect, handleChipRemove, handleClearAllRecents);
}

function handleClearAllRecents() {
  RecentSearches.clear();
  renderRecentChips([], handleChipSelect, handleChipRemove, handleClearAllRecents);
}

// ── Error icon helper ─────────────────────────────────────────────────────────
function errorIcon(code) {
  const map = {
    CITY_NOT_FOUND: '🔍',
    RATE_LIMIT:     '⏱️',
    AUTH_ERROR:     '🔑',
    NETWORK_ERROR:  '📡',
    INVALID_COORDS: '📍',
  };
  return map[code] || '⚠️';
}

// ── Event Listeners ───────────────────────────────────────────────────────────
if ($searchForm) {
  $searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (activeSuggestionIdx >= 0 && currentSuggestions[activeSuggestionIdx]) {
      onSuggestionSelected(currentSuggestions[activeSuggestionIdx]);
    } else {
      searchLocation($cityInput.value);
    }
  });
}

if ($searchBtn) {
  $searchBtn.addEventListener('click', () => {
    if (activeSuggestionIdx >= 0 && currentSuggestions[activeSuggestionIdx]) {
      onSuggestionSelected(currentSuggestions[activeSuggestionIdx]);
    } else {
      searchLocation($cityInput.value);
    }
  });
}

$cityInput.addEventListener('input', handleInputChange);

$cityInput.addEventListener('keydown', (e) => {
  // Autocomplete Dropdown Keyboard Navigation
  if (currentSuggestions.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIdx = (activeSuggestionIdx + 1) % currentSuggestions.length;
      renderSuggestions(currentSuggestions, activeSuggestionIdx, onSuggestionSelected);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIdx = activeSuggestionIdx <= 0 ? currentSuggestions.length - 1 : activeSuggestionIdx - 1;
      renderSuggestions(currentSuggestions, activeSuggestionIdx, onSuggestionSelected);
      return;
    }
    if (e.key === 'Escape') {
      hideSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      if (activeSuggestionIdx >= 0 && currentSuggestions[activeSuggestionIdx]) {
        e.preventDefault();
        onSuggestionSelected(currentSuggestions[activeSuggestionIdx]);
        return;
      }
    }
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    searchLocation($cityInput.value);
  }
});

// Close suggestions on click outside
document.addEventListener('click', (e) => {
  if (!$searchForm.contains(e.target)) {
    hideSuggestions();
  }
});

// Quick keyboard shortcut: Press '/' to focus search bar
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $cityInput) {
    e.preventDefault();
    $cityInput.focus();
    $cityInput.select();
  }
});

$geoBtn.addEventListener('click', searchByLocation);

$unitC.addEventListener('click', () => handleUnitToggle('metric'));
$unitF.addEventListener('click', () => handleUnitToggle('imperial'));

$toastClose.addEventListener('click', clearError);

if ($clearRecentsBtn) {
  $clearRecentsBtn.addEventListener('click', handleClearAllRecents);
}

// Logo click / Enter / Space -> return to home screen
if ($headerBrand) {
  $headerBrand.addEventListener('click', goToHomeScreen);
  $headerBrand.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToHomeScreen();
    }
  });
}

// Quick city pill clicks on welcome screen
document.querySelectorAll('.quick-city-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const city = btn.getAttribute('data-city');
    $cityInput.value = city;
    searchLocation(city);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(function init() {
  const recent = RecentSearches.get();
  if (recent.length) {
    renderRecentChips(recent, handleChipSelect, handleChipRemove, handleClearAllRecents);
  }

  // Silently query browser location for proximity bias if already granted
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          pos => { state.userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
          () => {}
        );
      }
    }).catch(() => {});
  }
})();
