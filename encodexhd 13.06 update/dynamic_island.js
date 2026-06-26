(function() {
  'use strict';

  if (document.getElementById('encodex-dynamic-island')) return;

  var badgeId = 'encodex-dynamic-island';
  var styleId = 'encodex-dynamic-styles';

  // Theme-aware colors
  var themes = {
    dark: {
      bg: 'rgba(12,10,29,0.78)',
      border: 'rgba(139,92,246,0.25)',
      shadow: 'rgba(139,92,246,0.15)',
      text: '#e8e4f8',
      highlight: '#a78bfa',
      quality: 'rgba(167,139,250,0.65)',
      dot: '#8b5cf6',
      dotShadow: 'rgba(139,92,246,0.4)',
      close: 'rgba(255,255,255,0.06)',
      closeHover: 'rgba(255,255,255,0.12)',
      closeIcon: 'rgba(255,255,255,0.35)',
      closeIconHover: 'rgba(255,255,255,0.6)',
      divider: 'rgba(139,92,246,0.2)'
    },
    light: {
      bg: 'rgba(245,243,250,0.88)',
      border: 'rgba(139,92,246,0.18)',
      shadow: 'rgba(139,92,246,0.10)',
      text: '#2d1b4e',
      highlight: '#7c3aed',
      quality: 'rgba(124,58,237,0.55)',
      dot: '#7c3aed',
      dotShadow: 'rgba(124,58,237,0.3)',
      close: 'rgba(0,0,0,0.04)',
      closeHover: 'rgba(0,0,0,0.08)',
      closeIcon: 'rgba(0,0,0,0.30)',
      closeIconHover: 'rgba(0,0,0,0.50)',
      divider: 'rgba(124,58,237,0.15)'
    },
    purple: {
      bg: 'rgba(20,10,45,0.82)',
      border: 'rgba(168,85,247,0.30)',
      shadow: 'rgba(168,85,247,0.20)',
      text: '#f3eaff',
      highlight: '#c084fc',
      quality: 'rgba(192,132,252,0.70)',
      dot: '#a855f7',
      dotShadow: 'rgba(168,85,247,0.5)',
      close: 'rgba(255,255,255,0.06)',
      closeHover: 'rgba(255,255,255,0.14)',
      closeIcon: 'rgba(255,255,255,0.35)',
      closeIconHover: 'rgba(255,255,255,0.6)',
      divider: 'rgba(168,85,247,0.25)'
    }
  };
  var defaultTheme = 'dark';

  function buildCss(c) {
    var rgbaMatch = c.dotShadow.match(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/);
    var dotShadowZero = rgbaMatch ? 'rgba(' + rgbaMatch[1] + ',' + rgbaMatch[2] + ',' + rgbaMatch[3] + ',0)' : 'transparent';
    return (
      '#' + badgeId + ' {\n' +
      '  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);\n' +
      '  z-index: 999999; display: inline-flex; align-items: center; gap: 8px;\n' +
      '  padding: 7px 16px 7px 12px; border-radius: 100px;\n' +
      '  background: ' + c.bg + ';\n' +
      '  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);\n' +
      '  border: 1px solid ' + c.border + ';\n' +
      '  box-shadow: 0 0 20px ' + c.shadow + ', 0 4px 16px rgba(0,0,0,0.3);\n' +
      '  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);\n' +
      '  opacity: 0; transform: translateX(-50%) translateY(-4px);\n' +
      '  pointer-events: auto; white-space: nowrap;\n' +
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
      '}\n' +
      '#' + badgeId + '.visible { opacity: 1; transform: translateX(-50%) translateY(0); }\n' +
      '#' + badgeId + '.closing { opacity: 0; transform: translateX(-50%) translateY(-6px); }\n' +
      '#' + badgeId + ' .ex-dot {\n' +
      '  width: 7px; height: 7px; border-radius: 50%;\n' +
      '  background: ' + c.dot + '; flex-shrink: 0;\n' +
      '  animation: exDotPulse 1.8s ease-in-out infinite;\n' +
      '}\n' +
      '@keyframes exDotPulse {\n' +
      '  0%, 100% { box-shadow: 0 0 0 0 ' + c.dotShadow + '; opacity: 1; }\n' +
      '  50% { box-shadow: 0 0 0 6px ' + dotShadowZero + '; opacity: 0.7; }\n' +
      '}\n' +
      '#' + badgeId + ' .ex-text {\n' +
      '  font-size: 12px; font-weight: 700; color: ' + c.text + ';\n' +
      '  letter-spacing: 0.02em; line-height: 1;\n' +
      '}\n' +
      '#' + badgeId + ' .ex-text .ex-highlight { color: ' + c.highlight + '; }\n' +
      '#' + badgeId + ' .ex-divider {\n' +
      '  width: 1px; height: 12px; background: ' + c.divider + ';\n' +
      '  margin: 0 2px;\n' +
      '}\n' +
      '#' + badgeId + ' .ex-quality {\n' +
      '  font-size: 9px; font-weight: 600; color: ' + c.quality + ';\n' +
      '  letter-spacing: 0.06em; text-transform: uppercase;\n' +
      '}\n' +
      '#' + badgeId + ' .ex-close {\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  width: 18px; height: 18px; border-radius: 50%;\n' +
      '  background: ' + c.close + '; border: none; cursor: pointer;\n' +
      '  color: ' + c.closeIcon + '; flex-shrink: 0; padding: 0;\n' +
      '  transition: all 0.2s; margin-left: 4px;\n' +
      '}\n' +
      '#' + badgeId + ' .ex-close:hover { background: ' + c.closeHover + '; color: ' + c.closeIconHover + '; }\n'
    );
  }

  function getTheme(callback) {
    try {
      chrome.storage.local.get('encodex_theme', function(res) {
        callback(res.encodex_theme || defaultTheme);
      });
    } catch(e) {
      callback(defaultTheme);
    }
  }

  getTheme(function(themeName) {
    var c = themes[themeName] || themes[defaultTheme];

    var styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = buildCss(c);
    (document.head || document.documentElement).appendChild(styleEl);

    var badge = document.createElement('div');
    badge.id = badgeId;
    badge.innerHTML =
      '<span class="ex-dot"></span>' +
      '<span class="ex-text">EncodeX <span class="ex-highlight">\u00d7</span></span>' +
      '<span class="ex-divider"></span>' +
      '<span class="ex-quality">High Quality</span>' +
      '<button class="ex-close" aria-label="Close">\u2715</button>';

    document.body.appendChild(badge);

    requestAnimationFrame(function() {
      badge.classList.add('visible');
    });

    badge.querySelector('.ex-close').addEventListener('click', function() {
      badge.classList.remove('visible');
      badge.classList.add('closing');
      setTimeout(function() { badge.remove(); }, 400);
    });
  });

})();
