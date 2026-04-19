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
    updateAuthUI();
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
