// client-side auth: accounts + session in localStorage (demo / no backend)
(function () {
  'use strict';

  var ACCOUNTS_KEY = 'backpack_accounts_v1';
  var SESSION_KEY = 'backpack_session_v1';
  var MIN_PASSWORD = 6;

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function getAccounts() {
    try {
      var raw = localStorage.getItem(ACCOUNTS_KEY);
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === 'object' ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function hashPassword(password) {
    if (!window.crypto || !crypto.subtle) {
      return Promise.resolve(btoa(unescape(encodeURIComponent(password))));
    }
    var enc = new TextEncoder().encode(password);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    });
  }

  function setSession(user) {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email: user.email, name: user.name })
    );
  }

  window.getBackpackUser = function () {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.email) return null;
      return { email: s.email, name: s.name || 'Student' };
    } catch (e) {
      return null;
    }
  };

  window.isBackpackLoggedIn = function () {
    return !!window.getBackpackUser();
  };

  window.logoutBackpack = function () {
    setSession(null);
    if (typeof window.clearBackpackApiToken === 'function') {
      window.clearBackpackApiToken();
    }
    window.location.reload();
  };

  /** Call after successful /auth/login or /auth/signup (backend) so header matches */
  window.applyBackpackApiUser = function (user) {
    if (!user || !user.email) return;
    setSession({ email: user.email, name: user.name || 'Student' });
    updateAuthUI();
  };

  function updateAuthUI() {
    var guest = document.getElementById('authGuestWrap');
    var userWrap = document.getElementById('authUserWrap');
    var greeting = document.getElementById('authGreeting');
    var logoutBtn = document.getElementById('authLogoutBtn');
    var session = window.getBackpackUser();
    if (!guest || !userWrap) return;
    if (session) {
      guest.setAttribute('hidden', '');
      userWrap.removeAttribute('hidden');
      if (greeting) greeting.textContent = 'Hi, ' + session.name + '!';
      if (greeting) greeting.removeAttribute('hidden');
      if (logoutBtn) logoutBtn.removeAttribute('hidden');
    } else {
      guest.removeAttribute('hidden');
      userWrap.setAttribute('hidden', '');
      if (greeting) {
        greeting.textContent = '';
        greeting.setAttribute('hidden', '');
      }
      if (logoutBtn) logoutBtn.setAttribute('hidden', '');
    }
    document.dispatchEvent(
      new CustomEvent('backpack-auth-changed', {
        detail: { user: session }
      })
    );
  }
  window.updateAuthUI = updateAuthUI;

  /*  messages (no browser “localhost …” dialogs) ---- */
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
    document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  window.showAppToast = function (message, variant) {
    var el = ensureAppToast();
    if (!message) return;
    el.textContent = message;
    el.className = 'app-toast' + (variant === 'error' ? ' app-toast--error' : '');
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
    var input = ov.querySelector('#appSheetInput');
    var cancel = ov.querySelector('#appSheetCancel');
    var ok = ov.querySelector('#appSheetOk');
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
    document.addEventListener('keydown', function onKey(e) {
      if (!ov || ov.hasAttribute('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(sheetMode === 'prompt' ? null : false);
      } else if (e.key === 'Enter' && sheetMode === 'prompt' && document.activeElement === input) {
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
    ov.innerHTML =
      '<div class="app-sheet" role="dialog" aria-modal="true">' +
      '<p id="appSheetText" class="app-sheet-text"></p>' +
      '<input type="text" id="appSheetInput" class="app-sheet-input" hidden />' +
      '<div class="app-sheet-actions">' +
      '<button type="button" class="app-sheet-btn app-sheet-btn--ghost" id="appSheetCancel">Cancel</button>' +
      '<button type="button" class="app-sheet-btn app-sheet-btn--primary" id="appSheetOk">OK</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    wireAppSheetOnce(ov);
    return ov;
  }

  window.showAppConfirm = function (message) {
    return new Promise(function (resolve) {
      var ov = ensureAppSheet();
      var input = ov.querySelector('#appSheetInput');
      var text = ov.querySelector('#appSheetText');
      sheetMode = 'confirm';
      sheetResolve = resolve;
      text.textContent = message || '';
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
      var input = ov.querySelector('#appSheetInput');
      var text = ov.querySelector('#appSheetText');
      sheetMode = 'prompt';
      sheetResolve = resolve;
      text.textContent = message || '';
      if (input) {
        input.value = defaultValue != null ? String(defaultValue) : '';
        input.removeAttribute('hidden');
        input.classList.add('app-sheet-input--show');
        setTimeout(function () {
          try {
            input.focus();
            input.select();
          } catch (e) {}
        }, 50);
      }
      ov.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    });
  };

  /** Used by accountcreate.html */
  window.registerBackpackAccount = async function (name, email, password) {
    name = String(name || '').trim();
    email = normalizeEmail(email);
    password = String(password || '');
    if (!name || !email) return { ok: false, message: 'Please fill in all fields.' };
    if (password.length < MIN_PASSWORD) {
      return { ok: false, message: 'Password must be at least ' + MIN_PASSWORD + ' characters.' };
    }
    var accounts = getAccounts();
    if (accounts[email]) {
      return { ok: false, message: 'That email is already registered. Try logging in.' };
    }
    var hash = await hashPassword(password);
    accounts[email] = { name: name, passwordHash: hash };
    saveAccounts(accounts);
    setSession({ email: email, name: name });
    updateAuthUI();
    return { ok: true };
  };

  window.localBackpackSignup = async function (name, email, password) {
    var result = await window.registerBackpackAccount(name, email, password);
    if (!result.ok) throw new Error(result.message || 'Signup failed');
    var user = window.getBackpackUser();
    return { user: user };
  };

  window.localBackpackLogin = async function (email, password) {
    email = normalizeEmail(email);
    password = String(password || '');
    if (!email || !password) throw new Error('Please enter email and password.');
    var accounts = getAccounts();
    var row = accounts[email];
    if (!row) throw new Error('No account found for that email. Please sign up first.');
    var hash = await hashPassword(password);
    if (row.passwordHash !== hash) throw new Error('Wrong password. Try again.');
    setSession({ email: email, name: row.name });
    updateAuthUI();
    return { user: window.getBackpackUser() };
  };

  document.addEventListener('DOMContentLoaded', function () {
    updateAuthUI();
    var logoutBtn = document.getElementById('authLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        window.logoutBackpack();
      });
    }
    try {
      if (document.getElementById('loginModal')) {
        var p = new URLSearchParams(window.location.search);
        if (p.get('login') === '1' && typeof openModal === 'function') {
          openModal('loginModal');
        }
      }
    } catch (e) {}
  });
})();
