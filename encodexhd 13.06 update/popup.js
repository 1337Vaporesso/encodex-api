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
    console.error('[EncodeX] WASM error:', e);
    return false;
  }
}

/* ═══ Elements ═══ */
const $ = id => document.getElementById(id);
const fileInput = $('fileInput');
const uploadTrigger = $('uploadTrigger');
const patchBtn = $('patchBtn');
const fileNameDisplay = $('fileNameDisplay');
const statusText = $('statusText');
const statusBox = $('status');
const patchProgress = $('patchProgress');
const patchProgressBar = $('patchProgressBar');

/* ═══ Helpers ═══ */
const FORMATS = { mp4:'MP4', mov:'MOV', avi:'AVI', mkv:'MKV', webm:'WebM', flv:'FLV' };
function getFmt(n) { const e = n.split('.').pop().toLowerCase(); return FORMATS[e] || null; }
function fmtSize(b) { return b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB'; }

function setStatus(msg, state) {
  statusText.textContent = msg;
  statusBox.dataset.state = state || 'idle';
}

function setProgress(pct) {
  patchProgress.classList.add('visible');
  patchProgressBar.style.width = Math.min(100, pct) + '%';
}

/* ═══ Premium UI ═══ */
function updatePremiumUI() {
  const auth = window.__ENCODEX_AUTH;
  const prem = auth && !!auth._a;
  $('patcherLockBadge').hidden = prem;
  $('patcherActiveBadge').hidden = !prem;
  patchBtn.disabled = !prem || !selectedFile;
  patchBtn.classList.toggle('enabled', prem && !!selectedFile);
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
  fileNameDisplay.textContent = `${file.name} (${fmtSize(file.size)})`;
  fileNameDisplay.classList.add('has-file', 'size-warn');
  fileNameDisplay.classList.toggle('size-warn', file.size <= 209715200);
  fileNameDisplay.classList.toggle('size-danger', file.size > 209715200);
  updatePremiumUI();
  setStatus(`Ready: ${file.name} (${fmt}). Click Patch & Download.`, 'idle');
}

/* ═══ Patching ═══ */
async function patchVideo(e) {
  e.stopPropagation();
  if (!selectedFile || !wasmPatcher) return;
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
    setStatus('Success! Video patched and downloaded.', 'success');
    setTimeout(() => { patchProgress.classList.remove('visible'); patchProgressBar.style.width = '0%'; }, 3500);
  } catch (err) {
    setStatus('Error: ' + (err.message || err), 'error');
    patchProgress.classList.remove('visible');
  }
}

/* ═══ Events ═══ */
uploadTrigger.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) selectFile(fileInput.files[0]); });
uploadTrigger.addEventListener('dragover', e => { e.preventDefault(); uploadTrigger.classList.add('drag-over'); });
uploadTrigger.addEventListener('dragleave', () => uploadTrigger.classList.remove('drag-over'));
uploadTrigger.addEventListener('drop', e => {
  e.preventDefault();
  uploadTrigger.classList.remove('drag-over');
  if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0]);
});
patchBtn.addEventListener('click', patchVideo);

/* ═══ Init ═══ */
addEventListener('DOMContentLoaded', async () => {
  let ready = false;
  const waitAuth = setInterval(() => {
    if (window.__ENCODEX_AUTH) {
      clearInterval(waitAuth);
      updatePremiumUI();
      // Watch for premium state changes
      const orig = window.__ENCODEX_AUTH;
      let cur = orig._a;
      setInterval(() => {
        if (window.__ENCODEX_AUTH && window.__ENCODEX_AUTH._a !== cur) {
          cur = window.__ENCODEX_AUTH._a;
          updatePremiumUI();
        }
      }, 1000);
    }
  }, 100);
  const ok = await initWasmPatcher();
  if (ok) {
    setProgress(0);
    setStatus('Ready — drop a video to start.', 'idle');
  } else {
    setStatus('Failed to load patcher. Reload extension.', 'error');
  }
});
