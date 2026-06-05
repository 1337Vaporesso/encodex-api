(function() {
  let hqEnabled = false;
  let processing = false;
  let reentryGuard = false;
  let pendingUsageToken = null;
  let commitInFlight = false;
  let tokenReceived = false;

  // Store DOM refs here (not passed through postMessage)
  let pendingInput = null;
  let pendingDropTarget = null;
  let pendingFileName = '';
  let pendingFileType = '';

  window._encodex_hqEnabled = false;
  window._encodex_currentLang = 'ru';

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

  function postMsg(type, payload) {
    window.postMessage({ source: 'encodex-inject', type: type, payload: payload }, '*');
  }

  // === INTERCEPT FILE CHANGE ===
  window.addEventListener('change', function(e) {
    var input = e.target;
    if (input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (reentryGuard) { reentryGuard = false; return; }
    if (!hqEnabled) return;
    if (!input.files || !input.files[0]) return;
    if (processing) { e.stopImmediatePropagation(); return; }
    var file = input.files[0];
    if (!tokenReceived) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      return;
    }
    e.stopImmediatePropagation();
    processing = true;
    pendingInput = input;
    pendingDropTarget = null;
    pendingFileName = file.name;
    pendingFileType = file.type;
    showOverlay(file);
    postMsg('ALLOCATE', { fileSize: file.size, _file: file, fileName: file.name, fileType: file.type });
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
    if (!tokenReceived) {
      if (window._encodex_currentLang === 'ru') alert('EncodeX: войди в аккаунт в расширении');
      else alert('EncodeX: login in the extension first');
      e.stopImmediatePropagation();
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    processing = true;
    pendingInput = null;
    pendingDropTarget = e.target;
    pendingFileName = file.name;
    pendingFileType = file.type;
    showOverlay(file);
    postMsg('ALLOCATE', { fileSize: file.size, _file: file, fileName: file.name, fileType: file.type, isDrop: true });
  }, true);

  // === LISTEN FOR RESPONSES FROM content.js ===
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'encodex-content') return;
    var p = e.data.payload || {};

    switch (e.data.type) {
      case 'ALLOCATE_RESULT':
        if (p.ok && p._file) {
          postMsg('UPLOAD', {
            transcoderUrl: p.transcoder_url,
            uploadToken: p.upload_token,
            usageToken: p.usage_token,
            _file: p._file
          });
        } else {
          processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
          alert('EncodeX: ' + (p.error || 'Allocate failed'));
        }
        break;

      case 'UPLOAD_PROGRESS':
        updateOverlay(p.label, p.percent);
        break;

      case 'UPLOAD_RESULT':
        if (p.ok) {
          postMsg('POLL', {
            transcoderUrl: p.transcoderUrl,
            uploadToken: p.uploadToken,
            usageToken: p.usageToken,
            jobId: p.jobId
          });
        } else {
          processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
          alert('EncodeX: ' + (p.error || 'Upload failed'));
        }
        break;

      case 'POLL_PROGRESS':
        updateOverlay(p.label, p.percent);
        break;

      case 'POLL_RESULT':
        if (p.ok) {
          postMsg('DOWNLOAD', {
            transcoderUrl: p.transcoderUrl,
            uploadToken: p.uploadToken,
            usageToken: p.usageToken,
            jobId: p.jobId
          });
        } else {
          processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
          alert('EncodeX: ' + (p.error || 'Processing failed'));
        }
        break;

      case 'DOWNLOAD_RESULT':
        if (p.ok && p.buffer) {
          var newFile = new File([p.buffer], pendingFileName, { type: pendingFileType, lastModified: Date.now() });
          if (pendingInput) {
            var dt = new DataTransfer();
            dt.items.add(newFile);
            pendingInput.files = dt.files;
            pendingUsageToken = p._usageToken;
            processing = false;
            removeOverlay();
            updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
            reentryGuard = true;
            var inp = pendingInput;
            pendingInput = null; pendingDropTarget = null;
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (pendingDropTarget) {
            var w = new DataTransfer();
            w.items.add(newFile);
            pendingUsageToken = p._usageToken;
            processing = false;
            removeOverlay();
            reentryGuard = true;
            var tgt = pendingDropTarget;
            pendingInput = null; pendingDropTarget = null;
            tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: w }));
          } else {
            processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
          }
        } else {
          processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
          alert('EncodeX: ' + (p.error || 'Download failed'));
        }
        break;

      case 'COMMIT_RESULT':
        commitInFlight = false;
        break;
    }
  });

  // === INTERCEPT FETCH/XHR TO COMMIT USAGE ===
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    return originalFetch.apply(this, args).then(function(response) {
      if (pendingUsageToken && !commitInFlight && url && url.indexOf('project/post') !== -1 && response.ok) {
        commitInFlight = true;
        var ct = pendingUsageToken;
        pendingUsageToken = null;
        postMsg('COMMIT', { usageToken: ct });
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
        postMsg('COMMIT', { usageToken: ct });
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
      if (e.detail.token) tokenReceived = true;
    }
  });

  console.log('[EncodeX] HQ Upload inject loaded');
})();