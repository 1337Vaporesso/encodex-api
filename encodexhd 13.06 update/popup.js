let wasmPatcher = null;
let selectedFile = null;

/* ═══ WasmPatcher ═══ */
async function initWasmPatcher() {
  try {
    const res = await fetch(chrome.runtime.getURL('patcher.wasm'));
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const mem = instance.exports.memory;
    const patch = instance.exports.patch;
    wasmPatcher = {
      patch(buf) {
        const src = new Uint8Array(buf);
        const len = src.byteLength;
        const need = Math.ceil(len / 65536);
        const cur = mem.buffer.byteLength / 65536;
        if (need > cur) mem.grow(need - cur);
        new Uint8Array(mem.buffer, 0, len).set(src);
        patch(len);
        return new Uint8Array(mem.buffer, 0, len).buffer;
      }
    };
    return true;
  } catch (e) {
    console.error('[EncodeX] WASM:', e);
    return false;
  }
}

/* ═══ Elements ═══ */
const fileInput = document.getElementById('fileInput');
const uploadTrigger = document.getElementById('uploadTrigger');
const patchBtn = document.getElementById('patchBtn');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const statusText = document.getElementById('statusText');
const statusBox = document.getElementById('status');
const patchProgress = document.getElementById('patchProgress');
const patchProgressBar = document.getElementById('patchProgressBar');

/* ═══ Helpers ═══ */
const FORMATS = { mp4:'MP4', mov:'MOV', avi:'AVI', mkv:'MKV' };
function getFmt(n) { const e = n.split('.').pop().toLowerCase(); return FORMATS[e] || null; }
function fmtSize(b) { return (b/1048576).toFixed(1)+' MB'; }

function setStatus(msg, state) {
  statusText.textContent = msg;
  statusBox.dataset.state = state || 'idle';
}

function setProgress(pct) {
  patchProgress.classList.add('visible');
  patchProgressBar.style.width = Math.min(100, pct) + '%';
}

/* ═══ Premium UI (visual only, blocking done by runtime.js) ═══ */
function updatePremiumUI() {
  const auth = window.__ENCODEX_AUTH;
  const prem = auth && !!auth._a;
  const lock = document.getElementById('patcherLockBadge');
  const act = document.getElementById('patcherActiveBadge');
  if (lock) lock.hidden = prem;
  if (act) act.hidden = !prem;
  // Enable button when file selected; runtime.js blocks non-premium via capture handler
  patchBtn.disabled = !selectedFile;
  patchBtn.classList.toggle('enabled', !!selectedFile);
}

/* ═══ File selection ═══ */
function selectFile(file) {
  const fmt = getFmt(file.name);
  if (!fmt) {
    setStatus('Unsupported format. Use MP4, MOV, AVI, or MKV.', 'error');
    selectedFile = null; updatePremiumUI(); return;
  }
  if (file.size > 314572800) {
    setStatus('File exceeds 300 MB limit.', 'error');
    selectedFile = null; updatePremiumUI(); return;
  }
  selectedFile = file;
  fileNameDisplay.textContent = file.name + ' (' + fmtSize(file.size) + ')';
  fileNameDisplay.classList.add('has-file');
  fileNameDisplay.classList.remove('size-warn', 'size-danger');
  if (file.size > 209715200) fileNameDisplay.classList.add('size-danger');
  else if (file.size > 104857600) fileNameDisplay.classList.add('size-warn');
  updatePremiumUI();
  setStatus('Ready: ' + file.name + ' (' + fmt + ').', 'idle');
}

/* ═══ Patching ═══ */
async function patchVideo() {
  if (!selectedFile) { setStatus('No file selected.', 'error'); return; }
  if (!wasmPatcher) { setStatus('Patcher not loaded.', 'error'); return; }
  const auth = window.__ENCODEX_AUTH;
  if (!auth || !auth._a) { setStatus('Premium required.', 'error'); return; }
  setProgress(0);
  setStatus('Reading file...', 'processing');
  let buffer;
  try { buffer = await selectedFile.arrayBuffer(); } catch (err) {
    setStatus('Failed to read file.', 'error'); return;
  }
  setProgress(35);
  setStatus('Patching video...', 'processing');
  try {
    const patched = wasmPatcher.patch(buffer);
    setProgress(70);
    const blob = new Blob([patched], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name.replace(/\.[^/.]+$/, '') + '_patched.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setProgress(100);
    setStatus('Done! Video patched and downloaded.', 'success');
    setTimeout(function() { patchProgress.classList.remove('visible'); patchProgressBar.style.width = '0%'; }, 3500);
  } catch (err) {
    setStatus('Error: ' + (err.message || err), 'error');
    patchProgress.classList.remove('visible');
  }
}

/* ═══ Events ═══ */
uploadTrigger.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function() { if (fileInput.files && fileInput.files[0]) selectFile(fileInput.files[0]); });
uploadTrigger.addEventListener('dragover', function(e) { e.preventDefault(); uploadTrigger.classList.add('drag-over'); });
uploadTrigger.addEventListener('dragleave', function() { uploadTrigger.classList.remove('drag-over'); });
uploadTrigger.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadTrigger.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});
patchBtn.addEventListener('click', patchVideo);

/* ═══ Init ═══ */
(function boot() {
  // Start WASM init immediately
  initWasmPatcher().then(function(ok) {
    if (ok) {
      setProgress(0);
      setStatus('Ready — select a video.', 'idle');
    } else {
      setStatus('Patcher failed to load. Reload extension.', 'error');
    }
  });

  // Poll for __ENCODEX_AUTH (set by runtime.js after session check)
  var waitAuth = setInterval(function() {
    if (window.__ENCODEX_AUTH) {
      clearInterval(waitAuth);
      updatePremiumUI();
      var prev = window.__ENCODEX_AUTH._a;
      setInterval(function() {
        if (window.__ENCODEX_AUTH && window.__ENCODEX_AUTH._a !== prev) {
          prev = window.__ENCODEX_AUTH._a;
          updatePremiumUI();
        }
      }, 2000);
    }
  }, 200);
  // Also check on first frame in case auth already set
  updatePremiumUI();
})();
