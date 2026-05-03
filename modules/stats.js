// modules/stats.js - Thong ke v7
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';

registerRoute('#stats', mount);

export async function mount(container) {
  container.innerHTML = `
<style>
.st-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;}
.st-panel{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;}
.st-panel h3{margin:0 0 12px;font-size:15px;color:#333;border-bottom:2px solid #e0e0e0;padding-bottom:8px;}
.st-panel h3.rep-hdr{border-color:#2196F3;}
.st-panel h3.sale-hdr{border-color:#4CAF50;}
.st-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f5f5f5;}
.st-row:last-child{border-bottom:none;}
.st-label{color:#666;font-size:13px;}
.st-val{font-size:14px;font-weight:600;color:#333;}
.st-val.green{color:#4CAF50;}
.st-val.red{color:#f44336;}
.st-val.blue{color:#2196F3;}
.st-full{grid-column:1/-1;}
.st-custom{display:none;align-items:center;gap:6px;}
.st-custom.show{display:flex;}
.st-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;}
.st-tbl th{background:#f5f5f5;padding:7px 10px;text-align:left;font-weight:600;color:#555;border-bottom:2px solid #e0e0e0;}
.st-tbl td{padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#333;}
.st-tbl tr:last-child td{border-bottom:none;}
.st-tbl tr:hover td{background:#fafafa;}
.st-tbl .cat-badge{display:inline-block;background:#e3f2fd;color:#1565c0;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600;}
.st-tbl .stock-zero{color:#f44336;font-weight:700;}
.st-tbl .stock-low{color:#ff9800;font-weight:700;}
.st-pg{display:flex;align-items:center;gap:6px;margin-top:10px;justify-content:flex-end;}
.st-pg button{padding:4px 10px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:13px;}
.st-pg button:hover:not(:disabled){background:#f0f0f0;}
.st-pg button:disabled{opacity:0.4;cursor:default;}
.st-pg span{font-size:13px;color:#666;}
@media(max-width:600px){.st-grid{grid-template-columns:1fr;}}
</style>
    <div class="module-header">
      <h2>Thống kê</h2>
      <div class="module-actions" style="flex-wrap:wrap;gap:8px;">
        <select id="st-period" class="search-input" style="width:160px">
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày qua</option>
          <option value="month" selected>Tháng này</option>
          <option value="last_month">Tháng trước</option>
          <option value="year">Năm nay</option>
          <option value="custom">Tùy chọn ngày...</option>
          <option value="all">Tất cả</option>
        </select>
        <div id="st-custom-wrap" class="st-custom">
          <input type="date" id="st-from" class="search-input" style="width:140px">
          <span>—</span>
          <input type="date" id="st-to" class="search-input" style="width:140px">
          <button id="st-apply" class="btn btn--primary" style="padding:5px 12px">Xem</button>
        </div>
        <button id="st-refresh" class="btn btn--secondary">Làm mới</button>
      </div>
    </div>
    <div id="st-content"><p style="padding:1rem;color:#888">Đang tải...</p></div>
  `;

  const periodEl = container.querySelector('#st-period');
  const customWrap = container.querySelector('#st-custom-wrap');
  const fromEl = container.querySelector('#st-from');
  const toEl = container.querySelector('#st-to');

  // Default custom range = today
  const todayStr = new Date().toISOString().slice(0, 10);
  fromEl.value = todayStr;
  toEl.value = todayStr;

  // Pagination state
  let _lowStock = [];
  let _curPage = 1;
  const PAGE_SIZE = 10;

  periodEl.addEventListener('change', () => {
    const isCustom = periodEl.value === 'custom';
    customWrap.classList.toggle('show', isCustom);
    if (!isCustom) loadStats();
  });
  container.querySelector('#st-apply').addEventListener('click', loadStats);
  container.querySelector('#st-refresh').addEventListener('click', loadStats);
  loadStats();

  // ─── helpers ────────────────────────────────────────────
  function getPeriodRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
      case 'today':
        return { from: today.getTime(), to: Date.now() };
      case 'week':
        return { from: today.getTime() - 6 * 86400000, to: Date.now() };
      case 'month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Date.now() };
      case 'last_month': {
        const fm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      2 const to = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
        return { from: fm.getTime(), to };
      }
      case 'year':
     2  return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: Date.now() };
      case 'custom': {
        // Dùng local time để tránh lệch múi giờ UTC+7
        const f = fromEl.value
          ? new Date(fromEl.value + 'T00:00:00').getTime()
          : 0;
        const t = toEl.value
          ? new Date(toEl.value + 'T23:59:59').getTime()
          : Date.now();
        return { from: f, to: t };
      }
      default:
        return { from: 0, to: Date.now() };
    }
  }

  function inRange(ts, from, to) {
    if (!ts) return false;
    return ts >= from && ts <= to;
  }

  // ─── render low-stock table (phân trang) ───────────────
  function renderLowStockTable(page) {
    _curPage = page;
    const total = _lowStock.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const slice = _lowStock.slice(start, start + PAGE_SIZE);

    const rows = slice.map(p => {
      const cat = p.category || p.type || '—';
      const s = p.stock || 0;
      const cls = s === 0 ? 'stock-zero' : 'stock-low';
      return `<tr>
        <td>${p.code || p.id || '—'}</td>
        <td>${p.name || '—'}</td>
        <td><span class="cat-badge">${cat}</span></td>
        <td class="${cls}">${s}</td>
      </tr>`;
    }).join('');

    const wrap = container.querySelector('#st-lowstock-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <table class="st-tbl">
        <thead>
          <tr>
            <th>Mã SP</th>
            <th>Tên sản phẩm</th>
            <th>Danh mục</th>
            <th>Tồn kho</th>
    2     </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="st-pg">
        <button id="st-pg-prev" ${page <= 1 ? 'disabled' : ''}>‹ Trước</button>
        <span>Trang ${page} / ${totalPages} &nbsp;(${total} SP)</span>
        <button id="st-pg-next" ${page >= totalPages ? 'disabled' : ''}>Sau ›</button>
      </div>
    `;

    wrap.querySelector('#st-pg-prev')?.addEventListener('click', () => renderLowStockTable(_curPage - 1));
    wrap.querySelector('#st-pg-next')?.addEventListener('click', () => renderLowStockTable(_curPage + 1));
  }

  // ─── main load ──────────────────────────────────────────
  async function loadStats() {
    const content = container.querySelector('#st-content');
    content.innerHTML = `<p style="padding:1rem;color:#888">Đang tải...</p>`;
    const period = periodEl.value;
    const { from, to } = getPeriodRange(period);

    try {
      const [repairs, sales, products] = await Promise.all([
        getAll('repairs'),
        getAll('sales'),
        getAll('products'),
      ]);

      const repF  = repairs.filter(r => inRange(r.ts || r.createdAt, from, to));
      const saleF = sales.filter(s => inRange(s.ts || s.createdAt, from, to));

      // ── Repairs ──
 2    const repRevenue  = repF.reduce((s, r) => s + (r.cost       || 0), 0);
      const repCapital  = repF.reduce((s, r) => s + (r.partsCost  || 0), 0);
      const repDiscount = repF.reduce((s, r) => s + (r.discount   || 0), 0);
      const repDeposit  = repF.reduce((s, r) => s + (r.deposit    || 0), 0);
      const repProfit   = repRevenue - repCapital - repDiscount;
      const repDebt     = repRevenue - repDeposit - repDiscount;

      const statusMap = {};
      repF.forEach(r => { const k = r.status || 'Tiếp nhận'; statusMap[k] = (statusMap[k] || 0) + 1; });

      // ── Sales ──
      const saleRevenue = saleF.reduce((s, sl) => s + (sl.total || 0), 0);
      const salePaid    = saleF.reduce((s, sl) => s + (sl.paid  || 0), 0);
      const saleDebt    = saleRevenue - salePaid;

      // ── Inventory ──
      // Sắp xếp theo danh mục, rồi theo tên
      _lowStock = products
        .filter(p => (p.stock ?? 0) <= 3 && !p.deletedAt)
        .sort((a, b) => {
          const ca = (a.category || a.type || '').toLowerCase();
          const cb = (b.category || b.type || '').toLowerCase();
          if (ca !== cb) return ca.localeCompare(cb, 'vi');
      2   return (a.name || '').localeCompare(b.name || '', 'vi');
        });
      _curPage = 1;

      const totalStock = products
        .filter(p => !p.deletedAt)
        .reduce((s, p) => s + (p.stock || 0) * (p.cost || 0), 0);

      const lbl = periodEl.options[periodEl.selectedIndex]?.text || '';

      content.innerHTML = `
        <div class="st-grid">

          <!-- ══ SUA CHUA ══ -->
          <div class="st-panel">
            <h3 class="rep-hdr">🔧 Sửa chữa &mdash; ${lbl}</h3>
            <div class="st-row">
              <span class="st-label">Doanh thu</span>
      2      <span class="st-val blue">${formatVND(repRevenue)}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Vốn linh kieện</span>
              <span class="st-val">${formatVND(repCapital)}</span>
            </div>
            <div class="st-row">
 2            <span class="st-label">Chiết khấu</span>
              <span class="st-val">${formatVND(repDiscount)}</span>
            </div>
     2      <div class="st-row" style="border-top:2px solid #e3f2fd;margin-top:4px;padding-top:8px;">
              <span class="st-label" style="font-weight:600">Lợi nhuận</span>
              <span class="st-val ${repProfit >= 0 ? 'green' : 'red'}" style="font-size:15px">${formatVND(repProfit)}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Đã đặt cọc</span>
              <span class="st-val green">${formatVND(repDeposit)}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Còn nợ</span>
   2          <span class="st-val ${repDebt > 0 ? 'red' : ''}">${formatVND(Math.max(0, repDebt))}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Số phiếu</span>
              <span class="st-val">${repF.length}</span>
            </div>
            ${Object.keys(statusMap).length > 0 ? `
            <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd;">
              ${Object.entries(statusMap).map(([k, v]) =>
                `<div class="st-row"><span class="st-label" style="font-size:12px">${k}</span><span style="font-size:12px;font-weight:600">${v}</span></div>`
              ).join('')}
            </div>` : ''}
          </div>

          <!-- ══ BAN HANG ══ -->
          <div class="st-panel">
            <h3 class="sale-hdr">💻 Bán hàng &mdash; ${lbl}</h3>
            <div class="st-row">
            2 <span class="st-label">Doanh thu</span>
              <span class="st-val blue">${formatVND(saleRevenue)}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Đã thu</span>
              <span class="st-val green">${formatVND(salePaid)}</span>
         2  </div>
            <div class="st-row">
              <span class="st-label">Còn nợ</span>
              <span class="st-val ${saleDebt > 0 ? 'red' : ''}">${formatVND(Math.max(0, saleDebt))}</span>
            </div>
            <div class="st-row">
              <span class="st-label">Số đơn hàng</span>
              <span class="st-val">${saleF.length}</span>
            </div>
          </div>

          <!-- ══ KHO HANG ══ -->
          <div class="st-panel st-full">
            <h3>📦 Kho hàng &mdash; Hàng sắp hết (≤3)</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div class="st-row">
                <span class="st-label">Số sản phẩm sắp hết</span>
                <span class="st-val ${_lowStock.length > 0 ? 'red' : 'green'}">${_lowStock.length} sản phẩm</span>
          2   </div>
              <div class="st-row">
                <span class="st-label">Giá trị kho (vốn)</span>
                <span class="st-val">${formatVND(totalStock)}</span>
              </div>
            </div>
            <div id="st-lowstock-wrap"></div>
          </div>

        </div>
      `;

      // Render bảng phân trang
      renderLowStockTable(1);

    } catch (e) {
      content.innerHTML = `<p style="padding:1rem;color:red">Lỗi: ${e.message}</p>`;
    }
  }
}
