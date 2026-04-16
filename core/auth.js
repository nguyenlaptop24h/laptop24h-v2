// core/auth.js - Quản lý đăng nhập / phiên làm việc
import { getDB } from './db.js';

let currentUser = null;  // { uid, email, role, name }

export async function initAuth() {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        // Lấy thông tin role từ DB
        const db = getDB();
        const snap = await db.ref('users').orderByChild('email').equalTo(user.email).once('value');
        const data = snap.val();
        if (data) {
          const key = Object.keys(data)[0];
          currentUser = { uid: user.uid, email: user.email, _key: key, ...data[key] };
        } else {
          currentUser = { uid: user.uid, email: user.email, role: 'employee', name: user.email };
        }
        showApp();
      } else {
        currentUser = null;
        showAuth();
      }
      resolve(currentUser);
    });

    // Xử lý form đăng nhập
    document.getElementById('auth-btn').addEventListener('click', handleLogin);
    document.getElementById('auth-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
  });
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';
  try {
    await firebase.auth().signInWithEmailAndPassword(email, pass);
  } catch (e) {
    errEl.textContent = 'Email hoặc mật khẩu không đúng';
  }
}

async function handleLogout() {
  await firebase.auth().signOut();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Ẩn menu admin nếu không phải admin
  const isAdmin = currentUser?.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  if (currentUser?.name) {
    document.getElementById('user-name').textContent = currentUser.name;
  }
}

function showAuth() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.role === 'admin'; }
