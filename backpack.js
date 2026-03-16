// backpack — folders, notebooks, and flashcards -yr

var bpItems = [];
var bpCurrentFolder = null;
var bpView = 'browse';
var bpEditingItem = null;
var bpTestIndex = 0;
var bpTestFlipped = false;

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

// -- crud -yr --

function bpCreate(type, name, parentId) {
  var item = {
    id: bpId(),
    type: type,
    name: (name && name.trim()) ? name.trim() : 'Untitled',
    parentId: parentId === undefined ? bpCurrentFolder : parentId,
    content: type === 'flashcards' ? [] : ''
  };
  bpItems.push(item);
  bpRender();
  return item;
}

function bpDelete(id) {
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
  bpRender();
}

function bpConfirmDelete(id) {
  var item = bpFind(id);
  if (!item) return;
  if (confirm('Delete "' + item.name + '"?')) bpDelete(id);
}

// -- navigation -yr --

function bpOpen(id) {
  var item = bpFind(id);
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
    alert('Open a folder first. Notebooks and flashcards need to be inside a folder!');
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
      html += '<div class="bp-item" onclick="bpOpen(\'' + item.id + '\')">';
      html += '<div class="bp-item-top">';
      html += '<span class="bp-item-icon">' + icons[item.type] + '</span>';
      html += '<button class="bp-item-delete" onclick="event.stopPropagation(); bpConfirmDelete(\'' + item.id + '\')" title="Delete">🗑️</button>';
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
    });
    area.focus();
  }
}

function bpSaveNotebook() {
  var area = document.getElementById('bpNotebookArea');
  if (area && bpEditingItem) {
    bpEditingItem.content = area.value;
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
      }
    });
  });
}

function bpAddCard() {
  if (!bpEditingItem) return;
  bpEditingItem.content.push({ question: '', answer: '' });
  bpRender();
  setTimeout(function() {
    var inputs = document.querySelectorAll('.bp-card-input[data-side="question"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function bpDeleteCard(index) {
  if (!bpEditingItem) return;
  bpEditingItem.content.splice(index, 1);
  bpRender();
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

// render once on load -yr
document.addEventListener('DOMContentLoaded', function() {
  bpRender();
});

