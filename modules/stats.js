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
        <select id="stats-period">
          <option value="month">Tháng này</option>
          <option value="lastmonth">Tháng trước</option>
          <option value="year">Năm nay</option>
          <option value="all">Tất cả</option>
        </select>
        <button id="stats-refresh" class="btn btn--secondary">↻ Tải lại</button>
      </div>
    </div>
    <div id="stats-content"><p class="loading">Đang tải...</p></div>
  `;

  async function loadStats() {
    const content = container.querySelector('#stats-content');
    content.innerHTML = '<p class="loading">Đang tải...</p>';

    const period = container.querySelector('#stats-period').value;
    const now = new Date();
    let fromTs = 0;

    if (period === 'month') {
      fromTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    } else if (period === 'lastmonth') {
      fromTs = new Date(now.getFullYear(), now.getMonth()-1, 1).getTime();
      const toTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      // filter đặc biệt cho tháng trước
    } else if (period === 'year') {
      fromTs = new Date(now.getFullYear(), 0, 1).getTime();
    }

    const [repairs, sales] = await Promise.all([
      getAll('repairs'),
      getAll('sales'),
    ]);

    const filterByTime = (arr) => fromTs > 0
      ? arr.filter(r => (r.createdAt||0) >= fromTs)
      : arr;

    const rFiltered = filterByTime(repairs);
    const sFiltered = filterByTime(sales);

    // --- Sửa chữa ---
    const repRevenue = rFiltered.reduce((s,r) => s + (Number(r.total)||0), 0);
    const repCapital = rFiltered.reduce((s,r) => s + (Number(r.capital)||0), 0);
    const repDiscount = rFiltered.reduce((s,r) => s + (Number(r.discount)||0), 0);
    const repProfit = repRevenue - repCapital - repDiscount;

    // --- Bán hàng ---
    const saleRevenue = sFiltered.reduce((s,r) => s + (Number(r.price)||0) * (Number(r.qty)||1), 0);
    const saleCost = sFiltered.reduce((s,r) => s + (Number(r.cost)||0) * (Number(r.qty)||1), 0);
    const saleProfit = saleRevenue - saleCost;

    const totalRevenue = repRevenue + saleRevenue;
    const totalProfit = repProfit + saleProfit;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Tổng doanh thu</div>
          <div class="stat-value">${formatVND(totalRevenue)}</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-label">Tổng lợi nhuận</div>
          <div class="stat-value">${formatVND(totalProfit)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Số phiếu sửa</div>
          <div class="stat-value">${rFiltered.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Số đơn bán</div>
          <div class="stat-value">${sFiltered.length}</div>
        </div>
      </div>

      <div class="stats-section">
        <h3>Sửa chữa</h3>
        <table class="data-table">
          <tr><td>Doanh thu</td><td class="cell--money">${formatVND(repRevenue)}</td></tr>
          <tr><td>Vốn linh kiện</td><td class="cell--money text--red">${formatVND(repCapital)}</td></tr>
          <tr><td>Giảm giá</td><td class="cell--money text--red">${formatVND(repDiscount)}</td></tr>
          <tr><td><strong>Lợi nhuận</strong></td><td class="cell--money ${repProfit>=0?'text--green':'text--red'}"><strong>${formatVND(repProfit)}</strong></td></tr>
        </table>
      </div>

      <div class="stats-section">
        <h3>Bán hàng</h3>
        <table class="data-table">
          <tr><td>Doanh thu</td><td class="cell--money">${formatVND(saleRevenue)}</td></tr>
          <tr><td>Vốn hàng</td><td class="cell--money text--red">${formatVND(saleCost)}</td></tr>
          <tr><td><strong>Lợi nhuận</strong></td><td class="cell--money ${saleProfit>=0?'text--green':'text--red'}"><strong>${formatVND(saleProfit)}</strong></td></tr>
        </table>
      </div>
    `;
  }

  container.querySelector('#stats-period').addEventListener('change', loadStats);
  container.querySelector('#stats-refresh').addEventListener('click', loadStats);
  loadStats();
}
