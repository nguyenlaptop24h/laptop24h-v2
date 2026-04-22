// modules/sales.js - Ban hang v39 (chọn SP kho + BH đến ngày)
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
.sf-disc  { width:80px !important; text-align:right; }
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
        <div style="width:90px;text-align:right">Thành tiền</div>
          <div style="width:118px;text-align:center">BH đến</div>
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
      <input class="sf-disc"  type="number" min="0"  title="Giảm giá" style="width:80px">
      <input class="sf-bh-date" type="date" title="BH đến ngày" style="width:118px">
      <span class="sf-line-total">0đ</span>
      <button class="sf-remove-btn" type="button" title="Xoá dòng">✕</button>`;
    wrap.appendChild(row);

    // Set values programmatically
    row.querySelector('.sf-name').value  = data.name     || '';
    row.querySelector('.sf-qty').value   = data.qty      || 1;
    row.querySelector('.sf-price').value = data.price    || 0;
    row.querySelector('.sf-disc').value  = data.discount || 0;
        row.querySelector('.sf-bh-date').value = data.bhDate   || '';

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
          if (p) { nameInput.value = p.name || ''; row.querySelector('.sf-price').value = p.price || 0; const _wm = parseInt(p.warranty)||0; if(_wm>0){const _modal=container.querySelector('#sl-modal');const _sd=(_modal&&_modal.querySelector('#sf-date')&&_modal.querySelector('#sf-date').value)||new Date().toISOString().slice(0,10);const _d=new Date(_sd+'T00:00:00');_d.setMonth(_d.getMonth()+_wm);row.querySelector('.sf-bh-date').value=_d.toISOString().slice(0,10);} }
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
        bhDate:   (row.querySelector('.sf-bh-date')||{}).value || '',
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
  //  PRINT INVOICE
  // ══════════════════════════════════════════════
  function printInvoice(key) {
    const s = allItems.find(x => x._key === key);
    if (!s) { toast('Không tìm thấy đơn hàng'); return; }

    const tpl = getTemplate();

    // Stable order code: sort active items by createdAt
    const sorted = [...allItems].filter(x => !x.deletedAt).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const idx    = sorted.findIndex(x => x._key === key);
    const code   = '#BH' + String(idx + 1).padStart(4, '0');

    const dateObj = s.date ? new Date(s.date + 'T12:00:00') : new Date(s.createdAt || Date.now());
    const dateStr = dateObj.toLocaleDateString('vi-VN');

    // Inline format (can't use imported formatVND in a new window)
    const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';

    const itemRows = (s.items || []).map((it, i) => {
      const line = Math.max(0, (it.qty || 1) * (it.price || 0) - (it.discount || 0));
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.name || '')}</td>
        <td style="text-align:center">${it.qty || 1}</td>
        <td style="text-align:right">${fmt(it.price || 0)}</td>
        <td style="text-align:right">${it.discount ? '-' + fmt(it.discount) : '—'}</td>
          <td style="text-align:center">${it.bhDate ? it.bhDate.split('-').reverse().join('/') : '&mdash;'}</td>
        <td style="text-align:right;font-weight:600">${fmt(line)}</td>
      </tr>`;
    }).join('');

    const remaining  = (s.total || 0) - (s.paid || 0);
    const shopName   = esc(tpl.shopName || 'Laptop 24h');
    const invTitle   = esc(tpl.title   || 'HÓA ĐƠN BÁN HÀNG');
    const footerText = esc(tpl.footer  || 'Cảm ơn quý khách đã mua hàng! 🙏');
    const printTime  = new Date().toLocaleString('vi-VN');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${invTitle} ${code}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:28px;max-width:620px;margin:0 auto}
  .inv-store{text-align:center;padding-bottom:14px;border-bottom:3px solid #1a3a6b;margin-bottom:16px}
  .inv-store-name{font-size:1.7rem;font-weight:800;color:#1a3a6b;letter-spacing:.5px}
  .inv-store-sub{font-size:12px;color:#555;margin-top:5px;line-height:1.8}
  .inv-title{text-align:center;font-size:1.1rem;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a3a6b;margin:16px 0 4px}
  .inv-code{text-align:center;font-size:12px;color:#666;margin-bottom:16px}
  .inv-cust{background:#f7f8fa;border-radius:7px;padding:11px 14px;margin-bottom:16px;border:1px solid #e8ecf0}
  .inv-cust table{width:100%;border-collapse:collapse}
  .inv-cust td{padding:4px 5px;font-size:12.5px;vertical-align:top}
  .inv-cust td:first-child{color:#777;width:130px;font-weight:600}
  .inv-cust td:last-child{color:#222}
  table.inv-items{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12.5px}
  table.inv-items thead tr{background:#1a3a6b}
  table.inv-items th{padding:8px 9px;color:#fff;font-weight:600;font-size:11px}
  table.inv-items td{padding:7px 9px;border-bottom:1px solid #eef0f3}
  table.inv-items tbody tr:last-child td{border-bottom:none}
  table.inv-items tbody tr:nth-child(even){background:#fafbfc}
  .inv-totals{display:flex;flex-direction:column;gap:4px;align-items:flex-end;margin-bottom:20px}
  .inv-tr{display:flex;justify-content:space-between;width:280px;font-size:12.5px;color:#555;padding:2px 0}
  .inv-tr.final{border-top:2px solid #1a3a6b;margin-top:5px;padding-top:8px;font-size:1.05rem;font-weight:800;color:#1a3a6b}
  .inv-tr.owe{color:#dc2626;font-weight:700}
  .inv-footer{text-align:center;padding-top:14px;border-top:2px dashed #d1d5db;color:#6b7280;font-size:12.5px;line-height:2}
  .inv-time{font-size:10.5px;color:#bbb;margin-top:5py}
  .btn-bar{display:flex;gap:10px;justify-content:center;margin-top:22px}
  .btn-bar button{padding:10px 26px;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:.3px}
  .btn-p{background:#1a3a6b;color:#fff}
  .btn-p:hover{background:#0f2647}
  .btn-c{background:#f0f0f0;color:#444}
  @media print{.btn-bar{display:none}body{padding:8px}}
</style>
</head>
<body>

<div class="inv-store">
  <div class="inv-store-name">${shopName}</div>
  <div class="inv-store-sub">
    ${tpl.address ? `📍 ${esc(tpl.address)}<br>` : ''}
    ${tpl.phone   ? `📞 ${esc(tpl.phone)}` : ''}
  </div>
</div>

<div class="inv-title">${invTitle}</div>
<div class="inv-code">Số: <b>${code}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Ngày: <b>${dateStr}</b></div>

<div class="inv-cust">
  <table>
    <tr><td>Khách hàng:</td><td>${esc(s.customer || 'Khách lẻ')}</td></tr>
    ${s.phone ? `<tr><td>Điện thoại:</td><td>${esc(s.phone)}</td></tr>` : ''}
    <tr><td>Thanh toán:</td><td>${s.payMethod === 'transfer' ? '🏦 Chuyển khoản' : '💵 Tiền mặt'}</td></tr>
    ${s.note ? `<tr><td>Ghi chú:</td><td>${esc(s.note)}</td></tr>` : ''}
  </table>
</div>

<table class="inv-items">
  <thead>
    <tr>
      <th style="width:30px;text-align:center">#</th>
      <th>TΪn sản phẩm</th>
      <th style="width:36px;text-align:center">SL</th>
      <th style="width:100px;text-align:right">Đơn giá</th>
      <th style="width:80px;text-align:right">Giảm</th>
      <th style="width:100px;text-align:right">Thành tiền</th>
          <th style="width:100px;text-align:center">BH đến</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="inv-totals">
  ${(s.extraDiscount || (s.subtotal !== undefined && s.subtotal !== s.total))
    ? `<div class="inv-tr"><span>Tạm tính:</span><span>${fmt(s.subtotal || 0)}</span></div>` : ''}
  ${s.extraDiscount
    ? `<div class="inv-tr"><span>Giảm thêm:</span><span style="color:#059669">-${fmt(s.extraDiscount)}</span></div>` : ''}
  <div class="inv-tr final"><span>Tổng cộng:</span><span>${fmt(s.total || 0)}</span></div>
  <div class="inv-tr"><span>Đã trả:</span><span>${fmt(s.paid || 0)}</span></div>
  ${remaining > 0 ? `<div class="inv-tr owe"><span>Còn lại:</span><span>${fmt(remaining)}</span></div>` : ''}
</div>

<div class="inv-footer">
  <div>${footerText}</div>
  <div class="inv-time">🕐 In lúc: ${printTime}</div>
</div>

<div class="btn-bar">
  <button class="btn-p" onclick="window.print()">🖨 In hóa đơn</button>
  <button class="btn-c" onclick="window.close()">✕ Đóng</button>
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=660,height=860,scrollbars=yes,resizable=yes');
    if (!win) { toast('⚠ Vui lòng cho phép popup để in hóa đơn'); return; }
    win.document.write(html);
    win.document.close();
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
