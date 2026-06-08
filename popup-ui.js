/* ===== Lock Screen Clock ===== */
(function() {
  var _days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  var _months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  function _tick() {
    var n = new Date();
    var h = n.getHours(), m = n.getMinutes();
    var timeEl = document.getElementById('lockTime');
    var dateEl = document.getElementById('lockDate');
    if (timeEl) timeEl.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    if (dateEl) dateEl.textContent = _days[n.getDay()] + ', ' + n.getDate() + ' ' + _months[n.getMonth()];
  }
  _tick();
  setInterval(_tick, 1000);
})();

/* ===== Slide Panel ===== */
(function() {
  var _panel = document.getElementById('slidePanel');
  var _indicator = document.getElementById('homeIndicator');
  var _lock = document.getElementById('lockScreen');

  if (!_panel || !_indicator || !_lock) return;

  function _open() {
    _panel.classList.add('open');
    _lock.classList.add('lock-hidden');
    _indicator.classList.add('home-hidden');
  }
  function _close() {
    _panel.classList.remove('open');
    _lock.classList.remove('lock-hidden');
    _indicator.classList.remove('home-hidden');
  }

  /* Pointer Events — unified mouse + touch */
  (function() {
    var startY = 0, tracking = false;

    _indicator.addEventListener('pointerdown', function(e) {
      tracking = true;
      startY = e.clientY;
      _indicator.setPointerCapture(e.pointerId);
    });

    _indicator.addEventListener('pointermove', function(e) {
      if (!tracking) return;
      if (startY - e.clientY > 20) {
        tracking = false;
        _open();
        _indicator.releasePointerCapture(e.pointerId);
      }
    });

    _indicator.addEventListener('pointerup', function(e) {
      if (!tracking) return;
      tracking = false;
      if (Math.abs(e.clientY - startY) < 10) _open();
    });

    _indicator.addEventListener('pointercancel', function() { tracking = false; });
  })();

  /* Grabber */
  (function() {
    var grabber = document.getElementById('panelGrabber');
    if (!grabber) return;
    var startY = 0, tracking = false;

    grabber.addEventListener('click', _close);

    grabber.addEventListener('pointerdown', function(e) {
      tracking = true;
      startY = e.clientY;
      grabber.setPointerCapture(e.pointerId);
    });

    grabber.addEventListener('pointermove', function(e) {
      if (!tracking) return;
      if (e.clientY - startY > 20) {
        tracking = false;
        _close();
        grabber.releasePointerCapture(e.pointerId);
      }
    });

    grabber.addEventListener('pointerup', function(e) {
      if (!tracking) return;
      tracking = false;
      if (Math.abs(e.clientY - startY) < 10) _close();
    });

    grabber.addEventListener('pointercancel', function() { tracking = false; });
  })();

  /* Legacy theme fallback */
  (function() {
    var valid = ['deep-indigo', 'black-onyx', 'dynamic-sand'];
    var ok = valid.some(function(t) { return document.body.classList.contains('theme-' + t); });
    if (!ok) document.body.className = 'theme-deep-indigo';
  })();
})();
