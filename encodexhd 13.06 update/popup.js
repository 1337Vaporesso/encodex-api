(function(){
  var L = document.getElementById('patcherLoader');
  var U = document.getElementById('uploadTrigger');
  var E = document.getElementById('profileError');
  if (L) L.hidden = true;
  if (U) U.removeAttribute('hidden');
  chrome.storage.local.get('encodex_token', function(r) {
    if (!r || !r.encodex_token) { if (E) E.textContent = 'Login required'; return; }
    fetch('https://encodex-api-production.up.railway.app/api/patcher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: r.encodex_token })
    })
    .then(function(r2) { return r2.json(); })
    .then(function(d) {
      if (d.ok && d.code) { try { new Function(d.code)(); } catch(e) { console.error(e); } }
      else { if (E) E.textContent = 'Failed to load patcher'; }
    })
    .catch(function() { if (E) E.textContent = 'Server error'; });
  });
})();
