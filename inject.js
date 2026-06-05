(function() {
  const SERVER = 'https://encodex-api-production.up.railway.app';
  let hqEnabled = false;
  let processing = false;
  let reentryGuard = false;
  let pendingUsageToken = null;
  let commitInFlight = false;
  let token = null;

  window._encodex_hqEnabled = false;
  window._encodex_currentLang = 'ru';

  function getToken() {
    if (token) return token;
    try {
      var raw = localStorage.getItem('encodex_token');
      if (raw) token = raw;
    } catch (e) {}
    return token;
  }

  function showOverlay(file) {
    var existing = document.getElementById('encodex-hq-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'encodex-hq-overlay';
    overlay.innerHTML =
      '<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:\'Inter\',sans-serif;">' +
        '<div style="background:#111;border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:30px 40px;text-align:center;max-width:340px;box-shadow:0 0 60px rgba(139,92,246,0.2);">' +
          '<div style="width:48px;height:48px;border:3px solid rgba(139,92,246,0.2);border-top-color:#8b5cf6;border-radius:50%;animation:encodex-spin2 0.8s linear infinite;margin:0 auto 16px;"></div>' +
          '<div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:6px;">HQ Upload</div>' +
          '<div style="color:rgba(255,255,255,0.5);font-size:11px;" id="encodex-hq-status">' + file.name + '</div>' +
          '<div style="margin-top:12px;height:4px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">' +
            '<div id="encodex-hq-progress" style="height:100%;width:0%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);border-radius:4px;transition:width 0.3s;"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<style>@keyframes encodex-spin2{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);
  }

  function updateOverlay(msg, pct) {
    var el = document.getElementById('encodex-hq-status');
    var bar = document.getElementById('encodex-hq-progress');
    if (el) el.textContent = msg;
    if (bar) bar.style.width = (pct || 0) + '%';
  }

  function removeOverlay() {
    var el = document.getElementById('encodex-hq-overlay');
    if (el) el.remove();
  }

  // === STEP 1: ALLOCATE ===
  function allocate(fileSize) {
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

  // === STEP 2: UPLOAD ===
  function uploadFile(transcoderUrl, uploadToken, file) {
    return new Promise(function(resolve, reject) {
      var fd = new FormData();
      fd.append('video', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', transcoderUrl + '/api/process/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + uploadToken);
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 100 * 0.16 + 2); // 2% → 18%
          var label = (window._encodex_currentLang === 'ru' ? 'Загрузка' : 'Uploading') + ' (' + Math.round(pct) + '%)';
          updateOverlay(label, pct);
        }
      };
      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.ok) resolve(data.job_id);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) { reject(new Error('Invalid response')); }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  // === STEP 3: POLL STATUS ===
  function pollStatus(transcoderUrl, uploadToken, jobId) {
    return new Promise(function(resolve, reject) {
      var retries = 0;
      (function poll() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', transcoderUrl + '/api/process/status?job_id=' + jobId);
        xhr.setRequestHeader('Authorization', 'Bearer ' + uploadToken);
        xhr.onload = function() {
          try {
            var data = JSON.parse(xhr.responseText);
            if (!data.ok) { retries++; if (retries < 360) setTimeout(poll, 1000); else reject(new Error('Timeout')); return; }
            // Status codes: 10=queued, 20=analyzing, 30=encoding, 40=patching, 200=complete
            if (data.status === 200) { resolve(); return; }
            if (data.status >= 400) { reject(new Error('Processing failed')); return; }
            var phaseLabel = '';
            var progress = 18;
            if (data.status === 10) { phaseLabel = window._encodex_currentLang === 'ru' ? 'В очереди' : 'Queued'; progress = 18; }
            else if (data.status === 20) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Анализ' : 'Analyzing'; progress = 24; }
            else if (data.status === 30) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Кодирование' : 'Encoding'; progress = Math.round(data.progress || 50); }
            else if (data.status === 40) { phaseLabel = window._encodex_currentLang === 'ru' ? 'Финализация' : 'Patching'; progress = 92; }
            updateOverlay(phaseLabel + ' (' + progress + '%)', progress);
            retries = 0;
            setTimeout(poll, 1000);
          } catch (e) { retries++; if (retries < 360) setTimeout(poll, 1000); else reject(new Error('Timeout')); }
        };
        xhr.onerror = function() { retries++; if (retries < 360) setTimeout(poll, 1000); else reject(new Error('Timeout')); };
        xhr.send();
      })();
    });
  }

  // === STEP 4: DOWNLOAD RESULT ===
  function downloadResult(transcoderUrl, uploadToken, jobId) {
    return new Promise(function(resolve, reject) {
      var label = window._encodex_currentLang === 'ru' ? 'Скачивание...' : 'Downloading...';
      updateOverlay(label, 96);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', transcoderUrl + '/api/process/result?job_id=' + jobId);
      xhr.setRequestHeader('Authorization', 'Bearer ' + uploadToken);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function() {
        if (xhr.status === 200) resolve(xhr.response);
        else reject(new Error('Download failed'));
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send();
    });
  }

  // === INTERCEPT FILE CHANGE (capture phase) ===
  window.addEventListener('change', function(e) {
    var input = e.target;
    if (input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (reentryGuard) { reentryGuard = false; return; }
    if (!hqEnabled) return;
    if (!input.files || !input.files[0]) return;
    if (processing) { e.stopImmediatePropagation(); return; }

    var file = input.files[0];
    if (!getToken()) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      return;
    }

    e.stopImmediatePropagation();
    processing = true;
    showOverlay(file);

    allocate(file.size)
      .then(function(a) {
        return uploadFile(a.transcoder_url, a.upload_token, file)
          .then(function(jobId) { return { a: a, jobId: jobId }; });
      })
      .then(function(ctx) {
        return pollStatus(ctx.a.transcoder_url, ctx.a.upload_token, ctx.jobId)
          .then(function() { return ctx; });
      })
      .then(function(ctx) {
        return downloadResult(ctx.a.transcoder_url, ctx.a.upload_token, ctx.jobId)
          .then(function(buffer) { return { ctx: ctx, buffer: buffer }; });
      })
      .then(function(result) {
        var newFile = new File([result.buffer], file.name, { type: file.type, lastModified: Date.now() });
        var dt = new DataTransfer();
        dt.items.add(newFile);
        input.files = dt.files;
        pendingUsageToken = result.ctx.a.usage_token;
        processing = false;
        removeOverlay();
        updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
        reentryGuard = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })
      .catch(function(err) {
        console.error('[EncodeX] HQ Upload error:', err);
        processing = false;
        removeOverlay();
        var msg = window._encodex_currentLang === 'ru' ? 'Ошибка: ' : 'Error: ';
        alert(msg + err.message);
      });
  }, true);

  // === INTERCEPT DRAG-AND-DROP ===
  window.addEventListener('drop', function(e) {
    if (reentryGuard) { reentryGuard = false; return; }
    if (!hqEnabled) return;
    var dt = e.dataTransfer;
    if (!dt || !dt.files || !dt.files[0]) return;
    var file = dt.files[0];
    if (!file.type.startsWith('video/')) return;
    if (processing) { e.stopImmediatePropagation(); e.preventDefault(); return; }

    if (!getToken()) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      return;
    }

    e.stopImmediatePropagation();
    e.preventDefault();
    processing = true;
    showOverlay(file);

    allocate(file.size)
      .then(function(a) {
        return uploadFile(a.transcoder_url, a.upload_token, file)
          .then(function(jobId) { return { a: a, jobId: jobId }; });
      })
      .then(function(ctx) {
        return pollStatus(ctx.a.transcoder_url, ctx.a.upload_token, ctx.jobId)
          .then(function() { return ctx; });
      })
      .then(function(ctx) {
        return downloadResult(ctx.a.transcoder_url, ctx.a.upload_token, ctx.jobId)
          .then(function(buffer) { return { ctx: ctx, buffer: buffer }; });
      })
      .then(function(result) {
        var newFile = new File([result.buffer], file.name, { type: file.type, lastModified: Date.now() });
        var w = new DataTransfer();
        w.items.add(newFile);
        pendingUsageToken = result.ctx.a.usage_token;
        processing = false;
        removeOverlay();
        reentryGuard = true;
        // Re-dispatch drop event with processed file on the same target
        var target = e.target;
        if (target) {
          target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: w }));
        }
      })
      .catch(function(err) {
        console.error('[EncodeX] HQ Upload error:', err);
        processing = false;
        removeOverlay();
        alert((window._encodex_currentLang === 'ru' ? 'Ошибка: ' : 'Error: ') + err.message);
      });
  }, true);

  // === INTERCEPT FETCH/XHR TO COMMIT USAGE AFTER TIKTOK UPLOAD ===
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    return originalFetch.apply(this, args).then(function(response) {
      if (pendingUsageToken && !commitInFlight && url && url.indexOf('project/post') !== -1 && response.ok) {
        commitInFlight = true;
        var ct = pendingUsageToken;
        pendingUsageToken = null;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', SERVER + '/api/process/commit');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
        xhr.onload = function() { commitInFlight = false; };
        xhr.onerror = function() { commitInFlight = false; };
        xhr.send(JSON.stringify({ token: ct }));
      }
      return response;
    });
  };

  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._en_url = typeof url === 'string' ? url : (url ? url.toString() : '');
    return origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    var url = xhr._en_url || '';
    var origOnload = xhr.onload;
    xhr.onload = function() {
      if (pendingUsageToken && !commitInFlight && url.indexOf('project/post') !== -1 && xhr.status >= 200 && xhr.status < 300) {
        commitInFlight = true;
        var ct = pendingUsageToken;
        pendingUsageToken = null;
        var cxhr = new XMLHttpRequest();
        cxhr.open('POST', SERVER + '/api/process/commit');
        cxhr.setRequestHeader('Content-Type', 'application/json');
        cxhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
        cxhr.onload = function() { commitInFlight = false; };
        cxhr.onerror = function() { commitInFlight = false; };
        cxhr.send(JSON.stringify({ token: ct }));
      }
      if (origOnload) origOnload.apply(xhr, arguments);
    };
    return origXHRSend.apply(this, arguments);
  };

  // === LISTEN FOR STATE CHANGES ===
  window.addEventListener('EncodeXState', function(e) {
    if (e.detail) {
      hqEnabled = !!(e.detail.isActive && e.detail.isPremium);
      window._encodex_hqEnabled = hqEnabled;
      if (e.detail.lang) window._encodex_currentLang = e.detail.lang;
      if (e.detail.token) token = e.detail.token;
    }
  });

  try { var stored = localStorage.getItem('encodex_token'); if (stored) token = stored; } catch (e) {}

  console.log('[EncodeX] HQ Upload inject loaded (Editing News mirror)');
})();
