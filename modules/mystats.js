// modules/mystats.js - "Lợi nhuận của tôi" (dành cho KỸ THUẬT VIÊN)
// Chỉ thống kê LỢI NHUẬN SỬA CHỮA do chính KTV đó làm (khớp theo tên KTV).
// Tính theo NGÀY HOÀN THÀNH (ngày giao máy), KHÔNG tính theo ngày tạo phiếu.
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';

registerRoute('#mystats', mount);

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

const _noAcc = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().trim();

function _me() {
  try { const u = JSON.parse(sessionStorage.getItem('laptop24h_user') || '{}'); return { name: u.name || '', username: u.username || '' }; } catch (e) { return { name: '', username: '' }; }
}
function _isMine(name, me) {
  const n = _noAcc(name); if (!n) return false;
  return n === _noAcc(me.name) || n === _noAcc(me.username);
}
// Tính tiền khi đơn ĐÃ XONG ("Hoàn thành" hoặc "Đã giao").
// Ngày tính = ngày hoàn thành (ưu tiên), rồi ngày giao, rồi ngày nhận. Chưa xong → không tính.
function _repMs(r) {
  if (!r) return 0;
  const st = r.status || '';
  if (st !== 'Hoàn thành' && st !== 'Đã giao') return 0;
  const ds = r.completedDate || r.deliveredDate || r.receivedDate || '';
  if (ds) { const t = new Date(ds + 'T00:00:00').getTime(); if (!isNaN(t)) return t; }
  return (r.ts || r.createdAt) || 0;
}
const _repProfit = r => (r.cost || 0) - (r.partsCost || 0) - (r.discount || 0);

let _chart = null;

export async function mount(container) {
  const me = _me();
  const meLabel = me.name || me.username || 'Tôi';

  container.innerHTML = `
    <div class="module-header"><h2>🔧 Lợi nhuận sửa chữa của tôi — ${meLabel}</h2></div>
    <div id="my-period" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn--secondary my-p" data-p="today">Hôm nay</button>
      <button class="btn btn--secondary my-p" data-p="week">Tuần này</button>
      <button class="btn btn--primary my-p" data-p="month">Tháng này</button>
      <button class="btn btn--secondary my-p" data-p="all">Tất cả</button>
    </div>
    <div id="my-cards" class="stats-grid"></div>
    <div class="stat-card" style="margin-top:4px"><div class="stat-label" style="margin-bottom:8px">Lợi nhuận theo ngày giao</div><div style="position:relative;height:240px"><canvas id="my-chart"></canvas></div></div>
    <div id="my-detail" style="margin-top:14px"></div>
  `;

  let repairs = [];
  try {
    const r = await getAll('repairs');
    // Chỉ lấy phiếu của chính mình, đã giao (có tính tiền)
    repairs = (r || []).filter(x => !x.deletedAt && _isMine(x.techName, me) && _repMs(x) > 0);
  } catch (e) {
    container.querySelector('#my-cards').innerHTML = '<p style="color:#e53e3e;padding:1rem">Lỗi tải dữ liệu: ' + e.message + '</p>';
    return;
  }

  function range(period) {
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    let from, to = Date.now();
    if (period === 'today') from = new Date(y, m, d).getTime();
    else if (period === 'week') { const dow = (now.getDay() + 6) % 7; from = new Date(y, m, d - dow).getTime(); }
    else if (period === 'month') from = new Date(y, m, 1).getTime();
    else from = 0;
    return { from, to };
  }
  function card(v, l, color) { return `<div class="stat-card"><div class="stat-value" style="${color ? 'color:' + color : ''}">${v}</div><div class="stat-label">${l}</div></div>`; }

  async function render(period) {
    const { from, to } = range(period);
    const list = repairs.filter(r => { const ms = _repMs(r); return ms >= from && ms <= to; });
    const profit = list.reduce((a, r) => a + _repProfit(r), 0);
    const revenue = list.reduce((a, r) => a + (r.cost || 0), 0);
    const capital = list.reduce((a, r) => a + (r.partsCost || 0), 0);

    container.querySelector('#my-cards').innerHTML =
      card(formatVND(profit), 'Tổng lợi nhuận của tôi', profit >= 0 ? '#16a34a' : '#dc2626') +
      card(formatVND(revenue), 'Doanh thu sửa', '#2563eb') +
      card(formatVND(capital), 'Vốn linh kiện') +
      card(list.length, 'Số phiếu (đã giao)');

    // gom theo ngày giao
    const byDay = {};
    list.forEach(r => { const d = new Date(_repMs(r)); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); byDay[k] = (byDay[k] || 0) + _repProfit(r); });
    const days = Object.keys(byDay).sort();
    try {
      await loadChartJs();
      const cv = container.querySelector('#my-chart'); if (cv) {
        try { if (_chart) _chart.destroy(); } catch (_) {}
        _chart = new Chart(cv.getContext('2d'), {
          type: 'bar',
          data: { labels: days.map(k => k.slice(5)), datasets: [{ label: 'Lợi nhuận', data: days.map(k => byDay[k]), backgroundColor: '#2563eb' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatVND(ctx.parsed.y) } } }, scales: { y: { ticks: { callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v } } } }
        });
      }
    } catch (e) {}

    const rows = list.map(r => ({ ms: _repMs(r), name: (r.customerName || '') + ' — ' + (r.device || '') + (r.repairRequest ? (' — ' + r.repairRequest) : (r.issue ? (' — ' + r.issue) : '')), profit: _repProfit(r) }));
    rows.sort((a, b) => b.ms - a.ms);
    const det = container.querySelector('#my-detail');
    if (!rows.length) { det.innerHTML = '<p style="color:#888;padding:1rem">Chưa có phiếu nào đã giao trong kỳ này.</p>'; return; }
    det.innerHTML = '<table class="data-table"><thead><tr><th>Ngày giao</th><th>Nội dung</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>' +
      rows.map(x => { const d = new Date(x.ms); const ds = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); return '<tr><td>' + ds + '</td><td>' + (x.name || '') + '</td><td style="text-align:right;color:' + (x.profit >= 0 ? '#16a34a' : '#dc2626') + ';font-weight:600">' + formatVND(x.profit) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  container.querySelectorAll('.my-p').forEach(b => b.addEventListener('click', () => {
    container.querySelectorAll('.my-p').forEach(x => { x.className = 'btn btn--secondary my-p'; });
    b.className = 'btn btn--primary my-p';
    render(b.dataset.p);
  }));
  render('month');
}
