// modules/warranty.js - Bảo hành (còn hạn) v1
import { registerRoute } from '../core/router.js';
import { getAll } from '../core/db.js';
import { formatVND } from '../core/ui.js';

registerRoute('#warranty', mount);

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function pd(s){
  if(!s && s!==0) return null;
  if(typeof s === 'number'){ const d=new Date(s); return isNaN(d.getTime())?null:d; }
  s=String(s).trim(); if(!s) return null;
  const d=new Date(s.length<=10 ? s+'T00:00:00' : s);
  return isNaN(d.getTime())?null:d;
}
function addMonths(d,m){ const x=new Date(d.getTime()); x.setMonth(x.getMonth()+Number(m||0)); return x; }
function fmtDate(d){ if(!d) return '—'; return d.toLocaleDateString('vi-VN'); }
function daysLeftBadge(ms, todayMs){
  const dl = Math.ceil((ms - todayMs)/86400000);
  let color = '#16a34a';
  if(dl <= 7) color='#dc2626'; else if(dl <= 30) color='#f59e0b';
  return '<span style="color:'+color+';font-weight:700;white-space:nowrap">còn '+dl+' ngày</span>';
}

export async function mount(container){
  container.innerHTML = `
<style>
.bh-tabs{display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap}
.bh-tabs button{padding:8px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#334155}
.bh-tabs button.active{background:#2563eb;color:#fff;border-color:#2563eb}
.bh-search{width:100%;max-width:420px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:10px}
.bh-tbl{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
.bh-tbl th{background:#eff6ff;padding:8px 10px;text-align:left;font-weight:700;color:#1e40af;border-bottom:2px solid #dbeafe;position:sticky;top:0}
.bh-tbl td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:top}
.bh-tbl tr:hover td{background:#f8fafc}
.bh-count{font-size:13px;color:#64748b;margin-bottom:8px}
.bh-empty{padding:18px;text-align:center;color:#94a3b8}
.bh-wrap{max-height:64vh;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
</style>
    <div class="module-header"><h2>🛡️ Bảo hành (còn hạn)</h2></div>
    <div class="bh-tabs">
      <button id="bh-tab-rep" class="active">🔧 Phiếu sửa chữa</button>
      <button id="bh-tab-sale">🛒 Phiếu bán hàng</button>
    </div>
    <input id="bh-search" class="bh-search" placeholder="🔍 Tìm khách hàng, SĐT, serial, sản phẩm...">
    <div id="bh-content"><p class="bh-empty">Đang tải...</p></div>
  `;

  const today = new Date(); today.setHours(0,0,0,0); const todayMs = today.getTime();
  let repRows = [], saleRows = [], tab = 'rep';

  const [repairs, sales, products] = await Promise.all([getAll('repairs'), getAll('sales'), getAll('products')]);
  const prodByKey = {}; products.forEach(p => { prodByKey[p._key] = p; });
  const wmonths = w => { const m = String(w == null ? '' : w).toLowerCase(); if(/kh[ôo]ng/.test(m)) return 0; const ny=m.match(/(\d+)\s*n[ăa]m/); if(ny) return parseInt(ny[1])*12; const mo=m.match(/(\d+)\s*th[áa]ng/); if(mo) return parseInt(mo[1]); const n=m.match(/\d+/); return n?parseInt(n[0]):0; };
  // Số tháng bảo hành thực tế = MAX của: BH nội dung sửa (text) + từng dịch vụ + từng linh kiện (lấy kho nếu trống). KHÔNG dùng warrantyMonths cũ.
  const repMonths = r => {
    const arr = [ wmonths(r.warranty) ];
    (r.servicesUsed||[]).forEach(s => arr.push(Number(s.warrantyMonths)||0));
    (r.partsUsed||[]).forEach(p => { let m=Number(p.warrantyMonths)||0; if(!m && p.invKey && prodByKey[p.invKey]) m=wmonths(prodByKey[p.invKey].warranty); arr.push(m); });
    return Math.max(0, ...arr);
  };

  // ─── Phiếu sửa chữa còn bảo hành ───
  repairs.forEach(r => {
    if (r.deletedAt) return;
    // Lợi nhuận = 0 (máy trả, không sửa) → không phát sinh nghĩa vụ bảo hành
    if (((r.cost||0) - (r.partsCost||0) - (r.discount||0)) === 0) return;
    const dd = pd(r.deliveredDate);
    if (!dd) return;                            // chưa giao máy
    const months = repMonths(r);
    if (months <= 0) return;                    // để trống bảo hành = không bảo hành
    const end = addMonths(dd, months);
    if (end.getTime() < todayMs) return;        // đã hết hạn
    repRows.push({
      customer: r.customerName || '', phone: r.phone || '',
      device: r.device || '', serial: r.serial || '', content: r.repairRequest || '',
      delivered: dd, months, end,
      search: ((r.customerName||'')+' '+(r.phone||'')+' '+(r.device||'')+' '+(r.serial||'')+' '+(r.repairRequest||'')).toLowerCase()
    });
  });
  repRows.sort((a,b)=> b.end.getTime() - a.end.getTime());

  // ─── Phiếu bán hàng còn bảo hành (theo từng sản phẩm có bhDate) ───
  sales.forEach(s => {
    if (s.deletedAt) return;
    const sd = pd(s.date) || pd(s.createdAt);
    (s.items || []).forEach(it => {
      // Hết BH = ngày nhập (bhDate); nếu trống & hàng trong kho → ngày bán + số tháng BH của SP
      let end = pd(it.bhDate);
      if (!end && it.invkey && prodByKey[it.invkey] && sd) {
        const wm = wmonths(prodByKey[it.invkey].warranty);
        if (wm > 0) { end = new Date(sd.getTime()); end.setMonth(end.getMonth() + wm); }
      }
      if (!end || end.getTime() < todayMs) return;
      saleRows.push({
        customer: s.customer || '', phone: s.phone || '',
        date: sd, product: it.name || '',
        qty: it.qty || 1, end,
        search: ((s.customer||'')+' '+(s.phone||'')+' '+(it.name||'')).toLowerCase()
      });
    });
  });
  saleRows.sort((a,b)=> b.end.getTime() - a.end.getTime());

  const contentEl = container.querySelector('#bh-content');
  const searchEl  = container.querySelector('#bh-search');
  const tabRep    = container.querySelector('#bh-tab-rep');
  const tabSale   = container.querySelector('#bh-tab-sale');

  function renderRep(q){
    const list = q ? repRows.filter(r=>r.search.includes(q)) : repRows;
    if(!list.length) return '<div class="bh-empty">Không có phiếu sửa chữa nào còn bảo hành.</div>';
    const rows = list.map(r=>`<tr>
      <td><b>${esc(r.customer)}</b></td>
      <td>${esc(r.phone)}</td>
      <td>${esc(r.device)}</td>
      <td style="font-size:12px;color:#475569;max-width:280px">${esc(r.content)}</td>
      <td>${fmtDate(r.delivered)}</td>
      <td style="text-align:center">${r.months} th</td>
      <td>${fmtDate(r.end)}</td>
      <td>${daysLeftBadge(r.end.getTime(), todayMs)}</td>
    </tr>`).join('');
    return '<div class="bh-count">'+list.length+' phiếu còn bảo hành</div>'+
      '<div class="bh-wrap"><table class="bh-tbl"><thead><tr>'+
      '<th>Khách hàng</th><th>SĐT</th><th>Máy</th><th>Nội dung</th><th>Ngày trả</th><th>BH</th><th>Hết BH</th><th>Còn lại</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderSale(q){
    const list = q ? saleRows.filter(r=>r.search.includes(q)) : saleRows;
    if(!list.length) return '<div class="bh-empty">Không có phiếu bán hàng nào còn bảo hành.</div>';
    const rows = list.map(r=>`<tr>
      <td><b>${esc(r.customer)}</b></td>
      <td>${esc(r.phone)}</td>
      <td>${fmtDate(r.date)}</td>
      <td>${esc(r.product)}${r.qty>1?' <span style="color:#64748b">×'+r.qty+'</span>':''}</td>
      <td>${fmtDate(r.end)}</td>
      <td>${daysLeftBadge(r.end.getTime(), todayMs)}</td>
    </tr>`).join('');
    return '<div class="bh-count">'+list.length+' sản phẩm còn bảo hành</div>'+
      '<div class="bh-wrap"><table class="bh-tbl"><thead><tr>'+
      '<th>Khách hàng</th><th>SĐT</th><th>Ngày bán</th><th>Sản phẩm</th><th>Hết BH</th><th>Còn lại</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function render(){
    const q = (searchEl.value||'').trim().toLowerCase();
    contentEl.innerHTML = tab==='rep' ? renderRep(q) : renderSale(q);
  }
  tabRep.onclick  = ()=>{ tab='rep';  tabRep.classList.add('active');  tabSale.classList.remove('active'); render(); };
  tabSale.onclick = ()=>{ tab='sale'; tabSale.classList.add('active'); tabRep.classList.remove('active'); render(); };
  searchEl.oninput = render;
  render();
}
