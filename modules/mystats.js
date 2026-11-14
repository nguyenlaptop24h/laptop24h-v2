// modules/mystats.js - "Lợi nhuận của tôi" (dành cho KỸ THUẬT VIÊN)
// Chỉ thống kê LỢI NHUẬN SỬA CHỮA do chính KTV đó làm (khớp theo tên KTV).
// Tính khi đơn ĐÃ XONG ("Hoàn thành" hoặc "Đã giao"), theo NGÀY HOÀN THÀNH (ưu tiên),
// rồi ngày giao, rồi ngày nhận — KHÔNG tính theo ngày tạo phiếu.
// Admin xem được thống kê của từng nhân viên (chọn ở ô "Xem của").
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';
import { canViewStats } from '../core/auth.js';

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
function _isMine(name, who) {
  const n = _noAcc(name); if (!n) return false;
  return n === _noAcc(who.name) || n === _noAcc(who.username);
}
// Ngày tính = ngày HOÀN THÀNH (ưu tiên) → ngày NHẬN. KHÔNG dùng ngày giao,
// để bấm "Đã giao" trễ không làm lệch thống kê. Chưa xong → không tính.
function _repMs(r) {
  if (!r) return 0;
  const st = r.status || '';
  if (st !== 'Hoàn thành' && st !== 'Đã giao') return 0;
  const ds = r.completedDate || r.receivedDate || '';
  if (ds) { const t = new Date(ds + 'T00:00:00').getTime(); if (!isNaN(t)) return t; }
  return (r.ts || r.createdAt) || 0;
}
const _repProfit = r => (r.cost || 0) - (r.partsCost || 0) - (r.discount || 0);
const _ddmm = s => { if (!s && s !== 0) return '--'; const d = (typeof s === 'number') ? new Date(s) : new Date(String(s).length <= 10 ? String(s) + 'T00:00:00' : String(s)); if (isNaN(d.getTime())) return '--'; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

let _chart = null;

export async function mount(container) {
  const me = _me();
  const admin = canViewStats();

  let allReps = [], users = [];
  try {
    allReps = (await getAll('repairs')) || [];
  } catch (e) {
    container.innerHTML = '<p style="color:#e53e3e;padding:1rem">Lỗi tải dữ liệu: ' + e.message + '</p>';
    return;
  }
  if (admin) { try { users = (await getAll('users')) || []; } catch (e) {} }

  // Người đang xem (target). Nhân viên thường = chính mình. Admin có thể chọn.
  let target = { name: me.name, username: me.username };

  // Danh sách nhân viên cho admin chọn
  let empOptions = '';
  if (admin) {
    const list = users.slice().sort((a, b) => String(a.name || a.username || '').localeCompare(String(b.name || b.username || ''), 'vi'));
    const hasMe = list.some(u => (u.username || '') === me.username);
    if (!hasMe && (me.name || me.username)) empOptions += '<option value="' + (me.username || '') + '" selected>' + (me.name || me.username) + ' (tôi)</option>';
    list.forEach(u => {
      const val = (u.username || u.name || '');
      const lbl = (u.name || u.username || '') + (u.username === me.username ? ' (tôi)' : '');
      empOptions += '<option value="' + String(val).replace(/"/g, '&quot;') + '"' + (u.username === me.username ? ' selected' : '') + '>' + lbl + '</option>';
    });
  }
  const meLabel = target.name || target.username || 'Tôi';

  container.innerHTML = `
    <div class="module-header"><h2>🔧 Lợi nhuận sửa chữa${admin ? '' : ' của tôi'} — <span id="my-who">${meLabel}</span></h2></div>
    ${admin ? '<div style="margin-bottom:10px"><label style="font-size:13px;color:#555;margin-right:6px;font-weight:600">👤 Xem của:</label><select id="my-emp" style="padding:7px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;min-width:200px">' + empOptions + '</select></div>' : ''}
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

  let curPeriod = 'month';

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

  async function render() {
    // phiếu của người đang xem, đã xong
    const mine = allReps.filter(x => !x.deletedAt && _isMine(x.techName, target) && _repMs(x) > 0);
    const { from, to } = range(curPeriod);
    const list = mine.filter(r => { const ms = _repMs(r); return ms >= from && ms <= to; });
    const profit = list.reduce((a, r) => a + _repProfit(r), 0);
    const revenue = list.reduce((a, r) => a + (r.cost || 0), 0);
    const capital = list.reduce((a, r) => a + (r.partsCost || 0), 0);

    container.querySelector('#my-cards').innerHTML =
      card(formatVND(profit), 'Tổng lợi nhuận', profit >= 0 ? '#16a34a' : '#dc2626') +
      card(formatVND(revenue), 'Doanh thu sửa', '#2563eb') +
      card(formatVND(capital), 'Vốn linh kiện') +
      card(list.length, 'Số phiếu (đã xong)');

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

    const rows = list.map(r => ({
      ms: _repMs(r),
      received: r.receivedDate || '',
      name: (r.customerName || '') + ' — ' + (r.device || '') + (r.repairRequest ? (' — ' + r.repairRequest) : (r.issue ? (' — ' + r.issue) : '')),
      status: r.status || '',
      profit: _repProfit(r)
    }));
    rows.sort((a, b) => b.ms - a.ms);
    const det = container.querySelector('#my-detail');
    if (!rows.length) { det.innerHTML = '<p style="color:#888;padding:1rem">Chưa có phiếu nào đã xong trong kỳ này.</p>'; return; }
    det.innerHTML = '<table class="data-table"><thead><tr><th>Ngày nhận</th><th>Ngày xong</th><th>Nội dung</th><th style="text-align:right">Lợi nhuận</th></tr></thead><tbody>' +
      rows.map(x => '<tr><td>' + _ddmm(x.received) + '</td><td>' + _ddmm(x.ms) + '</td><td>' + (x.name || '') + '</td><td style="text-align:right;color:' + (x.profit >= 0 ? '#16a34a' : '#dc2626') + ';font-weight:600">' + formatVND(x.profit) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  if (admin) {
    const sel = container.querySelector('#my-emp');
    if (sel) sel.addEventListener('change', () => {
      const u = users.find(x => (x.username || x.name || '') === sel.value) || {};
      target = { name: u.name || '', username: u.username || (u.name ? '' : sel.value) };
      if (!u.name && !u.username) { target = { name: me.name, username: me.username }; }
      container.querySelector('#my-who').textContent = u.name || u.username || sel.value || meLabel;
      render();
    });
  }

  container.querySelectorAll('.my-p').forEach(b => b.addEventListener('click', () => {
    container.querySelectorAll('.my-p').forEach(x => { x.className = 'btn btn--secondary my-p'; });
    b.className = 'btn btn--primary my-p';
    curPeriod = b.dataset.p;
    render();
  }));
  render();
}
