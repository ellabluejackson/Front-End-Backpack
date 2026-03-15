// Backend API base URL – change if your server runs elsewhere
const API_BASE = 'http://localhost:8000';

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'API error');
    err.status = res.status;
    err.response = res;
    throw err;
  }
  return res.json();
}

// Todos
async function getTodos() {
  return apiFetch('/todos');
}

async function createTodo(body) {
  return apiFetch('/todos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function updateTodo(id, params) {
  const search = new URLSearchParams();
  if (params.done !== undefined) search.set('done', params.done);
  if (params.folder_id !== undefined) search.set('folder_id', params.folder_id);
  const qs = search.toString();
  return apiFetch(`/todos/${id}?${qs}`, { method: 'PATCH' });
}

async function deleteTodo(id) {
  return apiFetch(`/todos/${id}`, { method: 'DELETE' });
}

// Folders
async function getFolders() {
  return apiFetch('/folders');
}

async function createFolder(body) {
  return apiFetch('/folders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function updateFolder(id, body) {
  return apiFetch(`/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function deleteFolder(id) {
  return apiFetch(`/folders/${id}`, { method: 'DELETE' });
}

// Notes (notebooks)
async function getNotes() {
  return apiFetch('/notes');
}

async function createNote(body) {
  return apiFetch('/notes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function updateNote(id, body) {
  return apiFetch(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function deleteNote(id) {
  return apiFetch(`/notes/${id}`, { method: 'DELETE' });
}

// Flashcards (backend uses front/back, we map to question/answer)
async function getFlashcards() {
  return apiFetch('/flashcards');
}

async function createFlashcard(body) {
  return apiFetch('/flashcards', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function updateFlashcard(id, body) {
  return apiFetch(`/flashcards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function deleteFlashcard(id) {
  return apiFetch(`/flashcards/${id}`, { method: 'DELETE' });
}
