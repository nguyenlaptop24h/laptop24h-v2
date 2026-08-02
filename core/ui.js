// core/ui.js - Shared UI helpers: toast, modal, formatters, table builder
import { formatVND } from './db.js';

export function initUI() {
  // Đảm bảo container toast tồn tại
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }
}

// ---- Toast ----
export function toast(msg, type = 'info', duration = 3000) {
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ---- Modal ----
export function showModal({ title, body, onConfirm, confirmText = 'Xác nhận', danger = false }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn--secondary modal-cancel">Huỷ</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'} modal-confirm">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);

  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300); };
  overlay.querySelector('.modal-close').onclick = close;
  overlay.querySelector('.modal-cancel').onclick = close;
  overlay.querySelector('.modal-confirm').onclick = async () => {
    if (onConfirm) { const r = await onConfirm(); if (r === false) return; }
    close();
  };
  return { close };
}

// ---- Table builder ----
export function buildTable(cols, data) {
  const thead = cols.map(c => `<th${c.cls ? ` class="${c.cls}"` : ''}>${c.label}</th>`).join('');
  const tbody = data.map(row => {
    const cells = cols.map(c => {
      let val = '';
      if (typeof c.key === 'function') {
        val = c.key(row) ?? '';
      } else if (typeof c.key === 'string') {
        val = row[c.key] ?? '';
      }
      return `<td${c.cls ? ` class="${c.cls}"` : ''}>${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}


export function getFormData(formEl) {
  const data = {};
  formEl.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.name) data[el.name] = el.value;
  });
  return data;
}

export function setFormData(formEl, data) {
  Object.entries(data).forEach(([key, val]) => {
    const el = formEl.querySelector(`[name="${key}"]`);
    if (el) el.value = val ?? '';
  });
}

export function clearForm(formEl) {
  formEl.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
}

// ---- Date helpers ----
export function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('vi-VN');
}

export function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('vi-VN');
}

export { formatVND };

// ---- Context menu (chuột phải) — hỗ trợ menu con (submenu) ----
function _closeCtxMenus() {
  document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
  document.removeEventListener('mousedown', _ctxOnDoc, true);
  document.removeEventListener('keydown', _ctxOnKey, true);
  document.removeEventListener('scroll', _ctxOnScroll, true);
  window.removeEventListener('resize', _closeCtxMenus);
}
function _ctxOnDoc(e) { if (!e.target.closest('.ctx-menu')) _closeCtxMenus(); }
function _ctxOnKey(e) { if (e.key === 'Escape') _closeCtxMenus(); }
// Cuộn BÊN TRONG menu (danh sách dài) thì KHÔNG đóng; chỉ đóng khi cuộn trang bên ngoài
function _ctxOnScroll(e) { if (e.target && e.target.closest && e.target.closest('.ctx-menu')) return; _closeCtxMenus(); }
function _buildCtxMenu(items, isSub) {
  const menu = document.createElement('div');
  menu.className = 'ctx-menu' + (isSub ? ' ctx-sub' : '');
  menu.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #d1d5db;border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:5px;min-width:180px;max-width:420px;max-height:72vh;overflow-y:auto;font-size:14px;font-family:inherit';
  (items || []).forEach(it => {
    if (it.sep) { const d = document.createElement('div'); d.style.cssText = 'height:1px;background:#eee;margin:4px 6px'; menu.appendChild(d); return; }
    const b = document.createElement('div');
    b.style.cssText = 'padding:9px 13px;border-radius:6px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;justify-content:space-between;gap:16px;color:' + (it.danger ? '#dc2626' : '#333');
    const lab = document.createElement('span'); lab.textContent = it.label; b.appendChild(lab);
    if (it.submenu) { const ar = document.createElement('span'); ar.textContent = '▸'; ar.style.color = '#999'; b.appendChild(ar); }
    b.addEventListener('mouseenter', () => {
      b.style.background = it.danger ? '#fee2e2' : '#f1f5f9';
      // đóng mọi submenu đang mở của menu này
      menu.querySelectorAll(':scope ~ .ctx-sub').forEach(m => m.remove());
      document.querySelectorAll('.ctx-sub').forEach(m => { if (m.__parentMenu === menu) m.remove(); });
      if (it.submenu) {
        const child = _buildCtxMenu(it.submenu, true);
        child.__parentMenu = menu;
        document.body.appendChild(child);
        const r = b.getBoundingClientRect(), cr = child.getBoundingClientRect();
        let cx = r.right - 2, cy = r.top - 4;
        if (cx + cr.width > window.innerWidth) cx = r.left - cr.width + 2;
        if (cy + cr.height > window.innerHeight) cy = window.innerHeight - cr.height - 6;
        child.style.left = Math.max(4, cx) + 'px';
        child.style.top = Math.max(4, cy) + 'px';
      }
    });
    b.addEventListener('mouseleave', () => { b.style.background = ''; });
    if (!it.submenu) {
      b.addEventListener('click', () => { _closeCtxMenus(); try { it.onClick && it.onClick(); } catch (e) { console.warn(e); } });
    }
    menu.appendChild(b);
  });
  return menu;
}
export function showContextMenu(x, y, items) {
  _closeCtxMenus();
  const menu = _buildCtxMenu(items, false);
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  let px = x, py = y;
  if (px + r.width > window.innerWidth) px = window.innerWidth - r.width - 6;
  if (py + r.height > window.innerHeight) py = window.innerHeight - r.height - 6;
  menu.style.left = Math.max(4, px) + 'px';
  menu.style.top = Math.max(4, py) + 'px';
  setTimeout(() => {
    document.addEventListener('mousedown', _ctxOnDoc, true);
    document.addEventListener('keydown', _ctxOnKey, true);
    document.addEventListener('scroll', _ctxOnScroll, true);
    window.addEventListener('resize', _closeCtxMenus);
  }, 0);
}
