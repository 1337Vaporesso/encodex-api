(function() {
  const SERVER = 'https://encodex-api-production.up.railway.app';
  let hqEnabled = false;
  let processing = false;
  let token = null;

  window._encodex_hqEnabled = false;
  window._encodex_currentLang = 'ru';
  window._encodex_fps = 'auto';

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

  function sendToContent(type, payload) {
    return new Promise(function(resolve, reject) {
      var msgId = Date.now() + '_' + Math.random();
      var timeout = setTimeout(function() { window.removeEventListener('message', handler); reject(new Error('Request timeout')); }, 120000);
      function handler(e) {
        if (e.data && e.data.source === 'encodex-content' && e.data.type === type + '_RESULT' && e.data.id === msgId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.result);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ source: 'encodex-inject', type: type, payload: payload, id: msgId }, '*');
    });
  }

  // Listen for upload progress from content.js relay
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'encodex-content' && e.data.type === 'UPLOAD_PROGRESS') {
      if (e.data.payload && e.data.payload.total) {
        var pct = Math.round(20 + (e.data.payload.loaded / e.data.payload.total) * 40);
        var label = (window._encodex_currentLang === 'ru' ? 'Загрузка' : 'Uploading') + ' (' + Math.round((e.data.payload.loaded / e.data.payload.total) * 100) + '%)';
        updateOverlay(label, pct);
      }
    }
  });

  function allocateJob(fileSize) {
    return sendToContent('JOB_ALLOCATE', { file_size: fileSize, _token: getToken() });
  }

  function uploadFile(file, uploadToken) {
    return sendToContent('JOB_UPLOAD', { file: file, upload_token: uploadToken });
  }

  function pollStatus(jobId) {
    var attempts = 0;
    return new Promise(function(resolve, reject) {
      (function poll() {
        var label = window._encodex_currentLang === 'ru' ? 'Обработка FFmpeg...' : 'FFmpeg processing...';
        updateOverlay(label, Math.min(85, 60 + attempts));
        sendToContent('JOB_POLL', { job_id: jobId }).then(function(data) {
          if (data.ok && data.status === 200) resolve();
          else if (data.ok && data.status >= 400) reject(new Error('FFmpeg error: ' + (data.error || data.status)));
          else { attempts++; if (attempts > 180) return reject(new Error('Timeout')); setTimeout(poll, 2000); }
        }).catch(function() { attempts++; if (attempts > 180) reject(new Error('Timeout')); else setTimeout(poll, 2000); });
      })();
    });
  }

  function downloadResult(jobId, uploadToken) {
    var label = window._encodex_currentLang === 'ru' ? 'Скачивание...' : 'Downloading...';
    updateOverlay(label, 90);
    return sendToContent('JOB_DOWNLOAD', { job_id: jobId, upload_token: uploadToken });
  }

  var _reinjecting = false;

  function interceptFileInput(e) {
    console.log('[EncodeX] interceptFileInput', e.type, e.target.tagName, 'hqEnabled=' + hqEnabled, 'processing=' + processing, '_reinjecting=' + _reinjecting);
    var isDrop = e.type === 'drop';
    var input = e.target;

    if (isDrop) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files[0]) { console.log('[EncodeX] no files in drop'); return; }
      if (!e.dataTransfer.files[0].type.startsWith('video/')) { console.log('[EncodeX] drop not video:', e.dataTransfer.files[0].type); return; }
    } else {
      if (input.tagName !== 'INPUT' || input.type !== 'file') { console.log('[EncodeX] not a file input:', input.tagName, input.type); return; }
      if (!input.files || !input.files[0]) { console.log('[EncodeX] input has no files'); return; }
    }
    if (_reinjecting) { console.log('[EncodeX] _reinjecting'); return; }
    if (processing) { console.log('[EncodeX] already processing'); return; }
    if (!hqEnabled) { console.log('[EncodeX] intercept skipped: hqEnabled=false'); return; }

    var file = isDrop ? e.dataTransfer.files[0] : input.files[0];

    if (!getToken()) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      if (isDrop) e.preventDefault();
      return;
    }

    e.stopImmediatePropagation();
    if (isDrop) e.preventDefault();
    processing = true;
    showOverlay(file);
    updateOverlay(window._encodex_currentLang === 'ru' ? 'Подготовка...' : 'Preparing...', 10);

    var _startTime = Date.now();
    var _uploadToken = null;
    var _jobId = null;
    var dropTarget = isDrop ? e.target : null;

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
        _reinjecting = true;
        if (isDrop) {
          dropTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        } else {
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setTimeout(function() { _reinjecting = false; }, 200);
      }, 800);
    }).catch(function(err) {
      console.error('[EncodeX] HQ Upload error:', err);
      processing = false;
      removeOverlay();
      var msg = window._encodex_currentLang === 'ru' ? 'Ошибка HQ Upload: ' : 'HQ Upload error: ';
      alert(msg + err.message);
    });
  }

  // Use window (not document) so we fire BEFORE TikTok's document capture listeners
  window.addEventListener('change', interceptFileInput, true);
  window.addEventListener('input', interceptFileInput, true);
  window.addEventListener('drop', interceptFileInput, true);

  // Also attach directly to any file inputs already in DOM or added later (TikTok shadow DOM workaround)
  function attachToInput(el) {
    if (el.tagName === 'INPUT' && el.type === 'file' && !el._encodexHooked) {
      el._encodexHooked = true;
      el.addEventListener('change', interceptFileInput, true);
    }
  }
  document.querySelectorAll('input[type=file]').forEach(attachToInput);
  new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'INPUT' && node.type === 'file') attachToInput(node);
        node.querySelectorAll && node.querySelectorAll('input[type=file]').forEach(attachToInput);
      });
    });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  // Listen for state changes from popup
  window.addEventListener('EncodeXState', function(e) {
    if (e.detail) {
      hqEnabled = !!(e.detail.isActive && e.detail.isPremium);
      window._encodex_hqEnabled = hqEnabled;
      if (e.detail.lang) window._encodex_currentLang = e.detail.lang;
      if (e.detail.token) {
        token = e.detail.token;
        window._encodex_token = e.detail.token;
        try { localStorage.setItem('encodex_token', e.detail.token); } catch (e) {}
      }
      if (e.detail.fps) window._encodex_fps = e.detail.fps;
      if (e.detail.api) window._encodex_api = e.detail.api;
    }
  });

  // Try to get token from storage
  try {
    var stored = localStorage.getItem('encodex_token');
    if (stored) token = stored;
  } catch (e) {}

  // Signal MAIN world is ready (content.js waits for this before dispatching EncodeXState)
  try { document.documentElement.dataset.encodexInjected = '1'; } catch (e) {}

  console.log('[EncodeX] HQ Upload inject loaded');
})();
