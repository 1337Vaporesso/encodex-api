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

patchBtn.addEventListener('click', function() { processVideo('quick'); });
ffmpegBtn.addEventListener('click', function() { processVideo('ffmpeg'); });

function processVideo(mode) {
  var input = mode === 'quick' ? fileInput : ffmpegInput;
  var file = input.files[0];
  if (!file) { _c('Select a video first', 'error'); return; }
  var btn = mode === 'quick' ? patchBtn : ffmpegBtn;
  btn.disabled = true; btn.textContent = 'Processing...';
  chrome.storage.local.get('encodex_token', function(r) {
    if (!r || !r.encodex_token) { btn.disabled = false; btn.textContent = 'Patch & Download'; _c('Login required', 'error'); return; }
    var fd = new FormData();
    fd.append('video', file);
    fetch(API + '/api/process/' + mode, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + r.encodex_token },
      body: fd
    }).then(function(r2) { return r2.blob(); })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'encoded_' + file.name;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      btn.disabled = false; btn.textContent = 'Patch & Download';
      _c('Done!', 'success');
    }).catch(function() {
      btn.disabled = false; btn.textContent = 'Patch & Download';
      _c('Server error', 'error');
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

document.querySelectorAll('[id$="Trigger"]').forEach(function(el) {
  el.addEventListener('click', function() {
    var target = document.getElementById(this.id.replace('Trigger', 'FileInput'));
    if (target) target.click();
  });
});
})();
