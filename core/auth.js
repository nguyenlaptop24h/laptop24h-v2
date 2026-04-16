// core/auth.js - Xác thực bằng DB (username + password plain text)
// Giống cơ chế app cũ — không dùng Firebase Auth
import { getDB } from './db.js';

let currentUser = null; // { _key, id, name, username, role }

export async function initAuth() {
  return new Promise((resolve) => {
    // Kiểm tra session đã lưu trong sessionStorage
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

    // Gắn sự kiện login
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
  const errEl   = document.getElementById('auth-err');
  errEl.textContent = '';

  if (!username || !password) {
    errEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
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
      errEl.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng';
      return;
    }

    currentUser = found;
    sessionStorage.setItem('laptop24h_user', JSON.stringify(found));
    showApp();
  } catch(e) {
    errEl.textContent = 'Lỗi kết nối: ' + e.message;
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
}

function showAuth() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-pass').value = '';
}

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.role === 'admin'; }
