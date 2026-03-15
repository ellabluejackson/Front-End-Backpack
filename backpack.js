// backpack: folders, notebooks, flashcards (integrated with backend API)

var bpItems = [];
var bpCurrentFolder = null;
var bpView = 'browse';
var bpEditingItem = null;
var bpTestIndex = 0;
var bpTestFlipped = false;
var bpLoadError = null;

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

// -- load from backend and build bpItems --

function bpBuildItems(folders, notes, flashcards) {
  var items = [];
  function numId(v) { return v != null ? Number(v) : null; }
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
  folders.forEach(function(f) {
    var hasCards = cardsInFolder(f.id).length > 0;
    var markedAsFlashcardSet = f.is_flashcard_set === true || f.is_flashcard_set === 1;
    var isFlashcardSet = markedAsFlashcardSet || (!hasSubfolders(f.id) && !hasNotesInFolder(f.id) && hasCards);
    if (isFlashcardSet) {
      items.push({
        id: 'fc_' + f.id,
        _folderId: f.id,
        type: 'flashcards',
        name: f.name,
        parentId: toParentId(f.parent_id),
        content: cardsInFolder(f.id)
      });
    } else {
      items.push({
        id: String(f.id),
        type: 'folder',
        name: f.name,
        parentId: toParentId(f.parent_id),
        content: null
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
}

function bpLoadFromBackend() {
  bpLoadError = null;
  Promise.all([getFolders(), getNotes(), getFlashcards()])
    .then(function(results) {
      bpBuildItems(results[0], results[1], results[2]);
      bpRender();
    })
    .catch(function(err) {
      console.warn('Backpack: could not load from API (is backend running at ' + API_BASE + '?)', err);
      bpLoadError = err;
      bpItems = [];
      bpRender();
    });
}

// -- crud (persist to backend) --

function bpCreate(type, name, parentId) {
  var pid = parentId === undefined ? bpCurrentFolder : parentId;
  var parentIdForApi = (pid === null || pid === undefined || pid === '') ? null : Number(pid);
  if (type === 'folder' || type === 'flashcards') {
    var isFlashcardSet = type === 'flashcards';
    createFolder({ name: (name && name.trim()) ? name.trim() : 'Untitled', parent_id: parentIdForApi, is_flashcard_set: isFlashcardSet })
      .then(function() { bpLoadFromBackend(); })
      .catch(function(e) {
        console.error('Failed to create folder/set', e);
        var msg = 'Could not create folder. ';
        if (e && e.response) {
          msg += 'Status ' + e.response.status + '. ';
          if (e.response.status === 400) msg += 'Name might be invalid (try a short name). ';
        }
        alert(msg + 'Is the backend running at ' + API_BASE + '?');
      });
    return;
  }
  if (type === 'notebook') {
    var folderIdForApi = (pid === null || pid === undefined || pid === '') ? null : Number(pid);
    createNote({ title: (name && name.trim()) ? name.trim() : 'Untitled', content: '', folder_id: folderIdForApi })
      .then(function() { bpLoadFromBackend(); })
      .catch(function(e) {
        console.error('Failed to create note', e);
        alert('Could not create notebook. Is the backend running?');
      });
    return;
  }
}

function bpDelete(id) {
  var item = bpFind(id);
  if (!item) return;
  if (item.type === 'folder') {
    var folderId = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
    deleteFolder(folderId).then(function() { bpLoadFromBackend(); bpEditingItem = null; bpView = 'browse'; }).catch(function(e) { console.error(e); alert('Could not delete folder.'); });
    return;
  }
  if (item.type === 'notebook' && item._noteId) {
    deleteNote(item._noteId).then(function() { bpLoadFromBackend(); bpEditingItem = null; bpView = 'browse'; }).catch(function(e) { console.error(e); alert('Could not delete notebook.'); });
    return;
  }
  if (item.type === 'flashcards' && item._folderId) {
    deleteFolder(item._folderId).then(function() { bpLoadFromBackend(); bpEditingItem = null; bpView = 'browse'; }).catch(function(e) { console.error(e); alert('Could not delete flashcard set.'); });
    return;
  }
  bpRender();
}

function bpConfirmDelete(id) {
  var item = bpFind(id);
  if (!item) return;
  if (confirm('Delete "' + item.name + '"?')) bpDelete(id);
}

// -- navigation -yr --

function bpOpen(id) {
  var idStr = id != null ? String(id) : '';
  var item = bpFind(idStr);
  if (!item && /^\d+$/.test(idStr)) item = bpFind(Number(id));
  if (!item) return;
  if (item.type === 'folder') {
    bpCurrentFolder = item.id;
    bpView = 'browse';
    bpRender();
  } else if (item.type === 'notebook') {
    bpEditingItem = item;
    bpView = 'notebook';
    bpRender();
  } else if (item.type === 'flashcards') {
    bpEditingItem = item;
    bpView = 'flashcards';
    bpRender();
  }
}

function bpGoRoot() {
  bpCurrentFolder = null;
  bpView = 'browse';
  bpEditingItem = null;
  bpRender();
}

function bpGoFolder(id) {
  bpCurrentFolder = id;
  bpView = 'browse';
  bpEditingItem = null;
  bpRender();
}

function bpGoBack() {
  if (bpView === 'test') {
    bpView = 'flashcards';
    bpRender();
    return;
  }
  if (bpView === 'notebook' || bpView === 'flashcards') {
    bpEditingItem = null;
    bpView = 'browse';
    bpRender();
    return;
  }
  if (bpCurrentFolder) {
    var folder = bpFind(bpCurrentFolder);
    bpCurrentFolder = folder ? folder.parentId : null;
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

  // notebooks and flashcards must live inside a folder -yr
  if ((type === 'notebook' || type === 'flashcards') && isRoot) {
    alert('Open a folder first. Notebooks and flashcard sets go inside a folder.');
    return;
  }

  var labels = { folder: 'folder', notebook: 'notebook', flashcards: 'flashcard set' };
  var name = prompt('Name your new ' + labels[type] + ':');
  if (name === null) return;

  bpCreate(type, name);
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

  if (bpLoadError) {
    html += '<div class="bp-empty">';
    html += '<div class="bp-empty-icon">⚠️</div>';
    html += '<h2>Couldn’t load your stuff</h2>';
    html += '<p>Backend might be offline. If you’re running it locally, check ' + escHtml(API_BASE) + '</p>';
    html += '<button type="button" class="bp-add-btn" onclick="bpLoadFromBackend()">Try again</button>';
    html += '</div>';
  } else if (children.length === 0) {
    html += '<div class="bp-empty">';
    html += '<div class="bp-empty-icon">' + (isRoot ? '🎒' : '📂') + '</div>';
    html += '<h2>' + (isRoot ? 'Nothing in here yet' : 'This folder is empty') + '</h2>';
    html += '<p>' + (isRoot ? 'Add a folder to start.' : 'Add a folder, notebook, or flashcard set.') + '</p>';
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
      html += '<span class="bp-item-icon">' + icons[item.type] + '</span>';
      html += '<button class="bp-item-delete" onclick="event.stopPropagation(); bpConfirmDelete(\'' + safeId + '\')" title="Delete">🗑️</button>';
      html += '</div>';
      html += '<span class="bp-item-name">' + escHtml(item.name) + '</span>';
      html += '<span class="bp-item-type">' + labels[item.type] + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // add button (only when loaded successfully)
  if (!bpLoadError) {
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
  }

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
  html += '<textarea class="bp-notebook-area" id="bpNotebookArea" placeholder="Type your notes here.">' + escHtml(item.content) + '</textarea>';

  app.innerHTML = html;

  var area = document.getElementById('bpNotebookArea');
  if (area) {
    area.addEventListener('input', function() {
      item.content = area.value;
    });
    area.focus();
  }
}

function bpSaveNotebook() {
  var area = document.getElementById('bpNotebookArea');
  if (area && bpEditingItem && bpEditingItem._noteId) {
    bpEditingItem.content = area.value;
    bpEditingItem.name = (bpEditingItem.name && bpEditingItem.name.trim()) ? bpEditingItem.name.trim() : 'Untitled';
    var folderId = bpEditingItem.parentId != null && bpEditingItem.parentId !== '' ? Number(bpEditingItem.parentId) : null;
    updateNote(bpEditingItem._noteId, {
      title: bpEditingItem.name,
      content: bpEditingItem.content,
      folder_id: folderId
    }).catch(function(e) { console.error('Failed to save notebook', e); });
  }
}

// -- flashcard editor -yr --

function bpRenderCards(app) {
  var item = bpEditingItem;
  var cards = item.content;
  var html = '';

  html += '<div class="bp-editor-header">';
  html += '<button class="bp-back-btn" onclick="bpGoBack()">← Back</button>';
  html += '<span class="bp-editor-title">🃏 ' + escHtml(item.name) + '</span>';
  if (cards.length > 0) {
    html += '<button class="bp-test-btn" onclick="bpStartTest()">📝 Test Me</button>';
  }
  html += '</div>';

  if (cards.length === 0) {
    html += '<div class="bp-empty">';
    html += '<div class="bp-empty-icon">🃏</div>';
    html += '<h2>No cards yet</h2>';
    html += '<p>Hit “Add Card” below to make your first one.</p>';
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

  // live-save card edits and persist on blur
  document.querySelectorAll('.bp-card-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var idx = parseInt(this.getAttribute('data-index'));
      var side = this.getAttribute('data-side');
      if (item.content[idx]) {
        item.content[idx][side] = this.value;
      }
    });
    input.addEventListener('blur', function() {
      var idx = parseInt(this.getAttribute('data-index'));
      var row = item.content[idx];
      if (!row || !row.id) return;
      var qInput = document.querySelector('.bp-card-input[data-index="' + idx + '"][data-side="question"]');
      var aInput = document.querySelector('.bp-card-input[data-index="' + idx + '"][data-side="answer"]');
      if (qInput && aInput) bpSaveCard(idx, qInput.value, aInput.value);
    });
  });
}

function bpAddCard() {
  if (!bpEditingItem || !bpEditingItem._folderId) return;
  createFlashcard({ front: '', back: '', folder_id: bpEditingItem._folderId })
    .then(function(c) {
      bpEditingItem.content.push({ id: c.id, question: c.front, answer: c.back });
      bpRender();
      setTimeout(function() {
        var inputs = document.querySelectorAll('.bp-card-input[data-side="question"]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 50);
    })
    .catch(function(e) { console.error('Failed to add card', e); alert('Could not add card.'); });
}

function bpDeleteCard(index) {
  if (!bpEditingItem) return;
  var card = bpEditingItem.content[index];
  if (card && card.id) {
    deleteFlashcard(card.id).then(function() {
      bpEditingItem.content.splice(index, 1);
      bpRender();
    }).catch(function(e) { console.error('Failed to delete card', e); });
  } else {
    bpEditingItem.content.splice(index, 1);
    bpRender();
  }
}

function bpSaveCard(index, question, answer) {
  if (!bpEditingItem || !bpEditingItem._folderId) return;
  var card = bpEditingItem.content[index];
  if (!card || !card.id) return;
  updateFlashcard(card.id, { front: question, back: answer, folder_id: bpEditingItem._folderId }).catch(function(e) { console.error('Failed to save card', e); });
}

// -- flashcard test mode -yr --

function bpStartTest() {
  if (!bpEditingItem || bpEditingItem.content.length === 0) return;
  bpTestIndex = 0;
  bpTestFlipped = false;
  bpView = 'test';
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
    bpRender();
  }
}

function bpTestNext() {
  if (bpEditingItem && bpTestIndex < bpEditingItem.content.length - 1) {
    bpTestIndex++;
    bpTestFlipped = false;
    bpRender();
  }
}

// load from backend when backpack is shown or on first load
document.addEventListener('DOMContentLoaded', function() {
  var app = document.getElementById('bpApp');
  if (app && app.closest('.page.active')) bpLoadFromBackend();
  else bpRender();
});

