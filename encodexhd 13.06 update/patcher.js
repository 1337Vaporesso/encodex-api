(function(){
var API = 'https://encodex-api-production.up.railway.app';
var fileInput = document.getElementById('fileInput');
var ffmpegInput = document.getElementById('ffmpegFileInput');
var fileName = document.getElementById('fileNameDisplay');
var ffmpegName = document.getElementById('ffmpegFileNameDisplay');
var patchBtn = document.getElementById('patchBtn');
var ffmpegBtn = document.getElementById('ffmpegPatchBtn');
var uploadTrigger = document.getElementById('uploadTrigger');
var ffmpegUpload = document.getElementById('ffmpegUploadTrigger');

function _c(msg, type) {
  var t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

patchBtn.addEventListener('click', function() { processVideo('quick'); });
ffmpegBtn.addEventListener('click', function() { processVideo('ffmpeg'); });

function processVideo(mode) {
  var input = mode === 'quick' ? fileInput : ffmpegInput;
  var file = input.files[0];
  if (!file) { _c('Select a video first', 'error'); return; }
  var btn = mode === 'quick' ? patchBtn : ffmpegBtn;
  var oldText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Processing...';
  chrome.storage.local.get('encodex_token', function(r) {
    if (!r || !r.encodex_token) { btn.disabled = false; btn.textContent = oldText; _c('Login required', 'error'); return; }
    var fd = new FormData();
    fd.append('video', file);
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 120000);
    fetch(API + '/api/process/' + mode, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + r.encodex_token },
      body: fd,
      signal: controller.signal
    }).then(function(r2) {
      clearTimeout(timeout);
      if (!r2.ok) { throw new Error('Server error: ' + r2.status); }
      return r2.blob();
    }).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'encoded_' + file.name;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      btn.disabled = false; btn.textContent = oldText;
      _c('Done!', 'success');
    }).catch(function(e) {
      clearTimeout(timeout);
      btn.disabled = false; btn.textContent = oldText;
      if (e.name === 'AbortError') { _c('Request timed out', 'error'); }
      else { _c(e.message || 'Server error', 'error'); }
    });
  });
}

fileInput.addEventListener('change', function() {
  var f = this.files[0];
  if (f) fileName.textContent = f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)';
});
ffmpegInput.addEventListener('change', function() {
  var f = this.files[0];
  if (f) ffmpegName.textContent = f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)';
});

uploadTrigger.addEventListener('click', function() { fileInput.click(); });
ffmpegUpload.addEventListener('click', function() { ffmpegInput.click(); });
})();
