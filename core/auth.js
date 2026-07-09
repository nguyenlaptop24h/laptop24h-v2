// core/auth.js - Xác thực qua Firebase Authentication (email/mật khẩu)
// Có chế độ chuyển tiếp: nếu chưa tạo tài khoản Firebase Auth thì tạm dùng
// cách cũ (đọc bảng users) để không gián đoạn. Sau khi khóa Security Rules,
// chỉ Firebase Auth mới đăng nhập được.
import { getDB } from './db.js';

let currentUser = null; // { _key, id, name, username, role, branch }

const BRANCH_NAMES = { vinhlong: '📍 Vĩnh Long', cantho: '📍 Cần Thơ' };
const EMAIL_DOMAIN = '@laptop24h.local';

function fbAuth() {
  try { return (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null; }
  catch (e) { return null; }
}
function userToEmail(u) {
  return String(u || '').trim().toLowerCase().replace(/\s+/g, '') + EMAIL_DOMAIN;
}

// Tra thông tin (tên, vai trò) từ bảng users theo username
async function lookupUser(uname) {
  try {
    const snap = await getDB().ref('users').once('value');
    const data = snap.val() || {};
    let res = null;
    Object.entries(data).forEach(([key, u]) => {
      if ((u.username || '').toLowerCase() === String(uname).toLowerCase())
        res = { _key: key, id: u.id, name: u.name, username: u.username, role: u.role };
    });
    return res;
  } catch (e) { return null; }
}

export async function initAuth() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (u) => { if (!done) { done = true; resolve(u); } };

    document.getElementById('auth-btn').addEventListener('click', handleLogin);
    document.getElementById('auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    const _showBtn = document.getElementById('auth-show');
    if (_showBtn) _showBtn.addEventListener('click', () => {
      const p = document.getElementById('auth-pass'); if (!p) return;
      p.type = (p.type === 'password') ? 'text' : 'password';
      _showBtn.textContent = (p.type === 'text') ? '🙈' : '👁';
    });

    const auth = fbAuth();
    if (auth) {
      auth.onAuthStateChanged(async (fbUser) => {
        if (fbUser) {
          const uname = (fbUser.email || '').split('@')[0];
          const info = await lookupUser(uname);
          const branch = sessionStorage.getItem('laptop24h_branch') || 'vinhlong';
          currentUser = Object.assign({ username: uname, name: uname, role: 'staff' }, info || {}, { branch });
          sessionStorage.setItem('laptop24h_user', JSON.stringify(currentUser));
          showApp();
          finish(currentUser);
        } else {
          // Chưa đăng nhập Firebase → thử khôi phục phiên cũ (chuyển tiếp)
          const saved = sessionStorage.getItem('laptop24h_user');
          if (saved) { try { currentUser = JSON.parse(saved); showApp(); finish(currentUser); return; } catch (e) {} }
          showAuth();
          finish(null);
        }
      });
    } else {
      const saved = sessionStorage.getItem('laptop24h_user');
      if (saved) { try { currentUser = JSON.parse(saved); showApp(); finish(currentUser); return; } catch (e) {} }
      showAuth();
      finish(null);
    }
  });
}

async function handleLogin() {
  const username = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-pass').value;
  const branch = (document.getElementById('auth-branch') || {}).value || 'vinhlong';
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Vui lòng nhập đầy đủ thông tin'; return; }
  sessionStorage.setItem('laptop24h_branch', branch);
  try {
    if (document.getElementById('auth-remember')?.checked)
      localStorage.setItem('laptop24h_remember', JSON.stringify({ u: username, p: password, b: branch }));
    else
      localStorage.removeItem('laptop24h_remember');
  } catch (e) {}

  const auth = fbAuth();
  if (auth) {
    try {
      await auth.signInWithEmailAndPassword(userToEmail(username), password);
      // onAuthStateChanged sẽ tự lo phần còn lại (vai trò + hiện app)
      return;
    } catch (e) {
      // Chưa có tài khoản Firebase Auth (giai đoạn chuyển tiếp) → thử cách cũ
      const ok = await legacyLogin(username, password, branch);
      if (!ok) {
        errEl.textContent = (e && (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential'))
          ? 'Tên đăng nhập hoặc mật khẩu không đúng'
          : 'Tên đăng nhập hoặc mật khẩu không đúng';
      }
      return;
    }
  }
  const ok = await legacyLogin(username, password, branch);
  if (!ok) errEl.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng';
}

// Đăng nhập cách cũ (chỉ chạy khi Security Rules còn mở)
async function legacyLogin(username, password, branch) {
  try {
    const snap = await getDB().ref('users').once('value');
    const data = snap.val() || {};
    let found = null;
    Object.entries(data).forEach(([key, u]) => {
      if (u.username === username && u.password === password) found = { _key: key, ...u };
    });
    if (!found) return false;
    delete found.password;
    currentUser = Object.assign({}, found, { branch });
    sessionStorage.setItem('laptop24h_user', JSON.stringify(currentUser));
    showApp();
    return true;
  } catch (e) { return false; }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('laptop24h_user');
  const auth = fbAuth();
  if (auth) { auth.signOut().then(showAuth).catch(showAuth); } else { showAuth(); }
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const admin = isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = admin ? '' : 'none'; });
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = currentUser?.name || currentUser?.username || '';
  const branchEl = document.getElementById('branch-label');
  if (branchEl) branchEl.textContent = BRANCH_NAMES[currentUser?.branch] || '';
}

function showAuth() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  try {
    const rem = JSON.parse(localStorage.getItem('laptop24h_remember') || 'null');
    const e = document.getElementById('auth-email');
    const p = document.getElementById('auth-pass');
    const b = document.getElementById('auth-branch');
    const c = document.getElementById('auth-remember');
    if (rem) {
      if (e) e.value = rem.u || '';
      if (p) p.value = rem.p || '';
      if (b && rem.b) b.value = rem.b;
      if (c) c.checked = true;
    } else {
      if (p) p.value = '';
    }
  } catch (err) { const p = document.getElementById('auth-pass'); if (p) p.value = ''; }
}

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.role === 'admin'; }
