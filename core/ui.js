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
  const thead = cols.map(c => `<th>${c.label}</th>`).join('');
  const tbody = data.map(row => {
    const cells = cols.map(c => {
      let val = '';
      if (typeof c.key === 'function') {
        val = c.key(row) ?? '';
      } else if (typeof c.key === 'string') {
        val = row[c.key] ?? '';
      }
      return `<td>${val}</td>`;
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

// ---- Context menu (chuột phải) ----
export function showContextMenu(x, y, items) {
  document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #d1d5db;border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:5px;min-width:180px;font-size:14px;font-family:inherit';
  (items || []).forEach(it => {
    if (it.sep) { const d = document.createElement('div'); d.style.cssText = 'height:1px;background:#eee;margin:4px 6px'; menu.appendChild(d); return; }
    const b = document.createElement('div');
    b.textContent = it.label;
    b.style.cssText = 'padding:9px 13px;border-radius:6px;cursor:pointer;white-space:nowrap;color:' + (it.danger ? '#dc2626' : '#333');
    b.addEventListener('mouseenter', () => b.style.background = it.danger ? '#fee2e2' : '#f1f5f9');
    b.addEventListener('mouseleave', () => b.style.background = '');
    b.addEventListener('click', () => { close(); try { it.onClick && it.onClick(); } catch (e) { console.warn(e); } });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  let px = x, py = y;
  if (px + r.width > window.innerWidth) px = window.innerWidth - r.width - 6;
  if (py + r.height > window.innerHeight) py = window.innerHeight - r.height - 6;
  menu.style.left = Math.max(4, px) + 'px';
  menu.style.top = Math.max(4, py) + 'px';
  function close() {
    menu.remove();
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
    document.removeEventListener('keydown', onKey, true);
  }
  function onDoc(e) { if (!menu.contains(e.target)) close(); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  setTimeout(() => {
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey, true);
  }, 0);
}
