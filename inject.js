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

  function showToast(seconds) {
    var existing = document.getElementById('encodex-toast');
    if (existing) existing.remove();
    var lang = window._encodex_currentLang === 'ru';
    var msg = lang
      ? '✅ HQ Upload: файл обработан за ' + seconds + ' сек'
      : '✅ HQ Upload: processed in ' + seconds + 's';
    var toast = document.createElement('div');
    toast.id = 'encodex-toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);'
      + 'background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:Inter,sans-serif;'
      + 'font-size:13px;font-weight:600;padding:10px 20px;border-radius:24px;z-index:9999999;'
      + 'border:1px solid rgba(139,92,246,0.5);box-shadow:0 4px 24px rgba(139,92,246,0.25);'
      + 'opacity:0;transition:opacity 0.3s,transform 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
    }, 3000);
  }

  function allocateJob(fileSize) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SERVER + '/api/process/allocate');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.ok) resolve(data);
          else reject(new Error(data.error || 'Allocate failed'));
        } catch (e) { reject(new Error('Invalid response')); }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(JSON.stringify({ file_size: fileSize }));
    });
  }

  function uploadFile(file, uploadToken) {
    return new Promise(function(resolve, reject) {
      var fd = new FormData();
      fd.append('video', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SERVER + '/api/process/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + uploadToken);
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          var pct = Math.round(20 + (e.loaded / e.total) * 40);
          var label = (window._encodex_currentLang === 'ru' ? 'Загрузка' : 'Uploading') + ' (' + Math.round((e.loaded / e.total) * 100) + '%)';
          updateOverlay(label, pct);
        }
      };
      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.ok) resolve(data);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) { reject(new Error('Invalid response')); }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  function pollStatus(jobId) {
    return new Promise(function(resolve, reject) {
      var attempts = 0;
      (function poll() {
        var label = window._encodex_currentLang === 'ru' ? 'Обработка FFmpeg...' : 'FFmpeg processing...';
        updateOverlay(label, Math.min(85, 60 + attempts));
        var xhr = new XMLHttpRequest();
        xhr.open('GET', SERVER + '/api/process/status?job_id=' + jobId);
        xhr.onload = function() {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.ok && data.status === 200) resolve();
            else if (data.ok && data.status >= 400) reject(new Error('FFmpeg error: ' + (data.error || data.status)));
            else { attempts++; if (attempts > 180) return reject(new Error('Timeout')); setTimeout(poll, 2000); }
          } catch (e) { attempts++; setTimeout(poll, 2000); }
        };
        xhr.onerror = function() { attempts++; setTimeout(poll, 2000); };
        xhr.send();
      })();
    });
  }

  function downloadResult(jobId, uploadToken) {
    return new Promise(function(resolve, reject) {
      var label = window._encodex_currentLang === 'ru' ? 'Скачивание...' : 'Downloading...';
      updateOverlay(label, 90);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SERVER + '/api/process/result?job_id=' + jobId + '&token=' + uploadToken);
      xhr.responseType = 'blob';
      xhr.onload = function() {
        if (xhr.status === 200) resolve(xhr.response);
        else reject(new Error('Download failed: ' + xhr.status));
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send();
    });
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
    updateOverlay(window._encodex_currentLang === 'ru' ? 'Подготовка...' : 'Preparing...', 10);

    var _uploadToken = null;
    var _jobId = null;

    allocateJob(file.size).then(function(alloc) {
      _uploadToken = alloc.upload_token;
      _jobId = alloc.job_id;
      return uploadFile(file, _uploadToken);
    }).then(function() {
      return pollStatus(_jobId);
    }).then(function() {
      return downloadResult(_jobId, _uploadToken);
    }).then(function(blob) {
      var newFile = new File([blob], file.name, { type: 'video/mp4' });
      var dt = new DataTransfer();
      dt.items.add(newFile);
      processing = false;
      var elapsed = Math.round((Date.now() - _startTime) / 1000);
      updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
      setTimeout(function() {
        removeOverlay();
        showToast(elapsed);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 800);
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
