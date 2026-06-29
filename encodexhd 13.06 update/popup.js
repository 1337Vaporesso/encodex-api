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
    scanning: "Processing: rebuilding MP4 sample tables",
    patched: "Processing: {realSamples}+{fakeSamples} video samples. Downloading",
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
    scanning: "Processando: reconstruindo tabelas MP4",
    patched: "Processando: {realSamples}+{fakeSamples} samples de video. Baixando",
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
const ffmpegFileInput = document.getElementById("ffmpegFileInput");
const ffmpegUploadTrigger = document.getElementById("ffmpegUploadTrigger");
const ffmpegFileNameDisp = document.getElementById("ffmpegFileNameDisplay");
const ffmpegPatchBtn = document.getElementById("ffmpegPatchBtn");
const ffmpegStatusEl = document.getElementById("ffmpegStatus");
const ffmpegProgress = document.getElementById("ffmpegProgress");
const ffmpegProgressBar = document.getElementById("ffmpegProgressBar");
const ffmpegTiktokBtn = document.getElementById("ffmpegTiktokBtn");
const srcFpsDisplay = document.getElementById("srcFpsDisplay");
const ratioDisplay = document.getElementById("ratioDisplay");
const outFpsDisplay = document.getElementById("outFpsDisplay");
const cmdPreview = document.getElementById("cmdPreview");
let ffmpegSelectedFile = null;
let selectedFpsRatio = 0.5;
let detectedFps = null;
document.querySelectorAll(".fps-btn").forEach(_0x2eb23a => {
  _0x2eb23a.addEventListener("click", () => {
    document.querySelectorAll(".fps-btn").forEach(_0x241b41 => _0x241b41.classList.remove("active"));
    _0x2eb23a.classList.add("active");
    selectedFpsRatio = parseFloat(_0x2eb23a.dataset.fps);
    ratioDisplay.textContent = selectedFpsRatio + "×";
    updateFpsDisplays();
    updateCmdPreview();
  });
});
function updateFpsDisplays() {
  if (detectedFps) {
    const _0x3f18b4 = +(detectedFps * selectedFpsRatio).toFixed(4);
    srcFpsDisplay.textContent = detectedFps + " fps";
    outFpsDisplay.textContent = _0x3f18b4 + " fps";
  } else {
    srcFpsDisplay.textContent = "—";
    outFpsDisplay.textContent = "—";
  }
}
function updateCmdPreview() {
  const _0x11a76d = selectedFpsRatio;
  const _0x14a6f0 = ffmpegSelectedFile ? ffmpegSelectedFile.name.replace(/\.[^/.]+$/, "") : "input";
  const _0x5e3e03 = detectedFps ? +(detectedFps * _0x11a76d).toFixed(4) : "(src×" + _0x11a76d + ")";
  const _0x1ba58c = +(1 / _0x11a76d).toFixed(4);
  cmdPreview.innerHTML = "ffmpeg -i <span style='color:#f0900a'>" + _0x14a6f0 + ".mp4</span> " + ("-vf \"fps=fps=<span style='color:#3b9eff'>" + _0x5e3e03 + "</span>,setpts=<span style='color:#3b9eff'>" + _0x1ba58c + "</span>*PTS\" ") + "-c:v libx264 -crf 18 -c:a copy " + ("<span style='color:#22d97a'>" + _0x14a6f0 + "_fps" + _0x11a76d + "x_encodexhd.mp4</span>");
}
function setFfmpegStatus(_0x4dddbb, _0xbd1205 = "idle") {
  ffmpegStatusEl.textContent = _0x4dddbb;
  ffmpegStatusEl.dataset.state = _0xbd1205;
}
function detectFpsFromBuffer(_0x287ca7) {
  try {
    const _0x425f34 = new Uint8Array(_0x287ca7);
    const _0xabde7a = new DataView(_0x287ca7);
    const _0x2a04dd = parseBoxes(_0x425f34, _0xabde7a);
    const _0x2b974d = findTopLevel(_0x2a04dd, "moov");
    if (!_0x2b974d) {
      return null;
    }
    const _0x2e1023 = _0x2b974d.children.find(_0x2c865a => _0x2c865a.type === "trak" && handlerTypeForTrak(_0x2c865a) === "vide");
    if (!_0x2e1023) {
      return null;
    }
    const _0x3c7b17 = findDescendant(_0x2e1023, ["mdia", "mdhd"]);
    if (!_0x3c7b17) {
      return null;
    }
    const _0x1a6699 = _0x3c7b17.data[_0x3c7b17.contentStart];
    let _0x27d482;
    if (_0x1a6699 === 1) {
      _0x27d482 = _0x3c7b17.view.getUint32(_0x3c7b17.contentStart + 20, false);
    } else {
      _0x27d482 = _0x3c7b17.view.getUint32(_0x3c7b17.contentStart + 12, false);
    }
    if (!_0x27d482) {
      return null;
    }
    const _0x216041 = findDescendant(_0x2e1023, ["mdia", "minf", "stbl"]);
    if (!_0x216041) {
      return null;
    }
    const _0x463846 = findChild(_0x216041, "stts");
    if (!_0x463846) {
      return null;
    }
    const _0x5be056 = _0x463846.view.getUint32(_0x463846.contentStart + 4, false);
    if (_0x5be056 < 1) {
      return null;
    }
    const _0x3eedcb = _0x463846.view.getUint32(_0x463846.contentStart + 8 + 4, false);
    if (!_0x3eedcb) {
      return null;
    }
    return Math.round(_0x27d482 / _0x3eedcb * 1000) / 1000;
  } catch (_0x398fbd) {
    return null;
  }
}
ffmpegUploadTrigger.addEventListener("click", () => ffmpegFileInput.click());
ffmpegFileInput.addEventListener("change", async _0x519e5e => {
  ffmpegSelectedFile = _0x519e5e.target.files && _0x519e5e.target.files[0] ? _0x519e5e.target.files[0] : null;
  if (!ffmpegSelectedFile) {
    ffmpegFileNameDisp.textContent = "No file selected...";
    ffmpegFileNameDisp.classList.remove("has-file");
    ffmpegPatchBtn.disabled = true;
    ffmpegPatchBtn.classList.remove("enabled");
    detectedFps = null;
    updateFpsDisplays();
    updateCmdPreview();
    setFfmpegStatus("Ready — select a video to begin.", "idle");
    return;
  }
  ffmpegFileNameDisp.textContent = ffmpegSelectedFile.name;
  ffmpegFileNameDisp.classList.add("has-file");
  setFfmpegStatus("Detecting FPS…", "processing");
  try {
    const _0x2c4b64 = ffmpegSelectedFile.slice(0, 524288);
    const _0xaedeb8 = await _0x2c4b64.arrayBuffer();
    detectedFps = detectFpsFromBuffer(_0xaedeb8);
  } catch (_0x4fe80f) {
    detectedFps = null;
  }
  updateFpsDisplays();
  updateCmdPreview();
  const _0x3c92d7 = detectedFps ? detectedFps + " fps" : "FPS unknown";
  setFfmpegStatus("Ready: " + ffmpegSelectedFile.name + " — " + _0x3c92d7, "idle");
  ffmpegPatchBtn.disabled = false;
  ffmpegPatchBtn.classList.add("enabled");
  if (ffmpegSelectedFile.size > 94371840) {
    showSizeWarning();
  }
});
ffmpegPatchBtn.addEventListener("click", async () => {
  if (!ffmpegSelectedFile) {
    return;
  }
  setFfmpegStatus("Reading file…", "processing");
  ffmpegProgress.classList.add("visible");
  ffmpegProgressBar.style.width = "10%";
  ffmpegTiktokBtn.style.display = "none";
  try {
    const _0x2e0b48 = await ffmpegSelectedFile.arrayBuffer();
    ffmpegProgressBar.style.width = "35%";
    setFfmpegStatus("Patching FPS metadata…", "processing");
    const _0x32493c = patchFpsMetadata(_0x2e0b48, selectedFpsRatio);
    ffmpegProgressBar.style.width = "80%";
    setFfmpegStatus("Saving file…", "processing");
    const _0x1b5b19 = {
      type: ffmpegSelectedFile.type || "video/mp4"
    };
    const _0x28f0aa = new Blob([_0x32493c.output], _0x1b5b19);
    const _0x44db25 = URL.createObjectURL(_0x28f0aa);
    const _0x9da916 = document.createElement("a");
    _0x9da916.href = _0x44db25;
    const _0x2fb0c4 = ffmpegSelectedFile.name.replace(/\.[^/.]+$/, "");
    _0x9da916.download = _0x2fb0c4 + "_fps" + selectedFpsRatio + "x_encodexhd.mp4";
    document.body.appendChild(_0x9da916);
    _0x9da916.click();
    _0x9da916.remove();
    URL.revokeObjectURL(_0x44db25);
    ffmpegProgressBar.style.width = "100%";
    const _0x53e4dd = _0x32493c.originalFps ? +(_0x32493c.originalFps * selectedFpsRatio).toFixed(4) : "?";
    setFfmpegStatus("Done: FPS patched " + (_0x32493c.originalFps || "?") + " → " + _0x53e4dd + " fps · File downloaded.", "success");
    ffmpegTiktokBtn.style.display = "inline-flex";
    setTimeout(() => {
      ffmpegProgress.classList.remove("visible");
      ffmpegProgressBar.style.width = "0%";
    }, 2000);
  } catch (_0x674137) {
    ffmpegProgressBar.style.width = "100%";
    ffmpegProgressBar.style.background = "var(--red)";
    setFfmpegStatus("Error: " + (_0x674137 && _0x674137.message ? _0x674137.message : "unknown error"), "error");
    setTimeout(() => {
      ffmpegProgress.classList.remove("visible");
      ffmpegProgressBar.style.width = "0%";
      ffmpegProgressBar.style.background = "var(--blue)";
    }, 2000);
  }
});
function patchFpsMetadata(_0x49ca7e, _0x47159d) {
  const _0x2fffdb = _0x49ca7e.slice(0);
  const _0x35e576 = new Uint8Array(_0x2fffdb);
  const _0x2804d2 = new DataView(_0x2fffdb);
  const _0x25fcca = parseBoxes(_0x35e576, _0x2804d2);
  const _0x3a80b4 = findTopLevel(_0x25fcca, "moov");
  if (!_0x3a80b4) {
    throw new Error("No moov box found. Make sure this is a valid MP4.");
  }
  const _0x2125ed = _0x3a80b4.children.find(_0xfc63e4 => _0xfc63e4.type === "trak" && handlerTypeForTrak(_0xfc63e4) === "vide");
  if (!_0x2125ed) {
    throw new Error("No video track found.");
  }
  const _0x41e67c = findDescendant(_0x2125ed, ["mdia", "mdhd"]);
  if (!_0x41e67c) {
    throw new Error("No mdhd box found in video track.");
  }
  const _0x36b02a = _0x35e576[_0x41e67c.contentStart];
  let _0x3fa738;
  if (_0x36b02a === 1) {
    _0x3fa738 = _0x2804d2.getUint32(_0x41e67c.contentStart + 20, false);
  } else {
    _0x3fa738 = _0x2804d2.getUint32(_0x41e67c.contentStart + 12, false);
  }
  if (!_0x3fa738) {
    throw new Error("Invalid timescale in mdhd.");
  }
  const _0x19ba7d = findDescendant(_0x2125ed, ["mdia", "minf", "stbl"]);
  if (!_0x19ba7d) {
    throw new Error("No stbl box found in video track.");
  }
  const _0x202737 = findChild(_0x19ba7d, "stts");
  if (!_0x202737) {
    throw new Error("No stts box found in video track.");
  }
  const _0x4ff4d0 = _0x2804d2.getUint32(_0x202737.contentStart + 4, false);
  if (_0x4ff4d0 < 1) {
    throw new Error("stts has no entries.");
  }
  let _0xc627de = null;
  let _0x353bcf = 0;
  for (let _0x3443a1 = 0; _0x3443a1 < _0x4ff4d0; _0x3443a1++) {
    const _0x4424b4 = _0x202737.contentStart + 8 + _0x3443a1 * 8 + 4;
    const _0x39563d = _0x2804d2.getUint32(_0x4424b4, false);
    if (_0x39563d === 0) {
      continue;
    }
    const _0x32d0e4 = Math.round(_0x3fa738 / _0x39563d * 1000) / 1000;
    if (_0x32d0e4 < 1 || _0x32d0e4 > 300) {
      continue;
    }
    if (!_0xc627de) {
      _0xc627de = _0x32d0e4;
    }
    const _0x40dfa4 = Math.round(_0x39563d / _0x47159d);
    _0x2804d2.setUint32(_0x4424b4, _0x40dfa4, false);
    _0x353bcf++;
  }
  if (_0x353bcf === 0) {
    throw new Error("No patchable stts entries found. Make sure this is a valid MP4.");
  }
  const _0x9ae485 = {
    output: _0x35e576,
    originalFps: _0xc627de,
    patched: _0x353bcf
  };
  return _0x9ae485;
}
updateCmdPreview();