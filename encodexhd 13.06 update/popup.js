const fileInput = document.getElementById("fileInput");
const patchBtn = document.getElementById("patchBtn");
const openTabBtn = document.getElementById("openTabBtn");
const statusEl = document.getElementById("status");
const sizeWarningEl = document.getElementById("sizeWarning");
const sizeWarningCloseBtn = document.getElementById("sizeWarningClose");
const langBtns = Array.from(document.querySelectorAll("[data-lang]"));
const i18nEls = Array.from(document.querySelectorAll("[data-i18n]"));
const LANG_KEY = "cleanUploaderLang";
const SIZE_WARNING_BYTES = 94371840;
const COPY = {
  en: {
    title: "Shark Uploader",
    subtitle: "Local MP4 patch + upload metadata bypass",
    method: "EncodeX HD method",
    selectVideo: "Select video",
    openTab: "Open in new tab",
    patchDownload: "Patch & Download",
    ready: "Ready",
    processing: "Processing",
    done: "Done",
    error: "Error",
    selected: "Ready: {name}",
    scanning: "Processing MP4...",
    downloaded: "Done: file downloaded",
    failed: "Error: {message}",
    sizeWarningKicker: "File size warning",
    sizeWarningTitle: "Video over 90 MB",
    sizeWarningBody: "Your video is bigger than 90 MB. It may flop because of that. It is HIGHLY recommended to compress it more.",
    close: "Close"
  },
  pt: {
    title: "Shark Uploader",
    subtitle: "Patch local de MP4 + limpeza de metadados do bypass",
    method: "EncodeX HD method",
    selectVideo: "Selecionar video",
    openTab: "Abrir em nova aba",
    patchDownload: "Patch & Download",
    ready: "Pronto",
    processing: "Processando",
    done: "Concluido",
    error: "Erro",
    selected: "Pronto: {name}",
    scanning: "Processando MP4...",
    downloaded: "Concluido: arquivo baixado",
    failed: "Erro: {message}",
    sizeWarningKicker: "Aviso de tamanho",
    sizeWarningTitle: "Video acima de 90 MB",
    sizeWarningBody: "Seu video tem mais de 90 MB. Ele pode flopar por causa disso. E ALTAMENTE recomendado comprimir mais.",
    close: "Fechar"
  }
};
let selectedFile = null;
let currentLang = "en";
let currentStatus = {
  key: "ready",
  state: "idle",
  values: {}
};
function formatCopy(_0x56ecf4, _0x2390c5 = {}) {
  return String(_0x56ecf4 || "").replace(/\{(\w+)\}/g, (_0x3ebec1, _0x16c3a1) => _0x2390c5[_0x16c3a1] ?? "");
}
function t(_0x8a6e7f, _0x394601 = {}) {
  return formatCopy(COPY[currentLang] && COPY[currentLang][_0x8a6e7f] || COPY.en[_0x8a6e7f] || _0x8a6e7f, _0x394601);
}
function persistLanguage(_0xd9020c) {
  try {
    localStorage.setItem(LANG_KEY, _0xd9020c);
  } catch (_0x5a7779) {}
}
function getSavedLanguage() {
  try {
    const _0x3833a7 = localStorage.getItem(LANG_KEY);
    if (_0x3833a7 === "pt" || _0x3833a7 === "en") {
      return _0x3833a7;
    } else {
      return "en";
    }
  } catch (_0x4ccdc9) {
    return "en";
  }
}
function setStatus(_0x40613e, _0x1603db = "idle", _0x27dca9 = {}) {
  const _0x5b5894 = {
    key: _0x40613e,
    state: _0x1603db,
    values: _0x27dca9
  };
  currentStatus = _0x5b5894;
  statusEl.textContent = t(_0x40613e, _0x27dca9);
  statusEl.dataset.state = _0x1603db;
}
function setLanguage(_0x585175) {
  currentLang = _0x585175 === "pt" ? "pt" : "en";
  document.documentElement.lang = currentLang;
  i18nEls.forEach(_0x1461ca => {
    const _0x5744bd = _0x1461ca.dataset.i18n;
    _0x1461ca.textContent = t(_0x5744bd);
  });
  fileInput.setAttribute("aria-label", t("selectVideo"));
  langBtns.forEach(_0x3fb538 => {
    const _0x16431c = _0x3fb538.dataset.lang === currentLang;
    _0x3fb538.classList.toggle("is-active", _0x16431c);
    _0x3fb538.setAttribute("aria-pressed", String(_0x16431c));
  });
  setStatus(currentStatus.key, currentStatus.state, currentStatus.values);
  persistLanguage(currentLang);
}
function showSizeWarning() {
  sizeWarningEl.hidden = false;
}
function hideSizeWarning() {
  sizeWarningEl.hidden = true;
}
const uploadTriggerBtn = document.getElementById("uploadTrigger");
const fileNameDisplay = document.getElementById("fileNameDisplay");
if (uploadTriggerBtn) {
  uploadTriggerBtn.addEventListener("click", () => {
    fileInput.click();
  });
}
fileInput.addEventListener("change", _0x3c5742 => {
  selectedFile = _0x3c5742.target.files && _0x3c5742.target.files[0] ? _0x3c5742.target.files[0] : null;
  if (selectedFile) {
    patchBtn.disabled = false;
    patchBtn.classList.add("enabled");
    document.body.classList.add("has-file");
    if (fileNameDisplay) {
      fileNameDisplay.textContent = selectedFile.name;
      fileNameDisplay.classList.add("has-file");
    }
    const _0x16365e = {
      name: selectedFile.name
    };
    setStatus("selected", "idle", _0x16365e);
    if (selectedFile.size > SIZE_WARNING_BYTES) {
      showSizeWarning();
    } else {
      hideSizeWarning();
    }
  } else {
    patchBtn.disabled = true;
    patchBtn.classList.remove("enabled");
    document.body.classList.remove("has-file");
    if (fileNameDisplay) {
      fileNameDisplay.textContent = "No file selected...";
      fileNameDisplay.classList.remove("has-file");
    }
    hideSizeWarning();
    setStatus("ready", "idle");
  }
});
if (openTabBtn) {
  openTabBtn.addEventListener("click", () => {
    const _0x15886a = chrome.runtime.getURL("popup.html");
    const _0x4c785f = {
      url: _0x15886a
    };
    chrome.tabs.create(_0x4c785f);
  });
}
patchBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  setStatus("scanning", "processing");
  try {
    const buf = await selectedFile.arrayBuffer();
    const result = await window.patchFile(buf);
    const blob = new Blob([result.output], { type: selectedFile.type || "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = selectedFile.name.replace(/\.[^/.]+$/, "");
    a.download = name + "_encodexhd_bypassed.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("downloaded", "success");
    const tiktokBtn = document.getElementById("tiktokUploadBtn");
    if (tiktokBtn) tiktokBtn.style.display = "inline-flex";
  } catch (err) {
    setStatus("failed", "error", {
      message: err && err.message ? err.message : "unknown error"
    });
  }
});
langBtns.forEach(_0x2d543a => {
  _0x2d543a.addEventListener("click", () => {
    setLanguage(_0x2d543a.dataset.lang);
  });
});
sizeWarningCloseBtn.addEventListener("click", hideSizeWarning);
setLanguage(getSavedLanguage());
document.querySelectorAll(".nav-btn[data-page]").forEach(_0x38e564 => {
  _0x38e564.addEventListener("click", () => {
    const _0x38db7c = _0x38e564.dataset.page;
    document.querySelectorAll(".nav-btn").forEach(_0x3442ec => _0x3442ec.classList.remove("active"));
    _0x38e564.classList.add("active");
    document.querySelectorAll(".page-view").forEach(_0x4146ad => _0x4146ad.classList.remove("active"));
    const _0x48e950 = document.getElementById("page-" + _0x38db7c);
    if (_0x48e950) {
      _0x48e950.classList.add("active");
    }
  });
});

