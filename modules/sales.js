// modules/sales.js - Ban hang v37 (redesign theo mockup)
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, formatVND } from '../core/ui.js';

const COLLECTION = 'sales';
const SALES_SHEET_URL = 'https://script.google.com/macros/s/AKfycby1EKgFp101WvCx7v_bTFthGM655wGJ35azbCicNomLw10xz6Fbt-Ycp6ug15FE1_9S/exec';
registerRoute('#sales', mount);

function logToSheet(data, action) {
  try {
    fetch(SALES_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    }).catch(() => {});
  } catch(e) {}
}

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

  // Load products from Firebase for autocomplete
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

/* CONTENT (TABLE + PAGINATION) */
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
.sl-stat-card {
  flex:1; background:#f8f9fa; border-radius:8px; padding:9px 11px;
}
.sl-stat-val { font-size:1.25rem; font-weight:700; color:#1a73e8; line-height:1.2; }
.sl-stat-lbl { font-size:10px; color:#888; margin-top:2px; }

/* BAR CHART */
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
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center; z-index:1000;
}
.sl-modal {
  background:#fff; border-radius:10px; width:500px; max-width:95vw;
  max-height:92vh; display:flex; flex-direction:column;
  box-shadow:0 8px 32px rgba(0,0,0,.18); overflow:hidden;
}
.sl-modal-header {
  background:#1a73e8; color:#fff; padding:12px 16px;
  display:flex; justify-content:space-between; align-items:center; flex-shrink:0;
}
.sl-modal-header h3 { font-size:14px; font-weight:600; }
.sl-close-btn { background:none; border:none; color:#fff; font-size:18px; cursor:pointer; opacity:.8; line-height:1; }
.sl-close-btn:hover { opacity:1; }
.sl-modal-body { padding:14px 16px; overflow-y:auto; flex:1; }
.sl-modal-footer {
  padding:10px 16px; border-top:1px solid #eee;
  display:flex; justify-content:flex-end; gap:8px; flex-shrink:0;
}

.sl-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.sl-field { display:flex; flex-direction:column; gap:3px; }
.sl-field label { font-size:11px; color:#666; font-weight:600; }
.sl-field input, .sl-field select, .sl-field textarea {
  padding:7px 9px; border:1px solid #ddd; border-radius:6px;
  font-size:12px; outline:none; font-family:inherit;
}
.sl-field input:focus, .sl-field select:focus, .sl-field textarea:focus { border-color:#1a73e8; }
.sl-field.full { grid-column:1/-1; }

.sl-items-label { font-size:11px; font-weight:700; color:#555; margin-bottom:6px; }
.sf-item-row {
  display:flex; align-items:center; gap:5px; margin-bottom:6px;
  background:#f9f9f9; border-radius:6px; padding:6px 8px;
}
.sf-item-row input { padding:5px 7px; border:1px solid #ddd; border-radius:5px; font-size:12px; outline:none; }
.sf-item-row input:focus { border-color:#1a73e8; }
.sf-name { flex:1; min-width:0; }
.sf-qty { width:50px !important; text-align:center; }
.sf-price { width:100px !important; text-align:right; }
.sf-disc { width:75px !important; text-align:right; }
.sf-line-total { width:80px; text-align:right; font-size:11px; font-weight:600; color:#1a3a6b; flex-shrink:0; }
.sf-remove-btn {
  background:none; border:none; color:#ccc; cursor:pointer; font-size:14px;
  padding:0 3px; flex-shrink:0;
}
.sf-remove-btn:hover { color:#e74c3c; }
.sl-add-row-btn {
  width:100%; padding:6px; border:1px dashed #ddd; border-radius:6px;
  background:#fafafa; color:#888; cursor:pointer; font-size:12px; margin-top:2px;
}
.sl-add-row-btn:hover { border-color:#1a73e8; color:#1a73e8; background:#f0f4ff; }

.sl-totals {
  margin-top:10px; padding:10px 12px; background:#f8f9fa;
  border-radius:8px; display:flex; flex-direction:column; gap:6px;
}
.sl-total-row {
  display:flex; justify-content:space-between; align-items:center;
  font-size:12px; color:#555;
}
.sl-total-row input {
  padding:3px 6px; border:1px solid #ddd; border-radius:4px;
  font-size:12px; outline:none; text-align:right;
}
.sl-total-final { border-top:1px solid #e0e0e0; padding-top:6px; margin-top:2px; }

/* AUTOCOMPLETE */
.sl-autocomplete {
  position:fixed; z-index:9999; background:#fff;
  border:1px solid #ddd; border-radius:6px;
  box-shadow:0 4px 16px rgba(0,0,0,.12);
  max-height:220px; overflow-y:auto; display:none;
}
.sl-ac-opt { padding:.4rem .7rem; cursor:pointer; border-bottom:1px solid #f5f5f5; }
.sl-ac-opt:hover { background:#f0f4ff; }
.sl-ac-opt:last-child { border-bottom:none; }
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

  <div class="sl-overlay" id="sl-overlay" style="display:none">
    <div class="sl-modal" id="sl-modal"></div>
  </div>
</div>`;

  // ══════════════════════════════════════════════
  //  WIRE UP TOOLBAR
  // ══════════════════════════════════════════════
  container.querySelector('#sl-add-btn').onclick = () => openForm(null);
  container.querySelector('#sl-trash-btn').onclick = () => {
    filterMode = 'trash';
    updateFilterUI();
    currentPage = 1;
    render();
  };
  container.querySelector('#sl-search-inp').oninput = e => {
    searchQ = e.target.value.toLowerCase().trim();
    currentPage = 1;
    render();
  };
  container.querySelectorAll('.sl-f').forEach(f => {
    f.onclick = () => {
      filterMode = f.dataset.mode;
      updateFilterUI();
      currentPage = 1;
      render();
    };
  });

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

    if (filterMode === 'day') {
      list = list.filter(s => (s.date || '').startsWith(todayStr));
    } else if (filterMode === 'week') {
      const { start, end } = getWeekBounds(todayStr);
      list = list.filter(s => s.date >= start && s.date <= end);
    } else if (filterMode === 'month') {
      list = list.filter(s => (s.date || '').startsWith(todayStr.slice(0, 7)));
    }

    if (searchQ) {
      list = list.filter(s =>
        (s.customer || '').toLowerCase().includes(searchQ) ||
        (s.phone || '').includes(searchQ) ||
        (s.items || []).some(it => (it.name || '').toLowerCase().includes(searchQ))
      );
    }

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

  // ══════════════════════════════════════════════
  //  QUICK STATS
  // ══════════════════════════════════════════════
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
      renderPagination(0, 0);
      return;
    }

    const STATUS = {
      done:    { label: 'Hoàn thành', cls: 'badge-done' },
      pending: { label: 'Chờ TT',     cls: 'badge-pending' },
      cancel:  { label: 'Đã huỷ',     cls: 'badge-cancel' },
    };

    const rows = page.map((s, i) => {
      const idx = (currentPage - 1) * PAGE_SIZE + i;
      const code = '#BH' + String(idx + 1).padStart(4, '0');
      const items = s.items || [];
      const itemStr = items.length === 0 ? '—'
        : items.length === 1 ? (items[0].name || '—')
        : `${items[0].name || ''} +${items.length - 1}`;
      const st = STATUS[s.status || 'done'] || STATUS['done'];
      const pay = s.payMethod === 'transfer' ? '🏦 CK' : '💵 TM';

      if (filterMode === 'trash') {
        return `<tr>
          <td><input type="checkbox"></td>
          <td style="color:#aaa">${code}</td>
          <td>${s.customer || '—'}</td>
          <td title="${items.map(it => it.name).join(', ')}">${itemStr}</td>
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
          <div class="sl-customer">${s.customer || '—'}</div>
          ${s.phone ? `<div class="sl-phone">${s.phone}</div>` : ''}
        </td>
        <td title="${items.map(it => it.name).join(', ')}">${itemStr}</td>
        <td class="sl-money">${formatVND(s.total || 0)}</td>
        <td>${pay}</td>
        <td><span class="sl-badge ${st.cls}">${st.label}</span></td>
        <td>${s.date || ''}</td>
        <td>
          <div class="sl-actions">
            <button class="sl-action-btn sl-edit-btn" data-key="${s._key}">✏</button>
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

    wrap.querySelectorAll('.sl-edit-btn').forEach(btn =>
      btn.onclick = () => openForm(btn.dataset.key)
    );
    wrap.querySelectorAll('.sl-del-btn').forEach(btn =>
      btn.onclick = () => softDelete(btn.dataset.key)
    );
    wrap.querySelectorAll('.sl-restore-btn').forEach(btn =>
      btn.onclick = () => restoreItem(btn.dataset.key)
    );

    renderPagination(total, totalPages);
  }

  function renderPagination(total, totalPages) {
    const pg = container.querySelector('#sl-pagination');
    if (!pg || total <= PAGE_SIZE) { if (pg) pg.innerHTML = ''; return; }

    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, total);
    let html = `<span style="margin-right:6px">Hiển thị ${from}–${to} / ${total} đơn</span>`;
    html += `<button class="sl-pg-btn" ${currentPage === 1 ? 'disabled' : ''} data-pg="${currentPage - 1}">‹</button>`;
    const maxP = Math.min(totalPages, 7);
    for (let p = 1; p <= maxP; p++) {
      html += `<button class="sl-pg-btn ${p === currentPage ? 'active' : ''}" data-pg="${p}">${p}</button>`;
    }
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
    const active = allItems.filter(s => !s.deletedAt);
    const todayList  = active.filter(s => (s.date || '').startsWith(todayStr));
    const monthList  = active.filter(s => (s.date || '').startsWith(todayStr.slice(0, 7)));
    const todayRev   = todayList.reduce((s, x) => s + (x.total || 0), 0);
    const monthRev   = monthList.reduce((s, x) => s + (x.total || 0), 0);

    // 7-day bar chart
    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const rev = active.filter(s => (s.date || '').startsWith(ds))
                        .reduce((s, x) => s + (x.total || 0), 0);
      const lbl = ['CN','T2','T3','T4','T5','T6','T7'][d.getDay()];
      days7.push({ ds, rev, lbl });
    }
    const maxRev = Math.max(...days7.map(d => d.rev), 1);

    // Payment split
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
    const ex = key ? allItems.find(s => s._key === key) : null;
    const overlay = container.querySelector('#sl-overlay');
    const modal   = container.querySelector('#sl-modal');

    modal.innerHTML = `
    <div class="sl-modal-header">
      <h3>${ex ? '✏️ Sửa đơn bán hàng' : '➕ Thêm đơn bán hàng'}</h3>
      <button class="sl-close-btn" id="sl-close">✕</button>
    </div>
    <div class="sl-modal-body">
      <div class="sl-form-grid">
        <div class="sl-field">
          <label>Khách hàng</label>
          <input id="sf-customer" value="$x(ex?.customer || '').replace(/"/g, '&quot;')}" placeholder="Tên khách hàng...">
        </div>
        <div class="sl-field">
          <label>Số điện thoại</label>
          <input id="sf-phone" value="${(ex?.phone || '').replace(/"/g, '&quot;')}" placeholder="0901...">
        </div>
        <div class="sl-field">
          <label>Ngày bán</label>
          <input id="sf-date" type="date" value="${ex?.date || todayStr}">
        </div>
        <div class="sl-field">
          <label>Thanh toán</label>
          <select id="sf-pay">
            <option value="cash" ${(!ex?.payMethod || ex?.payMethod === 'cash') ? 'selected' : ''}>💵 Tiền mặt</option>
            <option value="transfer" ${ex?.payMethod === 'transfer' ? 'selected' : ''}>🏦 Chuyển khoản</option>
          </select>
        </div>
        <div class="sl-field">
          <label>Trạng thái</label>
          <select id="sf-status">
            <option value="done"    ${(ex?.status || 'done') === 'done'    ? 'selected' : ''}>✅ Hoàn thành</option>
            <option value="pending" ${ex?.status === 'pending' ? 'selected' : ''}>⏳ Chờ thanh toán</option>
            <option value="cancel"  ${ex?.status === 'cancel'  ? 'selected' : ''}>❌ Đã huỷ</option>
          </select>
        </div>
        <div class="sl-field">
          <label>Ghi chú</label>
          <input id="sf-note" value="${(ex?.note || '').replace(/"/g, '&quot;')}" placeholder="Ghi chú...">
        </div>
      </div>

      <div class="sl-items-label">Sản phẩm</div>
      <div id="sf-rows"></div>
      <button id="sf-add-row" class="sl-add-row-btn">＋ Thêm sản phẩm</button>

      <div class="sl-totals">
        <div class="sl-total-row"><span>Tạm tính:</span><b id="sf-subtotal">0đ</b></div>
        <div class="sl-total-row">
          <span>Giảm thêm:</span>
          <input id="sf-extra-disc" type="number" min="0" value="${ex?.extraDiscount || 0}" style="width:100px">
        </div>
        <div class="sl-total-row sl-total-final">
          <span style="font-weight:700">Tổng cộng:</span>
          <b id="sf-total" style="color:#1d4ed8;font-size:1.05rem">0đ</b>
        </div>
        <div class="sl-total-row">
          <span>Đã trả:</span>
          <input id="sf-paid" type="number" min="0" value="${ex?.paid || 0}" style="width:100px">
        </div>
      </div>
    </div>
    <div class="sl-modal-footer">
      <button class="sl-btn" id="sf-cancel">Huỷ</button>
      ${ex ? `<button class="sl-btn sl-btn-trash" id="sf-del-modal">🗑 Xoá</button>` : ''}
      <button class="sl-btn sl-btn-primary" id="sf-save">💾 Lưu đơn</button>
    </div>`;

    overlay.style.display = 'flex';

    // Add existing product rows (or one blank row)
    const rowsWrap = modal.querySelector('#sf-rows');
    const initRows = ex?.items?.length ? ex.items : [{}];
    initRows.forEach(r => addItemRow(rowsWrap, r));
    recalc();

    modal.querySelector('#sl-close').onclick  = () => { overlay.style.display = 'none'; };
    modal.querySelector('#sf-cancel').onclick  = () => { overlay.style.display = 'none'; };
    modal.querySelector('#sf-add-row').onclick = () => { addItemRow(rowsWrap, {}); };
    modal.querySelector('#sf-extra-disc').oninput = recalc;
    modal.querySelector('#sf-paid').oninput = recalc;
    modal.querySelector('#sf-save').onclick = saveForm;
    if (ex) modal.querySelector('#sf-del-modal').onclick = () => {
      softDelete(key);
      overlay.style.display = 'none';
    };
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

  function hideDrop() {
    if (globalDrop) globalDrop.style.display = 'none';
  }

  // ══════════════════════════════════════════════
  //  ITEM ROW
  // ══════════════════════════════════════════════
  function addItemRow(wrap, data) {
    const row = document.createElement('div');
    row.className = 'sf-item-row';
    row.innerHTML = `
      <input class="sf-name" value="${(data.name || '').replace(/"/g, '&quot;')}" placeholder="Tên sản phẩm..." autocomplete="off" style="flex:1;min-width:0">
      <input class="sf-qty"   type="number" min="1"  value="${data.qty   || 1}"   title="Số lượng">
      <input class="sf-price" type="number" min="0"  value="${data.price || 0}"   title="Đơn giá" style="width:100px">
      <input class="sf-disc"  type="number" min="0"  value="${data.discount || 0}" title="Giảm giá" style="width:75px">
      <span class="sf-line-total">0đ</span>
      <button class="sf-remove-btn" type="button" title="Xoá dòng">✕</button>`;
    wrap.appendChild(row);

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
              <div style="font-size:.82rem;font-weight:600">${p.name || ''}</div>
              <div style="font-size:.72rem;color:#888">${p.id || ''}</div>
            </div>
            <div style="font-size:.8rem;font-weight:700;color:#1a3a6b;white-space:nowrap">${formatVND(p.price || 0)}</div>
          </div>
        </div>`).join('');

      drop.querySelectorAll('.sl-ac-opt').forEach(opt => {
        opt.onmousedown = e => {
          e.preventDefault();
          const p = invItems.find(x => x._key === opt.dataset.key);
          if (p) {
            nameInput.value = p.name || '';
            row.querySelector('.sf-price').value = p.price || 0;
          }
          hideDrop();
          recalc();
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
    const modal = container.querySelector('#sl-modal');
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
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    try {
      if (editKey) {
        await updateItem(COLLECTION, editKey, data);
        toast('Ca��p nhật thành công ✓');
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
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Lưu đơn';
    }
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
    const now = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    // Auto-purge items deleted > 7 days
    all.filter(s => s.deletedAt && (now - s.deletedAt) > WEEK_MS)
       .forEach(s => deleteItem(COLLECTION, s._key).catch(() => {}));
    allItems = all;
    render();
  });

  // Cleanup when leaving this route
  container._cleanup = () => {
    if (unsub) { unsub(); unsub = null; }
    hideDrop();
    if (globalDrop) { globalDrop.remove(); globalDrop = null; }
  };
}
