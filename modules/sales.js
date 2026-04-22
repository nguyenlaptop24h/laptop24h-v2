// modules/sales.js - Ban hang v42 (fix font print + truong BH den)
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, formatVND } from '../core/ui.js';

const COLLECTION = 'sales';
const SALES_SHEET_URL = 'https://script.google.com/macros/s/AKfycby1EKgFp101WvCx7v_bTFthGM655wGJ35azbCicNomLw10xz6Fbt-Ycp6ug15FE1_9S/exec';
const TPL_KEY = 'sl_invoice_tpl';
registerRoute('#sales', mount);

// HTML-escape helper (fixes empty value bug khi innerHTML set attribute)
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function logToSheet(data, action) {
  try {
    fetch(SALES_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    }).catch(() => {});
  } catch(e) {}
}

function getTemplate() {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || '{}'); } catch(e) { return {}; }
}
function saveTemplate(obj) { localStorage.setItem(TPL_KEY, JSON.stringify(obj)); }

export async function mount(container) {
  let allItems = [];
  let invItems = [];
  let filterMode = 'day';
  let searchQ = '';
  let currentPage = 1;
  const PAGE_SIZE = 10;
  let editKey = null;
  let unsub = null;
  let globalDrop = null;
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    const snap = await firebase.database().ref('products').once('value');
    snap.forEach(c => invItems.push({ _key: c.key, ...c.val() }));
  } catch(e) {}

  // ══════════════════════════════════════════════
  //  SHELL HTML
  // ══════════════════════════════════════════════
  container.innerHTML = `
<style>
.sl-wrap { display:flex; flex-direction:column; height:100%; background:#f0f2f5; font-family:'Segoe UI',sans-serif; }

/* TOOLBAR */
.sl-toolbar {
  display:flex; align-items:center; gap:8px;
  padding:8px 14px; background:#fff;
  border-bottom:1px solid #e0e0e0; flex-shrink:0; flex-wrap:wrap;
}
.sl-btn {
  padding:6px 13px; border-radius:6px; border:1px solid #ddd;
  background:#fff; cursor:pointer; font-size:12px; font-weight:500;
  display:flex; align-items:center; gap:4px; white-space:nowrap;
}
.sl-btn-primary { background:#1a73e8; color:#fff; border-color:#1a73e8; }
.sl-btn-primary:hover { background:#1558b0; }
.sl-btn-trash { color:#e74c3c; border-color:#e74c3c; }
.sl-btn-trash:hover { background:#fdecea; }
.sl-btn-tpl { color:#7c3aed; border-color:#7c3aed; }
.sl-btn-tpl:hover { background:#f5f3ff; }
.sl-btn:disabled { opacity:.6; cursor:not-allowed; }

.sl-search {
  display:flex; align-items:center; gap:6px;
  border:1px solid #ddd; border-radius:6px; padding:5px 10px;
  background:#fafafa; width:220px;
}
.sl-search input { border:none; outline:none; background:transparent; font-size:12px; width:100%; }

.sl-filters { display:flex; gap:3px; }
.sl-f {
  padding:5px 11px; border-radius:20px; font-size:11px;
  cursor:pointer; border:1px solid #ddd; color:#555; user-select:none;
}
.sl-f:hover { background:#f0f0f0; }
.sl-f.active { background:#1a73e8; color:#fff; border-color:#1a73e8; }

.sl-quickstats { font-size:12px; color:#555; margin-left:4px; white-space:nowrap; }
.sl-quickstats b { color:#1a73e8; }
.sl-spacer { flex:1; }

/* MAIN AREA */
.sl-main { display:flex; flex:1; overflow:hidden; }
.sl-content { flex:1; display:flex; flex-direction:column; overflow:hidden; padding:12px 14px; gap:10px; }

.sl-table-wrap {
  background:#fff; border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,.07); overflow:auto; flex:1;
}
.sl-table { width:100%; border-collapse:collapse; min-width:700px; }
.sl-table thead th {
  background:#f8f9fa; padding:9px 11px;
  text-align:left; font-size:11px; color:#666; font-weight:600;
  border-bottom:1px solid #e8e8e8; white-space:nowrap; position:sticky; top:0;
}
.sl-table tbody td { padding:9px 11px; border-bottom:1px solid #f2f2f2; font-size:12px; vertical-align:middle; }
.sl-table tbody tr:hover { background:#f8f9ff; }
.sl-table tbody tr:last-child td { border-bottom:none; }

.sl-customer { font-weight:600; }
.sl-phone { font-size:11px; color:#888; }
.sl-money { font-weight:600; color:#1a3a6b; }

.sl-badge {
  display:inline-block; padding:2px 8px; border-radius:10px;
  font-size:10px; font-weight:600; white-space:nowrap;
}
.badge-done { background:#e8f5e9; color:#2e7d32; }
.badge-pending { background:#fff3e0; color:#e65100; }
.badge-cancel { background:#fce4ec; color:#c62828; }
.badge-trash { background:#f5f5f5; color:#757575; }

.sl-actions { display:flex; gap:5px; }
.sl-action-btn {
  padding:3px 9px; border-radius:4px; border:1px solid #ddd;
  background:#fff; font-size:11px; cursor:pointer; white-space:nowrap;
}
.sl-action-btn:hover { background:#f5f5f5; }
.sl-edit-btn { color:#1a73e8; border-color:#1a73e8; }
.sl-edit-btn:hover { background:#e8f0fe; }
.sl-del { color:#e74c3c; border-color:#e74c3c; }
.sl-del:hover { background:#fdecea; }
.sl-restore-btn { color:#2e7d32; border-color:#2e7d32; }
.sl-restore-btn:hover { background:#e8f5e9; }
.sl-print-btn { color:#7c3aed; border-color:#7c3aed; }
.sl-print-btn:hover { background:#f5f3ff; }

.sl-empty {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:60px 20px; color:#aaa; gap:10px; font-size:14px;
}

/* PAGINATION */
.sl-pagination {
  display:flex; align-items:center; justify-content:flex-end;
  gap:5px; padding:6px 4px; font-size:11px; color:#555; flex-shrink:0;
}
.sl-pg-btn {
  padding:3px 9px; border-radius:4px; border:1px solid #ddd;
  background:#fff; cursor:pointer; font-size:11px;
}
.sl-pg-btn:hover:not([disabled]) { background:#f0f0f0; }
.sl-pg-btn.active { background:#1a73e8; color:#fff; border-color:#1a73e8; }
.sl-pg-btn[disabled] { opacity:.4; cursor:not-allowed; }

/* SIDEBAR */
.sl-sidebar {
  width:250px; background:#fff; border-left:1px solid #e0e0e0;
  padding:12px; display:flex; flex-direction:column; gap:12px;
  overflow-y:auto; flex-shrink:0;
}
.sl-sb-title { font-size:10px; font-weight:700; color:#999; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.sl-sb-section { display:flex; flex-direction:column; }
.sl-stat-row { display:flex; gap:8px; }
.sl-stat-card { flex:1; background:#f8f9fa; border-radius:8px; padding:9px 11px; }
.sl-stat-val { font-size:1.25rem; font-weight:700; color:#1a73e8; line-height:1.2; }
.sl-stat-lbl { font-size:10px; color:#888; margin-top:2px; }

.sl-chart {
  display:flex; align-items:flex-end; justify-content:space-around;
  background:#f8f9fa; border-radius:8px; padding:10px 8px 0; height:100px; gap:2px;
}
.sl-chart-col { display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; }
.sl-bar { background:#93c5fd; border-radius:3px 3px 0 0; width:100%; min-height:4px; transition:height .3s; }
.sl-bar.today { background:#1a73e8; }
.sl-bar-lbl { font-size:9px; color:#999; padding-bottom:4px; }

.sl-pay-row { display:flex; justify-content:space-between; font-size:12px; padding:3px 0; color:#555; }
.sl-pay-row b { color:#333; }

/* MODAL OVERLAY */
.sl-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.4);
  display:flex; align-items:center; justify-content:center; z-index:1000;
}
.sl-modal {
  background:#fff; border-radius:10px; width:720px; max-width:96vw;
  max-height:92vh; display:flex; flex-direction:column;
  box-shadow:0 8px 32px rgba(0,0,0,.2); overflow:hidden;
}
.sl-modal-header {
  background:#1a73e8; color:#fff; padding:13px 18px;
  display:flex; justify-content:space-between; align-items:center; flex-shrink:0;
}
.sl-modal-header h3 { font-size:15px; font-weight:600; }
.sl-close-btn { background:none; border:none; color:#fff; font-size:18px; cursor:pointer; opacity:.8; line-height:1; }
.sl-close-btn:hover { opacity:1; }
.sl-modal-body { padding:16px 18px; overflow-y:auto; flex:1; }
.sl-modal-footer {
  padding:11px 18px; border-top:1px solid #eee;
  display:flex; justify-content:flex-end; gap:8px; flex-shrink:0;
}

/* FORM GRID — 3 cols for top info */
.sl-form-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px; }
.sl-field { display:flex; flex-direction:column; gap:4px; }
.sl-field label { font-size:11px; color:#555; font-weight:700; letter-spacing:.3px; }
.sl-field input, .sl-field select, .sl-field textarea {
  padding:8px 10px; border:1px solid #ddd; border-radius:6px;
  font-size:13px; outline:none; font-family:inherit; background:#fff;
}
.sl-field input:focus, .sl-field select:focus, .sl-field textarea:focus {
  border-color:#1a73e8; box-shadow:0 0 0 2px rgba(26,115,232,.12);
}
.sl-field.span2 { grid-column:span 2; }
.sl-field.full  { grid-column:1/-1; }

/* ITEM ROWS */
.sl-items-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:7px;
}
.sl-items-label { font-size:11px; font-weight:700; color:#555; letter-spacing:.3px; }
.sf-col-hdr {
  display:flex; gap:5px; padding:4px 8px;
  font-size:10px; font-weight:700; color:#999; text-transform:uppercase;
}
.sf-item-row {
  display:flex; align-items:center; gap:5px; margin-bottom:5px;
  background:#f9f9f9; border-radius:6px; padding:7px 9px;
  border:1px solid #f0f0f0;
}
.sf-item-row:focus-within { border-color:#c7d9f8; background:#f5f8ff; }
.sf-item-row input { padding:6px 8px; border:1px solid #e0e0e0; border-radius:5px; font-size:12.5px; outline:none; background:#fff; }
.sf-item-row input:focus { border-color:#1a73e8; }
.sf-name  { flex:1; min-width:0; }
.sf-qty   { width:56px !important; text-align:center; }
.sf-price { width:110px !important; text-align:right; }
.sf-disc    { width:80px !important; text-align:right; }
.sf-bh-date { width:120px !important; }
.sf-line-total { width:90px; text-align:right; font-size:12px; font-weight:700; color:#1a3a6b; flex-shrink:0; }
.sf-remove-btn {
  background:none; border:none; color:#ccc; cursor:pointer; font-size:15px;
  padding:0 3px; flex-shrink:0; line-height:1;
}
.sf-remove-btn:hover { color:#e74c3c; }
.sl-add-row-btn {
  width:100%; padding:7px; border:1px dashed #c8d6e8; border-radius:6px;
  background:#f8faff; color:#6b8cba; cursor:pointer; font-size:12px; margin-top:4px;
}
.sl-add-row-btn:hover { border-color:#1a73e8; color:#1a73e8; background:#eef3ff; }

/* TOTALS BOX */
.sl-totals {
  margin-top:12px; padding:12px 14px; background:#f7f9ff;
  border-radius:8px; border:1px solid #dce8fb; display:flex; flex-direction:column; gap:7px;
}
.sl-total-row {
  display:flex; justify-content:space-between; align-items:center;
  font-size:12.5px; color:#555;
}
.sl-total-row input {
  padding:4px 8px; border:1px solid #ddd; border-radius:5px;
  font-size:12.5px; outline:none; text-align:right; width:120px;
}
.sl-total-row input:focus { border-color:#1a73e8; }
.sl-total-final { border-top:1px solid #c5d8f5; padding-top:8px; margin-top:2px; }

/* AUTOCOMPLETE */
.sl-autocomplete {
  position:fixed; z-index:9999; background:#fff;
  border:1px solid #ddd; border-radius:7px;
  box-shadow:0 6px 20px rgba(0,0,0,.13);
  max-height:240px; overflow-y:auto; display:none;
}
.sl-ac-opt { padding:.45rem .8rem; cursor:pointer; border-bottom:1px solid #f5f5f5; }
.sl-ac-opt:hover { background:#f0f4ff; }
.sl-ac-opt:last-child { border-bottom:none; }

/* TEMPLATE EDITOR OVERLAY */
.sl-tpl-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.45);
  display:flex; align-items:center; justify-content:center; z-index:1100;
}
.sl-tpl-modal {
  background:#fff; border-radius:10px; width:480px; max-width:95vw;
  box-shadow:0 8px 32px rgba(0,0,0,.22); overflow:hidden;
}
.sl-tpl-header {
  background:#7c3aed; color:#fff; padding:13px 18px;
  display:flex; justify-content:space-between; align-items:center;
}
.sl-tpl-header h3 { font-size:14px; font-weight:600; }
.sl-tpl-body { padding:16px 18px; }
.sl-tpl-grid { display:flex; flex-direction:column; gap:10px; }
.sl-tpl-footer {
  padding:11px 18px; border-top:1px solid #eee;
  display:flex; justify-content:flex-end; gap:8px;
}
</style>

<div class="sl-wrap">
  <div class="sl-toolbar">
    <button class="sl-btn sl-btn-primary" id="sl-add-btn">＋ Bán hàng</button>
    <button class="sl-btn sl-btn-trash" id="sl-trash-btn">🗑 Thùng rác</button>
    <div class="sl-search">
      <span style="font-size:13px;color:#aaa">🔍</span>
      <input id="sl-search-inp" placeholder="Tìm khách hàng, sản phẩm...">
    </div>
    <div class="sl-filters" id="sl-filters">
      <span class="sl-f active" data-mode="day">Hôm nay</span>
      <span class="sl-f" data-mode="week">Tuần</span>
      <span class="sl-f" data-mode="month">Tháng</span>
      <span class="sl-f" data-mode="all">Tất cả</span>
    </div>
    <div class="sl-spacer"></div>
    <button class="sl-btn sl-btn-tpl" id="sl-tpl-btn" title="Cài đặt mẫu hóa đơn">🖨 Mẫu HĐ</button>
    <div class="sl-quickstats">
      Đơn: <b id="sl-qs-count">0</b> &nbsp;·&nbsp; Doanh thu: <b id="sl-qs-rev">0đ</b>
    </div>
  </div>

  <div class="sl-main">
    <div class="sl-content">
      <div class="sl-table-wrap" id="sl-table-wrap"></div>
      <div class="sl-pagination" id="sl-pagination"></div>
    </div>
    <div class="sl-sidebar" id="sl-sidebar"></div>
  </div>

  <!-- Form modal -->
  <div class="sl-overlay" id="sl-overlay" style="display:none">
    <div class="sl-modal" id="sl-modal"></div>
  </div>

  <!-- Invoice template editor -->
  <div class="sl-tpl-overlay" id="sl-tpl-overlay" style="display:none">
    <div class="sl-tpl-modal">
      <div class="sl-tpl-header">
        <h3>🖨 Cài đặt mẫu hóa đơn</h3>
        <button class="sl-close-btn" id="sl-tpl-close">✕</button>
      </div>
      <div class="sl-tpl-body">
        <div class="sl-tpl-grid">
          <div class="sl-field">
            <label>Tên cửa hàng</label>
            <input id="tpl-shop-name" placeholder="Laptop 24h">
          </div>
          <div class="sl-field">
            <label>Địa chỉ</label>
            <input id="tpl-address" placeholder="123 Đường ABC, Quận 1, TP.HCM">
          </div>
          <div class="sl-field">
            <label>Số điện thoại cửa hàng</label>
            <input id="tpl-phone" placeholder="0901 234 567">
          </div>
          <div class="sl-field">
            <label>Tiêu đề hóa đơn</label>
            <input id="tpl-title" placeholder="HÓA ĐƠN BÁN HÀNG">
          </div>
          <div class="sl-field">
            <label>Ghi chú cuối trang</label>
            <textarea id="tpl-footer" rows="2" style="resize:vertical;padding:7px 9px;border:1px solid #ddd;border-radius:6px;font-size:12.5px;font-family:inherit;outline:none" placeholder="Cảm ơn quý khách đã mua hàng! 🙏"></textarea>
          </div>
        </div>
      </div>
      <div class="sl-tpl-footer">
        <button class="sl-btn" id="tpl-cancel">Huỷ</button>
        <button class="sl-btn sl-btn-primary" id="tpl-save">💾 Lưu mẫu</button>
      </div>
    </div>
  </div>
</div>`;

  // ══════════════════════════════════════════════
  //  WIRE UP TOOLBAR
  // ══════════════════════════════════════════════
  container.querySelector('#sl-add-btn').onclick = () => openForm(null);
  container.querySelector('#sl-trash-btn').onclick = () => {
    filterMode = 'trash'; updateFilterUI(); currentPage = 1; render();
  };
  container.querySelector('#sl-search-inp').oninput = e => {
    searchQ = e.target.value.toLowerCase().trim(); currentPage = 1; render();
  };
  container.querySelectorAll('.sl-f').forEach(f => {
    f.onclick = () => { filterMode = f.dataset.mode; updateFilterUI(); currentPage = 1; render(); };
  });
  container.querySelector('#sl-tpl-btn').onclick = openTemplateEditor;

  // Template editor buttons
  container.querySelector('#sl-tpl-close').onclick  = () => container.querySelector('#sl-tpl-overlay').style.display = 'none';
  container.querySelector('#tpl-cancel').onclick     = () => container.querySelector('#sl-tpl-overlay').style.display = 'none';
  container.querySelector('#tpl-save').onclick = () => {
    const o = container.querySelector('#sl-tpl-overlay');
    saveTemplate({
      shopName: o.querySelector('#tpl-shop-name').value.trim(),
      address:  o.querySelector('#tpl-address').value.trim(),
      phone:    o.querySelector('#tpl-phone').value.trim(),
      title:    o.querySelector('#tpl-title').value.trim(),
      footer:   o.querySelector('#tpl-footer').value.trim(),
    });
    o.style.display = 'none';
    toast('Đã lưu mẫu hóa đơn ✓');
  };

  function updateFilterUI() {
    container.querySelectorAll('.sl-f').forEach(f =>
      f.classList.toggle('active', f.dataset.mode === filterMode)
    );
  }

  // ══════════════════════════════════════════════
  //  FILTER / DATA HELPERS
  // ══════════════════════════════════════════════
  function getWeekBounds(ds) {
    const d = new Date(ds + 'T12:00:00');
    const day = d.getDay() || 7;
    const mon = new Date(d); mon.setDate(d.getDate() - (day - 1));
    const sun = new Date(d); sun.setDate(d.getDate() + (7 - day));
    return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
  }

  function getFiltered() {
    if (filterMode === 'trash') return allItems.filter(s => s.deletedAt);
    let list = allItems.filter(s => !s.deletedAt);
    if (filterMode === 'day')        list = list.filter(s => (s.date || '').startsWith(todayStr));
    else if (filterMode === 'week')  { const { start, end } = getWeekBounds(todayStr); list = list.filter(s => s.date >= start && s.date <= end); }
    else if (filterMode === 'month') list = list.filter(s => (s.date || '').startsWith(todayStr.slice(0, 7)));
    if (searchQ) list = list.filter(s =>
      (s.customer || '').toLowerCase().includes(searchQ) ||
      (s.phone || '').includes(searchQ) ||
      (s.items || []).some(it => (it.name || '').toLowerCase().includes(searchQ))
    );
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // ══════════════════════════════════════════════
  //  RENDER ORCHESTRATOR
  // ══════════════════════════════════════════════
  function render() {
    const filtered = getFiltered();
    renderQuickStats(filtered);
    renderTable(filtered);
    renderSidebar();
  }

  function renderQuickStats(filtered) {
    const rev = filtered.reduce((s, x) => s + (x.total || 0), 0);
    container.querySelector('#sl-qs-count').textContent = filtered.length;
    container.querySelector('#sl-qs-rev').textContent = formatVND(rev);
  }

  // ══════════════════════════════════════════════
  //  TABLE
  // ══════════════════════════════════════════════
  function renderTable(filtered) {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const page = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const wrap = container.querySelector('#sl-table-wrap');

    if (!total) {
      const msg = filterMode === 'trash' ? 'Thùng rác trống' : 'Chưa có đơn nào';
      const icon = filterMode === 'trash' ? '🗑' : '🛒';
      wrap.innerHTML = `<div class="sl-empty"><div style="font-size:2.5rem">${icon}</div><div>${msg}</div></div>`;
      renderPagination(0, 0); return;
    }

    const STATUS = {
      done:    { label: 'Hoàn thành', cls: 'badge-done' },
      pending: { label: 'Chờ TT',     cls: 'badge-pending' },
      cancel:  { label: 'Đã huỷ',     cls: 'badge-cancel' },
    };

    const rows = page.map((s, i) => {
      const idx     = (currentPage - 1) * PAGE_SIZE + i;
      const code    = '#BH' + String(idx + 1).padStart(4, '0');
      const items   = s.items || [];
      const itemStr = items.length === 0 ? '—'
        : items.length === 1 ? (items[0].name || '—')
        : `${items[0].name || ''} +${items.length - 1}`;
      const st  = STATUS[s.status || 'done'] || STATUS['done'];
      const pay = s.payMethod === 'transfer' ? '🏦 CK' : '💵 TM';

      if (filterMode === 'trash') {
        return `<tr>
          <td><input type="checkbox"></td>
          <td style="color:#aaa">${code}</td>
          <td>${esc(s.customer || '—')}</td>
          <td title="${esc(items.map(it => it.name).join(', '))}">${esc(itemStr)}</td>
          <td class="sl-money">${formatVND(s.total || 0)}</td>
          <td>${pay}</td>
          <td><span class="sl-badge badge-trash">Đã xoá</span></td>
          <td>${s.date || ''}</td>
          <td><button class="sl-action-btn sl-restore-btn" data-key="${s._key}">↩ Khôi phục</button></td>
        </tr>`;
      }

      return `<tr>
        <td><input type="checkbox"></td>
        <td>${code}</td>
        <td>
          <div class="sl-customer">${esc(s.customer || '—')}</div>
          ${s.phone ? `<div class="sl-phone">${esc(s.phone)}</div>` : ''}
        </td>
        <td title="${esc(items.map(it => it.name).join(', '))}">${esc(itemStr)}</td>
        <td class="sl-money">${formatVND(s.total || 0)}</td>
        <td>${pay}</td>
        <td><span class="sl-badge ${st.cls}">${st.label}</span></td>
        <td>${s.date || ''}</td>
        <td>
          <div class="sl-actions">
            <button class="sl-action-btn sl-edit-btn"  data-key="${s._key}">✏</button>
            <button class="sl-action-btn sl-print-btn" data-key="${s._key}">🖨</button>
            <button class="sl-action-btn sl-del sl-del-btn" data-key="${s._key}">🗑</button>
          </div>
        </td>
      </tr>`;
    });

    wrap.innerHTML = `
    <table class="sl-table">
      <thead>
        <tr>
          <th style="width:32px"><input type="checkbox" id="sl-chk-all"></th>
          <th>Mã đơn</th>
          <th>Khách hàng</th>
          <th>Sản phẩm</th>
          <th>Tổng tiền</th>
          <th>Thanh toán</th>
          <th>Trạng thái</th>
          <th>Ngày bán</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

    wrap.querySelectorAll('.sl-edit-btn').forEach(btn  => btn.onclick  = () => openForm(btn.dataset.key));
    wrap.querySelectorAll('.sl-del-btn').forEach(btn   => btn.onclick  = () => softDelete(btn.dataset.key));
    wrap.querySelectorAll('.sl-restore-btn').forEach(btn => btn.onclick = () => restoreItem(btn.dataset.key));
    wrap.querySelectorAll('.sl-print-btn').forEach(btn => btn.onclick  = () => printInvoice(btn.dataset.key));

    renderPagination(total, totalPages);
  }

  function renderPagination(total, totalPages) {
    const pg = container.querySelector('#sl-pagination');
    if (!pg || total <= PAGE_SIZE) { if (pg) pg.innerHTML = ''; return; }
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to   = Math.min(currentPage * PAGE_SIZE, total);
    let html = `<span style="margin-right:6px">Hiển thị ${from}–${to} / ${total} đơn</span>`;
    html += `<button class="sl-pg-btn" ${currentPage === 1 ? 'disabled' : ''} data-pg="${currentPage - 1}">‹</button>`;
    const maxP = Math.min(totalPages, 7);
    for (let p = 1; p <= maxP; p++)
      html += `<button class="sl-pg-btn ${p === currentPage ? 'active' : ''}" data-pg="${p}">${p}</button>`;
    if (totalPages > maxP) html += `<span style="padding:0 4px">…${totalPages}</span>`;
    html += `<button class="sl-pg-btn" ${currentPage === totalPages ? 'disabled' : ''} data-pg="${currentPage + 1}">›</button>`;
    pg.innerHTML = html;
    pg.querySelectorAll('.sl-pg-btn:not([disabled])').forEach(btn =>
      btn.onclick = () => { currentPage = parseInt(btn.dataset.pg); render(); }
    );
  }

  // ══════════════════════════════════════════════
  //  SIDEBAR
  // ══════════════════════════════════════════════
  function renderSidebar() {
    const active    = allItems.filter(s => !s.deletedAt);
    const todayList = active.filter(s => (s.date || '').startsWith(todayStr));
    const monthList = active.filter(s => (s.date || '').startsWith(todayStr.slice(0, 7)));
    const todayRev  = todayList.reduce((s, x) => s + (x.total || 0), 0);
    const monthRev  = monthList.reduce((s, x) => s + (x.total || 0), 0);

    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds  = d.toISOString().slice(0, 10);
      const rev = active.filter(s => (s.date || '').startsWith(ds)).reduce((s, x) => s + (x.total || 0), 0);
      const lbl = ['CN','T2','T3','T4','T5','T6','T7'][d.getDay()];
      days7.push({ ds, rev, lbl });
    }
    const maxRev = Math.max(...days7.map(d => d.rev), 1);
    const cash     = active.filter(s => !s.payMethod || s.payMethod === 'cash').length;
    const transfer = active.filter(s => s.payMethod === 'transfer').length;
    const total    = (cash + transfer) || 1;
    const cashPct  = Math.round(cash / total * 100);
    const tranPct  = 100 - cashPct;

    container.querySelector('#sl-sidebar').innerHTML = `
    <div class="sl-sb-section">
      <div class="sl-sb-title">Hôm nay</div>
      <div class="sl-stat-row">
        <div class="sl-stat-card">
          <div class="sl-stat-val">${todayList.length}</div>
          <div class="sl-stat-lbl">Đơn bán</div>
        </div>
        <div class="sl-stat-card">
          <div class="sl-stat-val" style="font-size:.95rem">${formatVND(todayRev)}</div>
          <div class="sl-stat-lbl">Doanh thu</div>
        </div>
      </div>
    </div>
    <div class="sl-sb-section">
      <div class="sl-sb-title">Tháng ${todayStr.slice(5, 7)}</div>
      <div class="sl-stat-card">
        <div class="sl-stat-val" style="font-size:1.05rem">${formatVND(monthRev)}</div>
        <div class="sl-stat-lbl">${monthList.length} đơn</div>
      </div>
    </div>
    <div class="sl-sb-section">
      <div class="sl-sb-title">7 ngày gần đây</div>
      <div class="sl-chart">
        ${days7.map(d => {
          const h = Math.max(5, Math.round((d.rev / maxRev) * 70));
          return `<div class="sl-chart-col" title="${d.ds}\n${formatVND(d.rev)}">
            <div class="sl-bar ${d.ds === todayStr ? 'today' : ''}" style="height:${h}px"></div>
            <div class="sl-bar-lbl">${d.lbl}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="sl-sb-section">
      <div class="sl-sb-title">Thanh toán</div>
      <div class="sl-pay-row"><span>💵 Tiền mặt</span><b>${cashPct}%</b></div>
      <div style="height:5px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin:3px 0">
        <div style="height:100%;width:${cashPct}%;background:#1a73e8;border-radius:3px"></div>
      </div>
      <div class="sl-pay-row"><span>🏦 Chuyển khoản</span><b>${tranPct}%</b></div>
    </div>`;
  }

  // ══════════════════════════════════════════════
  //  MODAL FORM
  // ══════════════════════════════════════════════
  function openForm(key) {
    editKey = key;
    const ex      = key ? allItems.find(s => s._key === key) : null;
    const overlay = container.querySelector('#sl-overlay');
    const modal   = container.querySelector('#sl-modal');

    modal.innerHTML = `
    <div class="sl-modal-header">
      <h3>${ex ? '✏️ Sửa đơn bán hàng' : '➕ Thêm đơn bán hàng'}</h3>
      <button class="sl-close-btn" id="sl-close">✕</button>
    </div>
    <div class="sl-modal-body">

      <div class="sl-form-grid">
        <div class="sl-field span2">
          <label>Tên khách hàng</label>
          <input id="sf-customer" placeholder="Nhập tên khách hàng...">
        </div>
        <div class="sl-field">
          <label>Số điện thoại</label>
          <input id="sf-phone" placeholder="0901 234 567">
        </div>
        <div class="sl-field">
          <label>Ngày bán</label>
          <input id="sf-date" type="date">
        </div>
        <div class="sl-field">
          <label>Thanh toán</label>
          <select id="sf-pay">
            <option value="cash">💵 Tiền mặt</option>
            <option value="transfer">🏦 Chuyển khoản</option>
          </select>
        </div>
        <div class="sl-field">
          <label>Trạng thái</label>
          <select id="sf-status">
            <option value="done">✅ Hoàn thành</option>
            <option value="pending">⏳ Chờ thanh toán</option>
            <option value="cancel">❌ Đã huỷ</option>
          </select>
        </div>
        <div class="sl-field span2">
          <label>Ghi chú</label>
          <input id="sf-note" placeholder="Ghi chú thêm...">
        </div>
      </div>

      <div class="sl-items-header">
        <div class="sl-items-label">📦 Sản phẩm</div>
      </div>
      <div style="display:flex;gap:5px;padding:4px 9px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.3px">
        <div style="flex:1">Tên sản phẩm</div>
        <div style="width:56px;text-align:center">SL</div>
        <div style="width:110px;text-align:right">Đơn giá</div>
        <div style="width:80px;text-align:right">Giảm</div>
        <div style="width:120px;text-align:center">Hết BH</div>
        <div style="width:90px;text-align:right">Thành tiền</div>
        <div style="width:22px"></div>
      </div>
      <div id="sf-rows"></div>
      <button id="sf-add-row" class="sl-add-row-btn">＋ Thêm sản phẩm</button>

      <div class="sl-totals">
        <div class="sl-total-row">
          <span>Tạm tính:</span>
          <b id="sf-subtotal" style="font-size:13px">0đ</b>
        </div>
        <div class="sl-total-row">
          <label for="sf-extra-disc" style="cursor:pointer;color:#555">Giảm thêm:</label>
          <input id="sf-extra-disc" type="number" min="0" value="0" placeholder="0">
        </div>
        <div class="sl-total-row sl-total-final">
          <span style="font-weight:700;font-size:13px">Tổng cộng:</span>
          <b id="sf-total" style="color:#1d4ed8;font-size:1.1rem">0đ</b>
        </div>
        <div class="sl-total-row">
          <label for="sf-paid" style="cursor:pointer;color:#555">Đã trả:</label>
          <input id="sf-paid" type="number" min="0" value="0" placeholder="0">
        </div>
      </div>
    </div>
    <div class="sl-modal-footer">
      <button class="sl-btn" id="sf-cancel">Huỷ</button>
      ${ex ? `<button class="sl-btn sl-btn-trash" id="sf-del-modal">🗑 Xoá</button>` : ''}
      ${ex ? `<button class="sl-btn sl-btn-tpl" id="sf-print-modal">🖨 In HĐ</button>` : ''}
      <button class="sl-btn sl-btn-primary" id="sf-save">💾 Lưu đơn</button>
    </div>`;

    // ── Set values programmatically (tránh bug value rỗng với innerHTML) ──
    modal.querySelector('#sf-customer').value = ex?.customer || '';
    modal.querySelector('#sf-phone').value    = ex?.phone    || '';
    modal.querySelector('#sf-date').value     = ex?.date     || todayStr;
    modal.querySelector('#sf-pay').value      = ex?.payMethod || 'cash';
    modal.querySelector('#sf-status').value   = ex?.status   || 'done';
    modal.querySelector('#sf-note').value     = ex?.note     || '';
    modal.querySelector('#sf-extra-disc').value = ex?.extraDiscount || 0;
    modal.querySelector('#sf-paid').value     = ex?.paid     || 0;

    overlay.style.display = 'flex';

    const rowsWrap = modal.querySelector('#sf-rows');
    const initRows = ex?.items?.length ? ex.items : [{}];
    initRows.forEach(r => addItemRow(rowsWrap, r));
    recalc();

    modal.querySelector('#sl-close').onclick       = () => { overlay.style.display = 'none'; };
    modal.querySelector('#sf-cancel').onclick      = () => { overlay.style.display = 'none'; };
    modal.querySelector('#sf-add-row').onclick     = () => addItemRow(rowsWrap, {});
    modal.querySelector('#sf-extra-disc').oninput  = recalc;
    modal.querySelector('#sf-paid').oninput        = recalc;
    modal.querySelector('#sf-save').onclick        = saveForm;
    if (ex) {
      modal.querySelector('#sf-del-modal').onclick = () => { softDelete(key); overlay.style.display = 'none'; };
      modal.querySelector('#sf-print-modal').onclick = () => printInvoice(key);
    }
    overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none'; };
  }

  // ══════════════════════════════════════════════
  //  AUTOCOMPLETE DROPDOWN
  // ══════════════════════════════════════════════
  function getOrCreateDrop() {
    if (!globalDrop) {
      globalDrop = document.createElement('div');
      globalDrop.className = 'sl-autocomplete';
      document.body.appendChild(globalDrop);
    }
    return globalDrop;
  }
  function hideDrop() { if (globalDrop) globalDrop.style.display = 'none'; }

  // ══════════════════════════════════════════════
  //  ITEM ROW
  // ══════════════════════════════════════════════
  function addItemRow(wrap, data) {
    const row = document.createElement('div');
    row.className = 'sf-item-row';
    row.innerHTML = `
      <input class="sf-name"  placeholder="Tên sản phẩm..." autocomplete="off" style="flex:1;min-width:0">
      <input class="sf-qty"   type="number" min="1"  title="Số lượng">
      <input class="sf-price" type="number" min="0"  title="Đơn giá" style="width:110px">
      <input class="sf-disc"    type="number" min="0"  title="Giảm giá" style="width:80px">
      <input class="sf-bh-date" type="date"            title="Ngày hết bảo hành">
      <span class="sf-line-total">0đ</span>
      <button class="sf-remove-btn" type="button" title="Xoá dòng">✕</button>`;
    wrap.appendChild(row);

    // Set values programmatically
    row.querySelector('.sf-name').value  = data.name     || '';
    row.querySelector('.sf-qty').value   = data.qty      || 1;
    row.querySelector('.sf-price').value = data.price    || 0;
    row.querySelector('.sf-disc').value  = data.discount || 0;
    row.querySelector('.sf-bh-date').value = data.bhDate || '';

    const nameInput = row.querySelector('.sf-name');
    const drop = getOrCreateDrop();

    nameInput.oninput = () => {
      recalc();
      const q = nameInput.value.trim().toLowerCase();
      if (!q) { hideDrop(); return; }
      const hits = invItems.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        String(p.id || '').toLowerCase().includes(q)
      ).slice(0, 8);
      if (!hits.length) { hideDrop(); return; }

      const rect = nameInput.getBoundingClientRect();
      drop.style.cssText = `position:fixed;top:${rect.bottom + 2}px;left:${rect.left}px;` +
        `width:${rect.width + 130}px;display:block`;
      drop.innerHTML = hits.map(p => `
        <div class="sl-ac-opt" data-key="${p._key}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div>
              <div style="font-size:.82rem;font-weight:600">${esc(p.name || '')}</div>
              <div style="font-size:.72rem;color:#888">${esc(p.id || '')}</div>
            </div>
            <div style="font-size:.8rem;font-weight:700;color:#1a3a6b;white-space:nowrap">${formatVND(p.price || 0)}</div>
          </div>
        </div>`).join('');

      drop.querySelectorAll('.sl-ac-opt').forEach(opt => {
        opt.onmousedown = e => {
          e.preventDefault();
          const p = invItems.find(x => x._key === opt.dataset.key);
          if (p) { nameInput.value = p.name || ''; row.querySelector('.sf-price').value = p.price || 0; }
          hideDrop(); recalc();
        };
      });
    };
    nameInput.onfocus = () => { if (nameInput.value.trim()) nameInput.dispatchEvent(new Event('input')); };
    nameInput.onblur  = () => setTimeout(hideDrop, 200);
    row.querySelector('.sf-remove-btn').onclick = () => { row.remove(); recalc(); };
    row.querySelectorAll('.sf-qty, .sf-price, .sf-disc').forEach(inp => inp.oninput = recalc);
    recalc();
  }

  // ══════════════════════════════════════════════
  //  RECALC TOTALS
  // ══════════════════════════════════════════════
  function recalc() {
    const modal = container.querySelector('#sl-modal');
    if (!modal) return;
    let sub = 0;
    modal.querySelectorAll('.sf-item-row').forEach(row => {
      const qty   = parseFloat(row.querySelector('.sf-qty').value)   || 0;
      const price = parseFloat(row.querySelector('.sf-price').value) || 0;
      const disc  = parseFloat(row.querySelector('.sf-disc').value)  || 0;
      const line  = Math.max(0, qty * price - disc);
      row.querySelector('.sf-line-total').textContent = formatVND(line);
      sub += line;
    });
    const extra = parseFloat(modal.querySelector('#sf-extra-disc')?.value) || 0;
    const total = Math.max(0, sub - extra);
    if (modal.querySelector('#sf-subtotal')) modal.querySelector('#sf-subtotal').textContent = formatVND(sub);
    if (modal.querySelector('#sf-total'))    modal.querySelector('#sf-total').textContent    = formatVND(total);
  }

  // ══════════════════════════════════════════════
  //  SAVE FORM
  // ══════════════════════════════════════════════
  async function saveForm() {
    const modal         = container.querySelector('#sl-modal');
    const customer      = modal.querySelector('#sf-customer').value.trim();
    const phone         = modal.querySelector('#sf-phone').value.trim();
    const date          = modal.querySelector('#sf-date').value;
    const payMethod     = modal.querySelector('#sf-pay').value;
    const status        = modal.querySelector('#sf-status').value;
    const note          = modal.querySelector('#sf-note').value.trim();
    const extraDiscount = parseFloat(modal.querySelector('#sf-extra-disc').value) || 0;
    const paid          = parseFloat(modal.querySelector('#sf-paid').value) || 0;

    const items = [];
    modal.querySelectorAll('.sf-item-row').forEach(row => {
      const name = row.querySelector('.sf-name').value.trim();
      if (!name) return;
      items.push({
        name,
        qty:      parseFloat(row.querySelector('.sf-qty').value)   || 1,
        price:    parseFloat(row.querySelector('.sf-price').value) || 0,
        discount: parseFloat(row.querySelector('.sf-disc').value)  || 0,
        bhDate:   row.querySelector('.sf-bh-date').value || null,
      });
    });
    if (!items.length) { toast('Vui lòng thêm ít nhất 1 sản phẩm'); return; }

    const subtotal = items.reduce((s, it) => s + Math.max(0, it.qty * it.price - it.discount), 0);
    const total    = Math.max(0, subtotal - extraDiscount);
    const data = {
      customer, phone, date, payMethod, status, note,
      items, subtotal, extraDiscount, total, paid,
      createdAt: editKey
        ? (allItems.find(s => s._key === editKey)?.createdAt || Date.now())
        : Date.now()
    };

    const saveBtn = modal.querySelector('#sf-save');
    saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...';

    try {
      if (editKey) {
        await updateItem(COLLECTION, editKey, data);
        toast('Cập nhật thành công ✓');
        logToSheet({ ...data, key: editKey }, 'update');
      } else {
        const ref = await addItem(COLLECTION, data);
        toast('Lưu đơn thành công ✓');
        logToSheet({ ...data, key: ref?.key || '' }, 'add');
      }
      container.querySelector('#sl-overlay').style.display = 'none';
      editKey = null;
    } catch(e) {
      toast('Lỗi: ' + e.message);
      saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu đơn';
    }
  }

  // ══════════════════════════════════════════════
  //  PRINT INVOICE (Phiếu Bảo Hành – thiết kế mới)
  // ══════════════════════════════════════════════
  const LOGO_URL = 'https://nguyenlaptop24h.github.io/laptop24h-v2/logo-vang.jpg';

  function printInvoice(key) {
    const s = allItems.find(x => x._key === key);
    if (!s) { toast('Không tìm thấy đơn hàng'); return; }

    const tpl = getTemplate();

    const sorted = [...allItems].filter(x => !x.deletedAt).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const idx    = sorted.findIndex(x => x._key === key);
    const code   = '#PBH-' + String(idx + 1).padStart(4, '0');

    const dateObj   = s.date ? new Date(s.date + 'T12:00:00') : new Date(s.createdAt || Date.now());
    const dateStr   = dateObj.toLocaleDateString('vi-VN');

    const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));

    const shopName   = esc(tpl.shopName || 'Laptop 24h');
    const addr       = tpl.address ? esc(tpl.address) : '123 Đường ABC, TP.HCM';
    const phone      = tpl.phone   ? esc(tpl.phone)   : '0909 123 456';
    const invTitle   = esc(tpl.title   || 'PHIẾU BẢO HÀNH');
    const footerText = esc(tpl.footer  || 'Cảm ơn quý khách đã tin tưởng mua sắm! 🙏');

    const remaining = (s.total || 0) - (s.paid || 0);

    const itemRows = (s.items || []).map((it, i) => {
      const line = Math.max(0, (it.qty || 1) * (it.price || 0) - (it.discount || 0));
      const bhChip = it.bhDate
        ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4">${it.bhDate.split('-').reverse().join('/')}</span>`
        : `<span style="color:#bbb;font-size:12px">—</span>`;
      return `<tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td>${esc(it.name || '')}${it.discount ? `<br><span style="font-size:11px;color:#888">Giảm: ${fmt(it.discount)}đ</span>` : ''}</td>
        <td style="text-align:center">${it.qty || 1}</td>
        <td style="text-align:right">${fmt(it.price || 0)}</td>
        <td style="text-align:right;font-weight:600">${fmt(line)}đ</td>
        <td style="text-align:center">${bhChip}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${invTitle} ${code}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;background:#f0f2f5;padding:28px 12px;color:#333}
  .page{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)}
  .top-stripe{height:7px;background:linear-gradient(90deg,#00897b,#26a69a,#80cbc4)}
  .header{padding:20px 28px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8f5e9}
  .shop-sub{font-size:11.5px;color:#777;margin-top:4px;line-height:1.7}
  .title-block{text-align:right}
  .main-title{font-size:17px;font-weight:800;color:#004d40;letter-spacing:2px;text-transform:uppercase}
  .bill-num{display:inline-block;margin-top:5px;background:#e0f2f1;color:#00695c;border:1.5px solid #80cbc4;border-radius:20px;padding:2px 13px;font-size:12px;font-weight:700}
  .ribbon{background:#00897b;color:#fff;padding:6px 28px;display:flex;justify-content:space-between;font-size:11.5px;font-weight:600}
  .body{padding:20px 28px}
  .cust-box{display:grid;grid-template-columns:1fr 1fr;gap:7px 24px;margin-bottom:18px;background:#f9fffe;border:1px solid #e0f2f1;border-radius:7px;padding:11px 14px}
  .cust-box .fi{font-size:12.5px}.cust-box .k{font-weight:700;color:#00695c}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  thead tr{background:#00897b;color:#fff}
  thead th{padding:8px 9px;font-weight:600;text-align:left}
  .tc{text-align:center}.tr{text-align:right}
  tbody tr:nth-child(even){background:#f4fdfb}
  tbody td{padding:8px 9px;border-bottom:1px solid #e8f5e9;vertical-align:middle}
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:8px}
  .totals-box{min-width:240px}
  .t-row{display:flex;justify-content:space-between;padding:5px 9px;font-size:12.5px}
  .t-row .k{color:#555}.t-row .v{font-weight:600}
  .t-row.disc .v{color:#e53935}
  .t-row.grand{background:#00897b;color:#fff;border-radius:7px;margin-top:4px;padding:8px 11px;font-size:14px}
  .t-row.grand .k,.t-row.grand .v{font-weight:800;color:#fff}
  .t-row.owe .v{color:#e53935}
  .wn-box{margin-top:18px;border:1.5px solid #b2dfdb;border-radius:7px;overflow:hidden}
  .wn-head{background:#e0f2f1;padding:7px 15px;font-size:12px;font-weight:700;color:#00695c;letter-spacing:.5px}
  .wn-body{padding:9px 15px 11px}.wn-body li{font-size:12px;color:#555;line-height:1.85;margin-left:15px}
  .footer-band{margin-top:20px;background:#e0f2f1;padding:11px 28px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#00695c;font-weight:600}
  .footer-band span{opacity:.8;font-weight:400;font-style:italic}
  .bottom-stripe{height:5px;background:linear-gradient(90deg,#80cbc4,#26a69a,#00897b)}
  .btn-bar{display:flex;gap:10px;justify-content:center;padding:18px}
  .btn-bar button{padding:10px 26px;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:700}
  .btn-p{background:#00897b;color:#fff}.btn-p:hover{background:#00695c}
  .btn-c{background:#f0f0f0;color:#444}
  @media print{.btn-bar{display:none}body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="page">
  <div class="top-stripe"></div>
  <div class="header">
    <div>
      <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QB4RXhpZgAASUkqAAgAAAAEABIBAwABAAAAAQAAADEBAgAHAAAAPgAAABICAwACAAAAAgACAGmHBAABAAAARgAAAAAAAABHb29nbGUAAAMAAJAHAAQAAAAwMjIwAqAEAAEAAADXBQAAA6AEAAEAAAAEAgAAAAAAAP/bAIQACQYHDw8PDw8QDw0QDw8PDw4PDw8SIRcWDhUNHR4VGR4eGiAjJRklHx0lDh4lJiEeIi8tJSwoJSwuMCU0KScyIQEKCgoPExUQExUTLRkfHy0tMTIqNTEtNi01NSU3Li01Mi4tLSctLTEwNi41NjUvNjctMSY1LTUlLTExLiYvMCVF/8AAEQgCBAXXAwEiAAIRAQMRAf/EABsAAQACAwEBAAAAAAAAAAAAAAAFBgEDBAIH/8QARBABAAIBAAQICwYFAwUAAwAAAAECAwQFESEGEjFBUXHB0RUiMlJTYYGRkqGxE0JicqLhIzPC8PE0Q4IUJHOy8hZj4v/EABsBAQACAwEBAAAAAAAAAAAAAAAEBQIDBgEH/8QAOhEBAAIBAgMDCgQGAgMBAQAAAAECAwQRBSFREjFBBiIyQlJhcYGRsRMUodEVFiMzU/BDwTRy4STx/9oADAMBAAIRAxEAPwC+ZtNy0yZOLkvGy9o2bd3LPM3Y9fZ68s1t+aO7Y49PjZly/wDkv9Wh88tq89L3iuSY5z4uirhx2rXesJ/Fwkn72P21nsdmLhBhnl49euO5VBKx8c1Ve+0W+MNVtBinw2XfFrLBbkyU6pnZ9XTFonkmHz97pktXybWjqnYnY/KO3rY/o0W4bHhZfhS8Wts9eTJafzb/AKuzFwiyx5VaW+Sfj4/p574mqPbh+WO7aVoZQOLhJSfKx2jqnb3OzFrvR7ff4s9FomP2TsfEtNfuyx9vu0W02WO+spEasWk0v5N6z1TtbUyt6z3Tu0zEsgMngAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACj6zj+Nl/PZyuvW0fx8v5nI+a6qP6mT4y6bD6NPhAAjtgAAAAAA34tMy18nJePVt7GgbKZL17rbMZrE98JLFrzSK/ei35o7nZi4ST97HE+uttnyQIm4+Kaqvdkn7/dotpMU+qtWLhDhnli9euNv0deLWmC3Jlp7Z2fVShOx+UGePSrFmi3Dsc90zC/1vE74mJ6pelApea8kzHVLqxa0z15Mtvbv+qfj8o8frY5j/fkj24bbwsuoquLhDmjyopb2bHZi4SV+9jtH5Z29ydj41pbevt8Wi2iyx4bp5lGYteaPb701/NH9w7MWl47+Tek9Up2PVYb+jkifmj2xXjvrMN4xtZSGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACla5/1GX80fSHE7teR/3GTrj6Q4XzfWR/Vzf+0ulwehT4QAIra9Ysc2mK1jbMzsiOlty6Jkr5WO8evZ2verJ/j4vz1XfYvOG8LpqKXtNpiYlA1WrnHaI23h8+F7y6Ljv5VKT1w48uo8FvuzX8s/3Dfk8ncsejeJ/RhXiVfGuyoCx5eDdfu5Jj80be5xZeD+aOSaW6p2IGThGqr/AMe/wSK6zFPrbIkdeXVuevLjv7I2/Ry2rMbpiYnolAvhyV9Ksw31vWe6d2AGtmAPAAAAAAe7jdi0rJXyb3jql14td6RX70W/NH9yjhIx6vNT0ckx82u2Gk99YlO4uElvvY6z+Wdne7MXCLFPlRevs2qsJ2Pjeqr62/xR7aHFPhsumLWuC3Jkr7d31ddMlbb4mJ6pUBmtpjfEzE9MSn4/KO/rY4n4NFuGx4WfQBScWss9eTLf2zt+rrxcIM0cvEt7Nn0TsflBp59KJqj24fkju2laxAYuEsfexzH5Z2uzFr3R7ctpr+avcn4+J6W/dkj7fdHtpcserKTZc2LTcV/JyUn1bXRtTK5K27rbtMxMd8MgM3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACm6/j/ALnJ/wAfpCPSXCH/AFFuqv0Rr5zr4/rZv/aXSaf0MfwgAQ25v0Cf4uL/AMlPrC9Qomh/zMf56fWF7h13k5PmZfip+JelVkB0itAAYeMmKtvKrEx642vYxmsT3wbuHLqjR7cuOI/Lu+jjy8Hcc+Te9evemmUXJw/T378cN1dRkjutKr5eDmSPJvS3Xu73Jl1PpFf9uZ9dZ2/uuQgZOA6a3dvVIrxDLHfzUHJitXyq2r1xseH0CYieaHNl1dhv5WOnXEbPogZPJyfUyfVIrxKPGqkC15eD+GeTj16p73Fl4Nz93JE+q0dqvycD1Ve6sW+Et9dfinx2QIksmo9IryVi35Z73Hl0TJXysd49fF7UDJo89PSxzHySK5sc91olpAR9m0AeAAAAAAA2Y9IvXyb3r1S1jOt7R3Ts8msT3wkMWudIr9/b6rRE/u7MXCPJHlUrPVOzvQYmY+J6mndln7/dotpcU99FoxcI8U+VW9fm68et9HtyZIj8276qYJ+Pj+ojviLNFuHY57pmF+x5a28m1Z6p2vb5/W0xybup04tYZqcmS/VM7fqnY/KOvrY9vgj24bPhZdxU8Wv88cvEt1x3OzFwk87FPXWyfj43pbet2fjCPbQ5Y8N1gEVi19gtyzavXHdtdmLT8NvJyUn1bU7HrMF/RyRPzaLYbx31l1DETDKRu1gD0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVHhH/qJ/LVFpXhL/P8A+Fe1FPnfEo/r5vi6PS/26fAAQW9s0by6fnr9V9hQMU+NX80fVf4dZ5Od2b5f9qniXfRkB0yrAAAAAAAAAAAAGNjIDRl0THfyqUnrhxZdR6Pb7s1/LP8AcJMR8mlw39LHE/JnXLeO60wgMvBuv3ckx+aNrjy8H80cnEt1Ts+q1iDk4Lpbert8EiuuzR47qRl1dmpy4r+yNv0c1qzG6YmJ6JfQHjJirbyq1nrjagZPJynq5Jj4pFeJW8aqCLnl1Po9v9uI/Lu+jiy8HMc+Te9ever8nANRHdMWSK8Qxz3xMKyJrLwdyR5N6W693e48uqNIr/tzP5Z2/ugZOHamnfilIrqcU91ocI93xWr5VbV642PCJNZjvhuiYnxAGD0AAAAAAAejZjzXr5NrV6p2OvFrjSK/7kz6rRE/u4Bvx6nLT0bzHza7YqT31iU1i4R5I8qlLdW7vdmLhHjnyqXr1b1ZE7HxnVV9ff4tFtFinw2XLFrjR7f7kR+aNjsx5ItETWYmJ5JjftUFcdQ/6fH/AMvlMr7hXFMme00tWI2jdX6vSVxxExPikQF8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKnwn/nx/wCOv1lEpjhRH8av/jj6z3od894pH9fN8XRaT+3QAV6QzD6BXkfPl/xT4sdUOp8m5/v/AC/7VXE/+P5vYDqVUAAAAAAAAAAAAAAAAAAAAAAAA8zWJ5Yhy5dW4bcuOnXEbPo6xrvipb0qxLKLTHdOyIy8H8M8nHr1Tt+rjy8G5+7kifVaNnzWMQcnCdLbvx7fDk311eWPWVDLqPSK/di35Z73Hl0XJTyqXjrjtXsQMnk9hn0bzH6t9eI38YiXz4XvLoeO/lUpPXDjy6i0e33Zr+WUDJ5O5Y9G8T+iRXiVPGuyoCxZeDcfdyTH5o2uPLwfzxycS3VOz6oGThGqr/x7/DmkV1mKfW2RI6surs1OXFf2Rt+jmtExyxsn1oN8OSvpVmEit6z3TuwA1sgB4C48H/8ATY/+f/tKnLhwe/02P/n9ZX/k9/ev/wCv/cK/iXoV+KSAdmpQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFY4Ux/Ep+Tt/dCJzhVHj4/wAs/wB/NBvn/Fv/ACMrodH/AG6ACtSRfdHnxK/lhQl70OduPH+Sv0dP5Od+b5KvifdT5t4Dq1SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw8ZMNbeVWs9cbXsYzWJ74e7uDLqfR7f7cR+XciNcaophpx6zbliNk+tZkTwl/kf86qviOiwfhZbfhxvEd6Vps1+3SO1O26qAODX4t/B7/T067/WVQW/g7/p6ddvrK+8nv71v/X9lfxH0I+KTAdopQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFb4V+Vi6rdnegU/ws5cXVfs70A4HjH/AJGX5faHQaL+3UAVaULzq6duHFP/AOun0UZd9VfyMX5K/R0nk5Pn5Y9ys4l3UdYDrlQAAAAAAAAAAwDm0vTsWHZ9pbi8bbs3TO3Z1dbC961ibWnaOr2sTPKI3dQjvDejek/TPceG9G9J+me5o/Paf/LX6w2fgZPYn6JER3hvRvSfpnuPDejek/TPcfntP/lr9YPwMnsT9EgI7w3o3pP0z3O+sxMRMc+9tx58d9+xeLbdJYWpaO+Jh7AbWIAAAAAAAAAAAAAAAAiOE38j/nVLojhN/Jj89ULiP9jN8G/TenT4qoA+dOjFu4O/6evXb6qit3Bz/T167fVfeT/963wQOI+hHxSgDtFIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDj0nWeHHuteNvRG+WvJlpSN7WiIZVrM8ojd2CAzcJI+5jmfXadjjvwgzzyRSPYrcnGtLX1t/gk10WWfDZaxT7a70n0mzqrHcV15pEffieusI/8AMGm6W/T92z+HZesf78lwFXxcIsseVWlvkkNH4Q4rbrxanr5Y7/klYuMaW/Lt7fFqvo8tfV3TA14c1bxxq2i0dMS2LKLRMbxO6LMMgMgAAAAAAAAABgc+labjxbJvbi7eTdM7fc5vDejek/TPcj31WGs7WyRE/GGcYrzzisykhHeG9G9J+me48N6N6T9M9zH89p/8tfrDL8DJ7E/RIiO8N6N6T9M9x4b0b0n6Z7j89p/8tfrB+Bk9ifokBy6Jp+LLtjHabbOXxZjZt64dTfS9bRvWd4a5rMcpjZkBm8AAAAYHHpOs8OK3FvfZbl2cWZ5epq8N6N6T9M9yNbV4KzMTkiJj3w2RhvPOKykhHeG9G9J+me48N6N6T9M9zz89p/8ALX6w9/AyexP0SAjvDejek/TPc36Jp+LNMxjtxtnLumNm3rZU1WG0xFckTPTeHk4rxzmsw6wEhrAAAAAAAAV7hZH8qfz9ncryx8K48XF12/v5K44Tjcf/AKMny+y/0P8Abr8wBUJYuup5/gYvywpS56kn/t8fV2ui8nZ/qZPgruJejX4u8B2CmAAAAAAAAAAYVbhPk25q182sfq/wtKl65ycbPknotxfh3dii4/k2wxHWU7h9d779IcQDil4AA94Kca9a+daK+/d2r7WN0KbqTHxtIx+qZt7t/YucOv8AJ3HtTJbrP2U/EredWPcyA6NWgAAAAAAAAAAAAAAACH4T/wAmPz17Uwh+E/8AJj88fSUHiX9jN8G/TenT4qqA+dujFt4N/wAiPzWVJbODf8iPzWXvAP70/BA4j6EfFLAO1UgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPNrRG+ZiI9ZE7Xm8D0A9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHm1oiNszsjl3vJkZR+sNbY8O7bxr+bHai9a68mdtMU7I5Jvzz1d6ClznEOORXemLnPVZafQTPO/KOjv0zW2XLu28Wvm13fPlcAOXzZ8mSd72mZWtMda8ojYAaWYAAADbo+kXxzxqWms+rkn2LJqrXVcuyt9lb83RZVhY6LiOXBMbTvHRHz6al45xtPV9BEFqPWvH2Ysk+N920/e9XWnXcaXVUzUi9ZUOXFakzWWQElrAAAAAAYeM2SK1m1p2REbZnqe1a4R6w40/ZVndWfH2c89HsQ9dq64Mdrz3+EN2DDN7RWEbrLTJzZJtPJyVjohyg+fZctr2ta07zLoqUisREeAA1Mh6xY5taK1jbMzsj2vKycHdX8WPtrRvtHiRPNHT7U7QaO2fJFY7vGWjUZox1mfoktW6HGHHFY5eW09MusH0DHjrSta1jaIc7a0zMzPiyA2PAAAHm07Imet5Mima5ycbSMk9FuL8O7scT3lvxrWt51pn3/5eHzXUX7V726zLp8ddq1jpAA0MxZeCuPZTJbptEfD/APStLhqDHxdHp+Lbb3yvOA4982/sx/8AEHiFtqbdZSQDtlGAAAAAAAAgeFXkY/zT9FbWbhVH8On5+yVZcLxyP69vhC90H9uABTpouOoZ/wC2x/8AL6ypy38Hp/7enXf6yv8Ayen+tf8A9f2V/EfQj4pMB2alAAAAAAAAAAebTsiZ9Sg5b8a1rdMzPvn9111rk4uHJP4ZiPbu7VIcp5R5OeKnxlbcNr6cgDmFoAAmuC+LbltbzabPi/ws6D4K49lL2860R8P/ANJx33BsfZwY/fzc/rbb5LMgLRFAAAAAAAAAAAAAAAAYcOt9CnPSKxMRstFt/q297uGvLiretq27pZVtNZiY8FWtwdzc1sc+2Y7Gu2odIjmrPVZbWVTbgOlnrHzS41+VTLan0iP9ufZMd6wagw2ph4t4ms8a07JSQ26ThOLBft1tMsM2rveOzMQyAtUUAAAAAAAAAAAAAAAAAAAAAAAAABgEZrvWNsEV4sVm1tvLzbP8tOfPXHWb27oZ0pNpisd8pPa0Z9MxY/LvWPVt3+7lVHPrPNk8rJbZ0V3fRxy57N5RV7seP5ysacNn1rLRpHCLHHkVtf5R3/JGaRr7NbyeLSPVG2fmihU5+Mam/r9mPcmU0WKvhu3faXy3rFrWtNrRG+emV6rGyIj1bFM1Nj42fHHRbjfDv7F0Xfk/EzXLeZ33n7IHEZiJpWPCGQHRK4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5tbZG2d2zequutazlmaUnZjjlnz/2b+EOstszhpO6PLmOf1d6CcnxnikzM4cc8o75/6W2i0vde0fAAcytAAAAAAAAAAGazMTExumJ2xMcy56p0z7bFFvvR4to9cd6lpngzpHFyzTmvG321/wAyuuCaqceWKb8rf7CDrsUWpM+MLSA7hRgAAAMA1Z80UrNrTsiI2yxtaIiZl7EOPXWn/Y490+PbdX1ev2KfM7d7o0/SpzXm88+6I6IhzuD4prpz5J29GO5f6XBFK++QBVpQD3gxWvaK1jbNp2QzrWZmIiOcvJmI5y7dS6B9tk3x4ld9vX0R7VwiNjn0DRK4aRSOuZ6Z53S73hmhjBjiPWnvc/qs/wCJbfwjuZAWSMAAAAw5daZOLhyT+GYj27u11InhLk2YNnn2rHu39iLrMnZxZbe6WzDXe9I96qAPnDpgB4C96Hj4mOlfNrWPcpWhY+Nkx16b1he3VeTmP+7f4QqeJW9CGQHUKsAAAAAAABCcKY/hU/8AJH0lWFp4Tx/Bj89fpPeqziOPR/Xn4QvOH/2/mAKROFt4OT/Aj81vqqS18Gp/gf8AO39/Ne8A/vT8EDiPoR8UuA7VSAAAAAAAAAAIjhLk2YdnnWrHu39iqLBwryfy6/mtPyiO1X3DccydrPaOkRC90FdscT1AFMmgD2BcNQY+Lo9OmdtvfKRatEx8XHSvm1rHuhtfStNTs48dekQ5jJbe1p6yyA3sAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGFX4UZNuWtfNpt+L/C0KZrrJxtIyT0Txfh3KPj+TbDEdZTuH13vv0hwgOJXgACY4L4tuW1vNp/7f4WlBcFcfiZLdNor8O/+pOu94Lj7OCnv5qDW23yW9zIC1RAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGGjTOP9nb7PZx9ni7W8Y3rvExvtu9idtpUHNjtW0xaJi3PEvC76boOPNGy8dVo5YVjWOqcmHbPlU86ObrhxOv4Rlxb2r51evj815p9ZS/KeUo8BTJoCd1VqPjbL5dsRyxTnnr7krS6PJmt2aR8/BqzZq0jeZQ2HBe87KVtbqh3U1HpE/ciOu0LZixVpERWIrEckRD26XD5PYojz7zMqu/Eb+ERCn5NS6RXfxNv5ZhwXpNZ2TExMcsSv7g1pq6uak7oi8R4tvX3NWr8n6xWZxWnePCWeLiE7xFo5KaM2jZMxO6YnZMMOVmFsAPAdWq78XPin8cR8W7tcrdof83H/AOSn1hv087Xxz74a8sb1t8F8CB9KhzIA9AAGFX4Q6w49vsqz4tZ8aY+9b9kprzWH2VOLWfHvuj1RzyqTmeO8Q2j8Gk8/H9lnoNPv58/IAcmtwABZ+D2r+JX7W0eNeN0T92P3Reo9X/bX41o/h03z656O9bnUcC4f/wA1o+H7qrX6j1I+bIDqlUAAAAAAwr3CrJ/Kr+a0/KI7ViVHhJk255jza1r79/ap+OZOzgtHXaEzQ13yR7kWA4VfAAJHg/j42kU/DFrdnauKtcFcfj5LdFYr8W/+lZHccCx9nBE9Zn9lFr7b5JjoyAukIAAAAAAABEcJY/gf86qotvCOP4E/mr9VScV5Qf3o+ELvh3oT8QBRJ4tPBef4NvVkn6R3qss/BWf4V/8AydkLrgM/14+EoPEP7fzTYDuFGAAAAAAAAAAqPCTJxs8x5ta19+/tRbp1lk42bJb8cx7t3Y5nzjW5O1ly298ukwV2pSPcAIjcN+hY+Nlx16b1j2c7QkuD2PjaRX8MWt8tnak6TH28mKvWYas1tqXn3LhAD6S5oAAAAAAAAABgJnYhNY69rTbXFstbzvux3o+o1WLFXtXts2Y8VrztWExkyVrG21oiI5ZmUXpPCDFXdXjXn1bo96t6TpV8k7b2m0+vm9jS5nU+UF55Y67R1lZ4uHV9ad0zl4RZZ8mtK9e/+/c5ra60if8Ac2dVYR4qr8S1Nu/LKZXS4o9SHfGuNJ9JPujubsev88cvFt1x3IoY14hqY7ss/V7OmxT6kLJo3COs7slJr667470xo+kUyRxqWi0epQ23R9IvjtxqWms/VaaXj+WsxGSO1HXxRMvD6z6PJfHDn1rgpaaWvstXljizPZ62vVOtK5q7J2ReI3x0+uFX07JxsuS3Te2zsW2v4r2MeO+La3aQ9PpO1a1bbxstXhvRvSfpnuPDejek/TPcpwp/5i1Hs1/X903+G4+s/wC/JcfDejek/TPceG9G9J+me5Tg/mLUezX9f3P4bj6z/vyXnRNNx5YmcduNs3TumPq6ERwZxbMO3zrTPu3diXdVpMtr48d7RzmFTmrFbWiPBkBJa3FpOs8OK3FvbZbZt2cWZ5epq8N6N6T9M9yu67ycbSMk9ExX4dzhcnqOPZq3vWtY2iff4fNbYuH0mtZmZ5rj4b0b0n6Z7jw3o3pP0z3KcNH8xaj2a/r+7Z/DcfWf9+S4eG9G9J+me5v0TT8WWZjHbjTEbZ3TH1UhYODc1pjy5LTERtiJmfw7/wCpN0HGc2XJWloiI8Z+HzaNRoqUrMxM7rC5tK0/Fi8u8RPRz+5A6x17a22uLbWvnc89yGmZnfM7ZnlmWzWcepXeuKO1PXwY4eHzPO07e5Yc/CSOSmOZ9dp2fJxX1/nnkmleqO9FCiy8W1V/+Tb4ck+mjxR6u7v8M6R6SfhjubK690iPvVnrqjBojX6mP+Wfq2Tp8XsQnMHCO8eXSs+us7O9KaJrnDk3cbi2nmvu/ZTxOwcc1NJ86e3HvaMmgxT3cn0EVDV2t8mHZE7bU82eWOqVp0XSaZaxak7Y+jp9DxLFnjlyt0VWfTXx9/OOreAsUcBiSRw5tbYKWmtr7LRumOLM7Pk8+G9G9J+me5U9Kvxsl7eda0+9qchk8oM8WtEVrtv7/wB1xXh1No3mf9+S4TrrR/SfpnuVLNfjWtbzrTPvnb2vArdbxLJqIrFoiNuiTg0tce8xM8wBXJIACxam1jgxYa1tfZbbMzHFnnnq9Tv8NaN6T9M9ynC7w8cz0rWkVrtHx/dBvoKWmZmZ5/70XHw3o3pP0z3PWHWuC9opW+21uSOLPN7FMSvBvHtzxPm1tPv3dqbpeN58mTHTsxzn3/u0ZtDjrW1t55f70W0B1SqAAAeb2iI2zMREcszzPJnYZeb3isbZmIjplCafwgrG2uKONPnTyIHSdKyZJ23tNvVzR7ORS6vjmHHvFfPn9E7Dob25z5sLPpGvcFOSZvP4Y7eRH5eElp8jHWPzTt7kEKHNxzU27p7PwT6aDFHfG6Tvr7SJ+9WOqrx4a0n0n6Y7keIU8Q1M/wDLb6t8afF7EJOuvtIj71Z66urDwjvHl46z66zs70ENlOKaqvdln7sbaTFPqrfouu8N9024k9Ft3z5EjE7Xz916DrLLhnxbba89Z5FxpfKCd4jLX5whZeHeNJ+S7Dh1drOmeN260ctZ5nc6bFlpesWrO8SrLUms7TGzIDYxAAYatJ0imKvGvOysbI27OltQnCnJsx0r51tvw/5RdZnnFjvePBtw4+1aterr8N6N6T9M9x4b0b0n6Z7lOHLfzFqPZr+v7rX+G4+s/wC/JcfDejek/TPceG9G9J+me5Tg/mLUezX9f3P4bj6z/vyXGuudHmYiMm+Z2RHFnln2JBSdU4+NnxR+Lb8O/sT+s9dVxbaU2Wvyeqv99C30XFu1jvly7ViJ2hDz6Ta0VpvO6Uy5a0jba0REc8yitJ4QYq7qxa8+rdHv/ZW9J0m+Sdt7TM83RDUrNV5QZJ5Y69mOvilYuHV9ad0xl4RZZ8mtK/P+/c57a60if9zZ1VhHiqvxHU278spddLij1ISNdd6RH39vXWG/FwhzRyxS3s2IcK8S1Md2WSdNin1IWfRuEOO269bUnp5Y7/klsOat441bRaOmJUJu0XSr4p20tMTzxzStdL5QZImIyx2o6+KJl4fWfQnZexGaq1tXN4tvFydHNbq7km6nBnpkrFqTvCqvS1Z2mNmQG5gAAMTDICD1lqKt9tsWytvN5p7ldz4LUma3rNZjmlfXPpeiY8sbL1ieieeFFruC48m9qebb9E7T661eVucITg/qzbszXjd9yJ+vcsbzSsRERERERGyI6HpZaLSVw0ikfOUbNmm9ptLICW1BI82nZEzPW8mRSta1iM+WI8+Z9+/tcjbpeXj5L3860zHVPI1PmuotE3yTHdvLp8UbVrE9ABoZjq1VTjZ8Ufjifh39jlS3BnFxs3G5qVmfbbd3pmgx9rNir72nUW2pefctgD6M5sABhq0nPXHS17clY29baqmv9YfaX+zrPiUn4p/ZA4jrYwY5t4z3Q36fDOS0Qj9M0m2W83tz8kdENIOAve1pm0zvMuirWIiIgAa3o26NgtkvWleW07OpqWvUGr/s6ce0ePePhhY8O0U58kV8I75R9TnjHXfx8HfoejVxUileSPnLeDv6UisRWI2iHPTMzO8sgMngAAAAADCj6yycbNkt+OYj2bo+i65r8WtrdETPuUK07Z29O9zPlHk83FTrz+iz4bXneWAHJrcAei0cGMezFa3nWn3V3d6YmYhEaLpdNH0bHNuWa8aKxy2m2/tQen6zyZp3zxa81I5HZRxDFpsOKnfbbuUn5e+W957o371i0rXeHHuiePPRTf8APkRmbhHefIx1j807e5Bilzcb1N+6ezHuTqaDFHfG6Ttr3SJ+9WOqsPEa60n0n6Y7keIU6/Uz/wAtvq3/AJfF7EJbHwgzxy8S3XHckNF4RUndkrNPXG+O9WRIw8X1VJ9PtfFrvo8VvV2X3DmreONW0TE88NijaHpl8NttJ2dMTySturtPrmrtjdMeVXodRw/itM/mzHZt0/ZVajSWx8++HaAtkRGcIo/7e3XT6wqC4cIP9Nfrp9YU9xnlDH9av/r/ANyuuHehPxAFAsBZeCs+Jk/PH0VpZOCk+Lk/NVccD/8AIp80PX/25TwDulCAAAAAAAAw8Zr8WtrdFZn3Pbh13k4uj5J6Y4vxbu1pz37NL26RLKld5rHVTZnbv6WAfNZnm6iABiCd4K49tsluisV+Lf8A0oJaeDGPZhm3nXn3Rshb8Ex9rPT3byh6622OfemQHdqEAAAAAAABhrzZq0rNrTERHLMs5staVm1p2REbZlUNa6ytntzxSPJr2yruIcQpgr1tPdCTp9PbJPubda63tlma121x/O3X3IsHDajUZMtpted5XuPFWkbRAAjtgAAAAAD3hy2paLVnZMc7xtBl2p2iN+TzaO8AYvQHrHXjTEdMxHvZVjeYh5M7brpqnHxcGKPwxPxb+11sUjZER0Q9PpmGnZrSvSIcxad5mWGLTullzayycXDkt0UnZ1z/AJMt+zW1ukPKxvMQpWa/Gta3nWm3v39rwD5pe28zLqIjaIgAYPR7nLbixTb4sTM7PXLwM4tMb7S8mIkAYPQAAAAAB1au062C8WjfE+VXzo73KNuLLalotWdphjesWiYmOS+aNnrkrF6ztiY2tqq8H9P+zv8AZ2nxLzu9Vv35Fqd9w/WRnxxbx8XPajDOO0wy59OycTFkt0UtLejeEOTi6Pb8U1r29jfqsnYx5LdIlhirvasdZVAB82l0wA8AAAAAABYOCuP+bb8tY+cz2K+tfBrHswbfOtafdu7FzwPH2s9Z6RMoWvttjn3pcB3KiYBxay1hXBXbO+0+TXpa8uWtKza07RDKtZtMRENmm6bTDXjWnqiOWVU1hrK+ed87K7d1I/vlaNK0m2W02vO2Z+TS4viPFr5pmtfNr9/iu9No605zzkAUqaAAAAAAAA9Ysk1mLVmYmOSYW3U+s4z12TsjJXljp9cKg2aPmtjtF6zsmJ2rPh3ELYLRz3rPfCLqdPGSPevo59B0qMtK3jn5Y6JdDvKXi0RaJ3iVBMTEzEsgM3jCs8KMm3JSvm12/F/8rMpuvcnG0jJ6tlfdCk49k2wbdZj907h9d8m/RwAOIXgAD3hy2rO2s7J2TG3o2vAM+1O0RvyebR3gDB6AAAAAAzW0xO2JmJidsTHMtmpdZfbV4tv5leX8UdKpNmjZrY7Res76ztWXDtfbBeJ9We+EbU6eMke9fRo0TSIy0reOS0e5vd9S0WiJid4lz8xtylkBk8AAAAAAAAYQ/CLTYpT7OPKvG/1V5/fyO/T9MrhpN7dUR50qZpWe2S1r2nfM+5R8Z4hGOk46z51v0hO0Wn7U9qe6GoBxS8AHgLTwa0bi4pvPLknbHVXdHarmhaPOXJWkc8756I515x0isRWN0REREdTpPJ/S72tlnujlCs4jl5RSPF7AdcqGAaNM0muKk3tyRzdMsb3isTaZ2iHsRMztCP1/rD7On2dZ8e8fDH7qq26Tntkva9uW07epqfP+I62c+SbeEd0Oh02CMddvHxAFekAN2h6NbLeKV553z0RztlKWtMViN5l5a0REzKQ1Bq/7W/HtHiUn4p/Za2rRsFcdK0rG6sbOttd/w7RVwY4r4z3y53UZpyW38Ac19PwxMxOXHExOyYm0bmPCWD0uP4oSZz4/bj6tXYt0dY5PCOD0uP4oPCOD0uP4oPzGL24+p2LdHUOXwlg9Lj+KHrHpuK0xFclJmeSItG2SM+Odoi8fU7FujpAbmIADg13k4uj5J6Y4vxbu1TFo4UZNmKtfOvHuqq7i+P5N80V6Qu+HV2pM9ZAFCngD0e82a152zO3dER6oh4B7a0zO8y8iIgAYvQAAAB0aDpdsN4vHVMdMOcbMeS1LRaJ2mGNqxMTEr7gyxetbV3xaImPaIbgvpO2tsc/d316rf382X0TR6mMuOl+rnM2PsWtV269/0+Tqr9YU1dNdR/2+T8qluY8ov7tPh+604b6FviAOeWIsXBOd2X/h89vcrqf4J8uXqp29614LP/6Mfz+yJrv7dvksYDvVAAAAAAAAAwhuFGTZirXzrf8AqmVa4VZNt8dfNrM/Fu/pVnF8nZwZPfy+qTo675KoMBwDoQABdNTY+Lgxx0143xb+1TK12zERyzOyPav2KnFrERzREe503k5j87LbpG31VnErcqQ9gOsVAAAAAADAIfhDp32dPs6z49490fuj6nUVxUte3gzx45vaKx4ovXusvtbcSs/w6z8UooHz3U6i+W9r2nnLo8WOKRFYAEdsAe8OG154tazaZ5oZ1rMzERG8vJmI5y8Ce0Tg7M78ltn4a96Rxaj0ev3NvrmZ/wALfDwPU35zEV+KHfX4o96oC5+CNH9HVzaRwfw28mbUnr2x822/k/qIjeJiWFeI4574mFVHbrDVmTDvnfXmtHJ7XEps2G+OZreu0ptL1tG8TuANLMAAdmp8fGz4o/Ft+Hf2ONMcGMe3NNvNpPz3JvD8fbzYo9/2aNTbal59y1APornGEVwkybMEx51q17f6Usr3CvJ/Lr+a3u3dqv4pk7ODLPu2+vJI0td8lP8Ae5XgHz10QAAAAOvQtXZc3k18Xzp5P76k3o/B3HG+9rWnojdHesdNwvUZeda7R1lGy6rHTlM81ZFzrqfR4/249szLzfU2jz/t7OqZhP8A5dz7enH6/sj/AMSx9JU4WHS+DsbJnFadvm270DmxWpaa2iYmOWJVmq0GbD6deXXwSsWopf0ZeAEJvAAIldtV6T9ripfn2bLdcbpUlYeCub+ZTqtHt3T9IXvAdRNcvY8Lf9IHEMe9O10WBA8Ksni469Npt8O7+pPIDX2hZsuSs0ptrWuzbtjlmd/O6Pi0XnDeK13mVbpNu3WZnaIV0d/gXSfRT8Ud54F0n0U/FHe4r8lqP8VvpK8/Hx+3H1cA9WrMTMTyxMxPseUWY2bYkAeADq0bV2bJXjUptjk27YjkbceK952rWZlja9Y5zOzlHf4F0n0U/FHeeBdJ9FPxR3t35LUf4rfSWH4+P24+rgXfVePi4ccfgiZ9u/tViupdImY245iNu+eNHeuFY2REdERDoeA6XJS2W16TX4q3iGWtorETu9AxMumVjn03S64qTe3NyRzzKmaXpNst5vad88kdDq1zp/22TdPiV3V9fr9qPcRxfiM5bzSs+bH6rzR6bsR2p75AFInAAA6dE0HLlnxKzMc9p3RCYwcG/Pyeysds9yfp+HajLzrTl1aMmpx05TZXhao4O4enJ7/2acvBuk+Te0de/uS7cC1URvtE/NpjX4lbHbp2rMuHfaNtfOryOJV5cN8c9m9dpSqXraN4ncAaWYACY4N6Xxck45ndfk9Ux3rSoGK81tFo5azEx1x/hfMOSLVraOS0RMe3e7Lyf1M2pbHPq/8Aal4hi2tFo8WwB0CvYlQtJyca97eda0+//K66wycXFkt0UtMKM5byjyf2qfGVrw2vpyAOWWoAAD3hw2vPFrWbT0QzrWZnaI3l5MxHOXgTuicHZmNuS3F/DXl9/Ik8Wo9Hr9zb65mf8LfDwPU3jeYivxQ76/FHvU8XOdUaP6OvzcukcH8VvIm1J98fNsv5P6iI3iYljXiOOfCYVYdmsNW5MM+NG2vNaORxqfLhvjma2rtMJlL1tG8TuANLMABPcF9K2TbFPP41fZyrGo+rs3EzY7fiiJ6p3T9V4dtwHUdvFNZ9WVHr8e19+rIC8QQAAAAAGGjTNKpirNrTsjmjpl40/TqYa8a07/u1jlsqOnabfNbjWn8sc0QqeJcUpgjsxztPh+6XptLOSd55Qaw022e/Gtyfdr5sOYHEZMtr2m1p3mV7SsViIiOQA1MgEpqPVv2tuPaP4dZ+KehI02nvlvWlY5y15ckUibSlOD2gcSn2lo8a8bvVX90yRA+habT1xUrSvg53Lkm9ptPiyAkNbCo681h9tfi1n+HSdkeueee5KcIdYcSv2VZ8a8b582P3VhyvHeIf8NZ+P7LXQaf15+QA5dagAC26j1f9lTjWjx775/DHNCL4Pav49vtbR4tZ8WJ+9P7LQ6zgXD9o/GvHf3fuqNfqN/Mj5jEzuZc2ssnEw5Lc8UnZ7XR5L9mtrdIVtY3mIUrPfjWtbzrTb37+14B8zvaZmZ6uoiNogAY7vRKcHMe3PE+bW1uz+pFp/grj35LdEVrH1n6QseFU7WfFH+8kbV22x3/3vWMB9Ac8AArPCrJtvjr0Vm3xbv6UGkdf5ONpF/w7K+6P3Rz57xPJ2s+Wff8Abk6LS12x0gAV6QAADu1dqzJnnbHi057T2LBo2pMFOWvHnpt3ci10nCc+aO1EdmOsoubWY6cu+VRF8rouOOSlI/4w1ZdX4b+Vjp17Nk96wnycvtyyRujRxKPZUgTWtdSfZxN8e2axvms8sR3IVSanSZMNuzeNk7FmreN6yAIraAAkuD2Ti54jzq2r8tv9I59WTszU/wCX0kdLwrVTXFt71VrMW99/cteuI/gZfySpS7a1j+Bl/JZSWPlFH9TH8GfDfRt8QBziyE7wUnxsvVXt70EnOCs/xMn5Y+v7rPhH/kYkXWf27rMA79z4AAAAAAADCn6/ycbSL/h2V90fuuEqHpeTjZL26b2n3ue8osm2PHXrP2WPDq+daekNQDjlyAA6tV4+NnxR+KJ+Hf2LuqnBrHtz7fNpM+/d2rW7Tyfx7YrW6z9lJxG294jpDIC+QAAAAAAHm1tkTM8kRtUfWGkzlyWv0zsiOiI5Fl4Q6TxMMxHLeeLHb9FScn5Q6rea4o8Ocrbh2LlNwBzK0AZrWZmIjlmdkR65ZRG+0Ey6dX6FbPbi15OW1vNhbtC0KmGvFpHXPPaXjVmhRhxxX7077T0y7Hc8L4bXDWLTHnz+ig1Wpm87R3MgLdEAAeL0i0TE74mNkxKna30H7HJsjyLb6z9Y9i5onhLh42Hjc9LRPv3dqo4xpK5MVrbc680vR5preI8JVQBwi/AAFj4KY/FyW6Zivw7/AOpXFv4PY+Lo9Z86bW+ezsXfAcfazxPSJ/ZB4hbam3WUmA7dRsKpwlybc+zzaxHv39q1qRrTJxs+WfxTHw7uxQ+UGTbFWvWfsn8OrveZ6Q5QHFrsAATepdT8fZkyR4v3a+d+zj1NoX22SInyK+Nb19Ee1cYjZ1Oj4Lw2Mn9W8bxHdCt1uqmvmVnn4lKxEbIiIiN0RHM9DDrohTsgPRhwa21fGanJsvXfWez2pBhqzYa5K2raN4llS81mJh8/tWYmYnlidkx64YSXCDDxM9tnJaIt793YjXzrU4Zx3vTpLpMV+1WtuoAjtgleDdtmfZ00tH0nsRSS4Pf6inVb6SncOmYzYfjDRqY8y/wXAB9Ec4w85b8WszPJETPuenFrrJxcGSfw8X4t3a1Z79ml7dIllSu8xHVTLTtmZnlmdssA+aTO8y6iABiC56kx8XR8cdMcb4t/apsRtmI6dy+4KcWta9FYj3Ol8nce98t+kbfVWcStypDYA61UAAMInhDpn2ePiR5WTd1RHL9diWU3Xek/aZrdFfEj/jyqnjGq/CxTtPO3JL0eLt3jpDgAcIvwB4Ca1Pqbj7MmTbFOWK+d+zRqLQPtr8a0eJTZM+uejvW6I2Ok4NwuL/1ckbx4QrNbqpjzK9/i846RWNkRERHJEcz0MutiIjlCoAHo8WrExsmImJ3TEqnrvVv2NuNX+Xad34Z6O5bnJrTB9phvXn2TMddd8fRW8T0dc2O3Lzo5xKTpc00tHSVJAcA6EAeAuWo78bR8fqia/DOzsU1beDc/9vH5rfVf+T1ts1o6x+yv4jHmR8UqA7NSovhFk4uj2jzprXt7FRWLhVk8XHXpmbe7d2q64jj2TtZ5jpEfuvOH12pv1kAUicAzWszMREbZmdkR07WURvygmXTq7QrZ7cWu6I32t5sLdoWhUw14tY6557POrNDjDjiv3uW09Mut3PC+G1w1i1o8+f0UGq1M3naO5kBbogADXlxxaJraImJjZMTzqdrbQZwZOL92d9Z9X7LoiOEuHjYeNz0tE+y27tU/GdJXJitbbzq80zRZpreI8JVUBwq+AAF+wW20rPTWJ96gr1oP8rH+Sv0dP5OTzzR8FXxKOVPm6AHVqkAAABhwaz1lXBHTeeSvf6mnW+t4xRNabLZJ91evuVXLktaZtaZmZ5ZlQ8T4vGPemPnbr0T9Lo5v51uUPelaRbLabXnbM/JqBx17zaZmZ3mV1FYiNoAGD0B16u0C2e2yN1Y8q3R+7bixWvaK1jeZY3vFYmZlnVmgWz32RurHlW6P3XHBhrSsVrGyIjZDzomjVxVilY2RHzbndcN4dXBXrae+VBqdTOSfdDICzRmHNp+lVw0m8826I6ZdEzsU/XWn/bX2R5Fd1fX0z7VbxPXRgxzPrT3JOlwTktt4R3uLPlte02tO2bTtl4BwVrTMzMzzl0EREcoAGD0dGgaLOa8Ujn3zPRDniNu5cNS6B9jj3+Xbfaejoj2LThehnPkjf0Y70XVZ+xX3y7MGGKVitY2REbIbQd5WsRERHcoJkRfCTJswTHnWrXt/pSiv8K8n8uv5rT7N3ag8UydnBln3ffk36Wu+Sn+9yvAPnrogABauDOPZh2+daZ927sVVdtU4+LgxR+CJ9+/tdB5PY98trdI+6v4jbasR1l2AOyUrANOm5OJjvborafcwvbaLT0exG8xCk6Zk42S9um9pagfNMlt7Wnq6esbREADWyHbqrQZzZNn3Y32n++lxLfqHRvs8NZ+9fx59vIteE6OM2WInujnKJrM3Yry75SGLHFYisREREbIiOZ6B3kREcoUDID0YlSda6P8AZZr1jk27Y6rb+1dlT4S/z/8AhXtUPlBjicVbeMSn8OtPbmOsIoBxa7AAdupacbPSPzfSR1cGse3LM+bSfmw6zhGmicMTMd8yptdknt7R0WLWcfwcv/jv9FHXrTo/hZPyW+iitHlHHnYp90t3De64A5pZiZ4Lz/Ft+TtjvQyX4MT/AB5/8c/WO5Y8LnbPi+KNq/7d1rAfQXPAAAAAAAANGm5OJjvborMqIt/CDJxdHv8AimK++VQch5RZN8mOvSPuuOG18209ZAHOLIABYeCuP+Zb8tfdv7VgRXBvHswRPnWtPu3f0pV9C4Xj7ODFHu3+vNzuqtvkv/vcyAsEcAAAAABV+FGbbkrTmrXbPXb/AAhXZrjJxs+Sei3F+Hd2ON874hl7ebLPv+zo9NXs0pHuAEFvEpwd0fj5uNPJSON7Z3R9UWsvBXH4mS3TaI+GP/6WfCMPbz44nw5/RF1l+zjt9E6A79z4AAAA4Nd/6fJ1R9XciuEmXZgmPOtWvu3/ANKJrrRGHNM9JbcEb3p8YVMB85dKAPAXrQMXExY69FaxKlaLj416V861Y98r5DqfJzH/AHb/AAhVcSt6EMgOpVTxlvxazPREz7lBtbbMzPLM7Z9q565ycXBknprxfi3dqluT8o8nnYq9I3+q34bXleQBzKzAIh7EC28HdH4mGLc+SeNP0j6JRr0enFpWsfdrEe5sfSdLiimPHSPCIcxlv2rWnqyAkMAAAAFX4U/zafk7UKk+EeTbnmPNrWvb/UjHz3idonPmmOv2dFpI2x0AFekCU4N12549VbT2dqLTvBTH42S3REV9+/sWPCqdrPij3/ZG1dtsd1lAfQXPMIbhPk2Yq1868e6N6ZVvhVk8bHXorNvi3f0qzi+Ts4Mvv5fVJ0dd8lEEA4B0IADp1bj42bFX8cT7t/YvEKlwbx7c8T5tbT793atrs/J/HtitbrP2UnEbb3iOkMgL9AAAaNNzcTHe/m1mYUSVt4R5OLgmPOtWvb/SqTj/AChy75KU6R91zw2nm2nrIA51YgNmi0416V861Y98/uzpXeax1eWnaJlcNT6N9nhrXnmONbrs7SB9Lw44pWtY7ohzF7TMzM+LIDYxAAHm3JPUy0abl4mO9uitp90MMloitpl7EbzCiyA+ZW75dTAAxBb+D1dmj09c2n5z3Kgu+rMfFw46/gjb1zv7XQ+TtN8t7dI+6u4lbzax73WA7FTKpwmybc0V82kfPbKIdet8nGz5J/Fs+Hd2OSHzrX5O3myz73Saeu1KR7gBCbhK8HNH4+bjTyY443tndCKWXgrj8S9um2z4Y/8A6WnCMMXz44nw5/RF1l+zjt9E6A75z4AAADDh13/p8nVH1dyK4SZNmCY861Y92/sRNdaIw5pnpLbgje9PjCpgPnLpQB4C+6PXi0rHRWI9yj6Jj42Slem1Y96+Q6rycpyzW+Cp4lb0IZAdQqwGJnY8BB6411xduPFO23Ja3m9Xrc+uNdcbbjxT4vJa8c/V3oJzHFOM9+PFPxn9lppdF3WvHyZtO3fO+eeZYBy0ytgB4AJfVGp5ybL5NsY+WI57/sk6bTZM1orSN2vLlrSN5lz6r1ZbPO3yccTvt09S26No9cdYrSNkR83vHSKxFaxERG6Ijmenb6Dh2PBHLnbxlRajU2yT0joyAskYBiQQXCPWHFj7Gs77eXs5o6ParbdpmTj5L26bWnuaXzziOqtmyWtPdHKHRabFFKxAAgJAACc4O6Bxp+1tG6vkRPPPSsqh10jJEbIveI5oi0s/9Vl9Jk+KXRaLi+LBSKRjn3yrc+jve02my97Taon/AFWT0mT4pP8AqsnpMnxSl/zHT/HP1af4bb2l7VThLl259nm0iPfv7Uf/ANXl9Jk+KWq95mdszMzPLMyg8Q4xGfH2IpskabRTS3amd2AFAsAAHrHXbMR0zEe//K+0jZER0REQoETsnbHLy7W7/qsvpMnxSuOGcRrp+3vXfdD1Wmtk7O07bL2KJ/1WX0mT4pWzUnG+wpNpmZnbO2Z28s7nR6DitdRaaxTbaFZqNJOOImbbu9HcIMnF0e/4prX3ykUFwqyeJjr02m3w7v6kniWTs4Ms+778mvTV3vSPerYD526MAB7w041q1860V9+7tX2kbIiOiNimalx8bSMcdE8b4d66Q6/ydx7UyX6zt9FPxK3nVj3MgOjVoADCma7ycbSMnqmK+6FztKg578a9redabe/f2uc8osm1Mdes/ZZcNr51p6Q8AOQXAACx8FMfi5LdMxX4d/8AUOzg9j4uj1nzptb57Oxh9D4Zj7ODFHu+/NzmqtvkvPvd2lx/Dv8Akt9FDX7PHiW/LKgqPyj78Pz/AOk/hvr/ACAHMLQSvBr+f/wt2dyKSfByf+4r+W39/JO4dP8AXw/Fo1X9u/wW8B9Ec4AAAAAAAAgeFWTxcdem02+Hd/UraY4T5NuWtfNp/wC3+EO4HjGTtZ8nu5fR0GirtjqAKtKAe8NONatfOtFffOztZ0rvMQ8mdomV11bj4uHHXopXb7XSxWORl9Mx07Na16Q5e07zMsgM3gAAAAxLLEvJ7pFC0m22956bWn3y1vWXyp65eXzLJPnWdRXugAa2QtXBj+TP57diqrBwVz/zMfVePpPYueB5Irnrv4xsha+u+OfcsQDuVEAAAAwrHCfSeNeuOPuRtnrsntYaXXDSbz1RHTM8ik5Mk3tNp5ZmZn2ud49rIrSMUTznv+Cx4fh3t257oeQHHrkABIaix8bSKerbafZH7rirPBbHtyXt5tYj4v8A5WZ2/AcfZwb9Z/8Aii19t8nwZAXaEhuE+TZiivnXj5b1WTvCrJ42OvRWbfFu/pQThON5O1nv7toX2hrtjj3gCoTB6xeVXrh5GVZ2mJeT4voMDm1fn+0xUt01jb1xun6Ol9Nx2i1a2jxcvaNpmGQGbwABh4y5IrWbTOyIiZmep7V/hHrDd9jWd/LeY5vUia3U1w47Xn5NuHFN7RWEFpOWb3tefvWmfe1g+d3tMzMz4ukiIiIgAYPRbODeDi4eNz3mbezk7FWw45vatY5bTER7V6wYopWtY5KxER7HR+T2De98nSNvqreI5OVa9W0B16nYU/hBk42kW/DFa9vauEqJpuTjZMlum9pjsc95Q5NsdK9Z+yw4dXe1p6Q0gOOXQACwcFcf8y35ax9Z7FhRPBrHswbfOtafdu7Es+g8Kx9nBijrG/1c7q7b5LsgLFHAAQXCqfExx02mfdH7q0snCuPEx/mlW3C8b/8AIv8ACF9oP7cACnTB06utszYvz1+rmZpbZMTHLE7Y9jbit2bUt0mGN43iYfQBp0TPGSlbxyWiJbn0ulomImPFzExtMwyAyeAAMIbhLpXFxxjjlvO/1RCU0jNXHWbWnZERvUvT9LnNkteefkjoiORS8a1sY8c0ifOt9k3RYZtbteEOcBw69AAbtDw/aZKU860RPVzr1EK1wY0bbe2SeSscWOu37fVZnacA0/ZxTefW/wClJxDJveI6MvN7bImZ5omfcy5NbZOLgyz+GY+Ld2rrNfs0vbpEoVI3mI6qXe22ZmeWZmZ9ryD5nad5mXTxAAxei1cGP5M/nt2KqsHBXPHj4+fdePpPYueB5Irnrv4xMIWvrvjn3LEA7lRAAAAMKxwn0njZK445KRtnrt/hO6w0yuGk3nl5Kx0ypWXJNpm075tMzM9bnePayK0jDE857/gseH4Zme34Q8gOPXIACT4O4eNnieakTbs7VuQ3BrRuLjm88t53dVf8ymXe8Gwfh4K799uf1UGtydq8+7kA06TpFMdZtadkQs7WiImZnaIRYiZ5NmXJFYm1piIiNszPMq2t9bzl20ptjH87/t6mjWms7Z52clIndXp63A5DinGJyb48c7V69f8A4uNLoorta3eAOeWIAARDNKTaYisTMzOyIjnWjVGpox7L5Nk5OaOan7p+h0GTPbavKPGUfPqK4459/Rzan1JyZMseutJ7e5YYB3Ok0ePDWK1j5qLLmted5ZASmoABhp0zJxMd7ebW0+6G5HcIMnF0e/4tlffP7NGpv2ceS3SJZ4q72rHWVPAfNZdOAPAAAAAAAAAAAAAAAhfNEx8XHSvm1rHuUrQcfGy469N67ernXp1fk5j5Zb/CFTxK3OkCrcJ8m3LWvm0/9v8AC0qXrnJxtIyT0W4vwxs7Evj+TbDEdZaeH13vv0hxAOJXgACZ4L4tuW1vNrs+L/C0IPgrj8TJbptFfh/+k473g2Ps4Ke/m5/W23yW9zIC1RQAHLrHJxcOS3RS2zrnk+qjrbwjycXBMedate3+lUnHeUOTfJSvSPuueHV8209ZAHPLEBt0XHxslK9Nqx72dK7zWOry07RMrpoOPiYsdeilYHRA+mY67RWOjl5neZl5yRunqlQH0GeSXz6XM+Un/B8/+lpwz/k+QA5ZaiS4PT/3FPXFvp+yNd+oZ/7nH12+kpmhn+th/wDaGnUehf4SuYD6M5sAAAAAAB5tOyJl5Mima5ycbSMk9FuL8O7scT3lvxrWt51pn3/5eHzXUX7V726zLp8ddq1jpAA0Mx06tvWualrzsrWdsz1cjmG3Hfs2rbpLG1d4mOq4+G9G9J+me48N6N6T9M9ynC6/mHUezX9f3Qf4bj9qf9+S4+G9G9J+me48N6N6T9M9ynB/MWo9mv6/ufw3H7U/78lx8N6N6T9M9x4b0b0n6Z7lOD+YtR7Nf1/c/huP2p/35Lj4b0b0n6Z7jw3o3pP0z3KcPf5i1Hs1/X9z+G4/an/fkvWi6ZjyxM0txoidk7pj6t8org3i2YInzrWt7t39KVdTpclr46Wt3zH3VOWsVtaI8FE06nFy5I6L2+rSk+EWHi55nmvEW7J+iMcBrMfYy5K9Jl0OC3apWfcAIraNui57Yr1vXliff0tQzpeazExO0w8tETExK8aFplM1YtWeuOesulQ9G0i+O3GpaYn1c/sTWj8I55MlNvrrPZ+7sNHx3FaIjJ5s9fBTZtBeJ3rzhYxEV4QYZ8+PY8ZOEWGOSuSfYsZ4lptt/wAWEb8tl9iUy5dN07HhjbaeqI5Z9iB0rhDktupWKR08s9yIyZJtPGtMzM88yq9Xx/HETGKO1PXwSsPD7Tztyh0aw062e3GtuiPJr5rlBymXLa9ptad5lb0pFYiIgAamQA9Fm4LY9mO9vOts+H/KbcGo8fF0fH64m3xTt7Xe+icPx9jDij3fdzeotve8+9kCU1pU/hDk42kW/DFa9vajW/TcnGy5LdN7fs0Pm2rydrJlt1mXS4a7UpHuAEZtAAS2otZxiniXnxLTy+bPdK1RMTvjkl8/d2g60y4d0Ttr5tnQ8M4x+FEY8nOPCeiu1Wi7U9qveuYg8XCOk+VS0dW9u/8AyDB+P3OirxPSzG/4sK2dLlj1JSwgsvCSn3cdpn8U7O9E6ZrbLl3Tbi182u790bUcb09I82e3Pubcehy2742TGttdxXbTFMTbkm3NX91ataZmZmdszvmZYHJ63XZM9t7Ty8IW+DT1xxtAAgt4DZo+G2S9aV3zadkM61m0xERzl5MxEbyl+DWh8a85ZjdTdXrn/KzNGhaNGLHWkc0cvTPO3voPD9JGHFWnj4/Fzuoy9u0yyAnNDVpN+LS9uisz7lCXfWs/wMv5LfOFIcn5R287FHulb8NjleQBzKzAAW3g9mi2CtY5a7YmPbtSihYM98c8alprPTCSx8IM8cvEt1x3S6zQ8cxVpSl4mJiNvoqM+hvNrWrz3WsVj/8AI8vmY/n3pHUuscmeb8aKxFYjZsief/C0wcV0+S0UrMzM+5FyaTJWJtMckuAskZD8Jse3DE+beJ9+7tVVedYYftMV6c81nZ18sfRRpcb5Q4dslb9Y+y54dfesx0kAc+sQAErqPWn2U8S/8u0/DPctVLRaImJiYnfExzqA6tE1hlxeRbd5s74X/DeMziiKZI3r+sK/U6Ltz2q8pXcVzFwkt97HE+us7Hu3CWObFPtt+y/jjOk23/E/SVf+Szez9lgc2mabTDG29tnRHPPsV3SNf5rbq8WkerfPvnuReTJa07bTNpnnmUDVeUGOImMUbz18EjFw60+lOzr1nrK+e2/dWOSv987iBy2bNfJabWneZWtKVrEREbADSzGaVmZiIjbMzsiOnawneDmr9s/bWjdG6m3nnnlL0eltmyVpHzac+WKVm0prVui/ZYq05+W09My6gfRMeOKVrWO6HOWtMzMz4iI4TZNmGI868R7t/Yl1d4V5N+OvRFrT7dkQg8WydnBlnry+qRpK75KIAB8+dCAANui6ROK9b15Ynk6Y52oZ0vNZi0TtMPLViYmJXjQdMpmrxqz1xz1l0qHo+kXx241LTE+rnTWjcI52bMlNv4qz2fu7DR8dxWiIyebPXwU2bQXid684WMRFeEGCfPjrh4ycIsUclck+zYsZ4lptt/xYRvy2X2JTLk0/T8eGNtp381Y5ZQWlcIclt1KxSOnlnuRGS82mZtMzM8szKq1nH6RExijeevgl4eH2nnfl7m/T9NvmtxrcnNWOSsOYHK5MlrzNrTvMratYrEREADUyG3RcE5L1pHLadnVHO1LNwc0HiV+1tHjXjZX1V/dP4dpJzZK18PH4I+pzRSsz4+CXw44pWKxuisREexsHDrPWVMFd++8+TX++Z3uTJTHXe07RDn61tado5zLbp2m0w141p6ojllUdYadfNbjW5Pu1jkhr0rSb5bTa87Z5vU0uM4lxW+aZrXlX7/Fd6bSRTnPOQBTJoAAQD0WHVebRMEbftNt55bcWfluSHhvRvSfpnuU4XWHjeXHWK1x1iI+P7oN9BS0zM2mf9+C4+G9G9J+me48N6N6T9M9ynDZ/MWo9mv6/ux/huP2p/wB+S4+G9G9J+me48N6N6T9M9ynB/MWo9mv6/ufw3H7U/wC/JcfDejek/TPceGtG9J+me5Tm7Q8fGyUr03rHsZ4+P6i1q17Nefx/djbh+OImd5/35L3CC4VZPEx16bTb4d39SdVbhPl25a182n/t/hdcZydnT39+0IWirvkr7kOA4NfgAAAAAAAAAAAAAAAJLg/j42kV/DFrdnat6t8FcfjZLdERX37+xZHc8Cx9nBE9Zn9lFr7b5JjoxadkT1KFlvxrWt50zb3zt7V01pk4uHJP4ZiPbu7VIVvlHk54qfGUnhtfTkAcwtAB7AuGoMfF0enr2298pJo0PHxMdK9Fax7obn0rTY+zjx16RDmMlt7WnrLIDewAAV7hXk3Yq+u1p9m7tV5LcJcm3Ps82sR796JcBxbJ2s+WenL6Og0ddsdABWJQkNQ4+NpFPVttPsj90em+C2PbkvbzaxHxf/Kfw3H2s+KPf9uaPqrbY7z7lnAfQ3OsSoGSPGnrlf5UHP5dvzW+rmPKPuw/P/pacM77/J4Acoth3aln/uMXXP0lwuzVE/x8X5knRz/VxfGPu1ZvQv8ACV2AfSXNAAAAAAMOXWmTi4clvwTEdc7u11InhLk2YNnn2rHu39iLrMnYxZbe6WzDXe1I96qAPnDpgB4AAAAAAAAAPeGnGtWvnWivvnZ2s6V3mIeWnaJlddW4+Lhx16KV2+3ldLFY5GX0zHTs1rXpDl7TvMyh+Emi8fHx45cc7fZPL9FWfQLViYmJ3xMbJUvWuhThyTX7s76T6uj2OW4/o5iYzVjlPeteH5uU0n5OMBzK0AAAAAAAAAAAACB0avx8bNjr03rt9m+fo24qdq1a9ZY3ttEz0XXR8fFpWvRWI925sB9LrG0RDmJGrS8vEx3t5tbT7m5G6/ycXR79M7K++WrU5OzjyW6RLLHXe1Y6yp4D5rLpwB4AAAAAAAAAAAD0Fq1Fq37KvHvHj2jk82HPqPVHF2Zckb+WtfN9c+tPut4Nwua7Zckc/CFPrdVv5lZ5MgOkVoADl1nXbhyx/wDrt9FHX+8bYmOmFE0jFNLWpPLW0x7nK+UeOd8V/kteG29OGsBy61AAAAFo4L49mK1vOt/6quuepMfF0fH6443xb+1fcAx75pt0hA4jbakR1l3gO0UjCoa90T7PLMxHi38aOvn+q3uPWehxmxzXn5az0TCt4po/xscxHfHOEnS5uxaJ8JUoesuOa2msxsmJ2TDy4G1ZiZiXQRO/MAYvQAAAAAAAAHbqzVts9uikT41u5uw4b5LRWsbzLC961iZmdnrVOrpz26KVnxp7OtcMdIrEViNkRGyI6Njxo2CuOsUrGyIbXdcO4fXBTbvtPfKh1OonJPuZAWSMwqPCLJxtItHm1rXt/qW5RtYZONmyW6b2+W6Po5/yhybYq16z9lhw6u95npDnAcaugAAAAAAAAAAAAHdqvVts9uikT41uyG7DhvktFaxvMsL5K1iZmW3UmrZzX41o/h1nf+KejvW2I2PGDDWlYrWNkRGyGx3nD9DXBTbvme+VBqM85Lb+ApGtMvHzZLfimI/47uxdM1+LW1uiJn3KFads7Z5Z3yqvKPJ5uKnXn9Evhted5YAcktwAAAAAAAAAAABI6gx8bSKfh2290fujk5wVx7b5LdFYr8W/+lYcMx9rPij3/bmj6q22O/8Avesri0jVeHJabXpttOzbPGnm9rtHfZMVLxtasTHvc/W0xzidkf4E0b0f6p7zwJo3o/1T3pEafyOn/wAVfpDP8fJ7c/VHeBNG9H+qe88CaN6P9U96RD8jp/8AFX6Qfj5Pbn6o7wJo3o/1T3ngTRvR/qnvSIfkdP8A4q/SD8fJ7c/VHeBNG9H+qe88CaN6P9U96RD8jp/8VfpB+Pk9ufqjvAmjej/VPeeBNG9H+qe9IsS8/Jaf/FX6Qfj5Pbn6qVrfFSma1KRsrXZHLt5tvP1uNv03JxsuS3Te2zq5mhwGpmJyZJiNo3l0OKJ7Nd+gAjtg2aNj416V861a+9rSGosfG0inq22n2R+6RpcfbyY69Zhry22raekLBGpNG9H+qe9nwJo3o/1T3pEd/wDkdP8A4q/SHPfj5Pbn6ubRNDx4omMdeLE753zP1dAJNKVrERWNo6NczM85ndE8JcmzBs861Y92/wDpVRYOFeT+XX81p+UR2q+4jjmTtZ7R0iIXmgrtjj3gCmTRu0PHxslK9N6x7GlI6gx8bSKfhi1vls7UnSY+1kx16zDVmttW8+5cYAfSXNAADA85LbImZ5omfc8mdomRS9a5ONnyz+KY+Hd2OSGb22zMzyzMzPtYfNM1+1e9usy6fHXaKx0AGlmLPwWx7Md7edfZ7I/yrC5ajx8XR8fribfFv7V7wDHvmm3SEDiFtqRHWUgA7VSMSoelfzL/AJ7fVfJUTTf5uT/yX+sua8o483F8ZWXDe+7SA5JcDq1ZP8bF+erlb9An+Li/8lPrDfpp/qY/jDXl9G3wXsIH0uHMgAAAAAMK9wryfy6/mtPyiO1YlR4SZNueY82ta+/f2qjjeTs4LR12hM0Nd8ke5FgOF2XwAbAAbAAbAAbAAbA7tSY+NpGOOiZt8O9wpngvj25bW82mz4v8JvDsfazYo28fs0am21Lz7lpAfRHODj1joVc1OLO6eWs9EuvaMMmOt4mto3iXtbTExMKHpWjWxWmto2THzal30/QaZq8W0b+a0ctVX0/VWTDv2cannV7YcVxDhGTFM2rHar9vivNPrK35TylwAKZNAHgAPQIh1aHq/LlnxKzs57TuiFk1bqemLxp8e/TPN1LLRcLzZpjl2a9UXPq6U8d56KxpOi2x8XjbptHG4vPENCS4Q5NukWjzYrXt7UajavFWmS9a90cvo24bTNazPfIAjbS2iT4OY9ueJ82trdn9SMT/AAVx78lvVWsfOZWPCsfaz4o28fsjau22O/8AvesYD6A55hB8KsmymOvTaZ+H/wCk4q/CjJty1r5tNvxf4VfGcnZwZPfyStFXfJVDAOBdAAA26Lo9st4pXlnbs9kbex4vWYmYmJiYnZMTzJbgxj25ptzVpP6v7lKa21RGbxq+Lkj3W6+9c4OFWy4PxK+lvPL3IWTVxXJ2Z7lTG3SNHvjni3rMT6+f2tSpvSazMTG0pkWieccwBg9AAAiNqU0HUmXJsm0cSvTPLPs70jBpsmSdqVmWvJlrWN7TsjceObTFaxMzPJELNqnUsY9l8myb8sV5q/u7tB1fjwx4sb+e08sut1nDuC1x7Xyedbp4QqNTrZt5teUMgL5AAAAAYVzhJoE7ftqxunZF9nN0T2LG82rExsmNsTunaia3SVzUmk/Jtw5ZpaLQoAsOsOD++bYZj8k9k96Ez6Lkx+XS1fXMbvfyOG1PD82KZi1eXXwX2LUUv3T8mkBC2bwACsbZ2dO5fsNOLWteiIj3KVq3Hxs2Ov44mfZvn6Lw6vycx8st/hCo4lbnSGQHTKwABE651VGaOPXZGSI+JVb0mszWYmJidkxPMv7h1jqymeN+60clo/vkUPE+ERl3yY+VunVP0us7Hm27lMHbpuq8uLljbXzq8n7OJyOXDfHPZtWYlcUvW0bxO4A0swAAB6A79D1Rmy/d4tfOtu+XKsOr9T48W/Zx7+dPN1QtNJwjPl2nbsx1lEzazHTx3noh9V6ktk2Wyba05Yjnt3LNhxVpWK1iIiOSIex2Gj0GLBG1Y59VPm1Fsk8/oyAmtAADVpF+LS1vNrM+5QpXLXuTi6Pk9cRX4t3aprkfKLJvfHXpH3W/Da8ryAObWYD1Su2YiOWZiI9rKsbzEEy26TotscUm0br1i1Z69/y2tC8Z9Epkx/Z2jbGyIj1bFW1hqnJhnbs41Oa0c3XC44hwi+Lzqx2q/ZB02srflPKXAApk4AeAA9AdOiaDlyz4lZmOmd0R7Vh1fqKmPZa+y9ujmj+/WsdJwzNmnlXaOqNm1VKeO89EVqrU1suy19tcfzt1d60YcNaVitYiIjdEQ2bB2Oi4fjwRtXnPjKlz6i2Sef0ZAT2hw66ycXR8k9NeL8W7tUtaOFGTZirXzrx+n+4VdxfH8m+aK9IXXDq7UmesgCi2WAAbAAbAAbAAbAAbAAbAtHBfHsxWt51591VXXPUuPi6PjjpjjfFv7V7wDHvmm3SFfxG21IjrLvAdopQAAAAAAAGGrS8nFx3t0VtPubUdr7JxdHv69lffLRqcnZx5LdIlnjrvasdZU8B82nd04A82kE3wWxbcl7ebWI+L/wCUIs/BbHsx3t51tnsr/la8Gx9rPT3c0PXW2x296bAd4oQCQVLhJk255jza1j37+1FOnWeTjZsk/jmPh3djmfOddeb5ctvfLpMFdqUj3ACJs3Cd4K4/HyW6KxX4t/8ASglo4MY9mK1vOvPurs/dbcFxdrPT3c0PXW2xz700A7tQgAMOPXGTi4Ms/h4vxbu12IfhPk2YYr514j3b+xE12Ts4stvdLbgrveke9VgHznaXSgBsEQvuj04tK182sR7tylaux8bNjr03rt6o3z9F5h1fk5j5Zb/CFRxK3OkMgOmVjEqNrCNmbL/5L/WV5lSNaR/Gy/ns53yij+nj+Kx4b6Vvg5QHHrkbdD/mY/z0+rU2aP5dPzV+rbhnzqfGGN+6y+wyxDL6ZHg5cAegAAAA5smhYrTNrY8czPLM1jbLoGFqVtymN3sTMdzm8H4PRYvhg8H4PRYvhh0jD8vi9iPo97durm8H4PRYvhg8H4PRYvhh0h+XxexH0O3bq5vB+D0WL4YPB+D0WL4YdIfl8XsR9Dt26ubwfg9Fi+GDwfg9Fi+GHSH5fF7EfQ7durm8H4PRYvhg8H4PRYvhh0h+XxexH0O3bq5vB+D0WL4YPB+D0WL4YdIfl8XsR9Dt26uXwdh9Fi+GG3Do1KbeJStdvLxY2bdn+W0ZVw0id4rEE2nqyA2MQABiYZAR2k6ow5N814s9Nd37I/Lwb83JPVaP7+iwCBm4bpsnO2OPs301OWvdZWLcHMvNfH7dvcV4OZee9PZtWhhG/gel9n9W389m6q/j4NR97JP/ABjYkNH1Ngp9zjT023/LkSAk4uG6ano44+/3ar6nLbvsRERyMgnbNDmvoWK0zM48czPLM1jbLHg/B6LF8EOphrnBj9iGXbt1c3g/B6LF8EHg/B6LF8EOkefgY/Yj6Hbt1c3g/B6LF8ENuHDSkbKVrWOWeLGza2DKuKkTvFYgm09WQGxiwpmu8nG0jJ6pivu3LladyhZ78a1redabe/f2uc8osm1MdOs/ZZcNr51p9zwA5BcAALHwUx+Lkt0zFfh3/wBSeRvB7HxdHrPnTa3z2diSfQ+GY+zgxR7vvzc5qbb3vPva82Ct42WrFo6JhGaRwexW31m1OqdsfNLjfm0mHJ6dIlhTLevdbZW78G7/AHclZ642NU8Hc3nY/fPctLKBbgekn1dvmkRrs3VWacG8nPkpHVEy6sPBzHHlXtb1RuhNjPHwfSV59jdjbWZZ9ZzaNoOLH5FKxPTyz7+V0gsaY61jasbQjTaZ753ZAZvAAAAAAAABiYZDYcuTQMNuXHSfXxWm2p9Hn/bj2TMJBhotpcM9+OJ+TOMt47rSjo1Jo3o/1T3tkao0eP8Aar7drtGMaPB/ir9Ie/jZPbn6ufFoWKk7a46RMckxG/3uiAbq0rXlEbMJmZ75ZAZvAAAAGJhw6TqnBk3zSInprudw1ZMNLxtasSyre0c4nZA5eDdfu5Jj80be5zW4OZOa9J69sLOK+/BtJPqbfOUiutzR6yrRwdzedi989zbTg3fnyVjqjasjLGOB6WPV3+bL89m6oTFwcxx5V72+SR0fV+LH5NKxPTyz7+V0iZi0ODH6OOIaL58lu+zICW1AAAAAAIPhTk2Y6V86234f8qym+FOTbkpXzazPxf8AyhHB8ZydrPk93Jf6Gu2OvvAFSljr1Vj42fFH4on4d/Y5EvwZx7c0282kz7Z3Jmgx9rNir72nUW2pefctbEwyPozm0dpWp8OTfxeLPTXd+yOy8G/Nyey0f39FhEDNwzTZOdscfZvpqcte6yr24OZea2P59xXg5l57446tvctAjfwPS+zP1bfz2bqr+Pg352SeqsJDRtTYKfd409N9/wAuRICTi4Zpqc644+/3ar6nLbvsxFYjkegTohoAHoAA05tHpfZx61ts5ONG3Y1eDsPosXww6hrthpM7zWJZRaY8XN4PweixfDB4PweixfDDpGP5fF7EfQ7durm8H4PRYvhg8H4PRYvhh0h+XxexH0O3bq5vB+D0WL4YPB+D0WL4YdIfl8XsR9Dt26ubwfg9Fi+GDwfg9Fi+GHSH5fF7EfQ7durm8H4PRYvhg8H4PRYvhh0h+XxexH0O3bq5vB+D0WL4YPB+D0WL4YdIfl8XsR9Dt26ubwfg9Fi+GDwdg9Fi+GHSH5fF7EfQ7durm8H4PRYvhh0VrERsiNkRuiI5mRnTHWvdWIeTaZ75ZAZvAAAAAAAAGGvNireNlq1tHRaNrYPJiJ5SObwfg9Fi+CDwfg9Fi+CHSNX5fH7EfRl27dXN4PweixfBB4PweixfBDpD8DH7EfQ7durm8H4PRYvghuxYq1jZWsVjoiNkNjDKuKkc4rEPJtM98sgNjwAByzoGH0WP4YPB+D0WL4IdQ1fgY/Yj6Mu3bq5fB+D0WL4IPB+D0WL4IdIfgY/Yj6Hbt1c3g/B6LF8EN2LFWsbK1isRzVjZDYw9ripHOKxDybTPiyA2PAAGGrNo9L+VWttnJxo27G5hjNYmNpjciXN4PweixfBB4PweixfBDpGv8vj9iPoy7durm8H4PRYvgg8H4PRYvgh0h+Xx+xH0O3bq58eh4qzE1x44mOSYrETDoBsrSteURs8mZnvZAZPGFK1vH8fL+ZdVL11/qMv5o+kOf8ov7VPisOHenb4OIBxq6HrFPjV64eSGdJ2mHk90voMDTo2kUyVi1LRaPU3PplLRMRMTu5eY2ZAZvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHLrLJxcOS3RS2zrnd2qOtvCTJswTHnWrXt/pVJx3lDk3yUr0j7rnhtfNtPWQBzyxAbdFx8bJSvTase9sx13msdXlp2iZXXQcfExY69FKw3kMvpdK7RWOjl5neZlhoy5b15MfGj8Nt/unZHzdDD20TPjsQjp1xirOy/wBpjnovWW/HrHDbkyU9s7G/JjraNloiY6JhGaVqHDffXbSfVye5Cy/mq869m8dO6f2bq/hT37wlK3ieSYnqelUz6kz499J40dNZ2S5Y03SMc7JvkrPRb90G/GLY52y4Jq3xo4t6GSJXUVLHr7PHLNLdcdzqxcJLfexxPVOxspxzSz3zMfJjbQZY8N1jZQuPhFinlrevs2urHrjR7f7kR1xMJtNfp7d2WGm2nyR31l3jVi0mlvJvWeqdralVvWe6d2qYlkBk8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYkkU7XuTjaRf1bK+6Ee2aTk4172861p97W+a6rJ28mS3WZdNirtWse4AR2wWHgrj3ZLdM1r7t/ary28HMezBWfOm1uzsXXAsfazxPSJ/ZC19tse3VKgO4UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApmvf9Rl66/SFzU7X8f9zk9fF+kdyh8oY/o1/wDb90/h3pz8EcA4tdgANuj6RfHPGpaYn6+xYNX6/rbZXL4tvOjknuVoT9JxHNhnzbcungj5tNS/fHPq+gVtExtiYmJZUnQdY5MPkztrz1nkWTV+uMeXZHkX82efql1ui4vhzbRPm26KjPo70598JMBbIgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACvcK8n8qv5rT7N3aryW4S5NufZ5tIj37+1EuA4tk7WfLPTl9HQaOu2OgArEoSGocfG0in4dtvdH7o9N8Fse3Jkt0ViPi/8AlP4Zj7WfFHv+3NH1Vtsd5WcB9Dc6AAAAw1ZsFLxstWto6JhtGNqxPKY3exKG0ng/itvpM0no5Y7/AJonSdSZqckReOmvdyreKvUcG02Tn2ezPuSsety18d3z+1ZidkxMT0TDC959Fx5I2XpW3XCK0rg7S2/HaaT0TvjvUeo4BmrzpbtfpKdj4hSfSjZWW7HpWSvk3vHVaXTpOp8+PfxeNHTTf8uVwTEwqb48+KdpiaymVtjv3bSkMeudIr9/b1xEunHwiyx5VaT1bY70MNlOI6mvdlljbTYp9SFjx8JK/ex2jqnb3OvHr7R55bWr117lR2CbTj2pjvmLfL9mi3D8U928Lvj1jhtyZKdW101tE8kxL5+9UvMckzHVKZj8o59bH+rTbhseFl/FJx6yz15Mt/bO36urHr/PHLxLdcdybj8oME99Zhotw7JHdMStgruPhLP3sUeyzqx8IsM8sXr7NqZj4tpbf8mzTbSZY9VMMuDHrfR7f7kR17vq6seelvJvWeqdqZTUYrejeJ+bTbHaO+sw2htG5gAAAAAAAAAAAAAAAAAAAAw59PycXFkt0UtMdboRnCLLxdHtHnTWvb2I+rydnHkt0iWzFXe1Y6yqID5tLpgB4C86vx8TFjr0UrtUrR6ca9K+daK+/wDyvkOp8nMf92/whVcSt6EPQDqVUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw4NY6qx5t8+Lfzo7XeNWXDTJWa2jeGVLzWd4nZSdO1dkwz40ba81o5Jci/3rFomJiJieWJ50HrHUETtth3T5k8k9TltdwK1d7YucdPFa4NfE8r8verg9ZcVqTxbRNZjliXlz1qzE7TG0rKJiecADB6APRKav11kxbIt49PXyx7e9Y9D07HmjbS2/nieWFIesd5rMTWZiY5JiVzouM5cW1befX9ULPoqW5xylfxXNX8IJjxcsbY8+OX2x3J/DmreItW0WieeHWaXXYc0b0tz6eKoy4L0nnDaAmNIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACj60ycbPln8Ux8O7scq8ToGGd/wBli3/hg8H4PRYvghyuXgGS9rW/EjnO/wBVrTiFYiI7Pco4vHg/B6LF8EHg/B6LF8ENf8uZP8kMv4lHsKOs/BfHsxWt51/lVI+D8PosXwQ3YsVaRxa1isdERshP4fwe2HJF5tE7I+o1sXr2YjZsAX6AAAAAAAAAAAw59J0LFk8ulZ9fP7+V0DC9K2ja0bvYmY7pQOk8HKzvx3mvqtvjvROk6qzY+WkzHTXfHeuOXLWsbbWrEdMzsR2ka8wV5Jm89FY7eRRa3hui75t+HPx/6T8Gqz90R2lSkSWsdZ1y8mGkfinl+WxGuUz46VttW/ajqtsdrTHOvZAGhsAAAAAHu8jdj0vJXycl4/5S6seudIr9/b1xH+UeJFNVmr6OSY+bXbDSe+sSmsXCLLHlUpbq2w6sfCWn3sdo6p29ytiZj4zqq+vu0W0WKfVW7Fr3R55bTXrrLqx6fhtyZKT6tqjkRt5E3H5Q5/GkS024dTwtMPoEWieeGVN0TV+kW8it6+uZ4qa0PV+k18rSLR6o8b5z3LrS8Ry5Nv8A88x7/wD+7IOXT0r/AMkSmR4pGyNkzM+ued7WsIgA9AAAAAAAAAAGEBwrybsdembW927+pPtWbRsd9nHpS0xycaInYia3BbLjvjidt23Dkilq2mN9lDF48H4PRYvgg8H4PRYvghzn8uZP8kLL+JV9hRxePB+D0WL4IPB+D0WL4IP5cyf5IP4lHsKtqPHxtIx+qZtPshcmjFomOk7a46VnprEQ3r3huinT0mszvMyganP+JaJ22ZAWKOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA5dM0LHljZeu3onnhWtY6myYttq+PTpjljrhbhXazhuHPHONp6pGHU3p3TvHR8+Fs1jqWmXxq+Jf1cluuFa0vQ8mKdl67Oieafa5DW8MzYJ5xvHVc4NVS/uno0AK1JAAG7RtKyYp20tMdPRPsaRspe1ZiaztLy1YmNphaNX6+pfZXJ4lun7s9yYidu+OR8/dugazyYeSdtfNnkdFouPTG1c0b+9WZ+Hx30+i6CP0DW2PNsjbxbebPYkHT4s1MkRalt4Vd6WrO0xsyA2sQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAac2k46eVeteuWNr1jnM7PYiZ7m4RGkcIMNfJ4159UbI+aN0jhDlt5EVpHvnu+SuzcX01PX3+CTTR5berstMy49I1nhx+Vkrt6I3z8lRz6XkyeXe1vVM7vdyNCozeUU/8AHj+cpdOG+1ZY8/CSseRSZ9dp2I3PrrPf70VjorGz90cKnNxXU5O++3w5JlNJir6u71e82nbMzM9MzteQV82me+d0iIAGL0AAAAAAGa0mZ2REzPREO/R9TZ7/AHOLHTfd+/yb8Wny39Gky13y0r322R4sWDg3H38k9VY7Ulg1VgpyY6zPTbf9Vrh4DqLeltREvxDHHdzVHBouS/k0tb1xHakdH4P5reVNaR17Z+W75rTEbOZlb4fJ/DX07Tb9ES/EMk90bIfR+D2KvlTa/wAo+XeksGi48fkUrXqhuFth0eHH6NIhDvmvbvtuyAktYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDXmxVvE1tETE80tgxtWJjaY3IlW9Y6gmPGxb48yeWOqUHasxMxMTExumJ5n0Bxaw1bjzR40bLc1o5Yc9ruBVtvbFynp4LHBr5jlfnHVSx3afqvJh3zHGpzWjtcLls2G+OZreu0ramSto3idwBpZgACW1frzJj2Vv49fXyx7e9EiTp9VlxT2qW2a8mKt42tG686JpmPLG2ltvTHPHsdCgYslqzFqzNZjnhPav4QfdzR/ziPrHc6nRcdx32rk82evgqc+gtXnXnH6rCPGLLW8RasxMTyTEva+iYnnCv2ZAZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA58+nYsfl3rHq27/dyo3SOEWOPIra/rndHf8AJEza7Bj9LJENtMGS3dVNMWtEb5mIj1qppGvs1vJ4tI9UbZ98o7Nnvffa1rfmlU5vKHDHoVm36JdOHXn0p2W7PrjBT7/Gnorv/ZG5+Ek/7eP23nsjvV8VObjupt6MxVMpoMcd/N3aRrbPflvMR0V3fu4pmZ3zvnplgVWTPkvztaZS64617o2AGlmAAAAAAA948Vr7q1tafVG1nWszO0Ru8mYjvl4Eno+os9uWIpH4p7klo/Bykb73tb1RujvWGHhOpv3U2+PJGvrMVfW3Vp04NAy5PJx2n17Nke+dy3aPq/Dj8nHWJ6Z3z753upb4fJ3/ACZPlCHfiXs1VjR+DuSfLtWvVvnuSej6hwV5Ym8/inshKC2w8J01O6m/x5ol9Xlt62zXiwUpGyta1jorGxsBYVrEcojZHmWQGTwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5mNvUhdY6hrbbbFsrbzeae5NiNqNLiyx2b13bMeW1J3rKhZ8F8c8W9ZrPRLWvelaLTLXi3rEx9Fb1jqO+PbbHtvXo+9He5PXcFyY97U86v6rfBrq25W5T+iIAUaeAPAABv0TTMmKdtLTHTHNPsWPV+vaZNlb7KW9fJP8AfrVUWOj4lmw907x0Rs2lpfvjaer6BEsqboGtcuHdE8anmz2Ssmga0xZt0Tst5s8rrdHxXDm2jfs26KjPpL098dXeAtEUAAAAAAAAAAAAAAAAAAAAAAAAYJlx59Z4aeVkrt6I3z8mu+WlI3taIZVrM90buwQOkcI6x5GOZ9dp2I3PrvPf70VjorH9yq83G9NTut2p9yVTQ5Z8NltyZa1jba0VjpmdiP0jXmCnJabz+GO3kVPJktadtpm09MzteVTm8osk+hSI/VLpw6vrW3TmkcI7zupSK+u07UbpGsc2TysltnRG6Pk5RU5uIajJ6WSUymmx17qgCFu3gDwAAAAAHoDdg0bJfyKWt1R2pHBwfzW8qa0j175+W75pWHRZ8no45lqvnx177IgiFpwcHsVfKm1/lHy3/NI4NEx4/IpWvriFth8n81vTtFf1Q78RpHdG6o6PqvPfkxzEdNt31SWj8G7ffyRHqrHb+yxi2w8B09fS3sh31+We7kjsGpcFPu8aem87flyfJ30pFY2RERHREPQtcenx05VpEItslrd87sgNzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABGax1Rjzb48W/nRz9cK1pugZMM7Lxu5rRySu7zkxxaNloiYnliVRruEYs29o823VLway9OU84UAWDWOoPvYfgmfpPegcmO1ZmLRMTHLEw5HVaHLhna9fn4LnDnpeOUvICE3AADMTs62B7EiY1fr69Nlcnj16fvR3rFoul48sbaWienpj2KK94c1qTFq2msxzwu9FxvLj2rfz6/qgZ9DS3OvKf0X4QGr+EETsrmjZ+OO2O5O47xaNtZiYnkmHWabWYs0b0tv7vFU5cN6TtaHsBKagAAAAAAAAAAAAHm1ojlmI63kzAyODPrfBT78Wnorv/ZG6Rwk9Hj9tp7I70HNxLTY/SyR92+mmyW7qrC1Z9JpTfa9a9cqjn1tnvy3mI6K7v3cVrTO+ZmZ6ZVObyipHoU3+KZThtvWtstWka/w18njXn1Rsj5o3Pwhy28mtafOe75IYVObjWqv63Z+CZTQ4q+G7fn0zLk8q9p9W3d7uRoBWXyWtO9rbpNaxHKI2AGtkAAAAAAA6MGg5cnk47T69myPfyNlMV7TtWsyxtesd87OcTWj8Hck+XaterfPck9H1Dgryxa8/inshaYOC6m/fXsx70W+uxR47qnWszOyImZ6Ih3YNTZ7/c4sdN52fv8AJbsWClI2VrWseqNjYtsPk7jj07zPwQ78Rt6tdlf0fg3H+5kmfVWO2e5JYNVYKcmOJnptv+ruFth4dp8fo44+PeiX1GS3fYiIhkE2IaAB6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMOXTdAx5o2WjfzWjlh1DDJjraJraN4e1tMTvE7KfrDVGTDtmPHp0xHJ1wjn0HYiNY6jpk22pspf5T7O5zGu4D32w/T9lpg4h4X+qqjdpWi3xTxb1mOieafa0ubvS1ZmLRtMLStomN4kAa3oAA6dD07JhnbS2yOevNPsc0jZjyWpMWrO0sbViY2mN1s1frvHk2Vt4l/XyT7e9K7Xz5IaBrfJi2Rt49PNnm6pdJouP91c0fNWZ+H+NPouI4tB1ljzeTOy3PWeWHa6bHlpeItWd4VlqzE7TGzIDYxAAYHjJlrWNtrREdMyj8+vMFOS02n8O/58jRl1GKnpXiGdcdrd0bpMVvSOEdp8ikV9dp2/JG6RrLNk8rJbZ0Ruj5KrPx7T19He6XTh+Se/kt2fTcWPyr1j1bd/u5Ubn4RY48itr+vkjv8AkrAqc3lBntypWK/qmU4dSO+d0rn1/mt5PFpHqjbPvlHZs97ztte1uuWsVObWZsnpXmUumGle6uwAjNoA8AAAAACIexADswaszX5Mdojptu+qS0fg5b794j1Vjb8/2TsPDtRk9HHP2R76rFXvsgXvFitadla2tPqjatuj6lwU+7xp6b7/AJcnyd9KRWNkRER6lth8nbz6d9vgiX4lHq13VPR9RZ7csRSPxT3JLR+DlI8u9reqN0d6cFth4Lpqd9e1PvQ763Lbx2cuDV+HH5OOsT0zvn3y6gWlMVKxtWsQi2tM987sgM3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADTpGCmSvFvWLR61d1jqG1dtsW21fNnljvWcQtXoMOaNrRz6+Ldh1F6Tyn5Pn8xMTsnds5pYXPWGq8ebfMcW/NeOVWNP1bkwz40ba81o5HIa3hOXDvPpV6/uucGspfl3T0cYCpSwAAAGa2mJ2xtiY5JhM6v1/auyuXxq+dzx3oUStNq8uGd6W2+zVlw0vG1oXvR9JpkjjUtEx9GrSNZYcflZK7eiN8+6FKi0xyTO/l2MLu3lFfsxtjjdBjhtd+duSyaRwjrG6lJt67bkbpGu89+S0UjorH9yjRWZuK6m/ffb4ckqmkxV9Xd6yZLWnbaZtPTM7XkFfNpnnM7pEREdwAxegAAAAAAzWszOyImZ6Id2j6nz3+5xY6bzs/f5N+LT5b+jSZYWyVr322cAsODg3H+5knqrHbPcksGqcFOSkTPTbf9Vrh4DqLeltVEvxDHHdzVHDo2TJ5FLW6o7Ulg4P5reVxaR652z8u9aYjZzQytsPk/hr6dpt+kId+I5J7o2Q+j8HsVfLm1/lHf80jg0THj8ila+uI3t4tsOiwY/RxxCJfNe3fbdkBKagAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5tWJjZMRMTzS9DyYEDrHUETtti2VnzJ5J6lezYbUma2rNZ6JX5z6XodMsbL1ieieePaotdwTHk3tj823TwT8GutXlbnCjCV1jqTJi22ptvT1csezuRTk8+myYp7N67LfHlreN6zuAI7YAAAAAAAAA948Vrbq1tafVG1nWsz3Ru8mYjveBJ4NRZ7csRSPxSktH4OUjfe829Ubo71hh4Tqb91No9/JGvrMVfW3Vp0aPoOXJ5OO0+vZsj38i36Pq7Dj8nHXb0zvn3y6ltg8nf8mT5QiX4l7NVY0fg7kny7Vr1b57klo+ocNfKi15/FPclRb4eE6andTf480O+ry29bZqxYKUjZWtax6o2NoLCtYjlEbI8yyAyeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMIvWOpseXbaviX6Y5J64Sg059PjyR2b13hnTJas7xOyjaZoWTDOy9dnRMck+1zr9lxVvE1tETE8sSr+sdQTG22LfHLxJ5uqXKa7gd6b2xedHTx/+rbT6+s8r8pQI9XrMTMTExMbpieZ5UExMctljEg24dGyX8ilrdUdqRwcH81vK4tI9c7Z+Xek4dHnyejSZar58de+2yJIhaMHB7FXyptf5R3/NJYNEx4/IpWvriN/v5Vrh8n81vTtFf1Q78RpHdG6o6PqzNk8nHaI6bbvqktH4OWny7xHqrG1Y9gt8PAdPX0t7ol9fknu5I7BqTBT7vGnpvO35cnyd9MdaxsrERHREPQtcWnxU5VpEIlslrd87sgNzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABxafq/Fljxq7+a0bph40fVWCmzZjiZ6bbwQ50+KckzNI326NsZLbbdrk7oiI5oegS4hqAHoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k=" alt="${shopName}" style="height:52px;object-fit:contain;display:block">
      <div class="shop-sub">📍 ${addr}<br>📞 ${phone}</div>
    </div>
    <div class="title-block">
      <div class="main-title">${invTitle}</div>
      <div class="bill-num">${code}</div>
    </div>
  </div>
  <div class="ribbon">
    <span>📅 Ngày bán: ${dateStr}</span>
    <span>${s.staff ? '👤 Nhân viên: ' + esc(s.staff) : ''}</span>
  </div>
  <div class="body">
    <div class="cust-box">
      <div class="fi"><span class="k">Khách hàng: </span>${esc(s.customer || 'Khách lẻ')}</div>
      ${s.phone ? `<div class="fi"><span class="k">Điện thoại: </span>${esc(s.phone)}</div>` : ''}
      <div class="fi"><span class="k">Thanh toán: </span>${s.payMethod === 'transfer' ? '🏦 Chuyển khoản' : '💵 Tiền mặt'}</div>
      ${s.note ? `<div class="fi"><span class="k">Ghi chú: </span>${esc(s.note)}</div>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:28px" class="tc">#</th>
          <th>Tên sản phẩm</th>
          <th style="width:36px" class="tc">SL</th>
          <th style="width:90px" class="tr">Đơn giá</th>
          <th style="width:95px" class="tr">Thành tiền</th>
          <th style="width:112px" class="tc">BH đến ngày</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals-wrap"><div class="totals-box">
      ${s.extraDiscount ? `<div class="t-row disc"><span class="k">Giảm thêm:</span><span class="v">-${fmt(s.extraDiscount)}đ</span></div>` : ''}
      <div class="t-row grand"><span class="k">TỔNG THANH TOÁN</span><span class="v">${fmt(s.total || 0)}đ</span></div>
      <div class="t-row"><span class="k">Đã trả:</span><span class="v">${fmt(s.paid || 0)}đ</span></div>
      ${remaining > 0 ? `<div class="t-row owe"><span class="k">Còn lại:</span><span class="v">${fmt(remaining)}đ</span></div>` : ''}
    </div></div>
    <div class="wn-box">
      <div class="wn-head">📋 ĐIỀU KHOẢN BẢO HÀNH</div>
      <div class="wn-body"><ul>
        <li>Bảo hành áp dụng cho lỗi kỹ thuật phát sinh trong điều kiện sử dụng bình thường.</li>
        <li>Không áp dụng với các trường hợp: vỡ, vào nước, cháy nổ, tự ý tháo lắp.</li>
        <li>Vui lòng xuất trình phiếu này khi yêu cầu bảo hành.</li>
        <li>Hotline hỗ trợ: <strong>${phone}</strong> (8h–21h, Thứ 2 – Chủ Nhật).</li>
      </ul></div>
    </div>
  </div>
  <div class="footer-band">
    <strong>${shopName} — ${phone}</strong>
    <span>${footerText}</span>
  </div>
  <div class="bottom-stripe"></div>
  <div class="btn-bar">
    <button class="btn-p" onclick="window.print()">🖨 In phiếu bảo hành</button>
    <button class="btn-c" onclick="window.close()">✕ Đóng</button>
  </div>
</div>
</body></html>`;

    const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank', 'width=740,height=900,scrollbars=yes,resizable=yes');
    if (!win) { toast('⚠ Vui lòng cho phép popup để in phiếu'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    win.focus();
  }
  // ══════════════════════════════════════════════
  //  TEMPLATE EDITOR
  // ══════════════════════════════════════════════
  function openTemplateEditor() {
    const tpl = getTemplate();
    const o   = container.querySelector('#sl-tpl-overlay');
    o.querySelector('#tpl-shop-name').value = tpl.shopName || '';
    o.querySelector('#tpl-address').value   = tpl.address  || '';
    o.querySelector('#tpl-phone').value     = tpl.phone    || '';
    o.querySelector('#tpl-title').value     = tpl.title    || '';
    o.querySelector('#tpl-footer').value    = tpl.footer   || '';
    o.style.display = 'flex';
    o.onclick = e => { if (e.target === o) o.style.display = 'none'; };
  }

  // ══════════════════════════════════════════════
  //  SOFT DELETE / RESTORE
  // ══════════════════════════════════════════════
  async function softDelete(key) {
    if (!confirm('Chuyển đơn này vào thùng rác?')) return;
    try {
      await updateItem(COLLECTION, key, { deletedAt: Date.now() });
      toast('Đã chuyển vào thùng rác');
    } catch(e) { toast('Lỗi: ' + e.message); }
  }

  async function restoreItem(key) {
    try {
      await updateItem(COLLECTION, key, { deletedAt: null });
      toast('Đã khôi phục ✓');
    } catch(e) { toast('Lỗi: ' + e.message); }
  }

  // ══════════════════════════════════════════════
  //  REALTIME LISTENER
  // ══════════════════════════════════════════════
  unsub = onSnapshot(COLLECTION, all => {
    const now     = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    all.filter(s => s.deletedAt && (now - s.deletedAt) > WEEK_MS)
       .forEach(s => deleteItem(COLLECTION, s._key).catch(() => {}));
    allItems = all;
    render();
  });

  container._cleanup = () => {
    if (unsub) { unsub(); unsub = null; }
    hideDrop();
    if (globalDrop) { globalDrop.remove(); globalDrop = null; }
  };
}
