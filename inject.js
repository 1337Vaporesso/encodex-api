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

  // === URL.createObjectURL: не оверрайдим, TikTok сам обрабатывает файл ===
  // (серверный FFmpeg меняет metadata, TikTok не ресайзит)
  // (никакого dummy blob — TikTok должен видеть реальный файл для preview)

  // === MediaRecorder interceptor (check if TikTok uses client-side re-encode) ===
  if (!window._enx_mrPatched) {
    window._enx_mrPatched = true;
    var _origMR = window.MediaRecorder;

    function _mrWrapInstance(inst) {
      var _origStart = inst.start;
      inst.start = function(timeslice) {
        console.log('[EncodeX] MediaRecorder.start(' + timeslice + ')');
        // Eventually here: override ondataavailable to inject our 1080p blob
        return _origStart.call(this, timeslice);
      };
      var _origStop = inst.stop;
      inst.stop = function() {
        console.log('[EncodeX] MediaRecorder.stop()');
        return _origStop.call(this);
      };
      return inst;
    }

    window.MediaRecorder = function(stream, options) {
      console.log('[EncodeX] MediaRecorder CREATED: mime=' + (options ? options.mimeType : 'none') + ' videoBits=' + (options ? options.videoBitsPerSecond : 'none'));
      var tracks = stream && stream.getTracks ? stream.getTracks() : [];
      for (var t = 0; t < tracks.length; t++) console.log('[EncodeX]   track:', tracks[t].kind, tracks[t].label, tracks[t].getSettings ? JSON.stringify(tracks[t].getSettings()) : '');
      var inst = new _origMR(stream, options);
      return _mrWrapInstance(inst);
    };
    window.MediaRecorder.prototype = _origMR.prototype;
    // Copy static methods
    window.MediaRecorder.isTypeSupported = function(mime) {
      var r = _origMR.isTypeSupported(mime);
      console.log('[EncodeX] MediaRecorder.isTypeSupported(' + mime + ') -> ' + r);
      return r;
    };
    console.log('[EncodeX] MediaRecorder interceptor active');
  }

  function showOverlay(file) {
    var existing = document.getElementById('encodex-hq-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'encodex-hq-overlay';
    overlay.innerHTML =
      '<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:\'Sora\',sans-serif;">' +
        '<div id="encodex-hq-card" style="background:#111;border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:30px 40px;text-align:center;max-width:340px;box-shadow:0 0 60px rgba(139,92,246,0.2);animation:encodex-pulse 2s ease-in-out infinite;position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;left:-100%;width:100%;height:2px;background:linear-gradient(90deg,transparent,#8b5cf6,transparent);animation:encodex-scanline 2s ease-in-out infinite;"></div>' +
          '<div style="width:48px;height:48px;border:3px solid rgba(139,92,246,0.2);border-top-color:#8b5cf6;border-right-color:#a78bfa;border-radius:50%;animation:encodex-spin2 0.8s cubic-bezier(0.4,0,0.2,1) infinite;margin:0 auto 16px;"></div>' +
          '<div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:6px;">HQ Upload</div>' +
          '<div style="color:rgba(255,255,255,0.5);font-size:11px;" id="encodex-hq-status">' + file.name + '</div>' +
          '<div style="margin-top:12px;height:4px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;position:relative;">' +
            '<div id="encodex-hq-progress" style="height:100%;width:0%;background:linear-gradient(90deg,#8b5cf6,#a78bfa,#8b5cf6);background-size:200% 100%;border-radius:4px;transition:width 0.3s;animation:encodex-shimmer 1.5s ease-in-out infinite;"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<style>' +
        '@keyframes encodex-spin2{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}' +
        '@keyframes encodex-pulse{0%,100%{box-shadow:0 0 40px rgba(139,92,246,0.15)}50%{box-shadow:0 0 80px rgba(139,92,246,0.3)}}' +
        '@keyframes encodex-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
        '@keyframes encodex-scanline{0%{left:-100%}100%{left:200%}}' +
        '@keyframes encodex-glow{0%,100%{opacity:0.6}50%{opacity:1}}' +
      '</style>';
    document.body.appendChild(overlay);
  }

  function updateOverlay(msg, pct) {
    var el = document.getElementById('encodex-hq-status');
    var bar = document.getElementById('encodex-hq-progress');
    if (el) el.textContent = msg;
    if (bar) {
      bar.style.width = (pct || 0) + '%';
      if (pct >= 100) {
        bar.style.background = 'linear-gradient(90deg,#22c55e,#16a34a,#22c55e)';
        bar.style.backgroundSize = '200% 100%';
        var card = document.getElementById('encodex-hq-card');
        if (card) {
          card.style.borderColor = 'rgba(34,197,94,0.5)';
          card.style.animation = 'encodex-pulse 2s ease-in-out infinite';
          card.style.boxShadow = '0 0 60px rgba(34,197,94,0.2)';
        }
      }
    }
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

      case 'DOWNLOAD_PROGRESS':
        updateOverlay(p.label, p.percent);
        break;

      case 'DOWNLOAD_RESULT':
        if (p.ok && p.buffer) {
          console.log('[EncodeX] DOWNLOAD_RESULT buffer size:', p.buffer.size || p.buffer.byteLength || '?');
          var newFile = new File([p.buffer], pendingFileName, { type: pendingFileType, lastModified: Date.now() });
          console.log('[EncodeX] dispatching file to TikTok:', newFile.size + 'bytes', newFile.type);
          if (pendingInput) {
            var dt = new DataTransfer();
            dt.items.add(newFile);
            pendingInput.files = dt.files;
            pendingUsageToken = p._usageToken;
            processing = false;
            updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
            reentryGuard = true;
            var inp = pendingInput;
            pendingInput = null; pendingDropTarget = null;
            setTimeout(function() {
              removeOverlay();
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            }, 1000);
          } else if (pendingDropTarget) {
            var w = new DataTransfer();
            w.items.add(newFile);
            pendingUsageToken = p._usageToken;
            processing = false;
            updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
            reentryGuard = true;
            var tgt = pendingDropTarget;
            pendingInput = null; pendingDropTarget = null;
            setTimeout(function() {
              removeOverlay();
              tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: w }));
            }, 1000);
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

  // TRANSFORM request counter (unique ID for each call)
  var _enxTid = 0;

  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var input = args[0];
    var init = args[1] || {};
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    if (hqEnabled && url) {
      var isTikTok = _isTikTokApi(url);
      if (isTikTok) {
        var body = init.body;
        var bodyPreview = '';
        if (typeof body === 'string') bodyPreview = body.substr(0, 600);
        else if (body && typeof body === 'object' && body.toString) bodyPreview = body.toString().substr(0, 600);
        console.log('[EncodeX] FETCH:', (init.method || 'POST'), url.substr(0, 200), 'body=[' + bodyPreview + ']');
      }

      if (isTikTok) {
        // Extract body as string if possible
        var bodyStr = '';
        if (typeof body === 'string') bodyStr = body;
        else if (body && typeof body === 'object' && body.toString) bodyStr = body.toString();

        if (bodyStr) {
          // Fast path: local patch first (no network)
          var localPatched = patchBody1080p(bodyStr, url);
          if (localPatched !== bodyStr) {
            init.body = localPatched;
            console.log('[EncodeX] FETCH -> locally patched');
            return originalFetch.call(this, input, init).then(function(resp) {
              resp.clone().text().then(function(t) { console.log('[EncodeX] FETCH response:', t.substr(0, 600)); }).catch(function(){});
              var rUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
              if (pendingUsageToken && !commitInFlight && rUrl.indexOf('project/post') !== -1 && resp && resp.ok) {
                commitInFlight = true;
                var ct = pendingUsageToken;
                pendingUsageToken = null;
                postMsg('COMMIT', { usageToken: ct });
              }
              return resp;
            });
          }

          // Slow path: server transform via content.js (CSP-safe)
          if (bodyStr.length < 100000) {
            var tid = ++_enxTid;
            return new Promise(function(resolve, reject) {
              var to;
              var onMsg = function(e) {
                if (e.data.source !== 'encodex-content' || e.data.type !== 'TRANSFORM_RESULT') return;
                if (e.data.payload && e.data.payload._tid !== tid) return;
                window.removeEventListener('message', onMsg);
                clearTimeout(to);
                var wasPatched = e.data.payload && e.data.payload.body && e.data.payload.body !== bodyStr;
                if (wasPatched) {
                  init.body = e.data.payload.body;
                  console.log('[EncodeX] FETCH -> server patched (was ' + bodyStr.length + ' -> ' + init.body.length + ' bytes)');
                } else {
                  console.log('[EncodeX] FETCH -> server returned unchanged body');
                }
                originalFetch.call(window, input, init).then(function(resp) {
                  resp.clone().text().then(function(t) { console.log('[EncodeX] FETCH response:', t.substr(0, 600)); }).catch(function(){});
                  var rUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
                  if (pendingUsageToken && !commitInFlight && rUrl.indexOf('project/post') !== -1 && resp && resp.ok) {
                    commitInFlight = true;
                    var ct = pendingUsageToken;
                    pendingUsageToken = null;
                    postMsg('COMMIT', { usageToken: ct });
                  }
                  resolve(resp);
                });
              };
              window.addEventListener('message', onMsg);
              to = setTimeout(function() {
                window.removeEventListener('message', onMsg);
                console.log('[EncodeX] FETCH -> transform timed out, using original body');
                originalFetch.call(window, input, init).then(function(resp) {
                  resp.clone().text().then(function(t) { console.log('[EncodeX] FETCH response:', t.substr(0, 600)); }).catch(function(){});
                  var rUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
                  if (pendingUsageToken && !commitInFlight && rUrl.indexOf('project/post') !== -1 && resp && resp.ok) {
                    commitInFlight = true;
                    var ct = pendingUsageToken;
                    pendingUsageToken = null;
                    postMsg('COMMIT', { usageToken: ct });
                  }
                  resolve(resp);
                });
              }, 5000);
              window.postMessage({ source: 'encodex-inject', type: 'TRANSFORM', payload: { body: bodyStr, url: url, _tid: tid } }, '*');
            });
          }
        }
      }
    }

    return originalFetch.call(this, input, init).then(function(response) {
      if (url && _isTikTokApi(url)) {
        response.clone().text().then(function(t) { console.log('[EncodeX] FETCH (not intercepted) response:', t.substr(0, 600)); }).catch(function(){});
      }
      var rUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (pendingUsageToken && !commitInFlight && rUrl.indexOf('project/post') !== -1 && response && response.ok) {
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
    var isTikTok = hqEnabled && url && _isTikTokApi(url);

    if (isTikTok) {
      console.log('[EncodeX] XHR:', (xhr._en_method || 'GET'), url.substr(0, 200), 'body=[' + (typeof body === 'string' ? body.substr(0, 600) : (body && body.toString ? body.toString().substr(0, 600) : '')) + ']');
      if (typeof body === 'string') {
        var patched = patchBody1080p(body, url);
        if (patched !== body) {
          body = patched;
          console.log('[EncodeX] XHR -> locally patched');
        } else {
          console.log('[EncodeX] XHR -> local patch no change');
        }
      }
    }

    var origOnload = xhr.onload;
    var origOnreadystatechange = xhr.onreadystatechange;
    xhr.onload = function() {
      if (isTikTok) console.log('[EncodeX] XHR response status=' + xhr.status + ' body=[' + (typeof xhr.responseText === 'string' ? xhr.responseText.substr(0, 600) : '') + ']');
      if (pendingUsageToken && !commitInFlight && url.indexOf('project/post') !== -1 && xhr.status >= 200 && xhr.status < 300) {
        commitInFlight = true;
        var ct = pendingUsageToken;
        pendingUsageToken = null;
        postMsg('COMMIT', { usageToken: ct });
      }
      if (origOnload) origOnload.apply(xhr, arguments);
    };
    if (origOnreadystatechange) {
      xhr.onreadystatechange = function() {
        if (isTikTok && xhr.readyState === 4) console.log('[EncodeX] XHR readystatechange DONE status=' + xhr.status);
        if (origOnreadystatechange) origOnreadystatechange.apply(xhr, arguments);
      };
    }
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