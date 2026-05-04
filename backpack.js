/* In-app toast + sheet (bundled so localhost:5500 always loads it with this file) */
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

// backpack — folders, notebooks, and flashcards -yr
var bpItems = [];
var bpCurrentFolder = null;
var bpView = 'browse';
var bpEditingItem = null;
var bpTestIndex = 0;
var bpTestFlipped = false;
var BP_STORAGE_PREFIX = 'backpack_data_v1::';
var BP_EMOJI_STORAGE_PREFIX = 'backpack_folder_emoji_v1::';
var bpPendingFolderEmoji = null;

function bpCurrentUserEmail() {
  if (typeof window.getBackpackUser !== 'function') return null;
  var session = window.getBackpackUser();
  return session && session.email ? String(session.email).toLowerCase() : null;
}

function bpStorageKey() {
  var email = bpCurrentUserEmail();
  return email ? BP_STORAGE_PREFIX + email : null;
}

function bpSaveState() {
  var key = bpStorageKey();
  if (!key) return;
  var payload = {
    items: bpItems,
    currentFolder: bpCurrentFolder,
    view: bpView,
    editingItemId: bpEditingItem ? bpEditingItem.id : null
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

function bpResetState() {
  bpItems = [];
  bpCurrentFolder = null;
  bpView = 'browse';
  bpEditingItem = null;
  bpTestIndex = 0;
  bpTestFlipped = false;
}

function bpLoadState() {
  var key = bpStorageKey();
  if (!key) {
    bpResetState();
    return;
  }
  try {
    var raw = localStorage.getItem(key);
    if (!raw) {
      bpResetState();
      return;
    }
    var parsed = JSON.parse(raw);
    bpItems = Array.isArray(parsed.items) ? parsed.items : [];
    bpCurrentFolder = parsed.currentFolder || null;
    bpView = parsed.view || 'browse';
    bpEditingItem = parsed.editingItemId ? bpFind(parsed.editingItemId) : null;
    if (!bpEditingItem && bpView !== 'browse') bpView = 'browse';
    bpTestIndex = 0;
    bpTestFlipped = false;
  } catch (e) {
    bpResetState();
  }
}

function bpId() {
  return 'bp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

function bpChildren(parentId) {
  return bpItems.filter(function(i) { return i.parentId === parentId; });
}

function bpFind(id) {
  return bpItems.find(function(i) { return i.id === id; });
}

function bpBreadcrumb() {
  var path = [];
  var id = bpCurrentFolder;
  while (id) {
    var item = bpFind(id);
    if (!item) break;
    path.unshift(item);
    id = item.parentId;
  }
  return path;
}

// html escaping helpers -yr
function escHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function numId(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && v.indexOf('fc_') === 0) return parseInt(v.slice(3), 10) || null;
  var n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function bpFolderEmojiStorageKey() {
  var email = bpCurrentUserEmail();
  return email ? BP_EMOJI_STORAGE_PREFIX + email : null;
}

function bpLoadFolderEmojiMap() {
  var key = bpFolderEmojiStorageKey();
  if (!key) return {};
  try {
    var raw = localStorage.getItem(key);
    var o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

function bpSaveFolderEmojiMap(map) {
  var key = bpFolderEmojiStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(map || {}));
  } catch (e) {}
}

function bpSetFolderEmojiByNumericId(numericId, emojiChar) {
  if (numericId == null || !emojiChar) return;
  var map = bpLoadFolderEmojiMap();
  map[String(numericId)] = emojiChar;
  bpSaveFolderEmojiMap(map);
}

function bpMergeEmojiFromStorage() {
  var map = bpLoadFolderEmojiMap();
  bpItems.forEach(function (item) {
    if (item.type === 'folder') {
      var nid = numId(item.id);
      if (nid != null && map[String(nid)]) item.emoji = map[String(nid)];
    } else if (item.type === 'flashcards' && item._folderId != null && map[String(item._folderId)]) {
      item.emoji = map[String(item._folderId)];
    }
  });
}

// Load from backend and build bpItems
function bpBuildItems(folders, notes, flashcards) {
  var items = [];
  function hasSubfolders(fid) {
    var n = numId(fid);
    return n != null && folders.some(function(f) { return numId(f.parent_id) === n; });
  }
  function hasNotesInFolder(fid) {
    var n = numId(fid);
    return n != null && notes.some(function(note) { return numId(note.folder_id) === n; });
  }
  function cardsInFolder(fid) {
    var n = numId(fid);
    if (n == null) return [];
    return flashcards
      .filter(function(c) { return numId(c.folder_id) === n; })
      .map(function(c) { return { id: c.id, question: c.front, answer: c.back }; });
  }
  function toParentId(v) { return v != null ? String(v) : null; }
  function folderEmojiFromApi(f) {
    if (f.emoji != null && String(f.emoji).trim() !== '') return String(f.emoji).trim();
    if (f.icon != null && String(f.icon).trim() !== '') return String(f.icon).trim();
    return null;
  }
  folders.forEach(function(f) {
    var hasCards = cardsInFolder(f.id).length > 0;
    var markedAsFlashcardSet = f.is_flashcard_set === true || f.is_flashcard_set === 1;
    var isFlashcardSet = markedAsFlashcardSet || (!hasSubfolders(f.id) && !hasNotesInFolder(f.id) && hasCards);
    var rowEmoji = folderEmojiFromApi(f);
    if (isFlashcardSet) {
      items.push({
        id: 'fc_' + f.id,
        _folderId: f.id,
        type: 'flashcards',
        name: f.name,
        parentId: toParentId(f.parent_id),
        content: cardsInFolder(f.id),
        emoji: rowEmoji
      });
    } else {
      items.push({
        id: String(f.id),
        type: 'folder',
        name: f.name,
        parentId: toParentId(f.parent_id),
        content: null,
        emoji: rowEmoji
      });
    }
  });
  notes.forEach(function(n) {
    items.push({
      id: 'note_' + n.id,
      _noteId: n.id,
      type: 'notebook',
      name: n.title,
      parentId: toParentId(n.folder_id),
      content: n.content || ''
    });
  });
  bpItems = items;
  bpMergeEmojiFromStorage();
}

function bpLoadFromBackend() {
  return Promise.all([getFolders(), getNotes(), getFlashcards()]).then(function(results) {
    bpBuildItems(results[0], results[1], results[2]);
    return Promise.resolve();
  });
}

function bpBackendReady() {
  return typeof createFolder === 'function' &&
    typeof createNote === 'function' &&
    typeof updateNote === 'function' &&
    typeof deleteFolder === 'function' &&
    typeof deleteNote === 'function';
}

// -- crud -yr --

function bpCreate(type, name, parentId, emoji) {
  var item = {
    id: bpId(),
    type: type,
    name: (name && name.trim()) ? name.trim() : 'Untitled',
    parentId: parentId === undefined ? bpCurrentFolder : parentId,
    content: type === 'flashcards' ? [] : '',
    emoji: emoji || null
  };
  bpItems.push(item);
  bpSaveState();
  bpRender();
  return item;
}

function bpDelete(id) {
  var item = bpFind(id);
  if (!item) return;
  if (!bpBackendReady()) {
    var toDelete = [id];
    function gather(pid) {
      bpItems.forEach(function(i) {
        if (i.parentId === pid) {
          toDelete.push(i.id);
          gather(i.id);
        }
      });
    }
    gather(id);
    bpItems = bpItems.filter(function(i) { return toDelete.indexOf(i.id) === -1; });
    if (bpEditingItem && toDelete.indexOf(bpEditingItem.id) !== -1) {
      bpEditingItem = null;
      bpView = 'browse';
    }
    bpSaveState();
    bpRender();
    return;
  }
  var p = null;
  if (item.type === 'folder') {
    p = deleteFolder(Number(item.id));
  } else if (item.type === 'notebook') {
    p = deleteNote(item._noteId);
  } else if (item.type === 'flashcards') {
    p = deleteFolder(item._folderId);
  } else {
    return;
  }
  p.then(function() {
    if (bpEditingItem && (bpEditingItem.id === id || bpEditingItem.parentId === id)) {
      bpEditingItem = null;
      bpView = 'browse';
    }
    return bpLoadFromBackend();
  }).then(function() {
    bpRender();
  }).catch(function(err) {
    if (err && err.status) {
      // server responded with an error — don't delete locally
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('Could not delete: server error ' + err.status, 'error');
      } else {
        console.warn('Could not delete: server error ' + err.status);
      }
    } else {
      // network unreachable — remove locally so the user isn't stuck
      bpItems = bpItems.filter(function(i) { return i.id !== id; });
      if (bpEditingItem && (bpEditingItem.id === id || bpEditingItem.parentId === id)) {
        bpEditingItem = null;
        bpView = 'browse';
      }
      bpSaveState();
      bpRender();
    }
  });
}

function bpDeleteClick(ev, id) {
  if (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  bpConfirmDelete(id);
}

function bpConfirmDelete(id) {
  var item = bpFind(id);
  if (!item) return;
  var msg = 'Delete "' + item.name + '"?';
  if (typeof window.showAppConfirm !== 'function') {
    console.error('app-ui.js must load before backpack.js (showAppConfirm missing).');
    return;
  }
  window.showAppConfirm(msg).then(function (ok) {
    if (ok) bpDelete(id);
  });
}

// -- navigation -yr --

function bpOpen(id) {
  var item = bpFind(id);
  if (!item) return;
  if (item.type === 'folder') {
    bpCurrentFolder = item.id;
    bpView = 'browse';
    bpSaveState();
    bpRender();
  } else if (item.type === 'notebook') {
    bpEditingItem = item;
    bpView = 'notebook';
    bpSaveState();
    bpRender();
  } else if (item.type === 'flashcards') {
    bpEditingItem = item;
    bpView = 'flashcards';
    bpSaveState();
    bpRender();
  }
}

function bpGoRoot() {
  bpCurrentFolder = null;
  bpView = 'browse';
  bpEditingItem = null;
  bpSaveState();
  bpRender();
}

function bpGoFolder(id) {
  bpCurrentFolder = id;
  bpView = 'browse';
  bpEditingItem = null;
  bpSaveState();
  bpRender();
}

function bpGoBack() {
  if (bpView === 'test') {
    bpView = 'flashcards';
    bpSaveState();
    bpRender();
    return;
  }
  if (bpView === 'notebook' || bpView === 'flashcards') {
    bpEditingItem = null;
    bpView = 'browse';
    bpSaveState();
    bpRender();
    return;
  }
  if (bpCurrentFolder) {
    var folder = bpFind(bpCurrentFolder);
    bpCurrentFolder = folder ? folder.parentId : null;
    bpSaveState();
    bpRender();
  }
}

// -- add menu -yr --

function bpShowAddMenu() {
  var menu = document.getElementById('bpAddMenu');
  if (menu) menu.classList.toggle('show');
}

function bpPromptCreate(type) {
  var menu = document.getElementById('bpAddMenu');
  if (menu) menu.classList.remove('show');

  var isRoot = bpCurrentFolder === null;

  if ((type === 'notebook' || type === 'flashcards') && isRoot) {
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('Open a folder first — notebooks & flashcards live inside folders.', 'error');
    }
    return;
  }

  var labels = { folder: 'folder', notebook: 'notebook', flashcards: 'flashcard set' };
  var promptMsg = 'Name your new ' + labels[type] + ':';

  function continueCreate(name) {
    if (name === null || name === undefined) return;
    name = (name && String(name).trim()) ? String(name).trim() : 'Untitled';
    if (type === 'folder') {
      bpPickEmoji(function (emoji) {
        bpDoCreate(type, name, emoji);
      });
    } else {
      bpDoCreate(type, name, null);
    }
  }

  if (typeof window.showAppPrompt !== 'function') {
    console.error('app-ui.js must load before backpack.js (showAppPrompt missing).');
    return;
  }
  window.showAppPrompt(promptMsg, 'Untitled').then(continueCreate);
}

function bpDoCreate(type, name, emoji) {
  var parentId = numId(bpCurrentFolder);
  if (!bpBackendReady()) {
    bpCreate(type, name, bpCurrentFolder, emoji);
    return;
  }
  var p = null;
  if (type === 'folder' || type === 'flashcards') {
    var folderBody = { name: name, parent_id: parentId, is_flashcard_set: type === 'flashcards' };
    if (emoji) folderBody.emoji = emoji;
    p = createFolder(folderBody);
  } else {
    p = createNote({ title: name, content: '', folder_id: parentId });
  }
  p.then(function (res) {
    if (type === 'folder' && emoji) {
      var newId = res && (res.id != null ? res.id : res.folder_id);
      if (newId != null) {
        bpSetFolderEmojiByNumericId(newId, emoji);
      } else {
        bpPendingFolderEmoji = { name: name, parentId: parentId, emoji: emoji };
      }
    }
    return bpLoadFromBackend();
  })
    .then(function () {
      if (bpPendingFolderEmoji) {
        var pend = bpPendingFolderEmoji;
        bpPendingFolderEmoji = null;
        var match = bpItems.find(function (i) {
          if (i.type !== 'folder' || i.name !== pend.name) return false;
          var ip = numId(i.parentId);
          var pp = pend.parentId == null ? null : pend.parentId;
          return ip === pp;
        });
        if (match && pend.emoji) {
          var mid = numId(match.id);
          if (mid != null) bpSetFolderEmojiByNumericId(mid, pend.emoji);
        }
      }
      bpMergeEmojiFromStorage();
      bpSaveState();
      bpRender();
    })
    .catch(function () {
      bpCreate(type, name, bpCurrentFolder, emoji);
    });
}

function bpPickEmoji(callback) {
  var emojis = ['📁','📚','📖','📝','✏️','🔬','🔭','🎨','🎯','🏆','⭐','💡','🧪','🌍','🎭','🎵','🖥️','🚀','⚡','🎮','🌟','💎','🔥','🦄','🌈','🐉','🦋','🍎','🏃','📐'];

  var overlay = document.createElement('div');
  overlay.className = 'bp-emoji-overlay';

  var box = document.createElement('div');
  box.className = 'bp-emoji-picker';

  var title = document.createElement('p');
  title.className = 'bp-emoji-title';
  title.textContent = 'Pick a folder emoji';

  var grid = document.createElement('div');
  grid.className = 'bp-emoji-grid';

  emojis.forEach(function(e) {
    var btn = document.createElement('button');
    btn.className = 'bp-emoji-btn';
    btn.textContent = e;
    btn.addEventListener('click', function() {
      document.body.removeChild(overlay);
      callback(e);
    });
    grid.appendChild(btn);
  });

  var skip = document.createElement('button');
  skip.className = 'bp-emoji-skip';
  skip.textContent = 'No emoji (use default 📁)';
  skip.addEventListener('click', function() {
    document.body.removeChild(overlay);
    callback(null);
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) { document.body.removeChild(overlay); callback(null); }
  });

  box.appendChild(title);
  box.appendChild(grid);
  box.appendChild(skip);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// close add menu on outside click -yr
document.addEventListener('click', function(e) {
  var menu = document.getElementById('bpAddMenu');
  if (menu && !e.target.closest('.bp-add-bar')) {
    menu.classList.remove('show');
  }
});

// -- render router -yr --

function bpRender() {
  var app = document.getElementById('bpApp');
  if (!app) return;

  if (bpView === 'notebook' && bpEditingItem) {
    bpRenderNotebook(app);
  } else if (bpView === 'flashcards' && bpEditingItem) {
    bpRenderCards(app);
  } else if (bpView === 'test' && bpEditingItem) {
    bpRenderTest(app);
  } else {
    bpRenderBrowse(app);
  }
}

// -- browse view -yr --

function bpRenderBrowse(app) {
  var children = bpChildren(bpCurrentFolder);
  var crumbs = bpBreadcrumb();
  var isRoot = bpCurrentFolder === null;
  var html = '';

  // breadcrumb
  html += '<div class="bp-breadcrumb">';
  html += '<span class="bp-crumb bp-crumb--link" onclick="bpGoRoot()">🎒 Backpack</span>';
  crumbs.forEach(function(c) {
    html += '<span class="bp-crumb-sep">›</span>';
    html += '<span class="bp-crumb bp-crumb--link" onclick="bpGoFolder(\'' + c.id + '\')">' + escHtml(c.name) + '</span>';
  });
  html += '</div>';

  if (children.length === 0) {
    html += '<div class="bp-empty">';
    html += '<div class="bp-empty-icon">' + (isRoot ? '🎒' : '📂') + '</div>';
    html += '<h2>' + (isRoot ? 'Your backpack is empty' : 'This folder is empty') + '</h2>';
    html += '<p>' + (isRoot ? 'Add a folder to get started!' : 'Add folders, notebooks, or flashcards.') + '</p>';
    html += '</div>';
  } else {
    children.sort(function(a, b) {
      var order = { folder: 0, notebook: 1, flashcards: 2 };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });
    html += '<div class="bp-grid">';
    children.forEach(function(item) {
      var icons = { folder: '📁', notebook: '📓', flashcards: '🃏' };
      var labels = { folder: 'Folder', notebook: 'Notebook', flashcards: 'Flashcards' };
      var safeId = String(item.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      html += '<div class="bp-item" onclick="bpOpen(\'' + safeId + '\')">';
      html += '<div class="bp-item-top">';
      html += '<span class="bp-item-icon">' + (item.emoji || icons[item.type]) + '</span>';
      html += '<button type="button" class="bp-item-delete" onclick="bpDeleteClick(event,\'' + safeId + '\')" title="Delete">🗑️</button>';
      html += '</div>';
      html += '<span class="bp-item-name">' + escHtml(item.name) + '</span>';
      html += '<span class="bp-item-type">' + labels[item.type] + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // add button
  html += '<div class="bp-add-bar">';
  html += '<button class="bp-add-btn" onclick="bpShowAddMenu()">+ Add New</button>';
  html += '<div class="bp-add-menu" id="bpAddMenu">';
  html += '<button onclick="bpPromptCreate(\'folder\')">📁 Folder</button>';
  if (!isRoot) {
    html += '<button onclick="bpPromptCreate(\'notebook\')">📓 Notebook</button>';
    html += '<button onclick="bpPromptCreate(\'flashcards\')">🃏 Flashcards</button>';
  }
  html += '</div>';
  html += '</div>';

  app.innerHTML = html;
}

// -- notebook editor -yr --

function bpRenderNotebook(app) {
  var item = bpEditingItem;
  var html = '';

  html += '<div class="bp-editor-header">';
  html += '<button class="bp-back-btn" onclick="bpSaveNotebook(); bpGoBack()">← Back</button>';
  html += '<span class="bp-editor-title">📓 ' + escHtml(item.name) + '</span>';
  html += '</div>';
  html += '<textarea class="bp-notebook-area" id="bpNotebookArea" placeholder="Start typing your notes...">' + escHtml(item.content) + '</textarea>';

  app.innerHTML = html;

  var area = document.getElementById('bpNotebookArea');
  if (area) {
    area.addEventListener('input', function() {
      item.content = area.value;
      bpSaveState();
    });
    area.focus();
  }
}

function bpSaveNotebook() {
  var area = document.getElementById('bpNotebookArea');
  if (area && bpEditingItem) {
    bpEditingItem.content = area.value;
    bpEditingItem.name = (bpEditingItem.name && bpEditingItem.name.trim()) ? bpEditingItem.name.trim() : 'Untitled';
  }
  if (!bpEditingItem || bpEditingItem.type !== 'notebook') return;
  bpSaveState();
  if (!bpBackendReady() || !bpEditingItem._noteId) return;
  updateNote(bpEditingItem._noteId, {
    title: bpEditingItem.name,
    content: bpEditingItem.content || '',
    folder_id: numId(bpEditingItem.parentId)
  }).catch(function(err) {
    console.error('Could not save note', err);
  });
}

// -- flashcard editor -yr --

function bpRenderCards(app) {
  var item = bpEditingItem;
  var cards = item.content;
  var html = '';

  html += '<div class="bp-editor-header">';
  html += '<button class="bp-back-btn" onclick="bpSaveCards(); bpGoBack()">← Back</button>';
  html += '<span class="bp-editor-title">🃏 ' + escHtml(item.name) + '</span>';
  if (cards.length > 0) {
    html += '<button class="bp-test-btn" onclick="bpStartTest()">📝 Test Me</button>';
  }
  html += '</div>';

  if (cards.length === 0) {
    html += '<div class="bp-empty">';
    html += '<div class="bp-empty-icon">🃏</div>';
    html += '<h2>No cards yet</h2>';
    html += '<p>Add your first flashcard below!</p>';
    html += '</div>';
  } else {
    html += '<div class="bp-cards-list">';
    cards.forEach(function(card, i) {
      html += '<div class="bp-card-row">';
      html += '<div class="bp-card-fields">';
      html += '<input class="bp-card-input" data-index="' + i + '" data-side="question" value="' + escAttr(card.question) + '" placeholder="Question">';
      html += '<input class="bp-card-input" data-index="' + i + '" data-side="answer" value="' + escAttr(card.answer) + '" placeholder="Answer">';
      html += '</div>';
      html += '<button class="bp-card-delete" onclick="bpDeleteCard(' + i + ')">🗑️</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<button class="bp-add-card-btn" onclick="bpAddCard()">+ Add Card</button>';

  app.innerHTML = html;

  // live-save card edits -yr
  document.querySelectorAll('.bp-card-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var idx = parseInt(this.getAttribute('data-index'));
      var side = this.getAttribute('data-side');
      if (item.content[idx]) {
        item.content[idx][side] = this.value;
        bpSaveState();
      }
    });
  });
}

function bpSaveCards() {
  if (!bpEditingItem || bpEditingItem.type !== 'flashcards') return;
  bpSaveState();
  if (!bpBackendReady() || !bpEditingItem._folderId) return;
  var fid = bpEditingItem._folderId;
  bpEditingItem.content.forEach(function(card) {
    if (card.id) {
      updateFlashcard(card.id, { front: card.question || '', back: card.answer || '', folder_id: fid }).catch(function(err) { console.error('Save card failed', err); });
    }
  });
}

function bpAddCard() {
  if (!bpEditingItem || bpEditingItem.type !== 'flashcards') return;
  if (!bpBackendReady() || !bpEditingItem._folderId) {
    bpEditingItem.content.push({ id: bpId(), question: '', answer: '' });
    bpSaveState();
    bpRender();
    setTimeout(function() {
      var inputs = document.querySelectorAll('.bp-card-input[data-side="question"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
    return;
  }
  createFlashcard({ front: '', back: '', folder_id: bpEditingItem._folderId }).then(function(res) {
    bpEditingItem.content.push({ id: res.id, question: res.front, answer: res.back });
    bpSaveState();
    bpRender();
    setTimeout(function() {
      var inputs = document.querySelectorAll('.bp-card-input[data-side="question"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  }).catch(function(err) {
    bpEditingItem.content.push({ id: bpId(), question: '', answer: '' });
    bpSaveState();
    bpRender();
  });
}

function bpDeleteCard(index) {
  if (!bpEditingItem) return;
  var card = bpEditingItem.content[index];
  if (bpBackendReady() && bpEditingItem._folderId && card && card.id && String(card.id).indexOf('bp_') !== 0) {
    deleteFlashcard(card.id).then(function() {
      bpEditingItem.content.splice(index, 1);
      bpSaveState();
      bpRender();
    }).catch(function(err) {
      bpEditingItem.content.splice(index, 1);
      bpSaveState();
      bpRender();
    });
  } else {
    bpEditingItem.content.splice(index, 1);
    bpSaveState();
    bpRender();
  }
}

// -- flashcard test mode -yr --

function bpStartTest() {
  if (!bpEditingItem || bpEditingItem.content.length === 0) return;
  bpTestIndex = 0;
  bpTestFlipped = false;
  bpView = 'test';
  bpSaveState();
  bpRender();
}

function bpRenderTest(app) {
  var item = bpEditingItem;
  var cards = item.content;
  var card = cards[bpTestIndex];
  var html = '';

  html += '<div class="bp-editor-header">';
  html += '<button class="bp-back-btn" onclick="bpView=\'flashcards\'; bpRender()">← Back to Cards</button>';
  html += '<span class="bp-editor-title">Card ' + (bpTestIndex + 1) + ' of ' + cards.length + '</span>';
  html += '</div>';

  html += '<div class="bp-flashcard-container">';
  html += '<div class="bp-flashcard' + (bpTestFlipped ? ' flipped' : '') + '" onclick="bpFlipCard()">';
  html += '<div class="bp-flashcard-inner">';
  html += '<div class="bp-flashcard-front">';
  html += '<p class="bp-fc-label">Question</p>';
  html += '<p class="bp-fc-text">' + escHtml(card.question || '(no question)') + '</p>';
  html += '<p class="bp-fc-hint">tap to flip</p>';
  html += '</div>';
  html += '<div class="bp-flashcard-back">';
  html += '<p class="bp-fc-label">Answer</p>';
  html += '<p class="bp-fc-text">' + escHtml(card.answer || '(no answer)') + '</p>';
  html += '<p class="bp-fc-hint">tap to flip</p>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="bp-test-nav">';
  html += '<button class="bp-test-nav-btn" onclick="bpTestPrev()"' + (bpTestIndex === 0 ? ' disabled' : '') + '>← Prev</button>';
  html += '<button class="bp-test-nav-btn bp-test-flip-btn" onclick="bpFlipCard()">🔄 Flip</button>';
  html += '<button class="bp-test-nav-btn" onclick="bpTestNext()"' + (bpTestIndex === cards.length - 1 ? ' disabled' : '') + '>Next →</button>';
  html += '</div>';

  app.innerHTML = html;
}

function bpFlipCard() {
  bpTestFlipped = !bpTestFlipped;
  var card = document.querySelector('.bp-flashcard');
  if (card) card.classList.toggle('flipped', bpTestFlipped);
}

function bpTestPrev() {
  if (bpTestIndex > 0) {
    bpTestIndex--;
    bpTestFlipped = false;
    bpSaveState();
    bpRender();
  }
}

function bpTestNext() {
  if (bpEditingItem && bpTestIndex < bpEditingItem.content.length - 1) {
    bpTestIndex++;
    bpTestFlipped = false;
    bpSaveState();
    bpRender();
  }
}

// render once on load -yr
document.addEventListener('DOMContentLoaded', function() {
  bpLoadState();
  bpRender();
});

document.addEventListener('backpack-auth-changed', function (e) {
  if (e.detail && e.detail.user) {
    bpLoadState();
  } else {
    bpResetState();
  }
  bpRender();
});

