// modules/expenses.js - Chi phí hoạt động v1
import { registerRoute } from '../core/router.js';
import { onSnapshot, addItem, updateItem } from '../core/db.js';
import { toast, formatVND, showModal } from '../core/ui.js';

const COL = 'expenses';
const CATS = ['Mặt bằng','Điện nước','Lương nhân viên','Nhập hàng / Linh kiện','Công cụ / Dụng cụ','Marketing','Vận chuyển','Ăn uống / Tiếp khách','Khác'];
registerRoute('#expenses', mount);

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dot(n){ const s=String(Math.round(Number(n)||0)); return s.replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function num(v){ return parseFloat(String(v==null?'':v).replace(/[^0-9]/g,'')) || 0; }
function pd(s){ if(!s) return null; const d=new Date(String(s).length<=10?String(s)+'T00:00:00':String(s)); return isNaN(d.getTime())?null:d; }
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtDate(d){ return d?d.toLocaleDateString('vi-VN'):'—'; }

export function mount(container){
  container.innerHTML = `
<style>
.ex-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.ex-bar select,.ex-bar input{padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px}
.ex-add{padding:8px 16px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px}
.ex-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
.ex-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}
.ex-card .lb{font-size:12px;color:#6b7280;margin-bottom:4px}
.ex-card .vl{font-size:22px;font-weight:800;color:#dc2626}
.ex-panel{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:16px}
.ex-panel h3{margin:0 0 10px;font-size:14px;color:#374151;border-bottom:2px solid #f3f4f6;padding-bottom:6px}
.ex-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.ex-tbl th{background:#fef2f2;padding:8px 10px;text-align:left;font-weight:700;color:#991b1b;border-bottom:2px solid #fee2e2}
.ex-tbl td{padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#374151;vertical-align:top}
.ex-tbl tr:hover td{background:#fafafa}
.ex-cat{display:inline-block;background:#fef3c7;color:#92400e;border-radius:5px;padding:1px 8px;font-size:11px;font-weight:600}
.ex-btn{padding:3px 9px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:12px;margin-left:3px}
.ex-btn.del:hover{background:#fee2e2;border-color:#fca5a5;color:#dc2626}
.ex-empty{padding:16px;text-align:center;color:#9ca3af}
.ex-fld{margin-bottom:10px}
.ex-fld label{display:block;font-size:13px;color:#475569;margin-bottom:4px;font-weight:600}
.ex-fld input,.ex-fld select{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #cbd5e1;border-radius:7px;font-size:14px}
</style>
    <div class="module-header"><h2>💸 Chi phí hoạt động</h2></div>
    <div class="ex-bar">
      <select id="ex-period">
        <option value="month" selected>Tháng này</option>
        <option value="last_month">Tháng trước</option>
        <option value="year">Năm nay</option>
        <option value="all">Tất cả</option>
      </select>
      <select id="ex-cat"><option value="">Tất cả danh mục</option></select>
      <input id="ex-search" placeholder="🔍 Tìm nội dung..." style="min-width:180px">
      <button id="ex-add" class="ex-add">＋ Thêm chi phí</button>
    </div>
    <div id="ex-body"><p class="ex-empty">Đang tải...</p></div>
  `;

  let items = [];
  onSnapshot(COL, list => { items = (list||[]).filter(x=>!x.deletedAt); refreshCatOptions(); render(); });

  const bodyEl = container.querySelector('#ex-body');
  const periodEl = container.querySelector('#ex-period');
  const catEl = container.querySelector('#ex-cat');
  const searchEl = container.querySelector('#ex-search');
  periodEl.onchange = render; catEl.onchange = render; searchEl.oninput = render;
  container.querySelector('#ex-add').onclick = () => openForm(null);

  function refreshCatOptions(){
    const cur = catEl.value;
    const cats = Array.from(new Set(items.map(x=>x.category||'Khác'))).sort((a,b)=>a.localeCompare(b,'vi'));
    catEl.innerHTML = '<option value="">Tất cả danh mục</option>' + cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    catEl.value = cur;
  }

  function periodRange(p){
    const now=new Date(), y=now.getFullYear(), m=now.getMonth();
    if(p==='month') return [new Date(y,m,1), new Date(y,m+1,1)];
    if(p==='last_month') return [new Date(y,m-1,1), new Date(y,m,1)];
    if(p==='year') return [new Date(y,0,1), new Date(y+1,0,1)];
    return [new Date(0), new Date(8640000000000000)];
  }

  function render(){
    const [from,to] = periodRange(periodEl.value);
    const catF = catEl.value;
    const q = (searchEl.value||'').trim().toLowerCase();
    let list = items.filter(x=>{
      const d = pd(x.date); if(!d) return false;
      if(d < from || d >= to) return false;
      if(catF && (x.category||'Khác') !== catF) return false;
      if(q && !((x.name||'').toLowerCase().includes(q) || (x.note||'').toLowerCase().includes(q))) return false;
      return true;
    });
    list.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    const total = list.reduce((s,x)=>s+(Number(x.amount)||0),0);

    // Thống kê theo danh mục
    const byCat = {};
    list.forEach(x=>{ const c=x.category||'Khác'; if(!byCat[c]) byCat[c]={n:0,sum:0}; byCat[c].n++; byCat[c].sum+=(Number(x.amount)||0); });
    const catRows = Object.keys(byCat).sort((a,b)=>byCat[b].sum-byCat[a].sum).map(c=>`
      <tr><td><span class="ex-cat">${esc(c)}</span></td>
        <td style="text-align:center">${byCat[c].n}</td>
        <td style="text-align:right;font-weight:600">${formatVND(byCat[c].sum)}</td>
        <td style="text-align:right;color:#6b7280">${total?Math.round(byCat[c].sum/total*100):0}%</td></tr>`).join('')
      || '<tr><td colspan="4" class="ex-empty">Chưa có chi phí trong kỳ này</td></tr>';

    // Danh sách
    const rows = list.length ? list.map(x=>`
      <tr><td style="white-space:nowrap">${fmtDate(pd(x.date))}</td>
        <td><span class="ex-cat">${esc(x.category||'Khác')}</span></td>
        <td>${esc(x.name)}${x.note?`<div style="font-size:11px;color:#9ca3af">${esc(x.note)}</div>`:''}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap">${formatVND(x.amount||0)}</td>
        <td style="text-align:right;white-space:nowrap"><button class="ex-btn" data-edit="${x._key}">✏</button><button class="ex-btn del" data-del="${x._key}">🗑</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="ex-empty">Chưa có chi phí. Bấm "＋ Thêm chi phí".</td></tr>';

    bodyEl.innerHTML = `
      <div class="ex-cards">
        <div class="ex-card"><div class="lb">Tổng chi phí (kỳ đã chọn)</div><div class="vl">${formatVND(total)}</div></div>
        <div class="ex-card"><div class="lb">Số khoản chi</div><div class="vl" style="color:#374151">${list.length}</div></div>
      </div>
      <div class="ex-panel"><h3>📊 Thống kê theo danh mục</h3>
        <table class="ex-tbl"><thead><tr><th>Danh mục</th><th style="text-align:center">Số khoản</th><th style="text-align:right">Tổng tiền</th><th style="text-align:right">Tỷ lệ</th></tr></thead><tbody>${catRows}</tbody></table>
      </div>
      <div class="ex-panel"><h3>📋 Danh sách chi phí (${list.length})</h3>
        <table class="ex-tbl"><thead><tr><th>Ngày</th><th>Danh mục</th><th>Nội dung</th><th style="text-align:right">Số tiền</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;

    bodyEl.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=>openForm(items.find(x=>x._key===b.dataset.edit)));
    bodyEl.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>delItem(items.find(x=>x._key===b.dataset.del)));
  }

  function openForm(ex){
    const key = ex ? ex._key : null;
    const catOpts = CATS.map(c=>`<option value="${esc(c)}" ${ex&&ex.category===c?'selected':''}>${esc(c)}</option>`).join('');
    showModal({
      title: key ? 'Sửa khoản chi' : 'Thêm khoản chi',
      confirmText: 'Lưu',
      body: `
        <div class="ex-fld"><label>Ngày</label><input id="exf-date" type="date" value="${ex?esc(ex.date):todayStr()}"></div>
        <div class="ex-fld"><label>Danh mục</label><select id="exf-cat">${catOpts}</select></div>
        <div class="ex-fld"><label>Nội dung <span style="color:#e11d48">*</span></label><input id="exf-name" value="${esc(ex?.name)}" placeholder="VD: Tiền điện tháng 7, mua keo tản nhiệt..."></div>
        <div class="ex-fld"><label>Số tiền (đ) <span style="color:#e11d48">*</span></label><input id="exf-amount" data-fmt="number" inputmode="numeric" value="${ex?dot(ex.amount||0):''}" placeholder="0"></div>
        <div class="ex-fld"><label>Ghi chú</label><input id="exf-note" value="${esc(ex?.note)}" placeholder="Không bắt buộc"></div>
      `,
      onConfirm: async () => {
        const name = (document.querySelector('#exf-name')?.value||'').trim();
        const amount = num(document.querySelector('#exf-amount')?.value);
        if(!name){ toast('Nhập nội dung khoản chi!','warning'); return false; }
        if(!(amount>0)){ toast('Nhập số tiền!','warning'); return false; }
        const data = {
          date: document.querySelector('#exf-date')?.value || todayStr(),
          category: document.querySelector('#exf-cat')?.value || 'Khác',
          name, amount,
          note: (document.querySelector('#exf-note')?.value||'').trim()
        };
        try {
          if(key){ await updateItem(COL, key, data); toast('Đã cập nhật','success'); }
          else { data.createdAt = Date.now(); await addItem(COL, data); toast('Đã thêm khoản chi','success'); }
        } catch(e){ toast('Lỗi: '+e.message,'error'); return false; }
      }
    });
  }

  function delItem(x){
    if(!x) return;
    showModal({
      title:'Xoá khoản chi', danger:true, confirmText:'Xoá',
      body:`<p>Xoá khoản chi <b>${esc(x.name)}</b> (${formatVND(x.amount||0)})?</p>`,
      onConfirm: async () => { try { await updateItem(COL, x._key, {deletedAt:Date.now()}); toast('Đã xoá','success'); } catch(e){ toast('Lỗi: '+e.message,'error'); return false; } }
    });
  }
}
