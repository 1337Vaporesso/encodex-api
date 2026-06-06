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

  // === Override URL.createObjectURL: return fake 1080p blob URL (как у Editing News) ===
  if (!window._enx_urlPatched) {
    window._enx_urlPatched = true;
    var _origCreateURL = URL.createObjectURL;
    var _origRevokeURL = URL.revokeObjectURL;
    var _fake1080pUrl = null;
    var _fake1080pBlob = null;
    function _makeFakeBlob() {
      try {
        var _b64 = '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';
        var _bin = atob(_b64);
        var _buf = new Uint8Array(_bin.length);
        for (var _i = 0; _i < _bin.length; _i++) _buf[_i] = _bin.charCodeAt(_i);
        _fake1080pBlob = new Blob([_buf], { type: 'video/mp4' });
        _fake1080pUrl = _origCreateURL.call(URL, _fake1080pBlob);
      } catch(_e) { console.warn('[EncodeX] fake blob init:', _e); }
    }
    _makeFakeBlob();
    // Protect our fake URL from being revoked by TikTok
    URL.revokeObjectURL = function(url) {
      if (url === _fake1080pUrl) return;
      return _origRevokeURL.call(URL, url);
    };
    URL.createObjectURL = function(obj) {
      if (hqEnabled && obj instanceof Blob && obj.type && obj.type.indexOf('video/') === 0) {
        if (!_fake1080pUrl) _makeFakeBlob();
        if (_fake1080pUrl) return _fake1080pUrl;
      }
      return _origCreateURL.call(URL, obj);
    };
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

  // === INTERCEPT FETCH/XHR: inject 1080p into all TikTok API calls + commit tracking ===

  // TikTok API URL patterns that might carry resolution data
  var _tiktokApiPatterns = [
    'create?', 'project/post', 'publish?', 'upload?', 'video/post', 'post/video',
    'video/upload', 'v1/video', 'v2/video', 'api/v1/post', 'api/v2/post',
    'api/v1/upload', 'api/v2/upload', 'post/create', 'video/create',
    'post/publish', 'ai-queue/upscale', 'api/video'
  ];

  function _isTikTokApi(url) {
    if (!url) return false;
    for (var _i = 0; _i < _tiktokApiPatterns.length; _i++) {
      if (url.indexOf(_tiktokApiPatterns[_i]) !== -1) return true;
    }
    return false;
  }

  function patchBody1080p(bodyStr, urlHint) {
    if (!bodyStr || typeof bodyStr !== 'string') return bodyStr;
    try {
      var b = JSON.parse(bodyStr);
      var changed = false;

      function set1080p(obj) {
        if (!obj || typeof obj !== 'object') return false;
        var c = false;

        // Precise field matching: exact width/height + known aliases
        for (var k in obj) {
          var v = obj[k];
          if (v && typeof v === 'object') {
            if (set1080p(v)) c = true;
          }
          if (typeof v === 'number' && v > 0) {
            // Ensure the smaller dimension is at least 1080
            // For landscape (width > height): height ≥ 1080
            // For portrait (height > width): width ≥ 1080
            if (k === 'width' && obj.height !== undefined) {
              var isPortrait = obj.height > v;
              if (isPortrait && v < 1080) { obj.width = 1080; c = true; }
              else if (!isPortrait && v < 1920) { obj.width = 1920; c = true; }
            }
            if (k === 'height' && obj.width !== undefined) {
              var isLandscape = obj.width > v;
              if (isLandscape && v < 1080) { obj.height = 1080; c = true; }
              else if (!isLandscape && v < 1920) { obj.height = 1920; c = true; }
            }
          }
        }
        return c;
      }

      changed = set1080p(b);
      if (changed) {
        console.log('[EncodeX] patched body for', urlHint, JSON.stringify(b).substr(0, 600));
        return JSON.stringify(b);
      }
    } catch(e) { console.warn('[EncodeX] patchBody1080p error:', e); }
    return bodyStr;
  }

  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var input = args[0];
    var init = args[1] || {};
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    if (hqEnabled && url) {
      if (_isTikTokApi(url)) {
        console.log('[EncodeX] fetch intercepted:', url.substr(0, 200));
        // Try to parse and patch body
        var body = init.body;
        if (typeof body === 'string') {
          var patched = patchBody1080p(body, url);
          if (patched !== body) init.body = patched;
        } else if (body && typeof body === 'object') {
          // URLSearchParams or FormData
          try {
            var sp = body.toString ? body.toString() : '';
            if (sp) {
              var patched = patchBody1080p(sp, url);
              if (patched !== sp) init.body = patched;
            }
          } catch(se) {}
        }
      }
    }

    return originalFetch.call(this, input, init).then(function(response) {
      // Commit after successful project/post
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
    this._en_method = method;
    return origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    var url = xhr._en_url || '';

    if (hqEnabled && url) {
      if (_isTikTokApi(url)) {
        console.log('[EncodeX] XHR intercepted:', (xhr._en_method || 'GET'), url.substr(0, 200));
        if (typeof body === 'string') {
          body = patchBody1080p(body, url);
        }
      }
    }

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
    return origXHRSend.call(xhr, body);
  };
  console.log('[EncodeX] fetch/XHR interceptors active');

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