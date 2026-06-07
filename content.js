let isInjected = false;

function checkAndInject() {
  if (isInjected) return;
  injectScript();
  isInjected = true;
}

function injectScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
}

function addBadgeToPage() {
  if (document.getElementById("encodex-badge")) return;

  chrome.storage.local.get(["theme", "lang", "encodex_active", "encodex_premium", "encodex_user"], function(data) {
    const theme = data.theme || "midnight-black";
    const lang = data.lang || "ru";
    const isPremium = data.encodex_premium || (data.encodex_user && data.encodex_user.loggedIn && data.encodex_user.role === "Owner");
    const isActive = isPremium ? (data.encodex_active || false) : false;

    const labelDict = {
      en: { ready: "HQ READY", active: "HQ ACTIVE", locked: "PREMIUM REQUIRED" },
      ru: { ready: "HQ ГОТОВ", active: "HQ АКТИВЕН", locked: "ТРЕБУЕТСЯ PREMIUM" }
    };

    const labels = labelDict[lang] || labelDict.ru;
    const initialText = isPremium ? (isActive ? labels.active : labels.ready) : labels.locked;
    const stateClass = isPremium ? (isActive ? "state-active" : "state-ready") : "state-locked";

    const badgeHtml = `
      <div id="encodex-badge" class="t-badge-container ${stateClass}">
        <div class="t-content theme-${theme}">
          <div id="t-indicator-dot" class="t-dot"></div>
          <div class="t-text-group">
            <div class="t-header-row">
              <svg class="t-icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
              </svg>
              <span class="t-title">EncodeX v2.0</span>
            </div>
            <span id="encodex-status-text" class="t-status">${initialText}</span>
          </div>
          <div id="t-minimize-btn" class="t-action-btn" title="Minimize/Maximize">
            <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = badgeHtml;
    document.body.appendChild(wrapper);

    const badge = document.getElementById("encodex-badge");
    const minBtn = document.getElementById("t-minimize-btn");

    function toggleMinimize() {
      badge.classList.toggle("minimized");
      localStorage.setItem("encodex_badge_minimized", badge.classList.contains("minimized"));
    }

    if (localStorage.getItem("encodex_badge_minimized") === "true") {
      badge.classList.add("minimized");
    }

    minBtn.addEventListener("click", function(e) { e.stopPropagation(); toggleMinimize(); });
    badge.addEventListener("click", function() { if (badge.classList.contains("minimized")) toggleMinimize(); });

    setTimeout(function() {
      chrome.storage.local.get(["encodex_token"], function(tokenData) {
        window.dispatchEvent(new CustomEvent("EncodeXState", {
          detail: {
            lang: lang,
            isActive: isActive,
            isPremium: isPremium,
            token: tokenData.encodex_token || null
          }
        }));
      });
    }, 1000);
  });

  injectBadgeStyles();
}

function injectBadgeStyles() {
  const styles = document.createElement("style");
  styles.textContent = `
    .t-header-row { display: flex; align-items: center; gap: 6px; }
    .t-icon { width: 14px; height: 14px; fill: var(--badge-primary); filter: drop-shadow(0 0 3px var(--badge-primary-glow)); transition: fill 0.3s; }
    .t-title { font-size: 10px; color: #a1a1aa; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
    .t-badge-container {
      position: fixed; bottom: 30px; right: 30px;
      z-index: 2147483647; font-family: 'Inter', sans-serif;
      user-select: none; opacity: 0; transform: translateY(20px);
      transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); cursor: default;
    }
    .t-badge-container.visible { opacity: 1; transform: translateY(0); }
    .t-content {
      background: rgba(10, 11, 17, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--badge-border);
      padding: 10px 18px; border-radius: 14px; display: flex; align-items: center; gap: 12px;
      box-shadow: 0 8px 32px var(--badge-shadow), inset 0 0 8px rgba(255,255,255,0.02);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      max-width: 320px; overflow: hidden;
      --badge-primary: #00f2fe;
      --badge-primary-glow: rgba(0, 242, 254, 0.5);
      --badge-border: rgba(0, 242, 254, 0.3);
      --badge-shadow: rgba(0, 242, 254, 0.15);
    }
    .t-content.theme-mint-glow {
      --badge-primary: #00ff87;
      --badge-primary-glow: rgba(0, 255, 135, 0.5);
      --badge-border: rgba(0, 255, 135, 0.3);
      --badge-shadow: rgba(0, 255, 135, 0.15);
      background: rgba(7, 14, 16, 0.85);
    }
    .t-content.theme-amber-core {
      --badge-primary: #ff9900;
      --badge-primary-glow: rgba(255, 153, 0, 0.5);
      --badge-border: rgba(255, 153, 0, 0.3);
      --badge-shadow: rgba(255, 153, 0, 0.15);
      background: rgba(15, 10, 7, 0.85);
    }
    .t-content.theme-midnight-black {
      --badge-primary: #ffffff;
      --badge-primary-glow: rgba(255, 255, 255, 0.5);
      --badge-border: rgba(255, 255, 255, 0.3);
      --badge-shadow: rgba(255, 255, 255, 0.15);
      background: rgba(0, 0, 0, 0.95);
    }
    .t-text-group { display: flex; flex-direction: column; transition: opacity 0.2s; opacity: 1; }
    .t-status { font-size: 13px; color: #fff; font-weight: 800; transition: color 0.3s; white-space: nowrap; letter-spacing: 0.5px; }
    .t-dot {
      width: 10px; height: 10px; flex-shrink: 0;
      background-color: #4b5563; border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.08);
      transition: all 0.3s ease;
    }
    .t-action-btn {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; cursor: pointer;
      transition: all 0.2s; margin-left: 5px; opacity: 0.5;
    }
    .t-action-btn:hover { background: rgba(255,255,255,0.08); opacity: 1; }
    .t-action-btn svg { width: 16px; height: 16px; fill: #fff; transition: transform 0.3s; transform: rotate(90deg); }
    .t-badge-container.minimized .t-content {
      padding: 0; gap: 0; border-radius: 50%;
      width: 42px; height: 42px; justify-content: center;
    }
    .t-badge-container.minimized .t-text-group { display: none; opacity: 0; width: 0; }
    .t-badge-container.minimized .t-action-btn { display: none; }
    .t-badge-container.minimized { cursor: pointer; }
    .t-badge-container.minimized:hover .t-content {
      transform: scale(1.1);
      box-shadow: 0 0 20px var(--badge-primary-glow);
    }
    .t-badge-container.state-ready .t-dot { background-color: var(--badge-primary); box-shadow: 0 0 10px var(--badge-primary); }
    .t-badge-container.state-ready .t-status { color: var(--badge-primary); }
    .t-badge-container.state-active .t-dot {
      background-color: var(--badge-primary); box-shadow: 0 0 12px var(--badge-primary);
      animation: t-pulseDot 1.5s infinite;
    }
    .t-badge-container.state-active .t-status { color: var(--badge-primary); }
    .t-badge-container.state-active .t-content { border-color: var(--badge-primary); }
    .t-badge-container.state-locked .t-dot { background-color: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6); }
    .t-badge-container.state-locked .t-status { color: #ef4444; }
    .t-badge-container.state-locked .t-content { border-color: rgba(239, 68, 68, 0.4); }
    @keyframes t-pulseDot {
      0% { box-shadow: 0 0 0 0 var(--badge-shadow); }
      70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
    }
  `;
  document.head.appendChild(styles);

  setTimeout(function() {
    const badge = document.getElementById("encodex-badge");
    if (badge) badge.classList.add("visible");
  }, 500);
}

// HD Playback
function injectHDButtons() {
  document.querySelectorAll('[data-e2e="share-icon"]').forEach(function(shareIcon) {
    var btnParent = shareIcon.closest("button") || shareIcon.parentElement.parentElement;
    var actionContainer = btnParent.closest('[class*="DivActionItemContainer"]');
    if (!actionContainer) actionContainer = btnParent.parentElement;
    if (!actionContainer || actionContainer.querySelector(".encodex-hd-btn")) return;

    var hdBtn = document.createElement("div");
    hdBtn.className = "encodex-hd-btn";
    hdBtn.innerHTML = `
      <div class="encodex-hd-icon" title="Play HD">
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px;">
          <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/>
        </svg>
      </div>
      <span class="encodex-hd-text">HD</span>
    `;

    hdBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      e.preventDefault();
      startHDMode(hdBtn);
    });

    actionContainer.appendChild(hdBtn);
  });
}

function startHDMode(btnEl) {
  if (btnEl.getAttribute("data-loading") === "true") return;

  var iconContainer = btnEl.querySelector(".encodex-hd-icon");
  var originalSvg = iconContainer ? iconContainer.innerHTML : "";

  chrome.storage.local.get("theme", function(data) {
    var theme = data.theme || "midnight-black";
    var spinnerColor = "#00f2fe";
    if (theme === "mint-glow") spinnerColor = "#00ff87";
    else if (theme === "amber-core") spinnerColor = "#ff9900";

    if (iconContainer) {
      iconContainer.innerHTML = '<div style="width:14px;height:14px;border:2px solid ' + spinnerColor + ';border-top-color:transparent;border-radius:50%;animation:encodex-spin 1s infinite;"></div>';
    }
    btnEl.setAttribute("data-loading", "true");
    btnEl.style.opacity = "0.7";

    var videoUrl = null;
    var currentUrl = window.location.href;

    if (!currentUrl.includes("/video/") || currentUrl.includes("/foryou") || currentUrl.includes("/live")) {
      var feedContainer = btnEl.closest('[data-e2e="feed-video"]');
      if (!feedContainer) feedContainer = btnEl.closest('[class*="DivVideoPlayerContainer"]') || btnEl.parentElement.parentElement.parentElement;
      if (feedContainer) {
        var xgWrapper = feedContainer.querySelector('[id^="xgwrapper"]');
        if (xgWrapper) {
          var idParts = xgWrapper.id.split("-");
          var videoId = idParts[idParts.length - 1];
          if (/^\d{15,30}$/.test(videoId)) videoUrl = "https://www.tiktok.com/video/" + videoId;
        }
        if (!videoUrl) {
          var link = feedContainer.querySelector('a[href*="/video/"]');
          if (link && !link.href.includes("random")) videoUrl = link.href;
        }
      }
    } else {
      videoUrl = currentUrl.split("?")[0];
    }

    function resetBtn() {
      btnEl.setAttribute("data-loading", "false");
      btnEl.style.opacity = "1";
      if (iconContainer) iconContainer.innerHTML = originalSvg;
    }

    if (!videoUrl) {
      alert("Could not identify video target.");
      resetBtn();
      return;
    }

    var wrapperEl = btnEl.closest('[data-e2e="feed-video"]') || btnEl.closest('[class*="DivVideoPlayerContainer"]') || btnEl.closest('[class*="DivContentContainer"]');
    if (!wrapperEl) wrapperEl = btnEl.closest('div[class*="DivMainContainer"]') || document.body;
    var videoTag = wrapperEl.querySelector("video");

    chrome.runtime.sendMessage({ action: "FETCH_HD_VIDEO", url: videoUrl }, function(res) {
      resetBtn();
      if (res && res.success && res.data && res.data.playUrl) {
        var targetAttach = wrapperEl;
        if (videoTag && videoTag.parentElement) targetAttach = videoTag.parentElement.parentElement || videoTag.parentElement;
        enableHDOverlay(targetAttach, videoTag, res.data.playUrl, theme);
      } else {
        alert("Failed to grab HD stream.");
      }
    });
  });
}

function enableHDOverlay(container, nativeVideo, streamUrl, theme) {
  var playUrl = typeof streamUrl === "object" ? streamUrl.playUrl : streamUrl;
  var playerContainer = nativeVideo.closest('div[class*="DivBasicPlayerWrapper"]');
  if (!playerContainer) playerContainer = nativeVideo.parentElement;
  var parent = playerContainer.parentElement;

  Array.from(playerContainer.children).forEach(function(child) { child.style.visibility = "hidden"; });
  playerContainer.style.position = "relative";

  var hiddenEls = [];
  if (parent) {
    Array.from(parent.children).forEach(function(child) {
      if (child !== playerContainer && (child.querySelector("picture") || child.querySelector("img") || child.getAttribute("mode") === "0")) {
        child.style.display = "none";
        hiddenEls.push(child);
      }
    });
  }

  var hdOverlay = document.createElement("div");
  hdOverlay.id = "encodex-hd-overlay";
  Object.assign(hdOverlay.style, {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    zIndex: "999", backgroundColor: "#000",
    display: "flex", alignItems: "center", justifyContent: "center", visibility: "visible"
  });
  hdOverlay.innerHTML = '<iframe src="' + playUrl + '" style="width:100%;height:100%;border:none;" allow="autoplay;fullscreen;picture-in-picture" referrerpolicy="no-referrer"></iframe><button id="encodex-close-hd" class="t-modern-close theme-' + theme + '" title="Close HD Mode"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>';

  playerContainer.appendChild(hdOverlay);

  if (nativeVideo) { nativeVideo.muted = true; nativeVideo.pause(); }

  hdOverlay.querySelector("#encodex-close-hd").addEventListener("click", function(e) {
    e.stopPropagation();
    hdOverlay.remove();
    Array.from(playerContainer.children).forEach(function(child) { child.style.visibility = "visible"; });
    hiddenEls.forEach(function(el) { el.style.display = ""; });
    if (nativeVideo) nativeVideo.muted = false;
  });
}

function injectHDStyles() {
  var hdStyles = document.createElement("style");
  hdStyles.textContent = `
    .encodex-hd-btn { margin-top:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:999; flex-shrink:0; width:48px; }
    .encodex-hd-icon { width:44px; height:44px; border-radius:50%; background:rgba(20,20,25,0.55); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275); position:relative; overflow:hidden; --hd-accent:#00f2fe; --hd-glow:rgba(0,242,254,0.45); }
    body.theme-mint-glow .encodex-hd-icon { --hd-accent: #00ff87; --hd-glow: rgba(0,255,135,0.45); }
    body.theme-amber-core .encodex-hd-icon { --hd-accent: #ff9900; --hd-glow: rgba(255,153,0,0.45); }
    body.theme-midnight-black .encodex-hd-icon { --hd-accent: #ffffff; --hd-glow: rgba(255,255,255,0.45); }
    .encodex-hd-icon svg { width:24px; height:24px; fill:#e4e4e7; transition:fill 0.3s; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .encodex-hd-btn:hover .encodex-hd-icon { background:rgba(255,255,255,0.02); border-color:var(--hd-accent); box-shadow:0 0 15px var(--hd-glow); transform:scale(1.1); }
    .encodex-hd-btn:hover .encodex-hd-icon svg { fill:var(--hd-accent); filter:drop-shadow(0 0 5px var(--hd-accent)); }
    .encodex-hd-text { font-family:'Inter',sans-serif; font-size:11px; color:rgba(255,255,255,0.8); margin-top:4px; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,0.8); transition:color 0.3s; }
    .encodex-hd-btn:hover .encodex-hd-text { color:var(--hd-accent); }
    .t-modern-close { position:absolute; top:20px; right:20px; z-index:10000; width:36px; height:36px; background:rgba(0,0,0,0.45); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.15); border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.3s ease; box-shadow:0 4px 10px rgba(0,0,0,0.3); --close-accent:#00f2fe; }
    .t-modern-close svg { width:18px; height:18px; fill:#fff; transition:transform 0.4s cubic-bezier(0.68,-0.55,0.265,1.55); }
    .t-modern-close:hover { background:var(--close-accent); border-color:var(--close-accent); transform:rotate(90deg) scale(1.1); box-shadow:0 0 15px var(--close-accent); }
    .t-modern-close:hover svg { fill: #000; }
    .t-modern-close.theme-mint-glow { --close-accent:#00ff87; }
    .t-modern-close.theme-amber-core { --close-accent:#ff9900; }
    .t-modern-close.theme-midnight-black { --close-accent:#ffffff; }
    @keyframes encodex-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
  `;
  document.head.appendChild(hdStyles);
}

// Background listening for TikTok username
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "GET_LOGGED_IN_USER") {
    var username = null;
    var contextEl = document.getElementById("__Creator_Center_Context__");
    if (contextEl) {
      var match = contextEl.innerHTML.match(/"uniqueId":"([^"]+)"/);
      if (match && match[1]) username = "@" + match[1];
    }
    if (!username) {
      var match = document.documentElement.innerHTML.match(/"uniqueId":"([^"]+)"/);
      if (match && match[1]) username = "@" + match[1];
    }
    if (!username) {
      var profileAnchor = document.querySelector('a[data-e2e="nav-profile"]');
      if (profileAnchor && profileAnchor.getAttribute("href")) {
        var match = profileAnchor.getAttribute("href").match(/\/(@[\w.-]+)/);
        if (match && match[1]) username = match[1];
      }
    }
    sendResponse({ success: !!username, username: username });
  }
});

// Storage listener
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === "local") {
    chrome.storage.local.get(["theme", "lang", "encodex_active", "encodex_premium", "encodex_user", "encodex_token"], function(data) {
      var theme = data.theme || "midnight-black";
      var lang = data.lang || "ru";
      var isPremium = data.encodex_premium || (data.encodex_user && data.encodex_user.loggedIn && data.encodex_user.role === "Owner");
      var isActive = isPremium ? (data.encodex_active || false) : false;

      var badgeContent = document.querySelector("#encodex-badge .t-content");
      if (badgeContent) badgeContent.className = "t-content theme-" + theme;

      if (document.body) {
        document.body.className = document.body.className.replace(/theme-\S+/g, "");
        document.body.classList.add("theme-" + theme);
      }

      var badge = document.getElementById("encodex-badge");
      var statusText = document.getElementById("encodex-status-text");
      if (badge && statusText) {
        badge.classList.remove("state-ready", "state-active", "state-locked");
        var labelDict = {
          en: { ready: "HQ READY", active: "HQ ACTIVE", locked: "PREMIUM REQUIRED" },
          ru: { ready: "HQ ГОТОВ", active: "HQ АКТИВЕН", locked: "ТРЕБУЕТСЯ PREMIUM" }
        };
        var labels = labelDict[lang] || labelDict.ru;
        if (isPremium) {
          badge.classList.add(isActive ? "state-active" : "state-ready");
          statusText.innerText = isActive ? labels.active : labels.ready;
        } else {
          badge.classList.add("state-locked");
          statusText.innerText = labels.locked;
        }
      }

      window.dispatchEvent(new CustomEvent("EncodeXState", {
        detail: {
          lang: lang,
          isActive: isActive,
          isPremium: isPremium,
          token: data.encodex_token || null
        }
      }));
    });
  }
});

// === Message bridge: inject.js → content.js network calls (bypass CSP) ===
const SERVER = 'https://encodex-api-production.up.railway.app';

function getTokenFromStorage() {
  return new Promise(function(resolve) {
    try {
      chrome.storage.local.get(['encodex_token'], function(data) {
        resolve(data && data.encodex_token ? data.encodex_token : null);
      });
    } catch(e) {
      // Extension context invalidated (reloaded/updated) - inject.js will show login prompt
      console.warn('[EncodeX] storage unavailable:', e.message);
      resolve(null);
    }
  });
}

// Re-read token when storage changes (e.g. after re-login)
chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.encodex_token) {
    window.dispatchEvent(new CustomEvent('EncodeXState', {
      detail: { token: changes.encodex_token.newValue || null }
    }));
  }
});

window.addEventListener('message', function(event) {
  if (!event.data || event.data.source !== 'encodex-inject') return;
  var msg = event.data;
  var payload = msg.payload || {};

  switch (msg.type) {
    case 'ALLOCATE': {
      getTokenFromStorage().then(function(token) {
        if (!token) { respond('ALLOCATE_RESULT', { ok: false, error: 'Not logged in' }); return; }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', SERVER + '/api/process/allocate');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.onload = function() {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.ok) {
              respond('ALLOCATE_RESULT', {
                ok: true,
                transcoder_url: data.transcoder_url,
                upload_token: data.upload_token,
                usage_token: data.usage_token,
                job_id: data.job_id,
                _file: payload._file
              });
            } else {
              respond('ALLOCATE_RESULT', { ok: false, error: data.error || 'Allocate failed' });
            }
          } catch(e) { respond('ALLOCATE_RESULT', { ok: false, error: 'Invalid response' }); }
        };
        xhr.onerror = function() { respond('ALLOCATE_RESULT', { ok: false, error: 'Network error' }); };
        xhr.send(JSON.stringify({ file_size: payload.fileSize }));
      }).catch(function(e) {
        console.error('[EncodeX] ALLOCATE error:', e);
        respond('ALLOCATE_RESULT', { ok: false, error: e.message || 'Unknown error' });
      });
      break;
    }

    case 'UPLOAD': {
      var fd = new FormData();
      fd.append('video', payload._file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', payload.transcoderUrl + '/api/process/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + payload.uploadToken);
      xhr.timeout = 120000;
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 100 * 0.16 + 2);
          var label = (window._encodex_currentLang === 'ru' ? 'Загрузка' : 'Uploading') + ' (' + pct + '%)';
          respond('UPLOAD_PROGRESS', { percent: pct, label: label });
        }
      };
      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.ok) {
            respond('UPLOAD_RESULT', {
              ok: true, jobId: data.job_id,
              transcoderUrl: payload.transcoderUrl, uploadToken: payload.uploadToken, usageToken: payload.usageToken
            });
          } else {
            respond('UPLOAD_RESULT', { ok: false, error: data.error || 'Upload failed' });
          }
        } catch(e) { respond('UPLOAD_RESULT', { ok: false, error: 'Invalid response' }); }
      };
      xhr.onerror = function() { respond('UPLOAD_RESULT', { ok: false, error: 'Network error' }); };
      xhr.ontimeout = function() { respond('UPLOAD_RESULT', { ok: false, error: 'Upload timeout' }); };
      xhr.send(fd);
      break;
    }

    case 'POLL': {
      (function poll(retries) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', payload.transcoderUrl + '/api/process/status?job_id=' + payload.jobId);
        xhr.setRequestHeader('Authorization', 'Bearer ' + payload.uploadToken);
        xhr.onload = function() {
          try {
            var data = JSON.parse(xhr.responseText);
            if (!data.ok) { if (retries < 360) setTimeout(function() { poll(retries + 1); }, 1000); else respond('POLL_RESULT', { ok: false, error: 'Timeout' }); return; }
            if (data.status === 200) {
              respond('POLL_RESULT', {
                ok: true,
                transcoderUrl: payload.transcoderUrl, uploadToken: payload.uploadToken, jobId: payload.jobId, usageToken: payload.usageToken
              });
              return;
            }
            if (data.status >= 400) { respond('POLL_RESULT', { ok: false, error: data.error || 'Processing failed' }); return; }
            var phaseLabel = '';
            var progress = 18;
            if (data.status === 10) { phaseLabel = window._encodex_currentLang === 'ru' ? 'В очереди' : 'Queued'; progress = 18; }
            else if (data.status === 20) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Анализ' : 'Analyzing'; progress = 24; }
            else if (data.status === 30) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Кодирование' : 'Encoding'; progress = Math.round(data.progress || 50); }
            else if (data.status === 40) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Финализация' : 'Patching'; progress = 92; }
            respond('POLL_PROGRESS', { label: phaseLabel + ' (' + progress + '%)', percent: progress });
            setTimeout(function() { poll(0); }, 1000);
          } catch(e) { if (retries < 360) setTimeout(function() { poll(retries + 1); }, 1000); else respond('POLL_RESULT', { ok: false, error: 'Timeout' }); }
        };
        xhr.onerror = function() { if (retries < 360) setTimeout(function() { poll(retries + 1); }, 1000); else respond('POLL_RESULT', { ok: false, error: 'Timeout' }); };
        xhr.send();
      })(0);
      break;
    }

    case 'DOWNLOAD': {
      var url = payload.transcoderUrl + '/api/process/result?job_id=' + payload.jobId + '&token=' + payload.uploadToken + '&dl=1';
      (function downloadViaSW() {
        var port = chrome.runtime.connect({ name: 'dl-' + Date.now() });
        var chunks = [];
        var totalSize = 0;
        var timer = setTimeout(function() {
          console.error('[EncodeX] SW download timeout');
          downloadViaXHR(0);
        }, 10000);
        port.onMessage.addListener(function(msg) {
          if (msg.type === 'totalSize') { totalSize = msg.totalSize; }
          else if (msg.type === 'chunk') {
            chunks.push(msg.data);
            if (totalSize) respond('DOWNLOAD_PROGRESS', { label: 'Downloading...', percent: 80 + Math.round(chunks.reduce(function(s,c){return s+c.byteLength;},0)/totalSize*15) });
          }
          else if (msg.type === 'done') {
            clearTimeout(timer);
            respond('DOWNLOAD_PROGRESS', { label: 'Downloading...', percent: 95 });
            respond('DOWNLOAD_RESULT', { ok: true, buffer: new Blob(chunks, { type: 'video/mp4' }), _usageToken: payload.usageToken });
          }
          else if (msg.type === 'error') {
            clearTimeout(timer);
            console.error('[EncodeX] SW error:', msg.error);
            downloadViaXHR(0);
          }
        });
        port.postMessage({ action: 'DOWNLOAD_CHUNKED', url: url });
      })();
      function downloadViaXHR(retries) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.timeout = 480000;
        xhr.onprogress = function(e) {
          if (e.lengthComputable) respond('DOWNLOAD_PROGRESS', { label: 'Downloading...', percent: 80 + Math.round(e.loaded / e.total * 15) });
        };
        xhr.onload = function() {
          if (xhr.status !== 200) {
            if (retries < 2) { setTimeout(function() { downloadViaXHR(retries + 1); }, 2000); return; }
            return respond('DOWNLOAD_RESULT', { ok: false, error: 'HTTP ' + xhr.status });
          }
          respond('DOWNLOAD_RESULT', { ok: true, buffer: xhr.response, _usageToken: payload.usageToken });
        };
        xhr.onerror = function() {
          console.error('[EncodeX] XHR error:', xhr.status, xhr.statusText);
          if (retries < 2) { setTimeout(function() { downloadViaXHR(retries + 1); }, 2000); return; }
          respond('DOWNLOAD_RESULT', { ok: false, error: 'Network error' });
        };
        xhr.ontimeout = function() {
          if (retries < 2) { setTimeout(function() { downloadViaXHR(retries + 1); }, 5000); return; }
          respond('DOWNLOAD_RESULT', { ok: false, error: 'Timeout' });
        };
        xhr.send();
      }
      break;
    }

    case 'TRANSFORM': {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SERVER + '/api/transform');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000;
      xhr.onload = function() {
        try {
          var d = JSON.parse(xhr.responseText);
          respond('TRANSFORM_RESULT', { body: d.body || null, _tid: payload._tid });
        } catch(e) { respond('TRANSFORM_RESULT', { body: null, _tid: payload._tid }); }
      };
      xhr.onerror = function() { respond('TRANSFORM_RESULT', { body: null, _tid: payload._tid }); };
      xhr.ontimeout = function() { respond('TRANSFORM_RESULT', { body: null, _tid: payload._tid }); };
      xhr.send(JSON.stringify({ body: payload.body, url: payload.url }));
      break;
    }

    case 'COMMIT': {
      getTokenFromStorage().then(function(token) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', SERVER + '/api/process/commit');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.onload = function() { respond('COMMIT_RESULT', {}); };
        xhr.onerror = function() { respond('COMMIT_RESULT', {}); };
        xhr.send(JSON.stringify({ token: payload.usageToken }));
      });
      break;
    }
  }
});

function respond(type, payload) {
  window.postMessage({ source: 'encodex-content', type: type, payload: payload }, '*');
}

// Initialization
function initApp() {
  chrome.storage.local.get("theme", function(data) {
    var theme = data.theme || "midnight-black";
    document.body.classList.add("theme-" + theme);
  });
  checkAndInject();
  injectHDStyles();
  injectHDButtons();
  setInterval(injectHDButtons, 1500);
}

var observer = new MutationObserver(function() { checkAndInject(); });
if (document.body) observer.observe(document.body, { childList: true, subtree: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() { addBadgeToPage(); initApp(); });
} else {
  addBadgeToPage();
  initApp();
}
