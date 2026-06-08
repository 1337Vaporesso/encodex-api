// Premium Popup Controller for EncodeX Extension

let currentLang = "ru";
let currentTheme = "midnight-black"; // Default theme
let audioCtx = null;
let currentVideoData = [];
let currentActiveTarget = "main";

const viewIndex = { main: 0, calc: 1, stats: 2, profile: 3 };
var API = 'https://encodex-api-production.up.railway.app';



function updatePremiumUI(isPremium) {
  var premiumKeyCard = document.getElementById("premiumKeyCard");
  var premiumActiveCard = document.getElementById("premiumActiveCard");
  var headerPremiumBadge = document.getElementById("headerPremiumBadge");
  var premiumPulseDot = document.getElementById("premiumPulseDot");
  var keyInput = document.getElementById("premiumKeyInput");
  var activateBtn = document.getElementById("activatePremiumBtn");
  var statusText = document.getElementById("premiumCardStatusText");

  if (isPremium) {
    if (premiumKeyCard) premiumKeyCard.classList.add("hidden");
    if (premiumActiveCard) premiumActiveCard.classList.remove("hidden");
    if (headerPremiumBadge) headerPremiumBadge.classList.remove("hidden");
    if (premiumPulseDot) premiumPulseDot.classList.remove("hidden");
  } else {
    if (premiumActiveCard) premiumActiveCard.classList.add("hidden");
    if (premiumKeyCard) premiumKeyCard.classList.remove("hidden");
    if (headerPremiumBadge) headerPremiumBadge.classList.add("hidden");
    if (premiumPulseDot) premiumPulseDot.classList.add("hidden");
    chrome.storage.local.get("encodex_user", function(res) {
      var loggedIn = res.encodex_user && res.encodex_user.loggedIn;
      if (keyInput) keyInput.disabled = !loggedIn;
      if (activateBtn) activateBtn.disabled = !loggedIn;
      if (statusText) statusText.innerText = loggedIn
        ? (currentLang === 'ru' ? 'Введи лицензионный ключ для разблокировки' : 'Enter license key to unlock')
        : (currentLang === 'ru' ? 'Войди в аккаунт чтобы активировать премиум' : 'Login to activate premium');
      if (keyInput) keyInput.style.opacity = loggedIn ? '1' : '0.4';
      if (activateBtn) activateBtn.style.opacity = loggedIn ? '1' : '0.4';
    });
  }
}

// Localization dictionary
const translations = {
  en: {
    sys_status: "HQ Upload",
    status_off: "DISABLED",
    status_on: "HQ ACTIVE",
    feat1_title: "Server FFmpeg",
    feat1_desc: "Server-side processing bypasses browser compression",
    feat2_title: "60FPS + Bitrate",
    feat2_desc: "Original quality, lossless stream copy",
    feat3_title: "Automatic",
    feat3_desc: "File intercept → FFmpeg → swap, no extra steps",
    usage_title: "UPLOAD LIMITS",
    usage_daily: "Daily",
    usage_weekly: "Weekly",
    nav_booster: "Home",
    nav_stats: "Tools",
    nav_calc: "Settings",
    nav_profile: "Profile",
    stats_title: "PROFILE ANALYTICS",
    profile_active: "DATA STREAM ONLINE",
    best_time_title: "BEST UPLOAD HOUR",
    recent_label: "Recent Publications",
    analyzing_wait: "Waiting for profile analysis...",
    best_time_views: "Requires video analysis",
    best_time_calc: "Calculating metrics...",
    best_time_nodata: "Insufficient Data",
    best_time_avg: "Avg. ~",
    best_time_views_suffix: "views",
    calc_title: "BITRATE CALCULATOR",
    calc_lbl_sec: "Video Duration",
    calc_res_bitrate: "RECOMMENDED BITRATE (CBR)",
    calc_res_bitrate_desc: "Optimum h.264/h.265 encoding profile",
    calc_res_size: "ESTIMATED FILE SIZE",
    calc_res_size_desc: "Calculated weight of final output",
    err_wrong_page: "OPEN TIKTOK UPLOAD PAGE!",
    err_no_video: "No videos found or private account",
    no_active_user: "Please open TikTok and log in",
    connecting: "Connecting...",
    downloading: "Downloading...",
    success: "Success!",
    video_number: "Publication #",
    profile_title: "PROFILE",
    login_header: "AUTHENTICATION",
    guest_name: "Guest",
    not_logged_in: "Not logged in",
    login_err: "Invalid credentials!",
    ph_username: "Username",
    ph_password: "Password",
    btn_submit: "Login",
    btn_cancel: "Cancel",
    premium_activate: "PREMIUM ACTIVATION",
    premium_desc: "Enter a license key to unlock HQ Upload",
    premium_btn: "Activate Key",
    premium_active_desc: "All premium features and HQ Upload are fully unlocked!",
    err_premium_required: "PREMIUM REQUIRED FOR HQ UPLOAD!"
  },
  ru: {
    sys_status: "HQ Загрузка",
    status_off: "ОТКЛЮЧЕНО",
    status_on: "HQ АКТИВЕН",
    feat1_title: "Серверный FFmpeg",
    feat1_desc: "Обработка на сервере, обход браузерного сжатия",
    feat2_title: "60FPS + Битрейт",
    feat2_desc: "Исходное качество, копия без перекодирования",
    feat3_title: "Автоматически",
    feat3_desc: "Перехват файла → FFmpeg → подмена без лишних действий",
    usage_title: "ЛИМИТЫ ЗАГРУЗОК",
    usage_daily: "День",
    usage_weekly: "Неделя",
    nav_booster: "Главная",
    nav_stats: "Инструменты",
    nav_calc: "Настройки",
    nav_profile: "Профиль",
    stats_title: "АНАЛИТИКА",
    profile_active: "ПОТОК ДАННЫХ АКТИВЕН",
    best_time_title: "ЛУЧШЕЕ ВРЕМЯ ЗАГРУЗКИ",
    recent_label: "Последние публикации",
    analyzing_wait: "Ожидание анализа...",
    best_time_views: "Требуется анализ видео",
    best_time_calc: "Вычисляется...",
    best_time_nodata: "Недостаточно данных",
    best_time_avg: "Ср. ~",
    best_time_views_suffix: "просм.",
    calc_title: "КАЛЬКУЛЯТОР",
    calc_lbl_sec: "Длительность видео",
    calc_res_bitrate: "РЕКОМЕНДУЕМЫЙ БИТРЕЙТ",
    calc_res_bitrate_desc: "Рекомендуемый битрейт кодирования CBR (h.264/h.265)",
    calc_res_size: "ПРИМЕРНЫЙ РАЗМЕР",
    calc_res_size_desc: "Ориентировочный вес файла",
    err_wrong_page: "ОТКРОЙ СТРАНИЦУ ЗАГРУЗКИ TIKTOK!",
    err_no_video: "Видео не найдены или профиль скрыт",
    no_active_user: "Войдите в аккаунт на сайте TikTok",
    connecting: "Соединение...",
    downloading: "Загрузка...",
    success: "Успешно!",
    video_number: "Публикация #",
    profile_title: "ПРОФИЛЬ",
    login_header: "АВТОРИЗАЦИЯ",
    guest_name: "Гость",
    not_logged_in: "Не авторизован",
    login_err: "Неверные данные!",
    ph_username: "Имя пользователя",
    ph_password: "Пароль",
    btn_submit: "Войти",
    btn_cancel: "Отмена",
    premium_activate: "АКТИВАЦИЯ PREMIUM",
    premium_desc: "Введи лицензионный ключ для разблокировки HQ Upload",
    premium_btn: "Активировать",
    premium_active_desc: "Все премиум функции и HQ Upload полностью разблокированы!",
    err_premium_required: "ТРЕБУЕТСЯ PREMIUM ДЛЯ HQ UPLOAD!"
  }
};;;

// --- Web Audio Synth Sound FX ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playSynthSound(type) {
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.setValueAtTime(0.05, now);

    if (type === "hover") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = "sine";
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.03);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
    } 
    else if (type === "click") {
      // Soft organic pop/click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
    else if (type === "success") {
      // Pentatonic arpeggio chimes
      const freqs = [523.25, 587.33, 659.25, 783.99, 880.00]; // C5, D5, E5, G5, A5
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(masterGain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.06, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.25);
      });
    } 
    else if (type === "error") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    console.warn("Synth audio context play error:", err);
  }
}

// Bind audio hover and click responses
function bindAudioListeners() {
  document.querySelectorAll("input[type='checkbox'], input[type='range'], .nav-item, .nav-item-center, .theme-dot, .lang-toggle, .action-btn, #analyzeBtn").forEach(el => {
    el.removeAttribute("data-audio-bound");
    el.addEventListener("mouseenter", () => playSynthSound("hover"));
    el.addEventListener("click", () => playSynthSound("click"));
    el.setAttribute("data-audio-bound", "true");
  });
}

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  playSynthSound(type === 'success' ? 'success' : type === 'error' ? 'error' : 'click');
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// --- Starfield Particle Engine ---
let width = 330;
let height = 570;
let particles = [];
const count = 35;
let animationId = null;

function initStarfield() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  
  particles = [];

  class Star {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 1.5 + 0.5;
      this.speedY = Math.random() * 0.15 + 0.05;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.glow = Math.random() > 0.8;
    }
    update() {
      this.y -= this.speedY;
      if (this.y < 0) {
        this.reset();
        this.y = height;
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      
      let colorStr = "rgba(0, 242, 254, "; // Default Blue
      if (currentTheme === "mint-glow") {
        colorStr = "rgba(0, 255, 135, ";
      } else if (currentTheme === "amber-core") {
        colorStr = "rgba(255, 153, 0, ";
      } else if (currentTheme === "midnight-black") {
        colorStr = this.glow ? "rgba(255, 255, 255, " : "rgba(100, 180, 255, ";
      }
      
      ctx.fillStyle = colorStr + this.alpha + ")";
      ctx.fill();

      if (this.glow) {
        ctx.shadowBlur = 8;
        if (currentTheme === "mint-glow") ctx.shadowColor = "#00ff87";
        else if (currentTheme === "amber-core") ctx.shadowColor = "#ff9900";
        else if (currentTheme === "midnight-black") ctx.shadowColor = "#ffffff";
        else ctx.shadowColor = "#00f2fe";
      } else {
        ctx.shadowBlur = 0;
      }
    }
  }

  for (let i = 0; i < count; i++) {
    particles.push(new Star());
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  function animate() {
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, width, height);
    
    const gradient = ctx.createRadialGradient(width / 2, 0, 10, width / 2, height / 2, width);
    if (currentTheme === "mint-glow") {
      gradient.addColorStop(0, "rgba(7, 24, 20, 0.45)");
      gradient.addColorStop(1, "#070e10");
    } else if (currentTheme === "amber-core") {
      gradient.addColorStop(0, "rgba(25, 15, 10, 0.45)");
      gradient.addColorStop(1, "#0f0a07");
    } else if (currentTheme === "midnight-black") {
      gradient.addColorStop(0, "rgba(20, 20, 25, 0.5)");
      gradient.addColorStop(1, "#000000");
    } else {
      gradient.addColorStop(0, "rgba(10, 24, 45, 0.45)");
      gradient.addColorStop(1, "#090b11");
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    particles.forEach(star => {
      star.update();
      star.draw();
    });
    animationId = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  animate();
}

// --- Interface Translations ---
function translateUI(lang) {
  currentLang = lang;
  document.getElementById("langBtn").innerText = lang.toUpperCase();
  
  const dict = translations[lang] || translations.en;

  document.querySelectorAll("[data-key]").forEach(el => {
    const key = el.getAttribute("data-key");
    if (dict[key]) {
      if (key === "status_off" || key === "status_on") {
        updateHQUI(document.getElementById("toggleBtn").checked);
      } else {
        el.innerText = dict[key];
      }
    }
  });

  // Update usage card labels separately (dynamic values)
  updateUsageDisplay();

  const loginUser = document.getElementById("loginUsername");
  if (loginUser) loginUser.placeholder = dict.ph_username;

  const loginPass = document.getElementById("loginPassword");
  if (loginPass) loginPass.placeholder = dict.ph_password;

  const submitBtn = document.getElementById("submitLoginBtn");
  if (submitBtn) submitBtn.innerText = dict.btn_submit;

  const cancelBtn = document.getElementById("cancelLoginBtn");
  if (cancelBtn) cancelBtn.innerText = dict.btn_cancel;

  // Re-run user state update to ensure language match for Guest placeholders
  chrome.storage.local.get(["encodex_user", "encodex_premium"], (res) => {
    const user = res.encodex_user || null;
    const isPremium = res.encodex_premium || (user && user.loggedIn && user.role === "Owner");
    updateInterfaceForUser(user);
    updatePremiumUI(isPremium);
  });
}

// --- UI HQ Upload State Updates ---
function updateHQUI(isActive) {
  var statusText = document.getElementById("statusText");
  var mainCard = document.getElementById("mainCard");
  var dict = translations[currentLang];

  mainCard.classList.remove("state-active", "state-ready");

  if (isActive) {
    statusText.innerText = dict.status_on;
    statusText.style.color = "var(--primary)";
    mainCard.classList.add("state-active");
  } else {
    statusText.innerText = dict.status_off;
    statusText.style.color = "var(--text-sub)";
    mainCard.classList.add("state-ready");
  }
}

function updateUsageDisplay() {
  chrome.storage.local.get(["encodex_token", "encodex_premium"], function(res) {
    var card = document.getElementById("usageCard");
    if (!card) return;
    if (!res.encodex_token) { card.style.display = "none"; return; }
    card.style.display = "block";

    fetch(API + '/api/process/usage', {
      headers: { 'Authorization': 'Bearer ' + res.encodex_token }
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        document.getElementById("usageDaily").innerText = data.daily_used + '/' + data.daily_limit;
        document.getElementById("usageWeekly").innerText = data.weekly_used + '/' + data.weekly_limit;
        document.getElementById("usageMaxSize").innerText = 'Max ' + data.max_file_size_mb + ' MB';
      }
    }).catch(function() {});
  });
}

// Trigger active tab injection activate/deactivate commands
async function syncHqStateToTab(isActive) {
  var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  var isTikTok = tab.url && tab.url.includes("tiktok.com");

  if (isTikTok) {
    var settings = await new Promise(function(resolve) {
      chrome.storage.local.get(["encodex_premium", "encodex_user", "encodex_token"], resolve);
    });
    var isPremium = !!(settings.encodex_premium || (settings.encodex_user && settings.encodex_user.loggedIn && settings.encodex_user.role === "Owner"));
    var finalActive = isPremium ? isActive : false;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [currentLang, finalActive, isPremium, settings.encodex_token || null],
      func: function(lang, state, premium, token) {
        window._encodex_hasPremium = premium;
        window._encodex_currentLang = lang;
        window.dispatchEvent(new CustomEvent("EncodeXState", {
          detail: { lang: lang, isActive: state, isPremium: premium, token: token }
        }));
      }
    }).catch(function(err) { console.log("Tab scripting bypassed:", err); });
  }
}

function showWrongPageAlert() {
  const mainCard = document.getElementById("mainCard");
  const statusText = document.getElementById("statusText");
  const originalText = statusText.innerText;
  const originalColor = statusText.style.color;

  playSynthSound("error");
  statusText.innerText = translations[currentLang].err_wrong_page;
  statusText.style.color = "var(--error)";
  mainCard.style.borderColor = "var(--error)";
  mainCard.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.4)";

  // Shaking effect
  mainCard.style.transition = "none";
  let count = 0;
  const interval = setInterval(() => {
    mainCard.style.transform = count % 2 === 0 ? "translateX(-5px)" : "translateX(5px)";
    count++;
    if (count > 5) {
      clearInterval(interval);
      mainCard.style.transform = "";
      mainCard.style.transition = "";
      setTimeout(() => {
        statusText.innerText = originalText;
        statusText.style.color = originalColor;
        mainCard.style.borderColor = "";
        mainCard.style.boxShadow = "";
      }, 1000);
    }
  }, 60);
}

// --- Video Bitrate Calculator Logic ---
function updateCalculator() {
  const duration = parseInt(document.getElementById("calcDurationInput").value);
  document.getElementById("calcDurationVal").innerText = duration;

  let bitrate = 15;
  if (duration > 60) bitrate = 8;
  else if (duration > 30) bitrate = 12;

  document.getElementById("calcBitrateVal").innerText = `${bitrate} Mbps`;

  const sizeMB = Math.round((duration * bitrate) / 8);
  document.getElementById("calcSizeVal").innerText = `${sizeMB} MB`;
}

// --- Analytics & Best Time Calculations ---
function calculateBestTime(videos) {
  const resultVal = document.getElementById("bestTimeResult");
  const viewsDesc = document.getElementById("bestTimeViews");
  const dict = translations[currentLang];

  if (!videos || videos.length === 0) {
    resultVal.innerText = "-";
    viewsDesc.innerText = dict.best_time_nodata;
    return;
  }

  let hourStats = {};
  let validVideosCount = 0;

  videos.forEach(vid => {
    if (!vid.create_time) return;
    validVideosCount++;
    
    const date = new Date(vid.create_time * 1000);
    const hour = date.getHours();

    if (!hourStats[hour]) {
      hourStats[hour] = { totalViews: 0, count: 0 };
    }
    
    let viewVal = vid.views;
    if (typeof viewVal === "string") {
      viewVal = viewVal.includes("M") ? parseFloat(viewVal) * 1000000 
              : viewVal.includes("K") ? parseFloat(viewVal) * 1000 
              : parseInt(viewVal);
    }
    hourStats[hour].totalViews += viewVal;
    hourStats[hour].count++;
  });

  if (validVideosCount === 0) {
    resultVal.innerText = "-";
    viewsDesc.innerText = dict.best_time_nodata;
    return;
  }

  let bestHour = -1;
  let maxAvgViews = -1;

  for (let hr in hourStats) {
    const avg = hourStats[hr].totalViews / hourStats[hr].count;
    if (avg > maxAvgViews) {
      maxAvgViews = avg;
      bestHour = parseInt(hr);
    }
  }

  if (bestHour !== -1) {
    const nextHour = (bestHour + 1) % 24;
    const formatHour = (h) => h.toString().padStart(2, "0") + ":00";
    resultVal.innerText = `${formatHour(bestHour)} - ${formatHour(nextHour)}`;
    
    const formattedViews = formatCountNum(Math.round(maxAvgViews));
    viewsDesc.innerText = `${dict.best_time_avg} ${formattedViews} ${dict.best_time_views_suffix}`;
  }
}

function formatCountNum(num) {
  num = parseInt(num);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function renderRecentVideos(container, videos) {
  container.innerHTML = "";
  const dict = translations[currentLang];

  if (!videos || videos.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:11px;">${dict.err_no_video}</div>`;
    return;
  }

  videos.forEach((vid, index) => {
    const item = document.createElement("div");
    item.className = "video-item";
    
    const title = vid.title && vid.title.trim() ? vid.title : `${dict.video_number}${index + 1}`;
    const coverStyle = vid.cover ? `background-image: url('${vid.cover}')` : "";
    
    const viewsNum = parseInt(vid.views) || 1;
    const engRatio = (((parseInt(vid.likes) || 0) + (parseInt(vid.comments) || 0) + (parseInt(vid.shares) || 0)) / viewsNum * 100).toFixed(1);

    item.innerHTML = `
      <div class="video-left">
        <div class="video-thumb" style="${coverStyle}"></div>
        <div style="text-align: left;">
          <div class="video-title" title="${vid.title}">${title}</div>
          <span class="video-engagement">🔥 ${engRatio}% ER</span>
        </div>
      </div>
      <div class="video-views">${formatCountNum(vid.views)}</div>
    `;
    container.appendChild(item);
  });
}

function triggerProfileFetch() {
  const listContainer = document.getElementById("videoList");
  const avatarEl = document.getElementById("statsAvatar");
  const userEl = document.getElementById("statsUsername");
  const bestTimeVal = document.getElementById("bestTimeResult");
  const bestTimeDesc = document.getElementById("bestTimeViews");
  const dict = translations[currentLang];

  userEl.innerText = "@creator";
  avatarEl.innerText = "T";
  avatarEl.style.backgroundImage = "";
  listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:11px;">${dict.connecting}</div>`;
  bestTimeVal.innerText = dict.best_time_calc;
  bestTimeDesc.innerText = "";

  // Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.url && tab.url.includes("tiktok.com")) {
      chrome.tabs.sendMessage(tab.id, { action: "GET_LOGGED_IN_USER" }, (res) => {
        let username = null;
        if (res && res.success && res.username) {
          username = res.username;
        }
        
        if (!username) {
          chrome.runtime.sendMessage({ action: "GET_ACTIVE_TIKTOK_USER" }, (bgRes) => {
            if (bgRes && bgRes.success && bgRes.username) {
              loadProfileData(bgRes.username, bgRes.avatar);
            } else {
              showNoAccountMsg();
            }
          });
        } else {
          chrome.runtime.sendMessage({ action: "FETCH_AVATAR", username: username }, (avRes) => {
            const avatarUrl = (avRes && avRes.success) ? avRes.avatar : null;
            loadProfileData(username, avatarUrl);
          });
        }
      });
    } else {
      showNoAccountMsg();
    }
  });

  function loadProfileData(username, avatar) {
    userEl.innerText = username;
    if (avatar) {
      avatarEl.style.backgroundImage = `url('${avatar}')`;
      avatarEl.innerText = "";
    } else {
      avatarEl.innerText = username.replace("@", "").charAt(0).toUpperCase();
    }

    chrome.runtime.sendMessage({ action: "FETCH_TIKTOK_DATA", username: username }, (response) => {
      if (response && response.success && response.data) {
        currentVideoData = response.data;
        renderRecentVideos(listContainer, currentVideoData);
        calculateBestTime(currentVideoData);
      } else {
        listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:11px;">${dict.err_no_video}</div>`;
        bestTimeVal.innerText = "-";
        bestTimeDesc.innerText = dict.best_time_nodata;
      }
    });
  }

  function showNoAccountMsg() {
    userEl.innerText = "@Guest";
    listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); font-size:11px;">${dict.no_active_user}</div>`;
    bestTimeVal.innerText = "-";
    bestTimeDesc.innerText = dict.best_time_nodata;
  }
}

// Sync theme configuration to active content script badge
function sendThemeToPage(themeName) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes("tiktok.com")) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (theme) => {
          const badge = document.querySelector("#encodex-badge .t-content");
          if (badge) {
            badge.className = "t-content theme-" + theme;
          }
        },
        args: [themeName]
      }).catch(err => console.log("Theme synchronization bypassed:", err));
    }
  });
}

// --- Navigation Controller ---
const views = {
  calc: document.getElementById("calcView"),
  main: document.getElementById("mainView"),
  stats: document.getElementById("statsView"),
  profile: document.getElementById("profileView")
};

function navigateTo(target) {
  if (target === currentActiveTarget) return;

  const currentIdx = viewIndex[currentActiveTarget];
  const targetIdx = viewIndex[target];

  const currentView = views[currentActiveTarget];
  const targetView = views[target];

  playSynthSound("click");

  // Slide transition effects based on indices
  if (targetIdx > currentIdx) {
    currentView.classList.add("slide-left");
    targetView.classList.remove("hidden");
    targetView.classList.add("slide-right");
    
    targetView.offsetWidth; 
    
    setTimeout(() => {
      currentView.classList.add("hidden");
      currentView.classList.remove("slide-left");
      targetView.classList.remove("slide-right");
    }, 150);
  } else {
    currentView.classList.add("slide-right");
    targetView.classList.remove("hidden");
    targetView.classList.add("slide-left");
    
    targetView.offsetWidth;

    setTimeout(() => {
      currentView.classList.add("hidden");
      currentView.classList.remove("slide-right");
      targetView.classList.remove("slide-left");
    }, 150);
  }

  // Set active navbar items
  document.querySelectorAll(".bottom-nav .nav-item, .bottom-nav .nav-item-center").forEach(item => {
    if (item.getAttribute("data-target") === target) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  currentActiveTarget = target;

  if (target === "stats") {
    triggerProfileFetch();
  }
}

// --- User Profile Account Authentication Logic ---
function updateInterfaceForUser(user) {
  const hAvatar = document.getElementById("headerAvatar");
  const hUsername = document.getElementById("headerUsername");
  const hRole = document.getElementById("headerUserRole");

  const pUsername = document.getElementById("profileUsernameText");
  const pRole = document.getElementById("profileUserRoleText");
  const pActionText = document.getElementById("profileActionBtnText");
  const pActionBtn = document.getElementById("profileActionBtn");
  const pAvatar = document.getElementById("profileAvatarBig");

  const dict = translations[currentLang];

  if (user && user.loggedIn) {
    hUsername.innerText = user.username;
    pUsername.innerText = user.username;
    hAvatar.innerText = user.username.charAt(0).toUpperCase();
    pAvatar.innerHTML = '<span style="font-size:24px; font-weight:bold; color:var(--primary); font-family:\'Rajdhani\';">' + user.username.charAt(0).toUpperCase() + '</span>';
    hRole.innerText = user.premium ? 'Premium' : 'User';
    hRole.style.color = user.premium ? '#fbbf24' : 'var(--text-sub)';
    hRole.style.fontWeight = user.premium ? 'bold' : '';
    pRole.innerText = user.premium ? 'Premium' : 'User';
    pRole.style.color = user.premium ? '#fbbf24' : 'var(--text-sub)';
    pRole.style.fontWeight = user.premium ? 'bold' : '';
    pActionText.innerText = currentLang === "ru" ? "Выйти" : "Logout";
    pActionBtn.style.background = "rgba(239, 68, 68, 0.12)";
    pActionBtn.style.color = "#ef4444";
    pActionBtn.style.border = "1px solid rgba(239, 68, 68, 0.35)";
    // Admin panel + role
    var adminPanel = document.getElementById("adminPanel");
    if (adminPanel) {
      if (user.is_admin) {
        adminPanel.classList.remove("hidden");
        hRole.innerText = 'Боженька';
        hRole.style.color = '#fbbf24';
        hRole.style.fontWeight = 'bold';
        pRole.innerText = 'Боженька';
        pRole.style.color = '#fbbf24';
        pRole.style.fontWeight = 'bold';
      } else {
        adminPanel.classList.add("hidden");
      }
    }
  } else {
    // Guest view
    const guestLabel = dict.guest_name;
    const subLabel = dict.not_logged_in;

    hUsername.innerText = guestLabel;
    pUsername.innerText = guestLabel;
    
    hAvatar.innerText = "G";
    pAvatar.innerHTML = `<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: var(--text-main);"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

    hRole.innerText = subLabel;
    hRole.style.color = "";
    hRole.style.fontWeight = "";

    pRole.innerText = subLabel;
    pRole.style.color = "";
    pRole.style.fontWeight = "";

    pActionText.innerText = currentLang === "ru" ? "Войти" : "Login";
    pActionBtn.style.background = "#fff";
    pActionBtn.style.color = "#000";
    pActionBtn.style.border = "none";
    var adminPanel = document.getElementById("adminPanel");
    if (adminPanel) adminPanel.classList.add("hidden");
  }
}

function handleLoginSubmit() {
  var userIn = document.getElementById("loginUsername");
  var passIn = document.getElementById("loginPassword");
  var loginForm = document.getElementById("loginFormArea");
  var profileCard = document.getElementById("profileCardArea");
  var username = userIn.value.trim();
  var password = passIn.value.trim();
  if (!username || !password) {
    showToast(currentLang === 'ru' ? 'Заполни все поля' : 'Fill all fields', 'error');
    return;
  }
  fetch(API + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.ok) {
      playSynthSound("success");
      showToast(currentLang === 'ru' ? 'Авторизация успешна' : 'Login successful', 'success');
      var user = { loggedIn: true, username: data.username, premium: data.premium, is_admin: data.is_admin, token: data.token };
        chrome.storage.local.set({ encodex_user: user, encodex_premium: data.premium, encodex_token: data.token }, function() {
          updateInterfaceForUser(user);
          updatePremiumUI(data.premium);
          updateUsageDisplay();
          userIn.value = "";
          passIn.value = "";
          loginForm.classList.add("hidden");
          profileCard.classList.remove("hidden");
          chrome.storage.local.get("encodex_active", function(bgRes) {
            syncHqStateToTab(bgRes.encodex_active || false);
          });
        });
    } else {
      playSynthSound("error");
      userIn.parentElement.style.borderColor = "var(--error)";
      passIn.parentElement.style.borderColor = "var(--error)";
      loginForm.style.transition = "none";
      var count = 0;
      var interval = setInterval(function() {
        loginForm.style.transform = count % 2 === 0 ? "translateX(-6px)" : "translateX(6px)";
        count++;
        if (count > 5) {
          clearInterval(interval);
          loginForm.style.transform = "";
          loginForm.style.transition = "";
          setTimeout(function() {
            userIn.parentElement.style.borderColor = "";
            passIn.parentElement.style.borderColor = "";
          }, 1000);
        }
      }, 60);
    }
  }).catch(function() {
    showToast(currentLang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error');
  });
}

/* ===== Verify stored JWT on startup ===== */
function verifyToken() {
  chrome.storage.local.get("encodex_token", function(res) {
    if (!res.encodex_token) return;
    fetch(API + '/api/me', {
      headers: { 'Authorization': 'Bearer ' + res.encodex_token }
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        var user = { loggedIn: true, username: data.username, premium: data.premium, is_admin: data.is_admin, token: res.encodex_token };
        chrome.storage.local.set({ encodex_user: user, encodex_premium: data.premium }, function() {
          updateInterfaceForUser(user);
          updatePremiumUI(data.premium);
        });
      } else {
        chrome.storage.local.remove(["encodex_token", "encodex_user", "encodex_premium"]);
      }
    });
  });
}

// --- Main Init Event Binding ---
document.addEventListener("DOMContentLoaded", () => {
  verifyToken();
  // Load storage configurations
  chrome.storage.local.get(["lang", "theme", "encodex_active", "encodex_user", "encodex_premium"], (settings) => {
    currentLang = settings.lang || "ru";
    currentTheme = settings.theme || "midnight-black";
    const isActive = settings.encodex_active || false;
    const user = settings.encodex_user || null;
    const isPremium = settings.encodex_premium || false;

    // Apply Saved Theme
    document.body.className = "theme-" + currentTheme;
    document.querySelectorAll(".theme-dot").forEach(dot => {
      if (dot.getAttribute("data-theme") === currentTheme) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    // Apply user details
    updateInterfaceForUser(user);
    updatePremiumUI(isPremium);

    // Apply State
    document.getElementById("toggleBtn").checked = isActive;
    updateHQUI(isActive);
    translateUI(currentLang);
    updateUsageDisplay();
    initStarfield();
    bindAudioListeners();

  });

  // Toggle HQ Upload Switch
  const toggleBtn = document.getElementById("toggleBtn");
  toggleBtn.addEventListener("change", async (e) => {
    const isChecked = e.target.checked;

    const settings = await new Promise(resolve => {
      chrome.storage.local.get(["encodex_premium", "encodex_user"], resolve);
    });
    const isPremium = settings.encodex_premium || (settings.encodex_user && settings.encodex_user.premium);

    if (isChecked && !isPremium) {
      e.preventDefault();
      toggleBtn.checked = false;
      playSynthSound("error");

      const mainCard = document.getElementById("mainCard");
      const statusText = document.getElementById("statusText");
      const originalText = statusText.innerText;
      const originalColor = statusText.style.color;

      statusText.innerText = translations[currentLang].err_premium_required;
      statusText.style.color = "var(--error)";
      mainCard.style.borderColor = "var(--error)";
      mainCard.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.4)";

      mainCard.style.transition = "none";
      let count = 0;
      const interval = setInterval(() => {
        mainCard.style.transform = count % 2 === 0 ? "translateX(-5px)" : "translateX(5px)";
        count++;
        if (count > 5) {
          clearInterval(interval);
          mainCard.style.transform = "";
          mainCard.style.transition = "";
          setTimeout(() => {
            statusText.innerText = originalText;
            statusText.style.color = originalColor;
            mainCard.style.borderColor = "";
            mainCard.style.boxShadow = "";
          }, 1500);
        }
      }, 60);

      chrome.storage.local.set({ encodex_active: false });
      updateHQUI(false);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isUploadPage = tab && tab.url && (tab.url.includes("/upload") || tab.url.includes("/creator-center") || tab.url.includes("/tiktokstudio"));

    if (isChecked && !isUploadPage) {
      e.preventDefault();
      toggleBtn.checked = false;
      showWrongPageAlert();
      chrome.storage.local.set({ encodex_active: false });
      updateHQUI(false);
      return;
    }

    playSynthSound("click");
    chrome.storage.local.set({ encodex_active: isChecked });
    updateHQUI(isChecked);
    syncHqStateToTab(isChecked);
  });

  // Language Change Toggle
  document.getElementById("langBtn").addEventListener("click", () => {
    const nextLang = currentLang === "ru" ? "en" : "ru";
    chrome.storage.local.set({ lang: nextLang });
    translateUI(nextLang);
  });

  // Theme Selectors Clicks
  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.addEventListener("click", (e) => {
      const selected = e.target.getAttribute("data-theme");
      currentTheme = selected;
      
      document.body.className = "theme-" + selected;
      document.querySelectorAll(".theme-dot").forEach(d => d.classList.remove("active"));
      e.target.classList.add("active");
      
      chrome.storage.local.set({ theme: selected });
      sendThemeToPage(selected);
      
      initStarfield();
    });
  });

  // Slider Calculator events
  const durationInput = document.getElementById("calcDurationInput");
  durationInput.addEventListener("input", updateCalculator);
  updateCalculator();

  // Navigation Panel tab-clicks bindings
  document.querySelectorAll(".bottom-nav .nav-item, .bottom-nav .nav-item-center").forEach(item => {
    item.addEventListener("click", (e) => {
      const target = e.currentTarget.getAttribute("data-target");
      navigateTo(target);
    });
  });

  // --- Profile Actions Handlers ---
  const profileActionBtn = document.getElementById("profileActionBtn");
  const loginForm = document.getElementById("loginFormArea");
  const profileCard = document.getElementById("profileCardArea");
  const cancelLogin = document.getElementById("cancelLoginBtn");
  const submitLogin = document.getElementById("submitLoginBtn");

  profileActionBtn.addEventListener("click", () => {
    chrome.storage.local.get(["encodex_user"], (res) => {
      const user = res.encodex_user || null;
      if (user && user.loggedIn) {
        // Logout execution
        playSynthSound("click");
          chrome.storage.local.remove(["encodex_user", "encodex_premium", "encodex_token"], () => {
            updateInterfaceForUser(null);
            updatePremiumUI(false);
            chrome.storage.local.set({ encodex_active: false }, () => {
              const toggle = document.getElementById("toggleBtn");
              if (toggle) toggle.checked = false;
              updateHQUI(false);
              updateUsageDisplay();
              syncHqStateToTab(false);
            });
          });
      } else {
        // Open login overlay
        playSynthSound("click");
        profileCard.classList.add("hidden");
        loginForm.classList.remove("hidden");
      }
    });
  });

  cancelLogin.addEventListener("click", () => {
    playSynthSound("click");
    loginForm.classList.add("hidden");
    profileCard.classList.remove("hidden");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
  });

  submitLogin.addEventListener("click", handleLoginSubmit);

  document.getElementById("registerBtn").addEventListener("click", function() {
    var userIn = document.getElementById("loginUsername");
    var passIn = document.getElementById("loginPassword");
    var username = userIn.value.trim();
    var password = passIn.value.trim();
    if (!username || !password || password.length < 4) {
      showToast(currentLang === 'ru' ? 'Пароль минимум 4 символа' : 'Password min 4 chars', 'error');
      return;
    }
    fetch(API + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        playSynthSound("success");
        showToast(currentLang === 'ru' ? 'Аккаунт создан!' : 'Account created!', 'success');
        var user = { loggedIn: true, username: data.username, premium: false, is_admin: false, token: data.token };
        chrome.storage.local.set({ encodex_user: user, encodex_premium: false, encodex_token: data.token }, function() {
          updateInterfaceForUser(user);
          updatePremiumUI(false);
          userIn.value = "";
          passIn.value = "";
          loginForm.classList.add("hidden");
          profileCard.classList.remove("hidden");
        });
      } else {
        showToast(data.error || (currentLang === 'ru' ? 'Ошибка' : 'Error'), 'error');
      }
    }).catch(function() {
      showToast(currentLang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error');
    });
  });

  // --- Premium Activation Handler ---
  const activatePremiumBtn = document.getElementById("activatePremiumBtn");
  const premiumKeyInput = document.getElementById("premiumKeyInput");
  const premiumKeyCard = document.getElementById("premiumKeyCard");

  if (activatePremiumBtn && premiumKeyInput) {
    activatePremiumBtn.addEventListener("click", function() {
      var enteredKey = premiumKeyInput.value.trim().toUpperCase();
      if (!enteredKey) return;
      chrome.storage.local.get(["encodex_token", "encodex_user"], function(res) {
        if (!res.encodex_token) {
          showToast(currentLang === 'ru' ? 'Сначала войди в аккаунт' : 'Login first', 'error');
          return;
        }
        fetch(API + '/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + res.encodex_token },
          body: JSON.stringify({ key: enteredKey })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok) {
            playSynthSound("success");
            showToast(currentLang === 'ru' ? 'Премиум активирован!' : 'Premium activated!', 'success');
            res.encodex_user.premium = true;
            chrome.storage.local.set({ encodex_premium: true, encodex_user: res.encodex_user }, function() {
              updatePremiumUI(true);
              updateUsageDisplay();
              chrome.storage.local.get("encodex_active", function(bgRes) {
                syncHqStateToTab(bgRes.encodex_active || false);
              });
            });
          } else {
            playSynthSound("error");
            showToast(currentLang === 'ru' ? 'Неверный или уже использованный ключ' : 'Invalid or used key', 'error');
            premiumKeyInput.parentElement.style.borderColor = "var(--error)";
            premiumKeyCard.style.transition = "none";
            var count = 0;
            var interval = setInterval(function() {
              premiumKeyCard.style.transform = count % 2 === 0 ? "translateX(-6px)" : "translateX(6px)";
              count++;
              if (count > 5) {
                clearInterval(interval);
                premiumKeyCard.style.transform = "";
                premiumKeyCard.style.transition = "";
                setTimeout(function() { premiumKeyInput.parentElement.style.borderColor = ""; }, 1000);
              }
            }, 60);
          }
        }).catch(function() {
          showToast(currentLang === 'ru' ? 'Ошибка сервера' : 'Server error', 'error');
        });
      });
    });
  }

  // Admin: Generate Keys
  var genBtn = document.getElementById("genKeysBtn");
  var copyBtn = document.getElementById("copyKeysBtn");
  var keyOutput = document.getElementById("newKeysOutput");
  if (genBtn) {
    genBtn.addEventListener("click", function() {
      chrome.storage.local.get("encodex_token", function(res) {
        if (!res.encodex_token) return;
        fetch(API + '/api/keys/generate?count=10', {
          headers: { 'Authorization': 'Bearer ' + res.encodex_token }
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok && data.keys) {
            keyOutput.innerText = data.keys.join('\n');
            keyOutput.style.userSelect = 'text';
            keyOutput.style.webkitUserSelect = 'text';
            showToast('10 ключей создано!', 'success');
          }
        });
      });
    });
    if (copyBtn) {
      copyBtn.addEventListener("click", function() {
        var text = keyOutput.innerText;
        if (!text) return;
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Ключи скопированы!', 'success');
      });
    }
  }

  // Admin: Grant Premium
  var grantBtn = document.getElementById("grantPremiumBtn");
  var grantAdminBtn = document.getElementById("grantAdminBtn");
  var grantInput = document.getElementById("grantUsername");
  if (grantBtn) {
    grantBtn.addEventListener("click", function() {
      var username = grantInput.value.trim();
      if (!username) return;
      chrome.storage.local.get("encodex_token", function(res) {
        if (!res.encodex_token) return;
        fetch(API + '/api/admin/grant-premium', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + res.encodex_token },
          body: JSON.stringify({ username: username })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok) {
            showToast(username + ' теперь Premium!', 'success');
            grantInput.value = '';
          } else {
            showToast(data.error || 'Error', 'error');
          }
        }).catch(function() { showToast('Server error', 'error'); });
      });
    });
  }
  if (grantAdminBtn) {
    grantAdminBtn.addEventListener("click", function() {
      var username = grantInput.value.trim();
      if (!username) return;
      chrome.storage.local.get("encodex_token", function(res) {
        if (!res.encodex_token) return;
        fetch(API + '/api/admin/grant-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + res.encodex_token },
          body: JSON.stringify({ username: username })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok) {
            showToast(username + ' теперь Admin!', 'success');
            grantInput.value = '';
          } else {
            showToast(data.error || 'Error', 'error');
          }
        }).catch(function() { showToast('Server error', 'error'); });
      });
    });
  }

  // Admin: List Users
  var listBtn = document.getElementById("listUsersBtn");
  var usersOutput = document.getElementById("usersListOutput");
  if (listBtn) {
    listBtn.addEventListener("click", function() {
      if (usersOutput.style.display !== 'none') {
        usersOutput.style.display = 'none';
        return;
      }
      chrome.storage.local.get("encodex_token", function(res) {
        if (!res.encodex_token) return;
        fetch(API + '/api/admin/users', {
          headers: { 'Authorization': 'Bearer ' + res.encodex_token }
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok && data.users) {
            usersOutput.style.display = 'block';
            usersOutput.innerText = data.users.map(function(u) {
              return u.username + ' | ' + (u.premium ? 'PREMIUM' : 'user') + ' | ' + (u.created_at || '').substring(0, 10);
            }).join('\n');
          }
        });
      });
    });
  }
});
