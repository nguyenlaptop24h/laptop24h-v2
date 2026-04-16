// modules/stats.js - Thống kê
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';

registerRoute('#stats', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Thống kê</h2>
      <div class="module-actions">
        <select id="st-period" class="search-input" style="width:160px">
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày qua</option>
          <option value="month" selected>Tháng này</option>
          <option value="last_month">Tháng trước</option>
          <option value="year">Năm nay</option>
          <option value="all">Tất cả</option>
        </select>
        <button id="st-refresh" class="btn btn--secondary">Làm mới</button>
      </div>
    </div>
    <div id="st-content"><p style="padding:1rem;color:#888">Đang tải...</p></div>
  `;

  async function loadStats() {
    const content = document.getElementById('st-content');
    content.innerHTML = '<p style="padding:1rem;color:#888">Đang tải...</p>';
    const period = document.getElementById('st-period').value;
    const { from, to } = getPeriodRange(period);

    try {
      const [repairs, sales, products, customers] = await Promise.all([
        getAll('repairs'),
        getAll('sales'),
        getAll('products'),
        getAll('customers')
      ]);

      // Filter by period (using ts timestamp)
      const repFiltered = repairs.filter(r => inRange(r.ts, from, to));
      const saleFiltered = sales.filter(s => inRange(s.ts, from, to));

      // Repairs stats: profit = cost - capital - discount
      const repRevenue = repFiltered.reduce((s, r) => s + (r.cost || 0), 0);
      const repCapital  = repFiltered.reduce((s, r) => s + (r.capital || 0), 0);
      const repDiscount = repFiltered.reduce((s, r) => s + (r.discount || 0), 0);
      const repProfit   = repRevenue - repCapital - repDiscount;

      // Sales stats: revenue = total, no stored cost per sale
      const saleRevenue = saleFiltered.reduce((s, sl) => s + (sl.total || 0), 0);
      const salePaid    = saleFiltered.reduce((s, sl) => s + (sl.paid || 0), 0);
      const saleDebt    = saleRevenue - salePaid;

      // Inventory stats
      const lowStock   = products.filter(p => (p.stock ?? 0) <= 3);
      const totalStock = products.reduce((s, p) => s + (p.stock || 0) * (p.cost || 0), 0);

      // Status breakdown for repairs
      const statusMap = {};
      repFiltered.forEach(r => {
        statusMap[r.status||'?'] = (statusMap[r.status||'?'] || 0) + 1;
      });

      // Top sold products from sales items
      const productSales = {};
      saleFiltered.forEach(sl => {
        (sl.items || []).forEach(it => {
          if (!it.name) return;
          if (!productSales[it.name]) productSales[it.name] = { qty: 0, revenue: 0 };
          productSales[it.name].qty     += (it.qty || 1);
          productSales[it.name].revenue += (it.price || 0) * (it.qty || 1) - (it.disc || 0);
        });
      });
      const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 5);

      content.innerHTML = `
        <div class="stats-grid">
          <!-- Sửa chữa -->
          <div class="stat-card">
            <div class="stat-label">Doanh thu sửa chữa</div>
            <div class="stat-value">${formatVND(repRevenue)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Lợi nhuận sửa chữa</div>
            <div class="stat-value" style="color:#38a169">${formatVND(repProfit)}</div>
            <div class="stat-sub">Vốn: ${formatVND(repCapital)} | CK: ${formatVND(repDiscount)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Số phiếu sửa</div>
            <div class="stat-value">${repFiltered.length}</div>
          </div>
          <!-- Bán hàng -->
          <div class="stat-card">
            <div class="stat-label">Doanh thu bán hàng</div>
            <div class="stat-value">${formatVND(saleRevenue)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Đã thu / Còn nợ</div>
            <div class="stat-value">${formatVND(salePaid)}</div>
            <div class="stat-sub" style="color:#e53e3e">Nợ: ${formatVND(saleDebt)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Số đơn hàng</div>
            <div class="stat-value">${saleFiltered.length}</div>
          </div>
          <!-- Kho -->
          <div class="stat-card">
            <div class="stat-label">Tổng SP trong kho</div>
            <div class="stat-value">${products.length}</div>
            <div class="stat-sub">Giá trị: ${formatVND(totalStock)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Sắp hết hàng (≤3)</div>
            <div class="stat-value" style="color:${lowStock.length>0?'#e53e3e':'#38a169'}">${lowStock.length} SP</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Tổng khách hàng</div>
            <div class="stat-value">${customers.length}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem">
          <!-- Trạng thái sửa chữa -->
          <div class="form-card">
            <h4 style="margin:0 0 .75rem">Trạng thái phiếu sửa (kỳ đã chọn)</h4>
            ${Object.entries(statusMap).length
              ? Object.entries(statusMap).map(([st, cnt]) =>
                  `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #f0f0f0">
                    <span>${st}</span><strong>${cnt}</strong>
                  </div>`
                ).join('')
              : '<p style="color:#888;margin:0">Không có dữ liệu</p>'
            }
          </div>

          <!-- Top sản phẩm bán -->
          <div class="form-card">
            <h4 style="margin:0 0 .75rem">Top 5 sản phẩm bán chạy (kỳ đã chọn)</h4>
            ${topProducts.length
              ? topProducts.map(([name, d], i) =>
                  `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #f0f0f0">
                    <span>${i+1}. ${name}</span>
                    <span><strong>${d.qty}</strong> cái – ${formatVND(d.revenue)}</span>
                  </div>`
                ).join('')
              : '<p style="color:#888;margin:0">Không có dữ liệu</p>'
            }
          </div>
        </div>

        ${lowStock.length > 0 ? `
          <div class="form-card" style="margin-top:1.5rem">
            <h4 style="margin:0 0 .75rem;color:#e53e3e">⚠ Sản phẩm sắp hết hàng</h4>
            <table class="data-table">
              <thead><tr><th>Mã</th><th>Tên sản phẩm</th><th>Loại</th><th>Tồn kho</th></tr></thead>
              <tbody>
                ${lowStock.map(p => `<tr>
                  <td>${p.id||''}</td>
                  <td>${p.name||''}</td>
                  <td>${p.type||''}</td>
                  <td style="color:#e53e3e;font-weight:600">${p.stock??0}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `;
    } catch(e) {
      content.innerHTML = '<p style="padding:1rem;color:#e53e3e">Lỗi tải dữ liệu: ' + e.message + '</p>';
    }
  }

  function getPeriodRange(period) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch(period) {
      case 'today':
        return { from: today.getTime(), to: Date.now() };
      case 'week':
        return { from: today.getTime() - 6*86400000, to: Date.now() };
      case 'month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Date.now() };
      case 'last_month': {
        const fm = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
        return { from: fm.getTime(), to };
      }
      case 'year':
        return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: Date.now() };
      default:
        return { from: 0, to: Date.now() };
    }
  }

  function inRange(ts, from, to) {
    if (!ts) return false;
    return ts >= from && ts <= to;
  }

  document.getElementById('st-period').addEventListener('change', loadStats);
  document.getElementById('st-refresh').addEventListener('click', loadStats);
  loadStats();
}
