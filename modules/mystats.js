// modules/mystats.js - "Lợi nhuận của tôi" (mỗi nhân viên xem lợi nhuận do CHÍNH MÌNH làm ra)
// Sửa chữa: tính theo KTV (techName). Bán hàng: tính theo người bán (staff).
// Tính tiền theo NGÀY HOÀN THÀNH: sửa = ngày giao, bán = ngày bán.
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
function _repMs(r) {
  if (r && r.deliveredDate) { const t = new Date(r.deliveredDate + 'T00:00:00').getTime(); if (!isNaN(t)) return t; }
  if (r && r.status === 'Đã giao') { if (r.receivedDate) { const t2 = new Date(r.receivedDate + 'T00:00:00').getTime(); if (!isNaN(t2)) return t2; } return (r.ts || r.createdAt) || 0; }
  return 0;
}
function _saleMs(sl) {
  if (sl && sl.date) { const t = new Date(sl.date + 'T00:00:00').getTime(); if (!isNaN(t)) return t; }
  return (sl.ts || sl.createdAt) || 0;
}

let _chart = null;

export async function mount(container) {
  const me = _me();
  const meLabel = me.name || me.username || 'Tôi';

  container.innerHTML = `
    <div class="module-header"><h2>💰 Lợi nhuận của tôi — ${meLabel}</h2></div>
    <div id="my-period" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn--secondary my-p" data-p="today">Hôm nay</button>
      <button class="btn btn--secondary my-p" data-p="week">Tuần này</button>
      <button class="btn btn--primary my-p" data-p="month">Tháng này</button>
      <button class="btn btn--secondary my-p" data-p="all">Tất cả</button>
    </div>
    <div id="my-cards" class="stats-grid"></div>
    <div class="stat-card" style="margin-top:4px"><div class="stat-label" style="margin-bottom:8px">Lợi nhuận theo ngày</div><div style="position:relative;height:240px"><canvas id="my-chart"></canvas></div></div>
    <div id="my-detail" style="margin-top:14px"></div>
  `;

  let repairs = [], sales = [], products = {};
  try {
    const [r, s, p] = await Promise.all([getAll('repairs'), getAll('sales'), getAll('products')]);
    repairs = (r || []).filter(x => !x.deletedAt && _isMine(x.techName, me));
    sales = (s || []).filter(x => !x.deletedAt && _isMine(x.staff, me));
    (p || []).forEach(x => { products[x._key] = x; });
  } catch (e) {
    container.querySelector('#my-cards').innerHTML = '<p style="color:#e53e3e;padding:1rem">Lỗi tải dữ liệu: ' + e.message + '</p>';
    return;
  }

  const repProfitOf = r => (r.cost || 0) - (r.partsCost || 0) - (r.discount || 0);
  const saleProfitOf = sl => { let cap = 0; (sl.items || []).forEach(it => { const prod = it.invkey ? products[it.invkey] : null; const cost = (prod && prod.cost != null) ? prod.cost : (it.cost || 0); cap += (it.qty || it.quantity || 1) * cost; }); return (sl.total || 0) - cap; };

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
    const repIn = repairs.filter(r => { const ms = _repMs(r); return ms && ms >= from && ms <= to; });
    const saleIn = sales.filter(s => { const ms = _saleMs(s); return ms >= from && ms <= to; });
    const repProfit = repIn.reduce((a, r) => a + repProfitOf(r), 0);
    const saleProfit = saleIn.reduce((a, s) => a + saleProfitOf(s), 0);
    const total = repProfit + saleProfit;

    container.querySelector('#my-cards').innerHTML =
      card(formatVND(total), 'Tổng lợi nhuận của tôi', total >= 0 ? '#16a34a' : '#dc2626') +
      card(formatVND(repProfit), '🔧 Lợi nhuận sửa chữa', '#2563eb') +
      card(formatVND(saleProfit), '🛒 Lợi nhuận bán hàng', '#16a34a') +
      card(repIn.length, 'Số phiếu sửa (đã giao)') +
      card(saleIn.length, 'Số đơn bán');

    // gom lợi nhuận theo ngày
    const byDay = {};
    const add = (ms, val) => { const d = new Date(ms); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); byDay[k] = (byDay[k] || 0) + val; };
    repIn.forEach(r => add(_repMs(r), repProfitOf(r)));
    saleIn.forEach(s => add(_saleMs(s), saleProfitOf(s)));
    const days = Object.keys(byDay).sort();
    try {
      await loadChartJs();
      const cv = container.querySelector('#my-chart'); if (cv) {
        try { if (_chart) _chart.destroy(); } catch (_) {}
        _chart = new Chart(cv.getContext('2d'), {
          type: 'bar',
          data: { labels: days.map(k => k.slice(5)), datasets: [{ label: 'Lợi nhuận', data: days.map(k => byDay[k]), backgroundColor: '#22c55e' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatVND(ctx.parsed.y) } } }, scales: { y: { ticks: { callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v } } } }
        });
      }
    } catch (e) {}

    // chi tiết: liệt kê phiếu/đơn của tôi (gần nhất trước)
    const rows = [];
    repIn.forEach(r => rows.push({ ms: _repMs(r), type: '🔧 Sửa', name: (r.customerName || '') + ' — ' + (r.device || ''), profit: repProfitOf(r) }));
    saleIn.forEach(s => rows.push({ ms: _saleMs(s), type: '🛒 Bán', name: (s.customer || '') + ' — ' + ((s.items || []).map(i => i.name).join(', ')).slice(0, 40), profit: saleProfitOf(s) }));
    rows.sort((a, b) => b.ms - a.ms);
    const det = container.querySelector('#my-detail');
    if (!rows.length) { det.innerHTML = '<p style="color:#888;padding:1rem">Chưa có dữ liệu trong kỳ này.</p>'; return; }
    det.innerHTML = '<table class="data-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>' +
      rows.map(x => { const d = new Date(x.ms); const ds = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); return '<tr><td>' + ds + '</td><td>' + x.type + '</td><td>' + (x.name || '') + '</td><td style="text-align:right;color:' + (x.profit >= 0 ? '#16a34a' : '#dc2626') + ';font-weight:600">' + formatVND(x.profit) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  container.querySelectorAll('.my-p').forEach(b => b.addEventListener('click', () => {
    container.querySelectorAll('.my-p').forEach(x => { x.className = 'btn btn--secondary my-p'; });
    b.className = 'btn btn--primary my-p';
    render(b.dataset.p);
  }));
  render('month');
}
