/* ═══ JS Patcher (RYU-style) ═══ */
var selectedFile = null;

/* ═══ Elements ═══ */
var fileInput = document.getElementById('fileInput');
var uploadTrigger = document.getElementById('uploadTrigger');
var patchBtn = document.getElementById('patchBtn');
var fileNameDisplay = document.getElementById('fileNameDisplay');
var statusText = document.getElementById('statusText');
var statusBox = document.getElementById('status');
var patchProgress = document.getElementById('patchProgress');
var patchProgressBar = document.getElementById('patchProgressBar');

/* ═══ Helpers ═══ */
function getFmt(n) {
  var e = n.split('.').pop().toLowerCase();
  return { mp4:'MP4', mov:'MOV', avi:'AVI', mkv:'MKV' }[e] || null;
}

function setStatus(msg, state) {
  statusText.textContent = msg;
  statusBox.dataset.state = state || 'idle';
}

function setProgress(pct) {
  patchProgress.classList.add('visible');
  patchProgressBar.style.width = Math.min(100, pct) + '%';
}

/* ═══ File selection ═══ */
function selectFile(file) {
  var fmt = getFmt(file.name);
  if (!fmt) {
    setStatus('Unsupported format.', 'error');
    selectedFile = null;
    patchBtn.disabled = true;
    patchBtn.classList.remove('enabled');
    return;
  }
  if (file.size > 314572800) {
    setStatus('File exceeds 300 MB limit.', 'error');
    selectedFile = null;
    patchBtn.disabled = true;
    patchBtn.classList.remove('enabled');
    return;
  }
  selectedFile = file;
  fileNameDisplay.textContent = file.name + ' (' + (file.size/1048576).toFixed(1) + ' MB)';
  fileNameDisplay.classList.add('has-file');
  fileNameDisplay.classList.remove('size-warn', 'size-danger');
  if (file.size > 209715200) fileNameDisplay.classList.add('size-danger');
  else if (file.size > 104857600) fileNameDisplay.classList.add('size-warn');
  patchBtn.disabled = false;
  patchBtn.classList.add('enabled');
  setStatus('Ready: ' + file.name + ' (' + fmt + '). Click Patch & Download.', 'idle');
}

/* ═══ Patching ═══ */
async function patchVideo() {
  if (!selectedFile) { setStatus('No file selected.', 'error'); return; }
  setProgress(0);
  setStatus('Reading file...', 'processing');
  var buffer;
  try { buffer = await selectedFile.arrayBuffer(); } catch (e) {
    setStatus('Failed to read file: ' + e.message, 'error'); return;
  }
  setProgress(35);
  setStatus('Patching video...', 'processing');
  try {
    var patched = patchFile(buffer);
    setProgress(70);
    var blob = new Blob([patched], { type: 'video/mp4' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name.replace(/\.[^/.]+$/, '') + '_patched.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setProgress(100);
    setStatus('Success! Video patched and downloaded.', 'success');
    setTimeout(function() {
      patchProgress.classList.remove('visible');
      patchProgressBar.style.width = '0%';
    }, 3500);
  } catch (e) {
    setStatus('Error: ' + (e.message || e), 'error');
    patchProgress.classList.remove('visible');
  }
}

/* ═══ Events ═══ */
uploadTrigger.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function() {
  if (fileInput.files && fileInput.files[0]) selectFile(fileInput.files[0]);
});
uploadTrigger.addEventListener('dragover', function(e) { e.preventDefault(); uploadTrigger.classList.add('drag-over'); });
uploadTrigger.addEventListener('dragleave', function() { uploadTrigger.classList.remove('drag-over'); });
uploadTrigger.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadTrigger.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});
patchBtn.addEventListener('click', patchVideo);

/* ═══ Boot ═══ */
setStatus('Ready — select a video.', 'idle');
