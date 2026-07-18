// modules/stats.js - Thong ke v10
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';

registerRoute('#stats', mount);

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

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
.st-chart-wrap{position:relative;height:260px;width:100%;}
@media(max-width:600px){.st-grid{grid-template-columns:1fr;}.st-chart-wrap{height:200px;}}
</style>
    <div class="module-header">
      <h2>Th&#7889;ng k&#234;</h2>
      <div class="module-actions" style="flex-wrap:wrap;gap:8px;">
        <select id="st-period" class="search-input" style="width:160px">
          <option value="today">H&#244;m nay</option>
          <option value="week">7 ng&#224;y qua</option>
          <option value="month" selected>Th&#225;ng n&#224;y</option>
          <option value="last_month">Th&#225;ng tr&#432;&#7899;c</option>
          <option value="year">N&#259;m nay</option>
          <option value="single">Ng&#224;y c&#7909; th&#7875;</option>
          <option value="custom">T&#249; ch&#7885;n ng&#224;y...</option>
          <option value="all">T&#7845;t c&#7843;</option>
        </select>
        <div id="st-single-wrap" class="st-custom">
          <input type="date" id="st-single" class="search-input" style="width:150px">
          <button id="st-apply-single" class="btn btn--primary" style="padding:5px 12px">Xem</button>
        </div>
        <div id="st-custom-wrap" class="st-custom">
          <input type="date" id="st-from" class="search-input" style="width:140px">
          <span>&#8212;</span>
          <input type="date" id="st-to" class="search-input" style="width:140px">
          <button id="st-apply" class="btn btn--primary" style="padding:5px 12px">Xem</button>
        </div>
        <button id="st-refresh" class="btn btn--secondary">L&#224;m m&#7899;i</button>
      </div>
    </div>
    <div id="st-content"><p style="padding:1rem;color:#888">&#272;ang t&#7843;i...</p></div>
  `;

  const periodEl   = container.querySelector('#st-period');
  const customWrap = container.querySelector('#st-custom-wrap');
  const singleWrap = container.querySelector('#st-single-wrap');
  const fromEl     = container.querySelector('#st-from');
  const toEl       = container.querySelector('#st-to');
  const singleEl   = container.querySelector('#st-single');

  const todayStr = new Date().toISOString().slice(0, 10);
  fromEl.value   = todayStr;
  toEl.value     = todayStr;
  singleEl.value = todayStr;

  let _lowStock      = [];
  let _curPage       = 1;
  let _chartInstance = null;
  const PAGE_SIZE    = 10;

  periodEl.addEventListener('change', () => {
    const val = periodEl.value;
    customWrap.classList.toggle('show', val === 'custom');
    singleWrap.classList.toggle('show', val === 'single');
    if (val !== 'custom' && val !== 'single') loadStats();
  });
  container.querySelector('#st-apply').addEventListener('click', loadStats);
  container.querySelector('#st-apply-single').addEventListener('click', loadStats);
  singleEl.addEventListener('change', loadStats);
  container.querySelector('#st-refresh').addEventListener('click', loadStats);
  loadStats();

  // ─── helpers ────────────────────────────────────────────
  function getPeriodRange(period) {
    const now   = new Date();
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
        const to = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
        return { from: fm.getTime(), to };
      }
      case 'year':
        return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: Date.now() };
      case 'single': {
        const d = singleEl.value || todayStr;
        return {
          from: new Date(d + 'T00:00:00').getTime(),
          to:   new Date(d + 'T23:59:59').getTime()
        };
      }
      case 'custom': {
        const f = fromEl.value ? new Date(fromEl.value + 'T00:00:00').getTime() : 0;
        const t = toEl.value   ? new Date(toEl.value   + 'T23:59:59').getTime() : Date.now();
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
  function repMs(r) {
    if (r && r.receivedDate) { var t = new Date(r.receivedDate + 'T00:00:00').getTime(); if (!isNaN(t)) return t; }
    return (r && (r.ts || r.createdAt)) || 0;
  }

  // ─── revenue chart ──────────────────────────────────────
  async function renderRevenueChart(repF, saleF, from, to) {
    const canvas = container.querySelector('#st-chart');
    if (!canvas) return;
    try { await loadChartJs(); } catch (e) {
      canvas.parentElement.innerHTML = '<p style="color:#888;text-align:center;padding:20px">Kh&#244;ng t&#7843;i &#273;&#432;&#7907;c Chart.js</p>';
      return;
    }
    try { if (_chartInstance) { _chartInstance.destroy(); } } catch (_) {}
    _chartInstance = null;

    const diffDays = Math.ceil((to - from) / 86400000);
    const labels = [], repData = [], saleData = [], buckets = [];
    const _ld = dt => { const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,'0'), da=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; };

    if (diffDays <= 1) {
      // Hourly
      const baseDay = new Date(from); baseDay.setHours(0,0,0,0);
      for (let h = 0; h < 24; h++) {
        labels.push(h + ':00');
        const hS = new Date(baseDay); hS.setHours(h,0,0,0);
        const hE = new Date(baseDay); hE.setHours(h,59,59,999);
        buckets.push({ type:'hour', date:_ld(baseDay), from:hS.getTime(), to:hE.getTime() });
        repData.push( repF.filter(r=>inRange(repMs(r), hS.getTime(), hE.getTime())).reduce((s,r)=>s+(r.cost||0),0));
        saleData.push(saleF.filter(s=>inRange(s.ts||s.createdAt, hS.getTime(), hE.getTime())).reduce((s,sl)=>s+(sl.total||0),0));
      }
    } else if (diffDays <= 62) {
      // Daily
      const d0 = new Date(from); d0.setHours(0,0,0,0);
      for (let d = new Date(d0); d.getTime() <= to; d.setDate(d.getDate()+1)) {
        labels.push(d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}));
        const dS = d.getTime(), dE = dS + 86399999;
        buckets.push({ type:'day', date:_ld(d), from:dS, to:dE });
        repData.push( repF.filter(r=>inRange(repMs(r),dS,dE)).reduce((s,r)=>s+(r.cost||0),0));
        saleData.push(saleF.filter(s=>inRange(s.ts||s.createdAt,dS,dE)).reduce((s,sl)=>s+(sl.total||0),0));
      }
    } else {
      // Monthly
      const m0 = new Date(from); m0.setDate(1); m0.setHours(0,0,0,0);
      let cur = new Date(m0);
      while (cur.getTime() <= to) {
        labels.push((cur.getMonth()+1)+'/'+cur.getFullYear());
        const mS = cur.getTime();
        const nx = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
        const mE = nx.getTime()-1;
        buckets.push({ type:'month', from:mS, to:mE });
        repData.push( repF.filter(r=>inRange(repMs(r),mS,mE)).reduce((s,r)=>s+(r.cost||0),0));
        saleData.push(saleF.filter(s=>inRange(s.ts||s.createdAt,mS,mE)).reduce((s,sl)=>s+(sl.total||0),0));
        cur = nx;
      }
    }

    _chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Sửa chữa', data: repData,  backgroundColor:'rgba(33,150,243,0.7)', borderColor:'#2196F3', borderWidth:1 },
          { label: 'Bán hàng',  data: saleData, backgroundColor:'rgba(76,175,80,0.7)',  borderColor:'#4CAF50', borderWidth:1 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (evt) => {
          if (!_chartInstance) return;
          const pts = _chartInstance.getElementsAtEventForMode(evt, 'index', { intersect:false }, true);
          if (!pts.length) return;
          const b = buckets[pts[0].index];
          if (!b) return;
          if (b.type === 'month') {
            periodEl.value = 'custom';
            customWrap.classList.add('show'); singleWrap.classList.remove('show');
            fromEl.value = _ld(new Date(b.from)); toEl.value = _ld(new Date(b.to));
          } else {
            periodEl.value = 'single';
            singleWrap.classList.add('show'); customWrap.classList.remove('show');
            singleEl.value = b.date || _ld(new Date(b.from));
          }
          loadStats();
        },
        onHover: (evt, els) => { if (evt.native && evt.native.target) evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: ctx => ctx.dataset.label+': '+formatVND(ctx.parsed.y) } }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v }
          }
        }
      }
    });
  }

  // ─── low-stock table ────────────────────────────────────
  function renderLowStockTable(page) {
    _curPage = page;
    const total      = _lowStock.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    const start      = (page - 1) * PAGE_SIZE;
    const slice      = _lowStock.slice(start, start + PAGE_SIZE);

    const rows = slice.map(p => {
      const cat = p.category || p.type || '—';
      const s   = p.stock || 0;
      const cls = s === 0 ? 'stock-zero' : 'stock-low';
      return `<tr>
        <td>${p.code||p.id||'—'}</td>
        <td>${p.name||'—'}</td>
        <td><span class="cat-badge">${cat}</span></td>
        <td class="${cls}">${s}</td>
      </tr>`;
    }).join('');

    const wrap = container.querySelector('#st-lowstock-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <table class="st-tbl">
        <thead><tr>
          <th>M&#227; SP</th><th>T&#234;n s&#7843;n ph&#7849;m</th>
          <th>Danh m&#7909;c</th><th>T&#7891;n kho</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="st-pg">
        <button id="st-pg-prev" ${page<=1?'disabled':''}>&#8249; Tr&#432;&#7899;c</button>
        <span>Trang ${page} / ${totalPages} &nbsp;(${total} SP)</span>
        <button id="st-pg-next" ${page>=totalPages?'disabled':''}>Sau &#8250;</button>
      </div>`;
    wrap.querySelector('#st-pg-prev')?.addEventListener('click',()=>renderLowStockTable(_curPage-1));
    wrap.querySelector('#st-pg-next')?.addEventListener('click',()=>renderLowStockTable(_curPage+1));
  }

  // ─── main load ──────────────────────────────────────────
  async function loadStats() {
    const content = container.querySelector('#st-content');
    content.innerHTML = `<p style="padding:1rem;color:#888">&#272;ang t&#7843;i...</p>`;
    const period = periodEl.value;
    const { from, to } = getPeriodRange(period);

    try {
      const [repairs, sales, products, categories] = await Promise.all([
        getAll('repairs'), getAll('sales'), getAll('products'), getAll('categories')
      ]);

      const repF  = repairs.filter(r => !r.deletedAt && inRange(repMs(r), from, to));
      const saleF = sales.filter(s   => !s.deletedAt && inRange(s.ts || s.createdAt, from, to));

      // ── Repairs ──
      const repRevenue  = repF.reduce((s,r)=>s+(r.cost||0),0);
      const repCapital  = repF.reduce((s,r)=>s+(r.partsCost||0),0);
      const repDiscount = repF.reduce((s,r)=>s+(r.discount||0),0);
      const repDeposit  = repF.reduce((s,r)=>s+(r.deposit||0),0);
      const repProfit   = repRevenue - repCapital - repDiscount;
      const repDebt     = repF.filter(r => r.paymentStatus === 'debt').reduce((s,r) => s + Math.max(0, (r.cost||0) - (r.deposit||0) - (r.discount||0)), 0);

      // Đếm phiếu: sinh lời / lợi nhuận = 0 / phiếu bảo hành quay lại
      const repProfitOf = r => (r.cost||0) - (r.partsCost||0) - (r.discount||0);
      const repSucceed  = repF.filter(r => repProfitOf(r) > 0).length;
      const repReturn0  = repF.filter(r => repProfitOf(r) === 0).length;
      const _pdS = v => { if(!v) return null; const d=new Date(String(v).length<=10?String(v)+'T00:00:00':String(v)); return isNaN(d.getTime())?null:d; };
      const repWEndMs = r => { const dd=_pdS(r.deliveredDate); const wm=Number(r.warrantyMonths)||0; if(!dd||wm<=0) return 0; const x=new Date(dd.getTime()); x.setMonth(x.getMonth()+wm); return x.getTime(); };
      const bySerial = {};
      repairs.forEach(r => { if(r.deletedAt) return; const s=(r.serial||'').trim(); if(!s) return; (bySerial[s]=bySerial[s]||[]).push(r); });
      const repWarrantyReturn = repF.filter(r => {
        const s=(r.serial||'').trim(); if(!s) return false;
        const rc=_pdS(r.receivedDate); if(!rc) return false; const rcMs=rc.getTime();
        return (bySerial[s]||[]).some(p => {
          if(p===r) return false;
          if(repProfitOf(p) === 0) return false;   // phiếu LN=0 không phát sinh nghĩa vụ bảo hành
          const prc=_pdS(p.receivedDate); if(!prc) return false;
          return prc.getTime() < rcMs && repWEndMs(p) >= rcMs;
        });
      }).length;

      const statusMap = {};
      repF.forEach(r=>{ const k=r.status||'Tiếp nhận'; statusMap[k]=(statusMap[k]||0)+1; });

      // ── Sales ──
      // Đơn bán lưu sản phẩm theo 'invkey' (= _key của product) → map theo _key
      const productByKey = {};
      products.forEach(p=>{ productByKey[p._key] = p; });

      const saleRevenue = saleF.reduce((s,sl)=>s+(sl.total||0),0);
      // Chỉ đơn "Chờ TT" (pending) mới tính công nợ; đơn "Hoàn thành" coi như đã thu đủ
      const saleDebt    = saleF
        .filter(sl => (sl.status || 'done') === 'pending')
        .reduce((s,sl)=> s + Math.max(0, (sl.total||0) - (sl.paid||0)), 0);
      const salePaid    = saleRevenue - saleDebt;

      let saleCapital = 0;
      for (const sl of saleF) {
        for (const it of (sl.items||[])) {
          const prod = it.invkey ? productByKey[it.invkey] : null;
          const cost = (prod && prod.cost != null) ? prod.cost : (it.cost || 0);
          saleCapital += (it.qty || it.quantity || 1) * cost;
        }
      }
      const saleProfit = saleRevenue - saleCapital;

      // ── Inventory ──
      _lowStock = products
        .filter(p=>(p.stock??0)<=3 && !p.deletedAt)
        .sort((a,b)=>{
          const ca=(a.category||a.type||'').toLowerCase();
          const cb=(b.category||b.type||'').toLowerCase();
          if(ca!==cb) return ca.localeCompare(cb,'vi');
          return (a.name||'').localeCompare(b.name||'','vi');
        });
      _curPage = 1;

      const totalStock = products
        .filter(p=>!p.deletedAt)
        .reduce((s,p)=>s+(p.stock||0)*(p.cost||0),0);

      // ── Hàng còn tồn — phân loại theo danh mục gốc ──
      const catMap = {}; categories.forEach(c=>{ catMap[c._key]=c; });
      const rootCatName = (key)=>{
        let c = catMap[key]; if(!c) return 'Chưa phân loại';
        let g=0; while(c && c.parentKey && catMap[c.parentKey] && g<20){ c=catMap[c.parentKey]; g++; }
        return (c && c.name) ? c.name : 'Chưa phân loại';
      };

      // ── Bán hàng: tách LAPTOP riêng, phần còn lại "Khác" ──
      const isLaptopCat = (key)=> /laptop/i.test(rootCatName(key));
      let lapRev=0, lapCap=0, lapQty=0, othRev=0, othCap=0, othQty=0;
      for (const sl of saleF) {
        for (const it of (sl.items||[])) {
          const prod = it.invkey ? productByKey[it.invkey] : null;
          const cost = (prod && prod.cost != null) ? prod.cost : (it.cost || 0);
          const qty  = (it.qty || it.quantity || 1);
          const rev  = Math.max(0, qty*(it.price||0) - (it.discount||0));
          const cap  = qty*cost;
          if (prod && isLaptopCat(prod.categoryKey)) { lapRev+=rev; lapCap+=cap; lapQty+=qty; }
          else { othRev+=rev; othCap+=cap; othQty+=qty; }
        }
      }
      const inStock = products.filter(p=>!p.deletedAt && (p.stock||0)>0);
      const invItems = inStock.length;
      const invQty = inStock.reduce((s,p)=>s+(p.stock||0),0);
      const invVon = inStock.reduce((s,p)=>s+(p.stock||0)*(p.cost||0),0);
      const invBan = inStock.reduce((s,p)=>s+(p.stock||0)*(p.price||0),0);
      const invGroups = {};
      inStock.forEach(p=>{
        const g = rootCatName(p.categoryKey);
        if(!invGroups[g]) invGroups[g]={items:0,qty:0,von:0,ban:0,list:[]};
        const st=p.stock||0;
        invGroups[g].items++; invGroups[g].qty+=st;
        invGroups[g].von+=st*(p.cost||0); invGroups[g].ban+=st*(p.price||0);
        invGroups[g].list.push(p);
      });
      const invGKeys = Object.keys(invGroups).sort((a,b)=>invGroups[b].von-invGroups[a].von);
      const invCatRows = invGKeys.map(g=>`<tr>
          <td>${g}</td>
          <td style="text-align:center">${invGroups[g].items}</td>
          <td style="text-align:center">${invGroups[g].qty}</td>
          <td style="text-align:right">${formatVND(invGroups[g].von)}</td>
          <td style="text-align:right">${formatVND(invGroups[g].ban)}</td>
        </tr>`).join('') +
        `<tr style="font-weight:700;border-top:2px solid #bbb;background:#fafafa">
          <td>T&#7892;NG</td><td style="text-align:center">${invItems}</td><td style="text-align:center">${invQty}</td>
          <td style="text-align:right">${formatVND(invVon)}</td><td style="text-align:right">${formatVND(invBan)}</td>
        </tr>`;
      const invDetail = invGKeys.map(g=>{
        const prows = invGroups[g].list.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','vi'))
          .map(p=>`<tr><td>${p.id||'&mdash;'}</td><td>${p.name||'&mdash;'}</td><td style="text-align:center">${p.stock||0}</td><td style="text-align:right">${formatVND((p.stock||0)*(p.cost||0))}</td><td style="text-align:right">${formatVND(p.price||0)}</td></tr>`).join('');
        return `<details style="margin:4px 0;border:1px solid #eee;border-radius:6px;padding:4px 8px">
          <summary style="cursor:pointer;font-weight:600">${g} &middot; ${invGroups[g].items} m&#7863;t h&#224;ng &middot; ${invGroups[g].qty} c&#225;i &middot; v&#7889;n ${formatVND(invGroups[g].von)}</summary>
          <table class="st-tbl" style="margin-top:6px"><thead><tr><th>M&#227;</th><th>T&#234;n</th><th>T&#7891;n</th><th>V&#7889;n</th><th>&#272;&#417;n gi&#225; b&#225;n</th></tr></thead><tbody>${prows}</tbody></table>
        </details>`;
      }).join('');

      let lbl = periodEl.options[periodEl.selectedIndex]?.text || '';
      if (period==='single' && singleEl.value)
        lbl = new Date(singleEl.value+'T00:00:00').toLocaleDateString('vi-VN');

      content.innerHTML = `
        <div class="st-grid">

          <!-- BIEU DO -->
          <div class="st-panel st-full">
            <h3>&#128200; Bi&#7875;u &#273;&#7891; doanh thu &mdash; ${lbl} <span style="font-weight:400;font-size:11px;color:#888">(b&#7845;m v&#224;o c&#7897;t &#273;&#7875; xem chi ti&#7871;t ng&#224;y &#273;&#243;)</span></h3>
            <div class="st-chart-wrap"><canvas id="st-chart"></canvas></div>
          </div>

          <!-- SUA CHUA -->
          <div class="st-panel">
            <h3 class="rep-hdr">&#128295; S&#7917;a ch&#7919;a &mdash; ${lbl}</h3>
            <div class="st-row"><span class="st-label">Doanh thu</span><span class="st-val blue">${formatVND(repRevenue)}</span></div>
            <div class="st-row"><span class="st-label">V&#7889;n linh ki&#7879;n</span><span class="st-val">${formatVND(repCapital)}</span></div>
            <div class="st-row" style="border-top:2px solid #e3f2fd;margin-top:4px;padding-top:8px;">
              <span class="st-label" style="font-weight:600">L&#7907;i nhu&#7853;n</span>
              <span class="st-val ${repProfit>=0?'green':'red'}" style="font-size:15px">${formatVND(repProfit)}</span>
            </div>
            <div class="st-row"><span class="st-label">C&#242;n n&#7907;</span><span class="st-val ${repDebt>0?'red':''}">${formatVND(Math.max(0,repDebt))}</span></div>
            <div class="st-row"><span class="st-label">S&#7889; phi&#7871;u</span><span class="st-val">${repF.length}</span></div>
            <div class="st-row"><span class="st-label">&#10004; Th&#224;nh c&#244;ng (sinh l&#7901;i)</span><span class="st-val green">${repSucceed}</span></div>
            <div class="st-row"><span class="st-label">&#8617; S&#7889; m&#225;y tr&#7843; (LN=0)</span><span class="st-val">${repReturn0}</span></div>
            <div class="st-row"><span class="st-label">&#128737;&#65039; S&#7889; phi&#7871;u b&#7843;o h&#224;nh (quay l&#7841;i)</span><span class="st-val ${repWarrantyReturn>0?'red':''}">${repWarrantyReturn}</span></div>
            ${Object.keys(statusMap).length>0?`
            <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd;">
              ${Object.entries(statusMap).map(([k,v])=>`<div class="st-row"><span class="st-label" style="font-size:12px">${k}</span><span style="font-size:12px;font-weight:600">${v}</span></div>`).join('')}
            </div>`:''}
          </div>

          <!-- BAN HANG -->
          <div class="st-panel">
            <h3 class="sale-hdr">&#128187; B&#225;n h&#224;ng &mdash; ${lbl}</h3>
            <div class="st-row"><span class="st-label">Doanh thu</span><span class="st-val blue">${formatVND(saleRevenue)}</span></div>
            <div class="st-row"><span class="st-label">Gi&#225; v&#7889;n h&#224;ng b&#225;n</span><span class="st-val">${formatVND(saleCapital)}</span></div>
            <div class="st-row" style="border-top:2px solid #e8f5e9;margin-top:4px;padding-top:8px;">
              <span class="st-label" style="font-weight:600">L&#7907;i nhu&#7853;n</span>
              <span class="st-val ${saleProfit>=0?'green':'red'}" style="font-size:15px">${formatVND(saleProfit)}</span>
            </div>
            <div class="st-row"><span class="st-label">&#272;&#227; thu</span><span class="st-val green">${formatVND(salePaid)}</span></div>
            <div class="st-row"><span class="st-label">C&#242;n n&#7907;</span><span class="st-val ${saleDebt>0?'red':''}">${formatVND(Math.max(0,saleDebt))}</span></div>
            <div class="st-row"><span class="st-label">S&#7889; &#273;&#417;n h&#224;ng</span><span class="st-val">${saleF.length}</span></div>
            <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd">
              <div style="font-weight:700;font-size:12px;color:#555;margin-bottom:5px">Ph&#226;n lo&#7841;i s&#7843;n ph&#7849;m</div>
              <table class="st-tbl" style="margin-top:0">
                <thead><tr><th>Lo&#7841;i</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Gi&#225; v&#7889;n</th><th style="text-align:right">L&#7907;i nhu&#7853;n</th><th style="text-align:center">SL</th></tr></thead>
                <tbody>
                  <tr><td>&#128187; Laptop</td><td style="text-align:right">${formatVND(lapRev)}</td><td style="text-align:right">${formatVND(lapCap)}</td><td style="text-align:right;color:#4CAF50;font-weight:600">${formatVND(lapRev-lapCap)}</td><td style="text-align:center">${lapQty}</td></tr>
                  <tr><td>&#128230; Kh&#225;c</td><td style="text-align:right">${formatVND(othRev)}</td><td style="text-align:right">${formatVND(othCap)}</td><td style="text-align:right;color:#4CAF50;font-weight:600">${formatVND(othRev-othCap)}</td><td style="text-align:center">${othQty}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- KHO HANG -->
          <div class="st-panel st-full">
            <h3>&#128230; Kho h&#224;ng &mdash; H&#224;ng s&#7855;p h&#7871;t (&#8804;3)</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div class="st-row"><span class="st-label">S&#7889; s&#7843;n ph&#7849;m s&#7855;p h&#7871;t</span><span class="st-val ${_lowStock.length>0?'red':'green'}">${_lowStock.length} s&#7843;n ph&#7849;m</span></div>
              <div class="st-row"><span class="st-label">Gi&#225; tr&#7883; kho (v&#7889;n)</span><span class="st-val">${formatVND(totalStock)}</span></div>
            </div>
            <div id="st-lowstock-wrap"></div>
          </div>

          <!-- HANG CON TON THEO DANH MUC -->
          <div class="st-panel st-full">
            <h3>&#128230; H&#224;ng c&#242;n t&#7891;n &mdash; ph&#226;n lo&#7841;i theo danh m&#7909;c</h3>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
              <div class="st-row"><span class="st-label">M&#7863;t h&#224;ng c&#242;n t&#7891;n</span><span class="st-val">${invItems}</span></div>
              <div class="st-row"><span class="st-label">T&#7893;ng s&#7889; l&#432;&#7907;ng</span><span class="st-val">${invQty}</span></div>
              <div class="st-row"><span class="st-label">Gi&#225; tr&#7883; v&#7889;n</span><span class="st-val">${formatVND(invVon)}</span></div>
              <div class="st-row"><span class="st-label">Gi&#225; tr&#7883; b&#225;n</span><span class="st-val blue">${formatVND(invBan)}</span></div>
            </div>
            <table class="st-tbl">
              <thead><tr><th>Danh m&#7909;c</th><th>M&#7863;t h&#224;ng</th><th>SL t&#7891;n</th><th>Gi&#225; tr&#7883; v&#7889;n</th><th>Gi&#225; tr&#7883; b&#225;n</th></tr></thead>
              <tbody>${invCatRows}</tbody>
            </table>
            <div style="margin-top:12px;font-weight:600;color:#555">Chi ti&#7871;t theo danh m&#7909;c (b&#7845;m &#273;&#7875; m&#7903;):</div>
            ${invDetail || '<p style="color:#888;padding:6px 0">Kh&#244;ng c&#243; h&#224;ng t&#7891;n.</p>'}
          </div>

        </div>`;

      renderLowStockTable(1);
      renderRevenueChart(repF, saleF, from, to);

    } catch (e) {
      content.innerHTML = `<p style="padding:1rem;color:red">L&#7895;i: ${e.message}</p>`;
    }
  }
}
