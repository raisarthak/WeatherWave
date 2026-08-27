/**
 * ui-intelligence.js — DOM rendering for WeatherWave Intelligence features across all 5 phases.
 */

// ── Element References ────────────────────────────────────────────────────────
const $decisionEngine     = document.getElementById('decision-engine');
const $bestTimeSection    = document.getElementById('best-time');
const $weatherImpact      = document.getElementById('weather-impact');
const $forecastConfidence = document.getElementById('forecast-confidence');
const $weatherChanges     = document.getElementById('weather-changes');
const $stormArrival       = document.getElementById('storm-arrival');
const $journeySection     = document.getElementById('journey-weather');
const $laundrySection     = document.getElementById('laundry-analyzer');
const $personalitySection = document.getElementById('weather-personality');
const $historySection     = document.getElementById('weather-history');
const $assistantSection   = document.getElementById('weather-assistant');

// ── Activity Selector ─────────────────────────────────────────────────────────

function renderActivitySelector(selectedKey, onSelect) {
  const container = document.getElementById('activity-selector');
  if (!container) return;
  container.innerHTML = '';

  Object.values(ACTIVITIES).forEach(act => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `activity-pill${act.key === selectedKey ? ' active' : ''}`;
    pill.setAttribute('aria-pressed', String(act.key === selectedKey));
    pill.setAttribute('data-activity', act.key);

    const iconFn = Icons[act.icon];
    pill.innerHTML = `${iconFn ? iconFn(16) : ''}<span>${act.label}</span>`;

    pill.addEventListener('click', () => onSelect(act.key));
    container.appendChild(pill);
  });
}

// ── Score Ring (SVG Circular Progress) ─────────────────────────────────────────

function renderActivityScore(scoreData) {
  const container = document.getElementById('score-result');
  if (!container) return;

  const colorClass = getRatingColor(scoreData.total);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (scoreData.total / 100) * circumference;

  const breakdownLabels = {
    temp: 'Temperature',
    rain: 'Rain Risk',
    wind: 'Wind',
    aqi: 'Air Quality',
    humidity: 'Humidity',
    visibility: 'Visibility',
  };

  const breakdownColors = {
    temp: 'hsl(38, 94%, 54%)',
    rain: 'hsl(214, 100%, 62%)',
    wind: 'hsl(172, 85%, 50%)',
    aqi: 'hsl(152, 68%, 46%)',
    humidity: 'hsl(265, 90%, 68%)',
    visibility: 'hsl(190, 70%, 60%)',
  };

  container.className = `score-display ${colorClass}`;
  container.innerHTML = `
    <div class="score-ring-wrapper">
      <svg class="score-ring-svg" viewBox="0 0 120 120">
        <circle class="score-ring-bg" cx="60" cy="60" r="54" />
        <circle class="score-ring-fill" cx="60" cy="60" r="54"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${circumference}" />
      </svg>
      <div class="score-ring-center">
        <span class="score-ring-value">${scoreData.total}</span>
        <span class="score-ring-label">${scoreData.rating}</span>
      </div>
    </div>

    <div class="score-details">
      <div class="score-recommendation">${scoreData.recommendation}</div>
      <div class="breakdown-grid">
        ${Object.entries(scoreData.breakdown).map(([key, val]) => `
          <div class="breakdown-item">
            <div class="breakdown-item-header">
              <span class="breakdown-label">${breakdownLabels[key] || key}</span>
              <span class="breakdown-value">${val}</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-fill" style="width: 0%; --bar-color: ${breakdownColors[key] || 'var(--brand-primary)'}" data-target-width="${val}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const ring = container.querySelector('.score-ring-fill');
    if (ring) ring.style.strokeDashoffset = offset;

    container.querySelectorAll('.breakdown-fill').forEach(bar => {
      const target = bar.dataset.targetWidth;
      requestAnimationFrame(() => { bar.style.width = target; });
    });
  });
}

// ── Decision Engine ───────────────────────────────────────────────────────────

function renderDecisionEngine(weather, aqi, hourlySlots, selectedActivity, unit, onActivitySelect) {
  if (!$decisionEngine) return;
  $decisionEngine.classList.remove('hidden');

  const scoreData = calculateActivityScore(weather, aqi, selectedActivity, unit);
  renderActivitySelector(selectedActivity, onActivitySelect);
  renderActivityScore(scoreData);
}

// ── Best Time Today ───────────────────────────────────────────────────────────

function renderBestTime(hourlySlots, selectedActivity, unit, timezone) {
  if (!$bestTimeSection) return;

  const bestTime = findBestTimeWindow(hourlySlots, selectedActivity, unit, timezone);
  if (!bestTime || !bestTime.slots || bestTime.slots.length === 0) {
    $bestTimeSection.classList.add('hidden');
    return;
  }

  $bestTimeSection.classList.remove('hidden');
  const resultContainer = document.getElementById('best-time-result');
  const timelineContainer = document.getElementById('best-time-timeline');

  if (resultContainer) {
    const ratingClass = bestTime.score >= 85 ? 'excellent' : bestTime.score >= 70 ? 'good' : bestTime.score >= 50 ? 'moderate' : 'poor';
    const actLabel = ACTIVITIES[selectedActivity]?.label || 'Activity';

    resultContainer.innerHTML = `
      <div class="best-time-icon ${ratingClass}">
        ${Icons.clock(24)}
      </div>
      <div class="best-time-text">
        <h4>${bestTime.startTime} – ${bestTime.endTime}</h4>
        <p>Best window for ${actLabel} today • Score: ${bestTime.score}/100</p>
      </div>
    `;
  }

  if (timelineContainer) {
    const visibleSlots = bestTime.slots.slice(0, 8);
    const bestStartIdx = visibleSlots.indexOf(visibleSlots.reduce((best, s) => s.score > best.score ? s : best, visibleSlots[0]));

    timelineContainer.innerHTML = `
      <div class="timeline-bar">
        ${visibleSlots.map((slot, i) => {
          const isBest = i === bestStartIdx || i === bestStartIdx + 1;
          const t = new Date((slot.dt + timezone) * 1000);
          const timeStr = t.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', hour12: true });
          return `
            <div class="timeline-slot ${isBest ? 'best' : ''}" title="Score: ${slot.score}/100">
              <span class="timeline-slot-time">${timeStr}</span>
              <span class="timeline-slot-score">${slot.score}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

// ── Weather Impact Grid ───────────────────────────────────────────────────────

function renderWeatherImpact(weather, aqi, unit) {
  if (!$weatherImpact) return;
  $weatherImpact.classList.remove('hidden');

  const impactData = calculateWeatherImpact(weather, aqi, unit);
  const grid = document.getElementById('impact-grid');
  if (!grid) return;

  grid.innerHTML = impactData.map(item => {
    const iconFn = Icons[item.icon];
    return `
      <div class="impact-item ${item.colorClass}">
        <div class="impact-icon">${iconFn ? iconFn(18) : ''}</div>
        <div class="impact-info">
          <span class="impact-label">${item.label}</span>
          <span class="impact-status" style="color: var(--score-color)">${item.rating}</span>
        </div>
        <span class="impact-score-badge" style="color: var(--score-color)">${item.score}</span>
      </div>
    `;
  }).join('');
}

// ── Forecast Confidence ───────────────────────────────────────────────────────

function renderForecastConfidence(forecastDays) {
  if (!$forecastConfidence || !forecastDays || !forecastDays.length) {
    if ($forecastConfidence) $forecastConfidence.classList.add('hidden');
    return;
  }

  $forecastConfidence.classList.remove('hidden');
  const baseConfidences = [95, 88, 75, 62, 50];
  const grid = document.getElementById('confidence-grid');
  if (!grid) return;

  grid.innerHTML = forecastDays.map((day, i) => {
    const conf = baseConfidences[i] || 45;
    const color = conf >= 80 ? 'hsl(152, 68%, 46%)' : conf >= 60 ? 'hsl(214, 100%, 62%)' : conf >= 40 ? 'hsl(38, 94%, 54%)' : 'hsl(356, 80%, 58%)';

    return `
      <div class="confidence-card">
        <div class="confidence-day">${day.day}, ${day.date}</div>
        <div class="confidence-bar-bg">
          <div class="confidence-bar-fill" style="width: 0%; background: ${color};" data-target-width="${conf}%"></div>
        </div>
        <div class="confidence-value" style="color: ${color}">${conf}%</div>
        <div class="confidence-label">${conf >= 80 ? 'High' : conf >= 60 ? 'Moderate' : 'Low'} confidence</div>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.confidence-bar-fill').forEach(bar => {
      requestAnimationFrame(() => { bar.style.width = bar.dataset.targetWidth; });
    });
  });
}

// ── Weather Changes ───────────────────────────────────────────────────────────

function renderWeatherChanges(weather, hourlySlots) {
  if (!$weatherChanges) return;

  if (!hourlySlots || hourlySlots.length < 2) {
    $weatherChanges.classList.add('hidden');
    return;
  }

  const changes = [];
  const nextSlot = hourlySlots[0];
  const laterSlot = hourlySlots[Math.min(3, hourlySlots.length - 1)];

  const tempDiff = laterSlot.temp - weather.temp;
  if (Math.abs(tempDiff) >= 3) {
    changes.push({
      metric: 'Temperature',
      direction: tempDiff > 0 ? 'up' : 'down',
      detail: `Expected to ${tempDiff > 0 ? 'rise' : 'drop'} by ${Math.abs(Math.round(tempDiff))}° over the next few hours`,
    });
  }

  const windDiff = laterSlot.windSpeed - weather.windSpeed;
  if (Math.abs(windDiff) >= 3) {
    changes.push({
      metric: 'Wind Speed',
      direction: windDiff > 0 ? 'up' : 'down',
      detail: `Wind expected to ${windDiff > 0 ? 'increase' : 'decrease'} by ${Math.abs(Math.round(windDiff * 10) / 10)} m/s`,
    });
  }

  if (nextSlot.pop > 0.5 && !weather.condition.toLowerCase().includes('rain')) {
    changes.push({
      metric: 'Precipitation',
      direction: 'up',
      detail: `Rain probability rising to ${Math.round(nextSlot.pop * 100)}% in the coming hours`,
    });
  }

  const humDiff = laterSlot.humidity - weather.humidity;
  if (Math.abs(humDiff) >= 15) {
    changes.push({
      metric: 'Humidity',
      direction: humDiff > 0 ? 'up' : 'down',
      detail: `Humidity expected to ${humDiff > 0 ? 'increase' : 'decrease'} by ${Math.abs(humDiff)}%`,
    });
  }

  if (changes.length === 0) {
    $weatherChanges.classList.add('hidden');
    return;
  }

  $weatherChanges.classList.remove('hidden');
  const list = document.getElementById('changes-list');
  if (!list) return;

  list.innerHTML = changes.map(ch => `
    <div class="change-item">
      <div class="change-icon ${ch.direction}">
        ${ch.direction === 'up' ? Icons.trendingUp(18) : Icons.trendingDown(18)}
      </div>
      <div class="change-text">
        <div class="change-metric">${ch.metric}</div>
        <div class="change-detail">${ch.detail}</div>
      </div>
    </div>
  `).join('');
}

// ── Storm Arrival ─────────────────────────────────────────────────────────────

function renderStormArrival(weather, hourlySlots, timezone) {
  if (!$stormArrival) return;

  if (!hourlySlots || hourlySlots.length === 0) {
    $stormArrival.classList.add('hidden');
    return;
  }

  const currentNorm = normalizeCondition(weather.condition);
  const isCurrentlyStorm = currentNorm === 'thunderstorm';

  let stormSlot = null;
  let slotsAway = 0;

  if (!isCurrentlyStorm) {
    for (let i = 0; i < Math.min(hourlySlots.length, 8); i++) {
      const norm = normalizeCondition(hourlySlots[i].condition);
      if (norm === 'thunderstorm') {
        stormSlot = hourlySlots[i];
        slotsAway = i;
        break;
      }
    }
  }

  if (!stormSlot) {
    for (let i = 0; i < Math.min(hourlySlots.length, 4); i++) {
      if (hourlySlots[i].pop >= 0.8 && hourlySlots[i].windSpeed > 10) {
        stormSlot = hourlySlots[i];
        slotsAway = i;
        break;
      }
    }
  }

  if (!stormSlot) {
    $stormArrival.classList.add('hidden');
    return;
  }

  $stormArrival.classList.remove('hidden');

  const minutesAway = slotsAway * 180;
  const etaText = minutesAway < 60 ? `~${minutesAway} minutes` : `~${Math.round(minutesAway / 60)} hours`;
  const arrivalTime = new Date((stormSlot.dt + timezone) * 1000);
  const arrivalStr = arrivalTime.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true });

  const alertContent = document.getElementById('storm-alert-content');
  if (!alertContent) return;

  alertContent.innerHTML = `
    <div class="storm-alert-header">
      <div class="storm-alert-icon">${Icons.cloudLightning(24)}</div>
      <div>
        <div class="storm-alert-title">Storm Approaching</div>
        <div class="storm-alert-eta">Estimated arrival: ${etaText} (${arrivalStr})</div>
      </div>
    </div>
    <div class="storm-details-grid">
      <div class="storm-detail">
        <div class="storm-detail-label">Wind</div>
        <div class="storm-detail-value">${Math.round(stormSlot.windSpeed * 10) / 10} m/s</div>
      </div>
      <div class="storm-detail">
        <div class="storm-detail-label">Rain Probability</div>
        <div class="storm-detail-value">${Math.round(stormSlot.pop * 100)}%</div>
      </div>
      <div class="storm-detail">
        <div class="storm-detail-label">Condition</div>
        <div class="storm-detail-value">${stormSlot.condition}</div>
      </div>
    </div>
  `;
}

// ── Phase 3: Commute / Journey Weather ────────────────────────────────────────

function renderJourneyWeather(weather, unit = 'metric') {
  if (!$journeySection) return;
  $journeySection.classList.remove('hidden');

  const form = document.getElementById('journey-form');
  const originInput = document.getElementById('journey-origin');
  const destInput = document.getElementById('journey-dest');
  const comparisonBox = document.getElementById('journey-comparison-box');

  if (originInput && !originInput.value && weather) {
    originInput.value = weather.city;
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const origin = originInput.value.trim();
      const dest = destInput.value.trim();
      if (!origin || !dest) return;

      if (comparisonBox) {
        comparisonBox.innerHTML = `<div class="intel-no-data">${Icons.loader(24)}<p>Comparing weather routes...</p></div>`;
      }

      try {
        const result = await compareJourneyWeather(origin, dest, unit);
        const sym = unitSymbol(unit);

        comparisonBox.innerHTML = `
          <div class="journey-comparison">
            <div class="journey-endpoint-card">
              <div class="journey-endpoint-title">Origin</div>
              <div class="journey-endpoint-city">${result.origin.city}</div>
              <div class="journey-endpoint-temp">${result.origin.temp}${sym}</div>
              <div class="journey-endpoint-cond">${result.origin.description}</div>
            </div>

            <div class="journey-connector">
              ${Icons.route(20)}
            </div>

            <div class="journey-endpoint-card">
              <div class="journey-endpoint-title">Destination</div>
              <div class="journey-endpoint-city">${result.destination.city}</div>
              <div class="journey-endpoint-temp">${result.destination.temp}${sym}</div>
              <div class="journey-endpoint-cond">${result.destination.description}</div>
            </div>
          </div>

          <div class="journey-advice-box">
            ${result.advice}
          </div>
        `;
      } catch (err) {
        if (comparisonBox) {
          comparisonBox.innerHTML = `<div class="journey-advice-box">${err.message}</div>`;
        }
      }
    });
  }
}

// ── Phase 3: Detailed Laundry Drying ──────────────────────────────────────────

function renderLaundryAnalyzer(weather, unit = 'metric') {
  if (!$laundrySection) return;
  $laundrySection.classList.remove('hidden');

  const container = document.getElementById('laundry-content');
  if (!container) return;

  const result = calculateLaundryDrying(weather, unit);
  container.innerHTML = `
    <div class="laundry-gauge">
      <div class="laundry-hours">${result.dryingHours > 0 ? result.dryingHours : '—'}</div>
      <div class="laundry-hours-label">${result.dryingHours > 0 ? 'Hours' : 'Avoid'}</div>
    </div>
    <div>
      <h4 style="font-family: var(--font-display); font-size: var(--text-lg); font-weight: 700; color: var(--color-text); margin: 0 0 4px;">
        ${result.rating} (${result.efficiency}% Efficiency)
      </h4>
      <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: 0 0 8px; line-height: 1.5;">
        ${result.recommendation}
      </p>
      <div style="font-size: var(--text-xs); color: var(--color-text-dim);">
        Calculated from ${weather.temp}° thermal index, ${weather.humidity}% moisture level, and ${weather.windSpeed} speed.
      </div>
    </div>
  `;
}

// ── Phase 4: Weather Personality ──────────────────────────────────────────────

function renderWeatherPersonality(weather) {
  if (!$personalitySection) return;
  $personalitySection.classList.remove('hidden');

  const container = document.getElementById('personality-content');
  if (!container) return;

  const p = getWeatherPersonality(weather);
  container.innerHTML = `
    <div class="personality-badge">${Icons.sparkles(14)} Today's Atmosphere</div>
    <div class="personality-title">${p.title}</div>
    <div class="personality-subtitle">${p.subtitle}</div>
    <div class="personality-traits-row">
      <div class="personality-pill">Vibe: <strong>${p.vibe}</strong></div>
      <div class="personality-pill">Character: <strong>${p.trait}</strong></div>
    </div>
  `;
}

// ── Phase 4: Weather History & Accuracy Tracking ──────────────────────────────

function renderWeatherHistory(weather) {
  if (!$historySection) return;
  $historySection.classList.remove('hidden');

  // Record today's snapshot
  WeatherHistory.recordSnapshot(weather);

  const accData = ForecastTracker.evaluateAccuracy(weather);
  const accContainer = document.getElementById('history-accuracy-content');
  if (accContainer) {
    accContainer.innerHTML = `
      <div class="history-accuracy-bar">
        <div>
          <div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text);">Model Reliability Index</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted);">${accData.message}</div>
        </div>
        <div class="accuracy-metric">${accData.accuracyScore}%</div>
      </div>
    `;
  }

  // Render SVG Sparkline history chart
  const chartWrapper = document.getElementById('history-chart-wrapper');
  if (!chartWrapper) return;

  const cityRecords = WeatherHistory.getForCity(weather.city);
  if (cityRecords.length < 2) {
    chartWrapper.innerHTML = `
      <div class="intel-no-data" style="padding: var(--space-4);">
        <p>Snapshot recorded for ${weather.city}. Search again on subsequent visits to view multi-day trend graphs.</p>
      </div>
    `;
    return;
  }

  // Draw SVG sparkline
  const temps = cityRecords.map(r => r.temp);
  const minTemp = Math.min(...temps) - 2;
  const maxTemp = Math.max(...temps) + 2;
  const range = maxTemp - minTemp || 1;

  const w = 500;
  const h = 100;
  const step = w / (temps.length - 1);

  const points = temps.map((t, i) => {
    const x = i * step;
    const y = h - ((t - minTemp) / range) * (h - 20) - 10;
    return `${x},${y}`;
  }).join(' ');

  chartWrapper.innerHTML = `
    <svg class="history-svg-chart" viewBox="0 0 ${w} ${h}">
      <polyline fill="none" stroke="var(--brand-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      ${temps.map((t, i) => {
        const x = i * step;
        const y = h - ((t - minTemp) / range) * (h - 20) - 10;
        return `<circle cx="${x}" cy="${y}" r="4" fill="var(--brand-primary)" /><text x="${x}" y="${y - 8}" fill="var(--color-text)" font-size="10" text-anchor="middle" font-weight="600">${t}°</text>`;
      }).join('')}
    </svg>
  `;
}

// ── Phase 5: Natural Language Weather Assistant ───────────────────────────────

function initWeatherAssistant(weather, forecast, hourlySlots, aqi, unit = 'metric') {
  if (!$assistantSection) return;
  $assistantSection.classList.remove('hidden');

  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-input');
  const responseBox = document.getElementById('assistant-response');
  const chips = document.querySelectorAll('.assistant-chip');

  function handleAsk(queryText) {
    if (!queryText) return;
    const res = WeatherAssistant.ask(queryText, weather, forecast, hourlySlots, aqi, unit);
    const iconFn = Icons[res.icon] || Icons.messageCircle;

    if (responseBox) {
      responseBox.innerHTML = `
        <div class="assistant-response-bubble">
          <div class="assistant-response-icon">${iconFn(18)}</div>
          <div class="assistant-response-text">${res.answer}</div>
        </div>
      `;
    }
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      handleAsk(q);
      input.value = '';
    });
  }

  chips.forEach(chip => {
    chip.onclick = () => {
      const q = chip.dataset.prompt;
      if (input) input.value = q;
      handleAsk(q);
    };
  });
}

// ── Render All Intelligence (Master Function) ─────────────────────────────────

function renderAllIntelligence(weather, aqi, forecastDays, hourlySlots, selectedActivity, unit, onActivitySelect, rawForecastJson) {
  renderDecisionEngine(weather, aqi, hourlySlots, selectedActivity, unit, onActivitySelect);
  renderBestTime(hourlySlots, selectedActivity, unit, weather.timezone || 0);
  renderWeatherImpact(weather, aqi, unit);
  renderForecastConfidence(forecastDays, rawForecastJson);
  renderWeatherChanges(weather, hourlySlots, weather.timezone || 0);
  renderStormArrival(weather, hourlySlots, weather.timezone || 0);
  renderJourneyWeather(weather, unit);
  renderLaundryAnalyzer(weather, unit);
  renderWeatherPersonality(weather);
  renderWeatherHistory(weather);
  initWeatherAssistant(weather, forecastDays, hourlySlots, aqi, unit);

  // Save forecast prediction for accuracy tracking
  ForecastTracker.recordPrediction(weather.city, forecastDays);
}
