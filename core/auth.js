// core/auth.js - Xac thuc bang DB (username + password plain text)
import { getDB } from './db.js';

let currentUser = null; // { _key, id, name, username, role, branch }

const BRANCH_NAMES = { vinhlong: '📍 Vinh Long', cantho: '📍 Can Tho' };

export async function initAuth() {
  return new Promise((resolve) => {
    const saved = sessionStorage.getItem('laptop24h_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        showApp();
        resolve(currentUser);
        return;
      } catch(e) { sessionStorage.removeItem('laptop24h_user'); }
    }
    showAuth();
    resolve(null);

    document.getElementById('auth-btn').addEventListener('click', handleLogin);
    document.getElementById('auth-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
  });
}

async function handleLogin() {
  const username = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-pass').value;
  const branch = (document.getElementById('auth-branch') || {}).value || 'vinhlong';
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';

  if (!username || !password) {
    errEl.textContent = 'Vui long nhap day du thong tin';
    return;
  }

  try {
    const db = getDB();
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    let found = null;

    Object.entries(data).forEach(([key, user]) => {
      if (user.username === username && user.password === password) {
        found = { _key: key, ...user };
      }
    });

    if (!found) {
      errEl.textContent = 'Ten dang nhap hoac mat khau khong dung';
      return;
    }

    currentUser = { ...found, branch };
    sessionStorage.setItem('laptop24h_user', JSON.stringify(currentUser));
    showApp();
  } catch(e) {
    errEl.textContent = 'Loi ket noi: ' + e.message;
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('laptop24h_user');
  showAuth();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const admin = isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = currentUser?.name || currentUser?.username || '';
  const branchEl = document.getElementById('branch-label');
  if (branchEl) branchEl.textContent = BRANCH_NAMES[currentUser?.branch] || '';
}

function showAuth() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-pass').value = '';
}

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.role === 'admin'; }
