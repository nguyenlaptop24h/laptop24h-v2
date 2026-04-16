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
  overlay.querySelector('.modal-confirm').onclick = () => { close(); onConfirm && onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
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
