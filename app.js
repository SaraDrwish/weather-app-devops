const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search-form"),
  input: $("city-input"),
  status: $("status"),
  now: $("now"),
  city: $("city-name"),
  condition: $("condition"),
  temp: $("temp"),
  feels: $("feels"),
  humidity: $("humidity"),
  wind: $("wind"),
  horizon: $("horizon"),
  days: $("days"),
  suggestions: $("suggestions"),
};

const WEATHER_CODES = {
  0: ["صافٍ", "clear"],
  1: ["صافٍ غالبًا", "clear"],
  2: ["غائم جزئيًا", "cloudy"],
  3: ["غائم", "cloudy"],
  45: ["ضباب", "fog"],
  48: ["ضباب متجمد", "fog"],
  51: ["رذاذ خفيف", "rain"],
  53: ["رذاذ", "rain"],
  55: ["رذاذ كثيف", "rain"],
  56: ["رذاذ متجمد", "rain"],
  57: ["رذاذ متجمد كثيف", "rain"],
  61: ["مطر خفيف", "rain"],
  63: ["مطر", "rain"],
  65: ["مطر غزير", "rain"],
  66: ["مطر متجمد", "rain"],
  67: ["مطر متجمد غزير", "rain"],
  71: ["ثلج خفيف", "snow"],
  73: ["ثلج", "snow"],
  75: ["ثلج كثيف", "snow"],
  77: ["حبيبات ثلج", "snow"],
  80: ["زخات مطر خفيفة", "rain"],
  81: ["زخات مطر", "rain"],
  82: ["زخات مطر عنيفة", "rain"],
  85: ["زخات ثلج", "snow"],
  86: ["زخات ثلج كثيفة", "snow"],
  95: ["عاصفة رعدية", "storm"],
  96: ["عاصفة رعدية مع برد", "storm"],
  99: ["عاصفة رعدية مع برد كثيف", "storm"],
};

function describe(code) {
  return WEATHER_CODES[code] || ["غير معروف", "cloudy"];
}

function skyFor(code, isDay) {
  const kind = describe(code)[1];
  if (kind === "clear" || kind === "cloudy") {
    return `${kind}-${isDay ? "day" : "night"}`;
  }
  return kind;
}

function formatHour(isoTime) {
  const hour = Number(isoTime.slice(11, 13));
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? "ص" : "م"}`;
}

const weekday = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });
function formatDay(isoDate, index) {
  if (index === 0) return "اليوم";
  const [y, m, d] = isoDate.split("-").map(Number);
  return weekday.format(new Date(y, m - 1, d));
}

async function getJSON(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function findCity(query) {
  const params = new URLSearchParams({ name: query, count: 1, language: "ar" });
  const data = await getJSON(`${GEO_URL}?${params}`);
  return data.results ? data.results[0] : null;
}

async function searchCities(query, signal) {
  const params = new URLSearchParams({ name: query, count: 6, language: "ar" });
  const data = await getJSON(`${GEO_URL}?${params}`, signal);
  return data.results || [];
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 6,
  });
  return getJSON(`${FORECAST_URL}?${params}`);
}

function renderNow(place, current) {
  const [text] = describe(current.weather_code);
  els.city.textContent = place.country ? `${place.name}، ${place.country}` : place.name;
  els.condition.textContent = text;
  els.temp.textContent = Math.round(current.temperature_2m);
  els.feels.textContent = `${Math.round(current.apparent_temperature)}°`;
  els.humidity.textContent = `${current.relative_humidity_2m}٪`;
  els.wind.textContent = `${Math.round(current.wind_speed_10m)} كم/س`;
  document.body.dataset.sky = skyFor(current.weather_code, current.is_day === 1);
  document.title = `${place.name} ${Math.round(current.temperature_2m)}° | سار`;
}

function renderHorizon(hourly, currentTime) {
  const nowHour = currentTime.slice(0, 13);
  let start = hourly.time.findIndex((t) => t.startsWith(nowHour));
  if (start < 0) start = 0;

  const times = hourly.time.slice(start, start + 25);
  const temps = hourly.temperature_2m.slice(start, start + 25);
  if (temps.length < 2) {
    els.horizon.innerHTML = "";
    return;
  }

  const W = 600, H = 150, top = 30, bottom = 115, side = 20;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;

  const points = temps.map((t, i) => ({
    x: W - side - (i * (W - 2 * side)) / (temps.length - 1),
    y: bottom - ((t - min) / span) * (bottom - top),
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  const area = `${d} L ${last.x} ${H - 18} L ${points[0].x} ${H - 18} Z`;

  const step = window.innerWidth < 480 ? 6 : 4;
  let labels = "";
  points.forEach((p, i) => {
    if (i % step !== 0) return;
    const hourText = i === 0 ? "الآن" : formatHour(times[i]);
    labels += `
      <circle class="dot" cx="${p.x}" cy="${p.y}" r="3.5"></circle>
      <text class="temp-label" x="${p.x}" y="${p.y - 12}" text-anchor="middle">${Math.round(temps[i])}°</text>
      <text class="hour-label" x="${p.x}" y="${H - 2}" text-anchor="middle">${hourText}</text>`;
  });

  els.horizon.innerHTML = `
    <defs>
      <linearGradient id="line-grad" x1="1" x2="0" y1="0" y2="0">
        <stop offset="0" class="stop-a"></stop>
        <stop offset="0.5" class="stop-b"></stop>
        <stop offset="1" class="stop-c"></stop>
      </linearGradient>
      <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" class="stop-area-top"></stop>
        <stop offset="1" class="stop-area-bottom"></stop>
      </linearGradient>
    </defs>
    <path class="area" d="${area}"></path>
    <path class="line" d="${d}"></path>
    ${labels}`;
  els.horizon.setAttribute(
    "aria-label",
    `الحرارة في الـ 24 ساعة القادمة بين ${Math.round(min)}° و ${Math.round(max)}°`
  );
}

function renderDays(daily) {
  const lows = daily.temperature_2m_min;
  const highs = daily.temperature_2m_max;
  const weekMin = Math.min(...lows);
  const weekMax = Math.max(...highs);
  const span = weekMax - weekMin || 1;

  els.days.innerHTML = daily.time
    .map((date, i) => {
      const from = ((lows[i] - weekMin) / span) * 100;
      const width = ((highs[i] - lows[i]) / span) * 100;
      const [text, kind] = describe(daily.weather_code[i]);
      return `
        <li data-kind="${kind}">
          <span class="day-name">${formatDay(date, i)}</span>
          <span class="day-cond"><i class="swatch" aria-hidden="true"></i>${text}</span>
          <span class="day-min" aria-label="الصغرى">${Math.round(lows[i])}°</span>
          <span class="range" aria-hidden="true"><span style="inset-inline-start:${from}%;width:${Math.max(width, 4)}%"></span></span>
          <span class="day-max" aria-label="العظمى">${Math.round(highs[i])}°</span>
        </li>`;
    })
    .join("");
}

async function showPlace(place) {
  els.status.textContent = "جاري تحميل الطقس...";
  els.now.setAttribute("aria-busy", "true");
  try {
    const data = await getForecast(place.latitude, place.longitude);
    renderNow(place, data.current);
    renderHorizon(data.hourly, data.current.time);
    renderDays(data.daily);
    els.status.textContent = "";
  } catch (error) {
    console.error(error);
    els.status.textContent = "الاتصال بخدمة الطقس فشل. اتأكد من الإنترنت وجرب تاني.";
  } finally {
    els.now.setAttribute("aria-busy", "false");
  }
}

async function showWeather(query) {
  els.status.textContent = "جاري تحميل الطقس...";
  try {
    const place = await findCity(query);
    if (!place) {
      els.status.textContent = `مفيش مدينة باسم "${query}". جرب تكتبها بالإنجليزي، مثلًا Riyadh.`;
      return;
    }
    await showPlace(place);
  } catch (error) {
    console.error(error);
    els.status.textContent = "الاتصال بخدمة الطقس فشل. اتأكد من الإنترنت وجرب تاني.";
  }
}

let suggestionResults = [];
let activeIndex = -1;
let typingTimer = null;
let currentRequest = null;

function closeSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  els.input.setAttribute("aria-expanded", "false");
  els.input.removeAttribute("aria-activedescendant");
  suggestionResults = [];
  activeIndex = -1;
}

function renderSuggestions(places) {
  suggestionResults = places;
  activeIndex = -1;

  if (places.length === 0) {
    els.suggestions.innerHTML = `<li class="suggestion-empty" role="option" aria-disabled="true">مفيش مدن بالاسم ده</li>`;
  } else {
    els.suggestions.innerHTML = places
      .map((p, i) => {
        const region = [p.admin1, p.country].filter(Boolean).join("، ");
        return `
          <li id="suggestion-${i}" class="suggestion" role="option" aria-selected="false" data-index="${i}">
            <span class="suggestion-name">${p.name}</span>
            <span class="suggestion-region">${region}</span>
          </li>`;
      })
      .join("");
  }

  els.suggestions.hidden = false;
  els.input.setAttribute("aria-expanded", "true");
}

function setActive(index) {
  const items = els.suggestions.querySelectorAll(".suggestion");
  if (items.length === 0) return;
  activeIndex = (index + items.length) % items.length;
  items.forEach((item, i) => item.setAttribute("aria-selected", i === activeIndex ? "true" : "false"));
  els.input.setAttribute("aria-activedescendant", items[activeIndex].id);
  items[activeIndex].scrollIntoView({ block: "nearest" });
}

function chooseSuggestion(index) {
  const place = suggestionResults[index];
  if (!place) return;
  els.input.value = place.name;
  closeSuggestions();
  showPlace(place);
}

els.input.addEventListener("input", () => {
  const query = els.input.value.trim();
  clearTimeout(typingTimer);

  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  typingTimer = setTimeout(async () => {
    if (currentRequest) currentRequest.abort();
    currentRequest = new AbortController();
    try {
      const places = await searchCities(query, currentRequest.signal);
      if (els.input.value.trim() === query) renderSuggestions(places);
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }, 300);
});

els.input.addEventListener("keydown", (event) => {
  if (els.suggestions.hidden) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActive(activeIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActive(activeIndex - 1);
  } else if (event.key === "Enter" && activeIndex >= 0) {
    event.preventDefault();
    chooseSuggestion(activeIndex);
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

els.suggestions.addEventListener("mousedown", (event) => {
  const item = event.target.closest(".suggestion");
  if (!item) return;
  event.preventDefault();
  chooseSuggestion(Number(item.dataset.index));
});

document.addEventListener("click", (event) => {
  if (!els.form.contains(event.target)) closeSuggestions();
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(typingTimer);
  closeSuggestions();
  const query = els.input.value.trim();
  if (query) showWeather(query);
});

showWeather(els.input.value.trim());
