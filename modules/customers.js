// modules/customers.js - Khách hàng
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot, getAll } from '../core/db.js';
import { buildTable, toast, showModal, formatDate } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'customers';

registerRoute('#customers', mount);

const TYPE_LIST = ['Thân thiết','Thường','Đại lý','Công ty'];

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Khách hàng</h2>
      <div class="module-actions">
        <input id="cust-search" type="text" placeholder="Tìm theo tên, SĐT..." class="search-input" />
        <select id="cust-type-filter" class="search-input" style="width:130px">
          <option value="">Tất cả loại</option>
          ${TYPE_LIST.map(t => `<option>${t}</option>`).join('')}
        </select>
        <button id="cust-ranking" class="btn" style="background:#f59e0b;color:#fff;border:none">🏆 Xếp hạng LN</button>
        <button id="cust-add" class="btn btn--primary">+ Thêm khách</button>
      </div>
    </div>
    <div id="cust-table-wrap"></div>
    <div id="cust-form-wrap" class="hidden"></div>
  `;

  let allData = [];

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    filterData();
  });

  container.addEventListener('unmount', () => unsub && unsub());

  document.getElementById('cust-search').addEventListener('input', filterData);
  document.getElementById('cust-type-filter').addEventListener('change', filterData);
  document.getElementById('cust-ranking')?.addEventListener('click', showProfitRanking);

  function filterData() {
    const q = (document.getElementById('cust-search')?.value || '').toLowerCase();
    const t = document.getElementById('cust-type-filter')?.value || '';
    const filtered = allData.filter(c => {
      const matchQ = !q ||
        (c.name||'').toLowerCase().includes(q) ||
        (c.phone||'').toLowerCase().includes(q) ||
        (c.id||'').toLowerCase().includes(q) ||
        (c.address||'').toLowerCase().includes(q);
      const matchT = !t || c.type === t;
      return matchQ && matchT;
    });
    renderTable(filtered);
  }

  function renderTable(data) {
    const wrap = document.getElementById('cust-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Mã KH',       key: c => c.id || '' },
      { label: 'Tên khách',   key: c => c.name || '' },
      { label: 'Số điện thoại',key: c => c.phone || '' },
      { label: 'Địa chỉ',    key: c => c.address || '' },
      { label: 'Loại KH',    key: c => c.type
          ? `<span class="badge ${c.type==='Thân thiết'?'badge-green':c.type==='Đại lý'?'badge-purple':'badge-blue'}">${c.type}</span>`
          : '' },
      { label: 'Ghi chú',    key: c => c.note || '' },
      { label: 'Ngày tạo',   key: c => c.ts ? formatDate(c.ts) : '' },
      { label: '',           key: c => `
        ${isAdmin() ? `<button class="btn btn--sm btn--secondary cust-edit" data-key="${c._key}">Sửa</button>` : ''}
        ${isAdmin() ? `<button class="btn btn--sm btn--danger cust-del" data-key="${c._key}">Xóa</button>` : ''}
        <button class='btn btn--sm cust-stats' data-key='${c._key}' data-n='${c.name||String.fromCharCode(32)}' data-p='${c.phone||String.fromCharCode(32)}' style='background:#0891b2;color:#fff;border:none;cursor:pointer;padding:2px 8px;border-radius:3px;font-size:12px' title='Thống kê sửa chửa'>📊</button>
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.cust-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(c => c._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.cust-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
    wrap.querySelectorAll('.cust-stats').forEach(btn =>
      btn.addEventListener('click', () => showCustStats((btn.dataset.n||'').trim(), (btn.dataset.p||'').trim()))
    );
  }

  document.getElementById('cust-add').addEventListener('click', () => openForm(null));
  if (!isAdmin()) { const _addBtn = document.getElementById('cust-add'); if (_addBtn) _addBtn.style.display = 'none'; }

  function openForm(record) {
    if (!isAdmin()) { toast('Chỉ quản trị viên mới được thêm/sửa khách hàng', 'error'); return; }
    const wrap = document.getElementById('cust-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center">
        <div style="background:#fff;border-radius:12px;width:min(560px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.3);padding:1.4rem;box-sizing:border-box">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <h3 style="margin:0">${record ? 'Cập nhật khách hàng' : 'Thêm khách hàng'}</h3>
            <button id="f-x" type="button" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:15px;color:#64748b">✕</button>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Mã khách hàng</label>
              <input id="f-id" type="text" value="${record?.id||''}" placeholder="VD: KH001" />
            </div>
            <div class="form-group">
              <label>Tên khách hàng *</label>
              <input id="f-name" type="text" value="${record?.name||''}" />
            </div>
            <div class="form-group">
              <label>Số điện thoại</label>
              <input id="f-phone" type="text" value="${record?.phone||''}" />
            </div>
            <div class="form-group">
              <label>Địa chỉ</label>
              <input id="f-address" type="text" value="${record?.address||''}" />
            </div>
            <div class="form-group">
              <label>Loại khách hàng</label>
              <select id="f-type">
                <option value="">-- Chọn loại --</option>
                ${TYPE_LIST.map(t => `<option ${record?.type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Ghi chú</label>
              <input id="f-note" type="text" value="${record?.note||''}" />
            </div>
          </div>
          <div class="form-actions" style="margin-top:1.1rem;display:flex;gap:.5rem;justify-content:flex-end">
            <button id="f-cancel" class="btn btn--secondary">Hủy</button>
            <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu'}</button>
          </div>
        </div>
      </div>
    `;

    const closeForm = () => { wrap.classList.add('hidden'); wrap.innerHTML = ''; };
    document.getElementById('f-cancel').addEventListener('click', closeForm);
    document.getElementById('f-x').addEventListener('click', closeForm);
    setTimeout(() => { const nm = document.getElementById('f-name'); if (nm) nm.focus(); }, 30);

    document.getElementById('f-save').addEventListener('click', async () => {
      const name = document.getElementById('f-name').value.trim();
      if (!name) { toast('Vui lòng nhập tên khách hàng', 'error'); return; }
      const data = {
        id:      document.getElementById('f-id').value.trim(),
        name,
        phone:   document.getElementById('f-phone').value.trim(),
        address: document.getElementById('f-address').value.trim(),
        type:    document.getElementById('f-type').value,
        note:    document.getElementById('f-note').value.trim(),
        ts:      record?.ts || Date.now()
      };
      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('Đã cập nhật khách hàng');
        } else {
          await addItem(COLLECTION, data);
          toast('Đã thêm khách hàng');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('Lỗi: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa khách hàng này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa khách hàng');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }

async function showCustStats(name, phone) {
  if (!name && !phone) return;
  var allReps = [];
  try { allReps = await getAll('repairs'); } catch(e){}
  var phoneReal = phone && /[0-9]/.test(phone);
  var myReps = allReps.filter(function(r){ return (name && r.customerName === name) || (phoneReal && r.phone === phone); });
  var open = myReps.filter(function(r){ return ['Tiếp nhận','\u0110ang sửa','Hoàn thành'].indexOf(r.status||'') >= 0; });
  var fmtN = function(n){ return String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };
  var now = new Date();
  var months = [];
  for (var i=5;i>=0;i--) {
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var lbl = (d.getMonth()+1)+'/'+d.getFullYear();
    var mrs = myReps.filter(function(r){
      var rd = new Date(r.receivedDate||r.ts||0);
      return rd.getFullYear()===d.getFullYear()&&rd.getMonth()===d.getMonth();
    });
    var prf = mrs.reduce(function(s,r){return s+(r.profit||(r.cost||0)-(r.partsCost||0));},0);
    months.push({lbl:lbl,count:mrs.length,prf:prf});
  }
  var totalProfit = myReps.reduce(function(s,r){return s+(r.profit||(r.cost||0)-(r.partsCost||0));},0);
  var openRows = open.length ? open.map(function(r){
    return '<tr><td style="padding:4px 6px">'+( r.device||'')+' '+(r.serial||'')+'</td><td style="padding:4px 6px;color:'+(r.status==='Đang sửa'?'#e67e22':'#3498db')+'">'+( r.status||'')+'</td><td style="padding:4px 6px">'+(r.receivedDate||'').slice(0,10)+'</td><td style="padding:4px 6px;text-align:right;white-space:nowrap">'+fmtN(r.cost||0)+'đ</td></tr>';
  }).join('') : '<tr><td colspan="4" style="text-align:center;color:#888;padding:8px">Không có máy tại shop</td></tr>';
  var monthRows = months.map(function(m){
    return '<tr><td style="padding:4px 6px">'+m.lbl+'</td><td style="padding:4px 6px;text-align:center">'+m.count+'</td><td style="padding:4px 6px;text-align:right;color:#16a34a">'+fmtN(m.prf)+'đ</td></tr>';
  }).join('');
  var html = '<style>.modal{max-width:600px!important;width:92vw!important}</style><div style="width:100%;max-height:70vh;overflow:auto;box-sizing:border-box">'+
    '<div style="display:flex;gap:16px;margin-bottom:14px;padding:10px;background:#f0f9ff;border-radius:8px;text-align:center">'+
      '<div><div style="font-size:24px;font-weight:700;color:#1d4ed8">'+myReps.length+'</div><div style="font-size:11px;color:#555">Tổng phiếu</div></div>'+
      '<div><div style="font-size:24px;font-weight:700;color:#dc2626">'+open.length+'</div><div style="font-size:11px;color:#555">Đang tại shop</div></div>'+
      '<div><div style="font-size:20px;font-weight:700;color:#16a34a">'+fmtN(totalProfit)+'đ</div><div style="font-size:11px;color:#555">Tổng lợi nhuận</div></div>'+
    '</div>'+
    (open.length>0?'<div style="margin-bottom:12px"><div style="font-weight:600;color:#dc2626;margin-bottom:5px">📍 Máy đang tại shop ('+open.length+')</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#fee2e2;font-weight:600"><th style="padding:4px 6px;text-align:left">Thiết bị / Serial</th><th>TT</th><th>Ngày nhận</th><th style="text-align:right;white-space:nowrap">Chi phí</th></tr>'+openRows+'</table></div>':'')+
    '<div><div style="font-weight:600;color:#1d4ed8;margin-bottom:5px">📅 Thống kê 6 tháng gần nhất</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#dbeafe;font-weight:600"><th style="padding:4px 6px;text-align:left">Tháng</th><th style="text-align:center">Số máy</th><th style="text-align:right;white-space:nowrap">Lợi nhuận</th></tr>'+monthRows+'</table></div>'+
  '</div>';
  showModal({ title: 'Thống kê: '+name+' ('+phone+')', body: html, confirmText: 'Đóng' });
}

async function showProfitRanking() {
  var reps=[], sales=[], prods=[];
  try { var r = await Promise.all([getAll('repairs'), getAll('sales'), getAll('products')]); reps=r[0]; sales=r[1]; prods=r[2]; } catch(e){}
  var costByKey = {}; prods.forEach(function(p){ costByKey[p._key]=Number(p.cost)||0; });
  var fmtN = function(n){ return String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };

  // Chỉ khách hàng ĐÃ LƯU trong module Khách hàng — khớp phiếu theo SĐT hoặc tên
  var byPhone={}, byName={};
  allData.forEach(function(c){
    var ph=(c.phone||'').trim(), nm=(c.name||'').trim().toLowerCase();
    if(ph && /[0-9]/.test(ph)) byPhone[ph]=c;
    if(nm) byName[nm]=c;
  });
  function matchCust(name, phone){
    var ph=(phone||'').trim(), nm=(name||'').trim().toLowerCase();
    if(ph && /[0-9]/.test(ph) && byPhone[ph]) return byPhone[ph];
    if(nm && byName[nm]) return byName[nm];
    return null;
  }

  var entries = [];
  reps.forEach(function(rr){
    if (rr.deletedAt) return;
    var c = matchCust(rr.customerName, rr.phone);
    if(!c) return;
    var pf = (typeof rr.profit==='number') ? rr.profit : ((rr.cost||0)-(rr.partsCost||0));
    var ds = rr.receivedDate || (rr.ts? new Date(rr.ts).toISOString().slice(0,10):'');
    entries.push({name:(c.name||'?'), phone:(c.phone||''), profit:pf, date:ds});
  });
  sales.forEach(function(s){
    var c = matchCust(s.customer, s.phone);
    if(!c) return;
    var cap=0; (s.items||[]).forEach(function(it){ cap += (Number(it.qty)||1)*(costByKey[it.invkey]||0); });
    var pf = (Number(s.total)||0) - cap;
    var ds = s.date || (s.createdAt? new Date(s.createdAt).toISOString().slice(0,10):'');
    entries.push({name:(c.name||'?'), phone:(c.phone||''), profit:pf, date:ds});
  });

  function periodRange(p){
    var now=new Date(), y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
    if(p==='week'){ var day=(now.getDay()+6)%7; return [new Date(y,m,d-day), new Date(y,m,d+1)]; }
    if(p==='month'){ return [new Date(y,m,1), new Date(y,m+1,1)]; }
    if(p==='year'){ return [new Date(y,0,1), new Date(y+1,0,1)]; }
    return [new Date(0), new Date(8640000000000000)];
  }
  var baseBtn='padding:5px 14px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:13px;margin-right:6px;';
  var activeBtn='background:#2563eb;color:#fff;border-color:#2563eb;font-weight:600;';

  function render(p){
    var rng=periodRange(p), groups={};
    entries.forEach(function(e){
      if(p!=='all'){
        if(!e.date) return;
        var dt=new Date(e.date+'T00:00:00');
        if(isNaN(dt.getTime()) || dt<rng[0] || dt>=rng[1]) return;
      }
      var key=(e.name.toLowerCase()||'?')+'|'+e.phone;
      if(!groups[key]) groups[key]={name:e.name||'?',phone:e.phone,profit:0,count:0};
      groups[key].profit+=e.profit; groups[key].count++;
    });
    var arr=Object.keys(groups).map(function(k){return groups[k];}).sort(function(a,b){return b.profit-a.profit;});
    var total=arr.reduce(function(s,g){return s+g.profit;},0);
    var rows = arr.length ? arr.map(function(g,i){
      var rk = i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1);
      return '<tr><td style="text-align:center;font-weight:600">'+rk+'</td><td style="padding:4px 8px"><b>'+g.name+'</b></td><td style="font-size:12px;color:#777">'+(g.phone||'')+'</td><td style="text-align:center">'+g.count+'</td><td style="text-align:right;color:#16a34a;font-weight:600;white-space:nowrap">'+fmtN(g.profit)+'đ</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#888;padding:12px">Không có dữ liệu trong kỳ này</td></tr>';
    var el=document.getElementById('cpr-list');
    if(el) el.innerHTML = '<div style="text-align:right;font-size:13px;color:#555;margin-bottom:6px">Tổng lợi nhuận: <b style="color:#16a34a">'+fmtN(total)+'đ</b> · '+arr.length+' khách</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#dbeafe;font-weight:600"><th style="padding:5px;width:46px">#</th><th style="text-align:left;padding:5px">Khách hàng</th><th style="text-align:left">SĐT</th><th style="text-align:center">Số GD</th><th style="text-align:right;padding-right:6px">Lợi nhuận</th></tr></thead><tbody>'+rows+'</tbody></table>';
    ['week','month','year','all'].forEach(function(pp){ var b=document.getElementById('cpr-'+pp); if(b) b.style.cssText = baseBtn + (pp===p?activeBtn:''); });
  }

  var body='<style>.modal{max-width:660px!important;width:95vw!important}</style>'+
    '<div style="margin-bottom:10px">'+
      '<button id="cpr-week">Tuần này</button>'+
      '<button id="cpr-month">Tháng này</button>'+
      '<button id="cpr-year">Năm nay</button>'+
      '<button id="cpr-all">Tất cả</button>'+
    '</div><div id="cpr-list" style="max-height:62vh;overflow:auto"></div>';
  showModal({ title:'🏆 Xếp hạng lợi nhuận khách hàng (đã lưu)', body: body, confirmText:'Đóng' });
  ['week','month','year','all'].forEach(function(p){ var b=document.getElementById('cpr-'+p); if(b) b.onclick=function(){ render(p); }; });
  render('month');
}
}
