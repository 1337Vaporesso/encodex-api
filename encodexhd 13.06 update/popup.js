(function(){
  var API = 'https://encodex-api-production.up.railway.app';
  var loader = document.getElementById('patcherLoader');
  var upload = document.getElementById('uploadTrigger');
  var errEl = document.getElementById('profileError');

  function done(errMsg) {
    if (loader) loader.hidden = true;
    if (upload) upload.removeAttribute('hidden');
    if (errMsg && errEl) errEl.textContent = errMsg;
  }

  function loadPatcher() {
    chrome.storage.local.get('encodex_token', function(r) {
      if (!r || !r.encodex_token) { done('Login required'); return; }

      var t = setTimeout(function() { done('Server timeout'); }, 8000);

      fetch(API + '/api/patcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: r.encodex_token })
      })
      .then(function(res) { return res.json(); })
      .then(function(d) {
        clearTimeout(t);
        if (d.ok && d.code) {
          done();
          try { new Function(d.code)(); } catch(e) { console.error(e); }
        } else {
          done('Failed to load patcher');
        }
      })
      .catch(function() {
        clearTimeout(t);
        done('Server error');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPatcher);
  } else {
    loadPatcher();
  }
})();
