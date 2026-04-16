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
export function buildTable({ columns, data, actions }) {
  const table = document.createElement('table');
  table.className = 'data-table';
  // Header
  const thead = table.createTHead();
  const hr = thead.insertRow();
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.width) th.style.width = col.width;
    hr.appendChild(th);
  });
  if (actions) {
    const th = document.createElement('th');
    th.textContent = 'Thao tác';
    th.style.width = '120px';
    hr.appendChild(th);
  }
  // Body
  const tbody = table.createTBody();
  if (!data || data.length === 0) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = columns.length + (actions ? 1 : 0);
    td.className = 'empty-row';
    td.textContent = 'Không có dữ liệu';
  } else {
    data.forEach(row => {
      const tr = tbody.insertRow();
      tr.dataset.key = row._key || '';
      columns.forEach(col => {
        const td = tr.insertCell();
        if (col.render) {
          const result = col.render(row[col.field], row);
          if (result instanceof HTMLElement) td.appendChild(result);
          else td.innerHTML = result ?? '';
        } else if (col.money) {
          td.textContent = formatVND(row[col.field]);
          td.className = 'cell--money';
        } else {
          td.textContent = row[col.field] ?? '';
        }
      });
      if (actions) {
        const td = tr.insertCell();
        td.className = 'cell--actions';
        actions.forEach(act => {
          const btn = document.createElement('button');
          btn.className = `btn btn--xs btn--${act.type || 'secondary'}`;
          btn.textContent = act.label;
          btn.onclick = () => act.onClick(row);
          td.appendChild(btn);
        });
      }
    });
  }
  return table;
}

// ---- Form helpers ----
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
