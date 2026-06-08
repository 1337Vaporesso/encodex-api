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
  window._encodex_fps = 'auto';

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

  function injectIntoForm(file) {
    if (pendingInput) {
      var dt = new DataTransfer();
      dt.items.add(file);
      pendingInput.files = dt.files;
      processing = false;
      updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
      reentryGuard = true;
      var inp = pendingInput;
      pendingInput = null; pendingDropTarget = null;
      setTimeout(function() { removeOverlay(); inp.dispatchEvent(new Event('change', { bubbles: true })); }, 1000);
    } else if (pendingDropTarget) {
      var w = new DataTransfer();
      w.items.add(file);
      processing = false;
      updateOverlay(window._encodex_currentLang === 'ru' ? 'Готово!' : 'Done!', 100);
      reentryGuard = true;
      var tgt = pendingDropTarget;
      pendingInput = null; pendingDropTarget = null;
      setTimeout(function() { removeOverlay(); tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: w })); }, 1000);
    } else {
      processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
    }
  }

  // === LOCAL MP4 PROCESSING (no server) ===
  function _r32(d,o) { return (d[o]<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3]; }
  function _w32(d,o,v) { d[o]=(v>>24)&255; d[o+1]=(v>>16)&255; d[o+2]=(v>>8)&255; d[o+3]=v&255; }
  function _r64(d,o) { return _r32(d,o) * 0x100000000 + (_r32(d,o+4) >>> 0); }
  function _w64(d,o,v) { _w32(d,o,Math.floor(v / 0x100000000)); _w32(d,o+4,v >>> 0); }

  function _findBox(d, type, start, end) {
    start = start || 0; end = end || d.length;
    var stack = [{ s: start, e: end }];
    while (stack.length > 0) {
      var r = stack.pop();
      var i = r.s;
      while (i < r.e - 8) {
        var sz = _r32(d, i);
        if (sz < 8) sz = 8;
        var boxEnd = i + sz;
        if (boxEnd > r.e) boxEnd = r.e;
        var t = String.fromCharCode(d[i+4],d[i+5],d[i+6],d[i+7]);
        if (t === type) return { s: i, z: boxEnd - i, e: boxEnd };
        if (t !== 'mdat' && t !== 'free' && boxEnd > i + 8) {
          if (boxEnd < r.e) stack.push({ s: boxEnd, e: r.e });
          stack.push({ s: i + 8, e: boxEnd });
          break;
        }
        i = boxEnd;
      }
    }
    return null;
  }

  function _adjustStco(d, start, end, delta) {
    var pos = start;
    while (pos < end - 8) {
      var b = _findBox(d, 'stco', pos, end);
      if (!b) break;
      var cnt = _r32(d, b.s + 12);
      for (var j = 0; j < cnt; j++) { var off = b.s + 16 + j*4; _w32(d, off, _r32(d, off) + delta); }
      pos = b.e;
    }
  }

  function processLocally(file, onProgress) {
    return new Promise(function(resolve, reject) {
      var lang = window._encodex_currentLang || 'ru';
      var reader = new FileReader();
      reader.onprogress = function(e) {
        if (e.lengthComputable && onProgress) {
          var pct = Math.round((e.loaded / e.total) * 65);
          onProgress((lang === 'ru' ? 'Чтение' : 'Reading') + ' (' + pct + '%)', pct);
        }
      };
      reader.onload = function(e) {
        if (onProgress) onProgress((lang === 'ru' ? 'Обработка' : 'Processing') + ' (68%)', 68);
        setTimeout(function() {
          try {
            var buf = e.target.result;
            var d = new Uint8Array(buf);
            console.log('[EncodeX] file size: ' + buf.byteLength);
            var moov = _findBox(d, 'moov');
            if (!moov) { console.log('[EncodeX] no moov found, skipping'); return resolve(file); }
            console.log('[EncodeX] moov found at offset ' + moov.s);
            if (onProgress) onProgress((lang === 'ru' ? 'Анализ' : 'Analyzing') + ' (75%)', 75);
            setTimeout(function() {
              var its = 1;
              var tracks = [];
              var ti = moov.s + 8;
              while (ti < moov.e - 8) {
                var trak = _findBox(d, 'trak', ti, moov.e);
                if (!trak) break;
                tracks.push(trak);
                ti = trak.e;
              }

              // VFR fps detection: average over ALL stts entries (like ffprobe avg_frame_rate)
              for (var t = 0; t < tracks.length && its === 1; t++) {
                var mdia = _findBox(d, 'mdia', tracks[t].s + 8, tracks[t].e);
                if (!mdia) continue;
                var hdlr = _findBox(d, 'hdlr', mdia.s + 8, mdia.e);
                if (!hdlr) continue;
                var htype = String.fromCharCode(d[hdlr.s+16],d[hdlr.s+17],d[hdlr.s+18],d[hdlr.s+19]);
                if (htype !== 'vide') continue;
                var mdhd = _findBox(d, 'mdhd', mdia.s + 8, mdia.e);
                var stbl = _findBox(d, 'stbl', mdia.s + 8, mdia.e);
                if (!mdhd || !stbl) continue;
                var tsOff = mdhd.s + 12 + (d[mdhd.s + 8] === 1 ? 16 : 8);
                var stts = _findBox(d, 'stts', stbl.s + 8, stbl.e);
                if (!stts) continue;
                var cnt = _r32(d, stts.s + 12);
                if (cnt === 0) continue;
                var totalSamples = 0, totalDuration = 0;
                for (var e = 0; e < cnt; e++) {
                  totalSamples += _r32(d, stts.s + 16 + e * 8);
                  totalDuration += _r32(d, stts.s + 20 + e * 8) * _r32(d, stts.s + 16 + e * 8);
                }
                if (totalSamples > 0 && totalDuration > 0) {
                  var timescale = _r32(d, tsOff);
                  var fps = Math.round(timescale * totalSamples / totalDuration);
                  var targetFps = parseInt(window._encodex_fps, 10);
                  if (!isNaN(targetFps) && targetFps > 0) {
                    its = Math.max(1, Math.round(fps / targetFps));
                  } else {
                    its = fps >= 200 ? 12 : (fps >= 100 ? 6 : (fps >= 50 ? 2 : 1));
                  }
                }
                break;
              }

              if (its <= 1) { console.log('[EncodeX] video already <= 30fps, skipping'); return resolve(file); }
              console.log('[EncodeX] its=' + its + ', applying to all tracks');

              // Scale mvhd.duration (like ffmpeg -itsscale)
              var mvhd = _findBox(d, 'mvhd', moov.s + 8, moov.e);
              if (mvhd) {
                if (d[mvhd.s + 8] === 1) {
                  _w64(d, mvhd.s + 32, _r64(d, mvhd.s + 32) * its);
                } else {
                  _w32(d, mvhd.s + 24, _r32(d, mvhd.s + 24) * its);
                }
              }

              var changed = false;
              for (var t = 0; t < tracks.length; t++) {
                var mdia = _findBox(d, 'mdia', tracks[t].s + 8, tracks[t].e);
                if (!mdia) continue;
                var mdhd = _findBox(d, 'mdhd', mdia.s + 8, mdia.e);
                var stbl = _findBox(d, 'stbl', mdia.s + 8, mdia.e);
                if (!mdhd || !stbl) continue;

                // Scale tkhd.duration
                var tkhd = _findBox(d, 'tkhd', tracks[t].s + 8, tracks[t].e);
                if (tkhd) {
                  if (d[tkhd.s + 8] === 1) {
                    _w64(d, tkhd.s + 36, _r64(d, tkhd.s + 36) * its);
                  } else {
                    _w32(d, tkhd.s + 28, _r32(d, tkhd.s + 28) * its);
                  }
                }

                // Scale elst segment durations (edit list)
                var edts = _findBox(d, 'edts', tracks[t].s + 8, tracks[t].e);
                if (edts) {
                  var elst = _findBox(d, 'elst', edts.s + 8, edts.e);
                  if (elst) {
                    var elCnt = _r32(d, elst.s + 12);
                    var elVer = d[elst.s + 8];
                    var entrySize = elVer === 1 ? 20 : 12;
                    for (var e = 0; e < elCnt; e++) {
                      if (elVer === 1) {
                        _w64(d, elst.s + 16 + e * entrySize, _r64(d, elst.s + 16 + e * entrySize) * its);
                      } else {
                        _w32(d, elst.s + 16 + e * entrySize, _r32(d, elst.s + 16 + e * entrySize) * its);
                      }
                    }
                  }
                }

                // Scale stts sample deltas
                var stts = _findBox(d, 'stts', stbl.s + 8, stbl.e);
                if (!stts) continue;
                var cnt = _r32(d, stts.s + 12);
                if (cnt === 0) continue;
                for (var e = 0; e < cnt; e++) {
                  _w32(d, stts.s + 20 + e * 8, _r32(d, stts.s + 20 + e * 8) * its);
                }

                // Scale ctts composition offsets
                var ctts = _findBox(d, 'ctts', stbl.s + 8, stbl.e);
                if (ctts) {
                  var ctCnt = _r32(d, ctts.s + 12);
                  for (var e = 0; e < ctCnt; e++) {
                    _w32(d, ctts.s + 20 + e * 8, _r32(d, ctts.s + 20 + e * 8) * its);
                  }
                }

                // Scale mdhd.duration (with 64-bit fix)
                var tsOff = mdhd.s + 12 + (d[mdhd.s + 8] === 1 ? 16 : 8);
                if (d[mdhd.s + 8] === 1) {
                  _w64(d, tsOff + 4, _r64(d, tsOff + 4) * its);
                } else {
                  _w32(d, tsOff + 4, _r32(d, tsOff + 4) * its);
                }

                var hdlr2 = _findBox(d, 'hdlr', mdia.s + 8, mdia.e);
                var htype2 = hdlr2 ? String.fromCharCode(d[hdlr2.s+16],d[hdlr2.s+17],d[hdlr2.s+18],d[hdlr2.s+19]) : '?';
                console.log('[EncodeX] track ' + htype2 + ': ' + cnt + ' stts, dur x' + its);
                changed = true;
              }
              if (!changed) return resolve(file);
              if (onProgress) onProgress((lang === 'ru' ? 'Готово' : 'Done') + ' (100%)', 100);
              resolve(new File([buf], file.name, { type: file.type, lastModified: Date.now() }));
            }, 30);
          } catch(err) { reject(err); }
        }, 30);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // === SERVER PROCESSING (upload → ffmpeg → download, matches .bat exactly) ===
  function processViaServer(file, onProgress) {
    return new Promise(function(resolve, reject) {
      var api = window._encodex_api || 'https://encodex-api-production.up.railway.app';
      var authToken = window._encodex_token;
      var lang = window._encodex_currentLang || 'ru';

      if (!authToken) {
        reject(new Error(lang === 'ru' ? 'Нет токена' : 'No auth token'));
        return;
      }

      var jobId, usageToken, uploadToken, transcoderUrl;

      function checkRes(r, step) {
        if (!r.ok) throw new Error(step + ' HTTP ' + r.status);
        return r;
      }

      // 1. Allocate
      onProgress(lang === 'ru' ? 'Выделение ресурсов...' : 'Allocating...', 5);
      fetch(api + '/api/process/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
        body: JSON.stringify({ file_size: file.size })
      }).then(function(r) { return checkRes(r, 'allocate').json(); }).then(function(alloc) {
        if (!alloc.ok) { throw new Error(alloc.error || 'Allocate: not ok'); }

        jobId = alloc.job_id;
        usageToken = alloc.usage_token;
        uploadToken = alloc.upload_token;
        transcoderUrl = alloc.transcoder_url;

        // 2. Upload
        onProgress(lang === 'ru' ? 'Загрузка...' : 'Uploading...', 15);
        var fd = new FormData();
        fd.append('video', file);
        return fetch(transcoderUrl + '/api/process/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + uploadToken },
          body: fd
        });
      }).then(function(r) { return checkRes(r, 'upload').json(); }).then(function(uploadRes) {
        if (!uploadRes.ok) { throw new Error(uploadRes.error || 'Upload: not ok'); }

        // 3. Poll status
        return new Promise(function(pollResolve, pollReject) {
          var poll = function() {
            fetch(transcoderUrl + '/api/process/status?job_id=' + jobId)
              .then(function(r) { return checkRes(r, 'status').json(); }).then(function(s) {
                if (s.status === 200) { pollResolve(); return; }
                if (s.status >= 400) { pollReject(new Error(s.error || 'Status error ' + s.status)); return; }
                if (s.progress) onProgress((lang === 'ru' ? 'Обработка' : 'Processing') + ' ' + s.progress + '%', s.progress);
                setTimeout(poll, 2000);
              }).catch(pollReject);
          };
          poll();
        });
      }).then(function() {
        // 4. Download
        onProgress(lang === 'ru' ? 'Скачивание...' : 'Downloading...', 90);
        return fetch(transcoderUrl + '/api/process/result?job_id=' + jobId + '&token=' + usageToken);
      }).then(function(r) { return checkRes(r, 'download').blob(); }).then(function(blob) {
        var patched = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
        pendingUsageToken = usageToken;
        onProgress((lang === 'ru' ? 'Готово!' : 'Done!'), 100);
        resolve(patched);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  // === INTERCEPT FILE CHANGE (local processing) ===
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
    processViaServer(file, function(label, pct) { updateOverlay(label, pct); }).then(injectIntoForm).catch(function(err) {
      processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
      console.error('[EncodeX] Server processing failed:', err.message || err);
      alert((window._encodex_currentLang === 'ru' ? 'EncodeX: ошибка — ' : 'EncodeX: error — ') + (err.message || err));
    });
  }, true);

  // === INTERCEPT DRAG-AND-DROP (local processing) ===
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
    processViaServer(file, function(label, pct) { updateOverlay(label, pct); }).then(injectIntoForm).catch(function(err) {
      processing = false; pendingInput = null; pendingDropTarget = null; removeOverlay();
      console.error('[EncodeX] Server processing failed:', err.message || err);
      alert((window._encodex_currentLang === 'ru' ? 'EncodeX: ошибка — ' : 'EncodeX: error — ') + (err.message || err));
    });
  }, true);

  // === LISTEN FOR RESPONSES FROM content.js ===
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'encodex-content') return;
    var p = e.data.payload || {};
    switch (e.data.type) {
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
      if (e.detail.token) {
        tokenReceived = true;
        window._encodex_token = e.detail.token;
      }
      if (e.detail.fps) window._encodex_fps = e.detail.fps;
      if (e.detail.api) window._encodex_api = e.detail.api;
    }
  });

  console.log('[EncodeX] HQ Upload inject loaded');
})();