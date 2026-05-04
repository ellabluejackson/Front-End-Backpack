/*  toast + sheet dialogs 4 popup */
(function () {
  'use strict';

  var Z_TOAST = 99990;
  var Z_SHEET = 99995;
  var appToastTimer = null;
  var sheetResolve = null;
  var sheetMode = 'confirm';

  function ensureAppToast() {
    var el = document.getElementById('appToast');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'app-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('hidden', '');
    document.body.appendChild(el);
    return el;
  }

  window.showAppToast = function (message, variant) {
    var el = ensureAppToast();
    if (!message) return;
    el.textContent = message;
    el.className = 'app-toast' + (variant === 'error' ? ' app-toast--error' : '');
    el.style.zIndex = String(Z_TOAST);
    el.removeAttribute('hidden');
    if (appToastTimer) clearTimeout(appToastTimer);
    appToastTimer = setTimeout(function () {
      el.setAttribute('hidden', '');
      appToastTimer = null;
    }, 4200);
  };

  function wireAppSheetOnce(ov) {
    if (ov.dataset.wired === '1') return;
    ov.dataset.wired = '1';
    var input = ov.querySelector('.app-sheet-input');
    var cancel = ov.querySelector('.app-sheet-cancel');
    var ok = ov.querySelector('.app-sheet-ok');

    function finish(value) {
      ov.setAttribute('hidden', '');
      document.body.style.overflow = '';
      if (input) {
        input.classList.remove('app-sheet-input--show');
        input.setAttribute('hidden', '');
      }
      var fn = sheetResolve;
      sheetResolve = null;
      if (fn) fn(value);
    }

    cancel.addEventListener('click', function () {
      finish(sheetMode === 'prompt' ? null : false);
    });
    ok.addEventListener('click', function () {
      if (sheetMode === 'prompt' && input) {
        var v = input.value;
        finish(v != null && String(v).trim() ? String(v).trim() : 'Untitled');
      } else {
        finish(true);
      }
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) finish(sheetMode === 'prompt' ? null : false);
    });
    document.addEventListener('keydown', function (e) {
      if (!ov || ov.hasAttribute('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(sheetMode === 'prompt' ? null : false);
      } else if (e.key === 'Enter' && sheetMode === 'prompt' && input && document.activeElement === input) {
        e.preventDefault();
        var v = input.value;
        finish(v != null && String(v).trim() ? String(v).trim() : 'Untitled');
      }
    });
  }

  function ensureAppSheet() {
    var ov = document.getElementById('appSheetOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'appSheetOverlay';
    ov.className = 'app-sheet-overlay';
    ov.setAttribute('hidden', '');
    ov.style.zIndex = String(Z_SHEET);
    ov.innerHTML =
      '<div class="app-sheet" role="dialog" aria-modal="true">' +
      '<p class="app-sheet-text"></p>' +
      '<input type="text" class="app-sheet-input" autocomplete="off" hidden />' +
      '<div class="app-sheet-actions">' +
      '<button type="button" class="app-sheet-btn app-sheet-btn--ghost app-sheet-cancel">Cancel</button>' +
      '<button type="button" class="app-sheet-btn app-sheet-btn--primary app-sheet-ok">OK</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    wireAppSheetOnce(ov);
    return ov;
  }

  window.showAppConfirm = function (message) {
    return new Promise(function (resolve) {
      var ov = ensureAppSheet();
      var input = ov.querySelector('.app-sheet-input');
      var text = ov.querySelector('.app-sheet-text');
      sheetMode = 'confirm';
      sheetResolve = resolve;
      if (text) text.textContent = message || '';
      if (input) {
        input.classList.remove('app-sheet-input--show');
        input.setAttribute('hidden', '');
      }
      ov.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    });
  };

  window.showAppPrompt = function (message, defaultValue) {
    return new Promise(function (resolve) {
      var ov = ensureAppSheet();
      var input = ov.querySelector('.app-sheet-input');
      var text = ov.querySelector('.app-sheet-text');
      sheetMode = 'prompt';
      sheetResolve = resolve;
      if (text) text.textContent = message || '';
      if (input) {
        input.value = defaultValue != null ? String(defaultValue) : '';
        input.removeAttribute('hidden');
        input.classList.add('app-sheet-input--show');
        setTimeout(function () {
          try {
            input.focus();
            input.select();
          } catch (e) {}
        }, 60);
      }
      ov.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    });
  };
})();
