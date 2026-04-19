// Backend API — JWT auth + folders / notes / todos / flashcards
const API_BASES = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8001',
  'http://127.0.0.1:8001',
];
const AUTH_TOKEN_KEY = 'backpack_access_token';

function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Could not save auth token', e);
  }
}

function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.clearBackpackApiToken = clearAuthToken;
}

async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = 'Bearer ' + token;

  let lastErr = null;
  for (let i = 0; i < API_BASES.length; i++) {
    const base = API_BASES[i];
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        const err = new Error(res.statusText || 'API error');
        err.status = res.status;
        err.response = res;
        err.url = url;
        throw err;
      }
      return res.json();
    } catch (err) {
      if (err && typeof err.status === 'number') throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('Could not reach backend API');
}

async function signup(body) {
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res && res.access_token) setAuthToken(res.access_token);
  return res;
}

async function login(body) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res && res.access_token) setAuthToken(res.access_token);
  return res;
}

async function me() {
  return apiFetch('/auth/me');
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
  return apiFetch('/todos/' + id + '?' + qs, { method: 'PATCH' });
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

// Flashcards (backend uses front/back)
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
  return apiFetch('/flashcards/' + id, { method: 'DELETE' });
}

if (typeof window !== 'undefined') {
  window.deleteTodo = deleteTodo;
  window.login = login;
  window.signup = signup;
  window.me = me;
}

if (typeof window !== 'undefined') {
  window.deleteTodo = deleteTodo;
  window.login = login;
  window.signup = signup;
  window.me = me;
}
