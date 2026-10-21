const Dashboard = {
  lastDay: null,
  lastHours: null,
  lastMinutes: null,
  weatherTimeout: null,
  sleepDismissedUntil: 0,
  manualSleep: false,

  config: {
    city: "Novoiavorivsk",
    lat: 49.93,
    lon: 23.57,
    weatherInterval: 600000, // 10 minutes
  },

  init() {
    this.initMapToggle();
    this.initVectorAlerts();

    this.initWarmMode();
    this.initBattery();
    this.checkConnectivity();
    this.fetchWeather();

    // Self-correcting tick to sync with system seconds
    const tick = () => {
      this.update();
      const now = new Date();
      const delay = 1000 - now.getMilliseconds();
      setTimeout(tick, delay);
    };

    tick();
    setInterval(() => this.checkConnectivity(), 15000);
    // Reload map every 30 minutes to prevent renderer crashes (frowny face icon)
    setInterval(() => this.reloadMap(), 30 * 60 * 1000); 
  },

  reloadMap() {
    const iframe = document.getElementById("mapIframe");
    if (iframe && navigator.onLine && iframe.style.display !== "none") {
      console.log("Periodic map reload to prevent crashes");
      const currentSrc = iframe.src;
      // Using a temporary URL to force a hard reload of the iframe
      iframe.src = "about:blank";
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 50);
    }
  },

  update() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const d = now.getDate();
    const pad = (n) => String(n).padStart(2, "0");

    // Update date and calendar only on day change
    if (this.lastDay !== d) {
      this.lastDay = d;
      this.renderCalendar(now);
      document.getElementById("numeric-date").textContent =
        `${pad(d)}.${pad(now.getMonth() + 1)}`;
    }

    // Check Sleep Mode (1:45 - 8:00)
    const isSleepWindow = (h === 1 && m >= 45) || (h >= 2 && h < 8);
    const isSleepControlledByTime =
      isSleepWindow && Date.now() > this.sleepDismissedUntil;
    const isSleepTime = isSleepControlledByTime || this.manualSleep;

    const sleepMode = document.getElementById("sleepMode");
    if (isSleepTime && sleepMode.style.display !== "flex") {
      sleepMode.style.display = "flex";
    } else if (!isSleepTime && sleepMode.style.display !== "none") {
      sleepMode.style.display = "none";
    }

    // Update hours only on change
    if (this.lastHours !== h) {
      this.lastHours = h;
      const hStr = pad(h);
      document.getElementById("hours").textContent = hStr;
      document.getElementById("sleepHours").textContent = hStr;
    }

    // Update minutes only on change
    if (this.lastMinutes !== m) {
      this.lastMinutes = m;
      const mStr = pad(m);
      document.getElementById("minutes").textContent = mStr;
      document.getElementById("sleepMinutes").textContent = mStr;
    }
  },

  renderCalendar(now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const monthsEN = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const daysEN = ["M", "T", "W", "T", "F", "S", "S"];

    document.getElementById("monthName").textContent = monthsEN[month];

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    // Render Day Headers (M, T, W...)
    daysEN.forEach((day, i) => {
      const header = document.createElement("div");
      header.className = `day-header ${i >= 5 ? "weekend" : ""}`;
      header.textContent = day;
      grid.appendChild(header);
    });

    // Calculation logic for 6x7 grid (42 days)
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Adjust for Monday start (0=Sun, 1=Mon...6=Sat) -> (0=Mon...6=Sun)
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const totalCells = 42; // Always 6 rows * 7 days

    // Previous month days
    for (let i = offset - 1; i >= 0; i--) {
      const dayDiv = document.createElement("div");
      const dayVal = daysInPrevMonth - i;
      const dayOfWeek = (offset - 1 - i) % 7;
      dayDiv.className = `day other-month ${dayOfWeek >= 5 ? "weekend" : ""}`;
      dayDiv.textContent = dayVal;
      grid.appendChild(dayDiv);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDiv = document.createElement("div");
      const dayOfWeek = (offset + i - 1) % 7;
      dayDiv.className = `day ${dayOfWeek >= 5 ? "weekend" : ""} ${i === today ? "today" : ""}`;
      dayDiv.textContent = i;
      grid.appendChild(dayDiv);
    }

    // Next month days
    const remainingCells = totalCells - (offset + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
      const dayDiv = document.createElement("div");
      const dayOfWeek = (offset + daysInMonth + i - 1) % 7;
      dayDiv.className = `day other-month ${dayOfWeek >= 5 ? "weekend" : ""}`;
      dayDiv.textContent = i;
      grid.appendChild(dayDiv);
    }
  },

  initWarmMode() {
    const isWarm = localStorage.getItem("warmMode") === "true";
    if (isWarm) {
      document.body.classList.add("warm-mode");
    }
  },

  toggleWarmMode() {
    const isWarm = document.body.classList.toggle("warm-mode");
    localStorage.setItem("warmMode", isWarm);
  },

  async initBattery() {
    if (!("getBattery" in navigator)) return;
    try {
      const battery = await navigator.getBattery();
      const update = () => {
        const level = Math.round(battery.level * 100);
        const batteryLevel = document.getElementById("batteryLevel");
        const batteryIcon = document.getElementById("batteryIcon");

        batteryLevel.textContent = `${level}%`;
        batteryIcon.textContent = battery.charging ? "⚡" : "";

        if (level === 100) {
          batteryLevel.style.color = "#4ade80"; // Зелений для 100%
        } else if (level <= 10) {
          batteryLevel.style.color = "#f87171"; // Червоний для низького заряду
        } else {
          batteryLevel.style.color = "var(--text-secondary)";
        }

        document.getElementById("batteryContainer");
      };
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
      update();
    } catch (e) {
      console.error(e);
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  },

  enterSleepMode() {
    this.manualSleep = true;
    this.update();
  },

  dismissSleepMode() {
    // Dismiss sleep mode for 1 hour if tapped
    this.manualSleep = false;
    this.sleepDismissedUntil = Date.now() + 60 * 60 * 1000;
    document.getElementById("sleepMode").style.display = "none";
  },

  async checkConnectivity() {
    const mapWrapper = document.getElementById("mapWrapper");
    const offlineMessage = document.getElementById("offlineMessage");
    const weatherWidget = document.getElementById("weather");
    const iframe = document.getElementById("mapIframe");
    const clock = document.getElementById("clock");

    let currentlyOnline = false;

    if (navigator.onLine) {
      try {
        // Using a small fetch to confirm actual internet access
        const signal = AbortSignal.timeout
          ? AbortSignal.timeout(5000)
          : null;
        await fetch("https://www.google.com/favicon.ico", {
          mode: "no-cors",
          cache: "no-store",
          signal: signal,
        });
        currentlyOnline = true;
      } catch (e) {
        currentlyOnline = false;
      }
    }

    if (currentlyOnline) {
      weatherWidget.style.opacity = "1";
      weatherWidget.style.filter = "none";

      if (mapWrapper.style.display === "none") {
        mapWrapper.style.display = "block";
        offlineMessage.style.display = "none";
        // Reload iframe to ensure map is fresh
        this.reloadMap();
        this.fetchWeather();
      }
    } else {
      weatherWidget.style.opacity = "0.4";
      weatherWidget.style.filter = "grayscale(1)";
      mapWrapper.style.display = "none";
      offlineMessage.style.display = "flex";
    }
  },

  async fetchWeather() {
    if (this.weatherTimeout) clearTimeout(this.weatherTimeout);

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${this.config.lat}&longitude=${this.config.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
      );
      const data = await res.json();
      if (data.current_weather && data.daily) {
        this.lastWeatherData = data;
        this.updateWeather(data);
      }
    } catch (e) {
      console.error("Weather fetch failed", e);
    }
    this.weatherTimeout = setTimeout(
      () => this.fetchWeather(),
      this.config.weatherInterval,
    );
  },

  updateWeather(data) {
    const current = data.current_weather;
    const daily = data.daily;
    const temp = Math.round(current.temperature);
    const tempMax = Math.round(daily.temperature_2m_max[0]);
    const tempMin = Math.round(daily.temperature_2m_min[0]);
    const code = current.weathercode;

    document.getElementById("weatherTemp").textContent = `${temp}°`;
    document.getElementById("weatherMax").textContent = `↑${tempMax}°`;
    document.getElementById("weatherMin").textContent = `↓${tempMin}°`;
    document.getElementById("weatherCity").textContent = this.config.city;

    const iconMap = {
      0: { icon: "☀️", desc: "Clear" },
      1: { icon: "🌤️", desc: "Mainly Clear" },
      2: { icon: "⛅", desc: "Partly Cloudy" },
      3: { icon: "☁️", desc: "Overcast" },
      45: { icon: "🌫️", desc: "Fog" },
      48: { icon: "🌫️", desc: "Dep. Rime Fog" },
      51: { icon: "🌦️", desc: "Light Drizzle" },
      53: { icon: "🌦️", desc: "Mod. Drizzle" },
      55: { icon: "🌦️", desc: "Dense Drizzle" },
      56: { icon: "🌧️", desc: "Light Frz Drzl" },
      57: { icon: "🌧️", desc: "Dense Frz Drzl" },
      61: { icon: "🌧️", desc: "Slight Rain" },
      63: { icon: "🌧️", desc: "Moderate Rain" },
      65: { icon: "🌧️", desc: "Heavy Rain" },
      66: { icon: "🌧️", desc: "Light Frz Rain" },
      67: { icon: "🌧️", desc: "Heavy Frz Rain" },
      71: { icon: "❄️", desc: "Slight Snow" },
      73: { icon: "❄️", desc: "Moderate Snow" },
      75: { icon: "❄️", desc: "Heavy Snow" },
      77: { icon: "❄️", desc: "Snow grains" },
      80: { icon: "🌦️", desc: "Slight Showers" },
      81: { icon: "🌦️", desc: "Mod. Showers" },
      82: { icon: "🌦️", desc: "Heavy Showers" },
      85: { icon: "🌨️", desc: "Slight Snow Sh." },
      86: { icon: "🌨️", desc: "Heavy Snow Sh." },
      95: { icon: "⛈️", desc: "Thunderstorm" },
      96: { icon: "⛈️", desc: "Thun. + Hail" },
      99: { icon: "⛈️", desc: "Thun. + Hv. Hail" },
    };

    const w = iconMap[code] || { icon: "🌡️", desc: "Unknown" };
    document.getElementById("weatherIcon").textContent = w.icon;
    document.getElementById("weatherDesc").textContent = w.desc;
  },

  initMapToggle() {
    const header = document.getElementById("widgetHeader");
    const iframe = document.getElementById("mapIframe");
    const wrapper = document.getElementById("mapWrapper");
    const vectorContainer = document.getElementById("vectorMapContainer");

    const modes = [
      { name: "VECTOR", type: "vector" },
      { name: "MINI", url: "https://alerts.in.ua/mini" },
      { name: "LITE", url: "https://alerts.in.ua/lite" },
      { name: "FULL", url: "https://alerts.in.ua/" },
    ];

    let currentModeIndex = parseInt(localStorage.getItem("mapModeIndex")) || 0;
    if (currentModeIndex < 0 || currentModeIndex >= modes.length) {
      currentModeIndex = 0;
    }

    const updateUI = (index) => {
      const mode = modes[index];
      header.textContent = mode.name;
      wrapper.setAttribute("data-mode", mode.name);
      localStorage.setItem("mapModeIndex", index);

      if (mode.type === "vector") {
        if (iframe) {
          iframe.style.display = "none";
          if (iframe.src !== "about:blank") {
            iframe.src = "about:blank";
          }
        }
        if (vectorContainer) {
          vectorContainer.style.display = "flex";
        }
        this.fetchVectorAlerts();
      } else {
        if (vectorContainer) {
          vectorContainer.style.display = "none";
        }
        if (iframe) {
          iframe.style.display = "block";
          iframe.src = mode.url;
        }
      }
    };

    // Apply initial mode
    updateUI(currentModeIndex);

    header.addEventListener("click", () => {
      currentModeIndex = (currentModeIndex + 1) % modes.length;
      updateUI(currentModeIndex);
    });
  },

  initVectorAlerts() {
    this.fetchVectorAlerts();
    // Periodically update vector alerts every 15 seconds
    setInterval(() => {
      const modes = ["VECTOR", "MINI", "LITE", "FULL"];
      const modeIndex = parseInt(localStorage.getItem("mapModeIndex")) || 0;
      if (modes[modeIndex] === "VECTOR" && navigator.onLine) {
        this.fetchVectorAlerts();
      }
    }, 15000);
  },

  async fetchVectorAlerts() {
    const container = document.getElementById("vectorMapContainer");
    if (!container || !navigator.onLine) return;

    try {
      const signal = AbortSignal.timeout ? AbortSignal.timeout(6000) : null;
      const res = await fetch("https://neptun.in.ua/api/v1/alerts", { signal });
      if (!res.ok) return;
      const data = await res.json();
      this.updateVectorAlerts(data);
    } catch (e) {
      console.warn("Vector alerts fetch failed:", e);
    }
  },

  updateVectorAlerts(data) {
    const container = document.getElementById("vectorMapContainer");
    if (!container) return;

    const rootMap = {
      3: "хмельниц", 4: "вінниц", 5: "рівнен", 8: "волин", 9: "дніпро",
      10: "житомир", 11: "закарпат", 12: "запоріз", 13: "івано-франків",
      14: "київськ", 15: "кіровоград", 16: "луган", 17: "миколаїв",
      18: "одес", 19: "полтав", 20: "сум", 21: "терноп", 22: "харків",
      23: "херсон", 24: "черкас", 25: "чернігів", 26: "чернівец",
      27: "львів", 28: "донець", 29: "крим", 30: "севастопол", 31: "м. київ"
    };

    const uidAlerts = {};
    const processItem = (name, level) => {
      if (!name) return;
      const lower = name.toLowerCase();
      if (lower === "м. київ" || lower === "київ") {
        uidAlerts[31] = level || "red";
        return;
      }
      for (const [uid, root] of Object.entries(rootMap)) {
        if (lower.includes(root)) {
          const current = uidAlerts[uid];
          if (level === "red" || current === "red") {
            uidAlerts[uid] = "red";
          } else if (!current || current === "yellow") {
            uidAlerts[uid] = level || "yellow";
          }
          break;
        }
      }
    };

    (data.oblasts || []).forEach(o => processItem(o.name || o.oblast || o.key, o.level));
    (data.raions || []).forEach(r => processItem(r.oblast || r.name || r.key, r.level));

    container.querySelectorAll("path[data-uid]").forEach(p => {
      const uid = p.getAttribute("data-uid");
      const lvl = uidAlerts[uid];
      p.classList.remove("alert-red", "alert-yellow");
      if (lvl === "red") p.classList.add("alert-red");
      else if (lvl === "yellow") p.classList.add("alert-yellow");
    });

    container.querySelectorAll(".map-label[data-uid]").forEach(lbl => {
      const uid = lbl.getAttribute("data-uid");
      const lvl = uidAlerts[uid];
      if (lvl) lbl.classList.add("alert-active");
      else lbl.classList.remove("alert-active");
    });
  },
};

Dashboard.init();

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("SW registered:", reg))
      .catch((err) => console.log("SW reg error:", err));
  });
}
