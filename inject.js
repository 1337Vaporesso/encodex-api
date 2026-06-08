(function() {
  const SERVER = 'https://encodex-api-production.up.railway.app';
  let hqEnabled = false;
  let processing = false;
  let token = null;

  window._encodex_hqEnabled = false;
  window._encodex_currentLang = 'ru';

  function getToken() {
    if (token) return token;
    try {
      const raw = localStorage.getItem('encodex_token');
      if (raw) token = raw;
    } catch (e) {}
    return token;
  }

  function showOverlay(file) {
    const existing = document.getElementById('encodex-hq-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'encodex-hq-overlay';
    overlay.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:'Inter',sans-serif;">
        <div style="background:#111;border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:30px 40px;text-align:center;max-width:340px;box-shadow:0 0 60px rgba(139,92,246,0.2);">
          <div style="width:48px;height:48px;border:3px solid rgba(139,92,246,0.2);border-top-color:#8b5cf6;border-radius:50%;animation:encodex-spin2 0.8s linear infinite;margin:0 auto 16px;"></div>
          <div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:6px;">HQ Upload</div>
          <div style="color:rgba(255,255,255,0.5);font-size:11px;" id="encodex-hq-status">${file.name}</div>
          <div style="margin-top:12px;height:4px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
            <div id="encodex-hq-progress" style="height:100%;width:0%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>
      <style>
        @keyframes encodex-spin2 { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      </style>
    `;
    document.body.appendChild(overlay);
  }

  function updateOverlay(msg, pct) {
    const el = document.getElementById('encodex-hq-status');
    const bar = document.getElementById('encodex-hq-progress');
    if (el) el.textContent = msg;
    if (bar) bar.style.width = (pct || 0) + '%';
  }

  function removeOverlay() {
    const el = document.getElementById('encodex-hq-overlay');
    if (el) el.remove();
  }

  function uploadFile(file) {
    return new Promise(function(resolve, reject) {
      const fd = new FormData();
      fd.append('video', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SERVER + '/api/process/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const label = (window._encodex_currentLang === 'ru' ? 'Загрузка' : 'Uploading') + ' (' + pct + '%)';
          updateOverlay(label, pct);
        }
      };
      xhr.onload = function() {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.ok) resolve(data);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  function pollStatus(jobId) {
    return new Promise(function(resolve, reject) {
      (function poll() {
        var label = window._encodex_currentLang === 'ru' ? 'Обработка FFmpeg...' : 'FFmpeg processing...';
        updateOverlay(label, 50);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', SERVER + '/api/process/status/' + jobId);
        xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
        xhr.onload = function() {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.ok && data.status === 'done') resolve(jobId);
            else if (data.ok && data.status === 'error') reject(new Error('Processing failed'));
            else setTimeout(poll, 1500);
          } catch (e) { setTimeout(poll, 1500); }
        };
        xhr.onerror = function() { setTimeout(poll, 1500); };
        xhr.send();
      })();
    });
  }

  function downloadResult(jobId) {
    return new Promise(function(resolve, reject) {
      var label = window._encodex_currentLang === 'ru' ? 'Скачивание...' : 'Downloading...';
      updateOverlay(label, 80);

      var xhr = new XMLHttpRequest();
      xhr.open('GET', SERVER + '/api/process/result/' + jobId);
      xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.responseType = 'blob';
      xhr.onload = function() {
        if (xhr.status === 200) resolve(xhr.response);
        else reject(new Error('Download failed'));
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send();
    });
  }

  function commitJob(jobId) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', SERVER + '/api/process/commit');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
    xhr.send(JSON.stringify({ jobId: jobId }));
  }

  // Intercept file input changes (capture phase)
  document.addEventListener('change', function(e) {
    var input = e.target;
    if (input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (processing) return;
    if (!hqEnabled) return;
    if (!input.files || !input.files[0]) return;

    var file = input.files[0];

    // Check token
    if (!getToken()) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      return;
    }

    e.stopImmediatePropagation();
    processing = true;
    showOverlay(file);

    uploadFile(file).then(function(result) {
      return pollStatus(result.jobId);
    }).then(function(jobId) {
      return downloadResult(jobId).then(function(blob) {
        return { jobId: jobId, blob: blob };
      });
    }).then(function(result) {
      var newFile = new File([result.blob], file.name, { type: file.type });
      var dt = new DataTransfer();
      dt.items.add(newFile);
      input.files = dt.files;
      processing = false;
      removeOverlay();
      commitJob(result.jobId);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(function(err) {
      console.error('[EncodeX] HQ Upload error:', err);
      processing = false;
      removeOverlay();
      var msg = window._encodex_currentLang === 'ru' ? 'Ошибка HQ Upload: ' : 'HQ Upload error: ';
      alert(msg + err.message);
    });
  }, true);

  // Listen for state changes from popup
  window.addEventListener('EncodeXState', function(e) {
    if (e.detail) {
      hqEnabled = !!(e.detail.isActive && e.detail.isPremium);
      window._encodex_hqEnabled = hqEnabled;
      if (e.detail.lang) window._encodex_currentLang = e.detail.lang;
      if (e.detail.token) token = e.detail.token;
    }
  });

  // Try to get token from storage
  try {
    var stored = localStorage.getItem('encodex_token');
    if (stored) token = stored;
  } catch (e) {}

  console.log('[EncodeX] HQ Upload inject loaded');
})();
