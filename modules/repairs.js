// modules/repairs.js - PhiÃ¡ÂºÂ¿u sÃ¡Â»Â­a chÃ¡Â»Â¯a
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';

const STATUS_LIST = ['TiÃ¡ÂºÂ¿p nhÃ¡ÂºÂ­n','ÃÂang sÃ¡Â»Â­a','HoÃÂ n thÃÂ nh','ÃÂÃÂ£ giao','HuÃ¡Â»Â·'];
const STATUS_CLASS = {
  'TiÃ¡ÂºÂ¿p nhÃ¡ÂºÂ­n': 'badge-blue',
  'ÃÂang sÃ¡Â»Â­a':  'badge-orange',
  'HoÃÂ n thÃÂ nh':'badge-green',
  'ÃÂÃÂ£ giao':   'badge-purple',
  'HuÃ¡Â»Â·':       'badge-red'
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDeliveryItems(items) {
  if (!items || !items.length) return '';
  if (typeof items === 'string') return items;
  return items.map(i => (i.desc || '') + (i.qty > 1 ? ' x' + i.qty : '')).filter(Boolean).join(', ');
}

function printWarrantyBill(record) {
  const fmtN = n => (+n||0).toLocaleString('vi-VN');
  const p2 = n => String(n).padStart(2,'0');
  const BSr = (() => { try { return JSON.parse(localStorage.getItem('billSettings')||'{}'  ); } catch(e){ return {}; } })();
  const bc = BSr.colorR || '#1a3a6b';
  const giao = record.deliveredDate || record.receivedDate || '';
  let dateStr = '';
  if (giao) { const d = new Date(giao); if (!isNaN(d)) dateStr = 'Ng\u00e0y '+p2(d.getDate())+' th\u00e1ng '+p2(d.getMonth()+1)+' n\u0103m '+d.getFullYear(); }
  const wm = +(record.warrantyMonths||0);
  let wExp = 'Kh\u00f4ng';
  if (wm>0 && giao) { const d=new Date(giao); d.setMonth(d.getMonth()+wm); wExp=p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear(); }
  const dep = +(record.deposit||0);
  const cost = +(record.cost||0);
  const dvPaid = +(record.deliveryPaid||0);
  const disc = +(record.discount||0);
  const remaining = Math.max(0, cost - dep - dvPaid - disc);
  const items = (record.deliveryItems && record.deliveryItems.length) ? record.deliveryItems : [{desc: record.issue||'', qty:1, price:cost}];
  const itemRows = items.map((it,i) => {
    const q = +(it.qty||1), pr = +(it.price||0);
    const td = 'style="padding:5px 6px;border:1px solid #ddd"'
    return '<tr>' +
      '<td '+td+' style="padding:5px 6px;border:1px solid #ddd;text-align:center;width:22px">' + (i+1) + '</td>' +
      '<td '+td+' contenteditable="true">' + (it.desc||'') + '</td>' +
      '<td '+td+' contenteditable="true" style="padding:5px 6px;border:1px solid #ddd;text-align:center;width:38px">' + q + '</td>' +
      '<td '+td+' contenteditable="true" style="padding:5px 6px;border:1px solid #ddd;text-align:right;width:88px">' + fmtN(pr) + '</td>' +
      '<td style="padding:5px 6px;border:1px solid #ddd;text-align:right;width:88px" class="lt">' + fmtN(q*pr) + '</td>' +
      '</tr>';
  }).join('');
  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Phiếu SC</title>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:13px;padding:16px;max-width:400px;margin:0 auto;color:#222}
[contenteditable]{outline:none;border-radius:2px;cursor:text}
[contenteditable]:hover{background:rgba(26,58,107,.07)}
[contenteditable]:focus{background:rgba(255,235,60,.3)}
.no-print{display:block}
@media print{
  .no-print{display:none!important}
  [contenteditable]{background:none!important;cursor:default}
  body{padding:4px;max-width:100%}
}
</style></head><body>
<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid ${bc};padding-bottom:10px">
${BSr.logo?`<img src="${BSr.logo}" style="height:48px;margin-bottom:4px"><br>`:""}
<div contenteditable="true" style="font-size:16px;font-weight:700;color:${bc}">${BSr.shopName||"LAPTOP 24H"}</div>
<div contenteditable="true" style="font-size:12px;color:#666;margin-top:2px">${BSr.address||""}</div>
<div contenteditable="true" style="font-size:12px;color:#666">${BSr.phone||""}</div>
</div>
<div style="text-align:center;margin-bottom:14px">
<div contenteditable="true" style="font-size:15px;font-weight:700;color:${bc};letter-spacing:1px">PHIẼU BÀN GIAO MÁY</div>
<div contenteditable="true" style="font-size:12px;color:#888;margin-top:2px">Mã phiếu: ${record._key||""} &nbsp;|  ${dateStr}</div>
</div>
<div style="background:#f0f4ff;border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:2">
<div><b>Khách hàng:</b> <span contenteditable="true">${record.customerName||""}</span> &nbsp; <b>SĐT:</b> <span contenteditable="true">${record.phone||""}</span></div>
<div><b>Thiết bị:</b> <span contenteditable="true">${record.device||""}</span>${record.serial?` &nbsp; <b>S/N:</b> <span contenteditable="true">${record.serial}</span>`:""}</div>
<div><b>Tình trạng:</b> <span contenteditable="true">${record.issue||""}</span></div>
</div>
<div style="margin-bottom:12px">
<div style="font-weight:600;color:${bc};margin-bottom:5px;font-size:12px;text-transform:uppercase">HẠNG MỤC DỊCH VỤ / LINH KIỆN</div>
<table id="tbl" style="width:100%;border-collapse:collapse;font-size:12px">
<thead><tr style="background:${bc};color:#fff">
<th style="padding:6px 5px;border:1px solid #aaa;width:22px">#</th>
<th style="padding:6px 5px;border:1px solid #aaa;text-align:left">Mô tả</th>
<th style="padding:6px 5px;border:1px solid #aaa;width:38px">SL</th>
<th style="padding:6px 5px;border:1px solid #aaa;width:88px">Đơn giá</th>
<th style="padding:6px 5px;border:1px solid #aaa;width:88px">Thành tiền</th>
</tr></thead>
<tbody id="tb">${itemRows}</tbody>
</table>
<div class="no-print" style="margin-top:5px;display:flex;gap:6px">
<button onclick="addR()" style="font-size:11px;padding:3px 9px;border-radius:4px;border:1px solid ${bc};color:${bc};background:#fff;cursor:pointer">＋ Thêm hàng</button>
<button onclick="delR()" style="font-size:11px;padding:3px 9px;border-radius:4px;border:1px solid #e74c3c;color:#e74c3c;background:#fff;cursor:pointer">− Xóa hàng cuối</button>
</div></div>
<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
<tr><td style="padding:4px 8px;color:#555">Tổng cộng:</td><td id="tot" style="padding:4px 8px;text-align:right;font-weight:600">${fmtN(cost)} ₫</td></tr>
<tr><td style="padding:4px 8px;color:#555">Tiền cọc:</td><td style="padding:4px 8px;text-align:right;color:#e74c3c" contenteditable="true">${fmtN(dep)} ₫</td></tr>
${dvPaid>0?`<tr><td style="padding:4px 8px;color:#555">Đã thanh toán thêm:</td><td style="padding:4px 8px;text-align:right;color:#27ae60">${fmtN(dvPaid)} ₫</td></tr>`:""}
${disc>0?`<tr><td style="padding:4px 8px;color:#555">Giảm giá:</td><td style="padding:4px 8px;text-align:right;color:#e67e22">-${fmtN(disc)} ₫</td></tr>`:""}
<tr style="background:#fff3cd"><td style="padding:6px 8px;font-weight:700;font-size:14px">💰 CÒN LẠI:</td><td id="rem" style="padding:6px 8px;text-align:right;font-weight:700;font-size:14px;color:${bc}" contenteditable="true">${fmtN(remaining)} ₫</td></tr>
<tr><td style="padding:4px 8px;color:#555">Hình thức TT:</td><td style="padding:4px 8px;text-align:right" contenteditable="true">${record.paymentMethod||"Tiền mặt"}</td></tr>
</table>
${wm>0?`<div style="border:1.5px dashed ${bc};border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px">
<div style="font-weight:700;color:${bc};margin-bottom:3px">🛡 BẢO HÀNH</div>
<div>Thời hạn: <b contenteditable="true">${wm} tháng</b></div>
<div>Hết hạn: <b contenteditable="true">${wExp}</b></div>
<div contenteditable="true" style="color:#555;margin-top:3px">${BSr.warrantyNote||"Bảo hành đúng lỗi, không bảo hành hư hỏng do tác động ngoại lực."}</div>
</div>`:""}
<div style="margin-bottom:14px">
<div style="font-size:12px;color:#888;margin-bottom:3px">Ghi chú:</div>
<div contenteditable="true" style="min-height:28px;border:1px solid #e8e8e8;border-radius:4px;padding:5px 8px;font-size:12px;color:#555">${record.notes||BSr.footerNote||""}</div>
</div>
<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;text-align:center">
<div style="width:44%"><div style="height:40px"></div><div style="border-top:1px solid #999;padding-top:5px;color:#777">Khách hàng ký tên</div></div>
<div style="width:44%"><div style="height:40px"></div><div style="border-top:1px solid #999;padding-top:5px;color:#777">Kỹ thuật viên</div></div>
</div>
<div class="no-print" style="text-align:center;margin-top:18px;padding-bottom:10px">
<button onclick="window.print()" style="background:${bc};color:#fff;border:none;padding:10px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🖨 IN NGAY</button>
</div>
<script>
function fmt(n){return(+n||0).toLocaleString("vi-VN");}
function calc(){
  const rows=document.querySelectorAll("#tb tr");let tot=0;
  rows.forEach((r,i)=>{
    r.cells[0].textContent=i+1;
    const q=parseFloat(r.cells[2].textContent.replace(/[^\d.]/g,""))||1;
    const p=parseFloat(r.cells[3].textContent.replace(/[^\d]/g,""))||0;
    r.cells[4].textContent=fmt(q*p)+" \u20ab"; tot+=q*p;
  });
  const td=document.getElementById("tot"); if(td)td.textContent=fmt(tot)+" \u20ab";
}
function addR(){
  const tb=document.getElementById("tb"),i=tb.rows.length+1;
  const s="padding:5px 6px;border:1px solid #ddd";
  const tr=document.createElement("tr");
  tr.innerHTML='<td style="'+s+';text-align:center;width:22px">'+i+"</td>"+'<td style="'+s+'" contenteditable="true"></td>'+'<td style="'+s+';text-align:center;width:38px" contenteditable="true">1</td>'+'<td style="'+s+';text-align:right;width:88px" contenteditable="true">0</td>'+'<td style="'+s+';text-align:right;width:88px" class="lt">0 \u20ab</td>';
  tb.appendChild(tr); tr.cells[1].focus();
}
function delR(){const tb=document.getElementById("tb");if(tb.rows.length>1)tb.deleteRow(-1);calc();}
document.getElementById("tb").addEventListener("input",calc);
<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=480,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}


export async function mount(container) {
  const today = todayStr();

  container.innerHTML = `
    <div class="module-header">
      <h2>PhiÃ¡ÂºÂ¿u sÃ¡Â»Â­a chÃ¡Â»Â¯a</h2>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">
      <input id="rep-search" type="text" placeholder="Ã°ÂÂÂ TÃÂ¬m kiÃ¡ÂºÂ¿m..." class="search-input" style="flex:1;min-width:160px"/>
      <select id="rep-status-filter" class="search-input" style="width:145px">
        <option value="">TÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ trÃ¡ÂºÂ¡ng thÃÂ¡i</option>
        ${STATUS_LIST.map(s => '<option>' + s + '</option>').join('')}
      </select>
      <label style="font-size:.85rem;color:#555">TÃ¡Â»Â«:</label>
      <input id="rep-date-from" type="date" class="search-input" style="width:145px" value="${today}"/>
      <label style="font-size:.85rem;color:#555">ÃÂÃ¡ÂºÂ¿n:</label>
      <input id="rep-date-to"   type="date" class="search-input" style="width:145px" value="${today}"/>
      <button id="rep-clear-date" class="btn btn--secondary" style="font-size:.83rem;padding:.35rem .8rem">TÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ ngÃÂ y</button>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem;padding:.4rem;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
      <button id="rep-add" class="btn btn--primary" style="padding:.6rem 2rem;font-size:1rem;border-radius:8px;box-shadow:0 2px 6px rgba(37,99,235,.25)">+ ThÃÂªm phiÃ¡ÂºÂ¿u mÃ¡Â»Âi</button>
      <div style="width:1px;height:28px;background:#e5e7eb;margin:0 .25rem"></div>
      <button id="rep-edit-btn" class="btn btn--secondary" disabled style="opacity:.4">Ã¢ÂÂ SÃ¡Â»Â­a</button>
      <button id="rep-del-btn"  class="btn btn--danger"    disabled style="opacity:.4">Ã¢ÂÂ XÃÂ³a</button>
      <button id="rep-print-btn" class="btn btn--secondary" disabled style="opacity:.4">Ã°ÂÂÂ¨ In bill BH</button>
      <div style="width:1px;height:28px;background:#e5e7eb;margin:0 .25rem"></div>
      <button id="rep-trash-btn" class="btn btn--secondary" style="font-size:.9rem">Ã°ÂÂÂ ThÃÂ¹ng rÃÂ¡c</button>
      <button id="rep-deliver-btn" class="btn btn--primary" disabled style="display:none;opacity:.4">Ã°ÂÂÂ¦ Giao</button>
      <button id="rep-status-btn" class="btn btn--secondary" disabled style="display:none;background:#7c3aed;color:#fff;opacity:.4">Ã¢ÂÂ</button>
      <span id="rep-sel-hint" style="font-size:.82rem;color:#888;margin-left:.25rem">Ã¢ÂÂ ChÃ¡Â»Ân 1 phiÃ¡ÂºÂ¿u ÃÂÃ¡Â»Â thao tÃÂ¡c</span>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap"></div>
  `;

  let allData = [];
  let trashData = [];
  let selectedKey = null;
  let _dvItems = [];

  const unsub = onSnapshot(COLLECTION, items => {
    trashData = items.filter(r => r.deleted);
    allData = items.filter(r => !r.deleted).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    filterData();
  });
  container.addEventListener('unmount', () => unsub && unsub());

  const searchEl   = container.querySelector('#rep-search');
  const statusEl   = container.querySelector('#rep-status-filter');
  const dateFromEl = container.querySelector('#rep-date-from');
  const dateToEl   = container.querySelector('#rep-date-to');
  const editBtn    = container.querySelector('#rep-edit-btn');
  const delBtn     = container.querySelector('#rep-del-btn');
  const printBtn   = container.querySelector('#rep-print-btn');
  const selHint    = container.querySelector('#rep-sel-hint');
  const trashBtn   = container.querySelector('#rep-trash-btn');

  searchEl.addEventListener('input', filterData);
  statusEl.addEventListener('change', filterData);
  dateFromEl.addEventListener('change', filterData);
  dateToEl.addEventListener('change', filterData);

  container.querySelector('#rep-clear-date').addEventListener('click', () => {
    dateFromEl.value = ''; dateToEl.value = ''; filterData();
  });
  container.querySelector('#rep-add').addEventListener('click', () => openForm(null));

  editBtn.addEventListener('click', () => {
    const rec = allData.find(r => r._key === selectedKey);
    if (rec) openForm(rec);
  });
  delBtn.addEventListener('click', () => { if (selectedKey) confirmDelete(selectedKey); });
  printBtn.addEventListener('click', () => {
    const rec = allData.find(r => r._key === selectedKey);
    if (rec) printWarrantyBill(rec);
  });

  trashBtn.addEventListener('click', () => showTrash());

  function showTrash() {
    // Auto-purge items older than 1 day
    const oneDayAgo = Date.now() - 86400000;
    trashData.forEach(r => {
      if ((r.deletedAt || 0) < oneDayAgo) {
        deleteItem(COLLECTION, r._key).catch(() => {});
      }
    });
    const valid = trashData.filter(r => (r.deletedAt || 0) >= oneDayAgo);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:1.5rem;width:min(96vw,640px);max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.22)';
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 style="margin:0">Ã°ÂÂÂ ThÃÂ¹ng rÃÂ¡c phÃÂ­iÃ¡ÂºÂ¿u sÃ¡Â»Â­a</h3>
      <button id="trash-close" class="btn btn--secondary" style="padding:.3rem .8rem">&#x2715;</button>
    </div>
    ${valid.length === 0
      ? '<p style="color:#888;text-align:center;padding:1rem">ThÃÂ¹ng rÃÂ¡c trÃ¡Â»Âng</p>'
      : valid.map(r => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:.7rem 1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <div style="min-width:0;flex:1">
            <div style="font-weight:600">${r.customerName||'(khÃÂ´ng tÃÂªn)'}</div>
            <div style="font-size:.8rem;color:#666">${r.device||''}${r.serial?' ÃÂ· '+r.serial:''} ÃÂ· ${new Date(r.deletedAt||0).toLocaleString('vi-VN')}</div>
          </div>
          <div style="display:flex;gap:.4rem;flex-shrink:0">
            <button class="btn btn--secondary trash-restore" data-key="${r._key}" style="font-size:.82rem;padding:.3rem .7rem">KhÃÂ´i phÃ¡Â»Â¥c</button>
            <button class="btn btn--danger trash-perm" data-key="${r._key}" style="font-size:.82rem;padding:.3rem .7rem">XÃÂ³a hÃ¡ÂºÂ³n</button>
          </div>
        </div>`).join('')
    }`;
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.id === 'trash-close') { wrap.remove(); return; }
      const restoreBtn = e.target.closest('.trash-restore');
      const permBtn = e.target.closest('.trash-perm');
      if (restoreBtn) {
        const key = restoreBtn.dataset.key;
        updateItem(COLLECTION, key, {deleted:false, deletedAt:null}).then(() => { wrap.remove(); }).catch(() => {});
      }
      if (permBtn) {
        const key = permBtn.dataset.key;
        deleteItem(COLLECTION, key).then(() => { wrap.remove(); }).catch(() => {});
      }
    });
  }

  function setSelected(key) {
    selectedKey = key;
    const on = !!key;
    [editBtn, delBtn, printBtn].forEach(b => { b.disabled = !on; b.style.opacity = on ? '1' : '.4'; });
    selHint.style.display = on ? 'none' : '';
    container.querySelectorAll('.rep-row').forEach(tr => {
      tr.style.background = tr.dataset.key === key ? '#dbeafe' : '';
    });
    container.querySelectorAll('.rep-radio').forEach(rb => { rb.checked = rb.dataset.key === key; });
    const _db=document.getElementById('rep-deliver-btn'),_sb=document.getElementById('rep-status-btn');
    if(_db){_db.style.display=on?'':'none';_db.disabled=!on;_db.style.opacity=on?'1':'.4';}
    if(_sb){_sb.style.display=on?'':'none';_sb.disabled=!on;_sb.style.opacity=on?'1':'.4';}
  }

  function filterData() {
    const q    = searchEl.value.toLowerCase();
    const st   = statusEl.value;
    const from = dateFromEl.value;
    const to   = dateToEl.value;
    const filtered = allData.filter(r => {
      const matchQ = !q || (r.customerName||'').toLowerCase().includes(q) ||
        (r.phone||'').toLowerCase().includes(q) || (r.device||'').toLowerCase().includes(q) ||
        (r.serial||'').toLowerCase().includes(q);
      const matchSt   = !st || r.status === st;
      const rDate     = r.receivedDate || (r.ts ? new Date(r.ts).toISOString().slice(0,10) : '');
      const matchFrom = !from || rDate >= from;
      const matchTo   = !to   || rDate <= to;
      return matchQ && matchSt && matchFrom && matchTo;
    });
    renderTable(filtered);
  }

  function renderTable(data) {
    const wrap = container.querySelector('#rep-table-wrap');
    if (!data.length) { wrap.innerHTML = '<p style="padding:1rem;color:#888">KhÃÂ´ng cÃÂ³ dÃ¡Â»Â¯ liÃ¡Â»Âu</p>'; return; }
    const cols = [
      { label: '', key: r => '<input type="radio" class="rep-radio" data-key="' + r._key + '" name="rep-sel" style="cursor:pointer;accent-color:#2563eb">' },
      { label: 'NgÃÂ y nhÃ¡ÂºÂ­n',  key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'KhÃÂ¡ch hÃÂ ng', key: r => r.customerName || '' },
      { label: 'SÃÂT',        key: r => r.phone || '' },
      { label: 'ThiÃ¡ÂºÂ¿t bÃ¡Â»Â',   key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',     key: r => r.serial || '' },
      { label: 'KTV',        key: r => r.techName || '' },
      { label: 'Chi phÃÂ­',    key: r => formatVND(r.cost || 0) },
      { label: 'TrÃ¡ÂºÂ¡ng thÃÂ¡i', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' },
      { label: '', key: r => '' }
    ];
    wrap.innerHTML = buildTable(cols, data);

    // Tag tbody rows with data-key and style
    const tbody = wrap.querySelector('tbody');
    if (tbody) {
      [...tbody.querySelectorAll('tr')].forEach((tr, i) => {
        if (!data[i]) return;
        const key = data[i]._key;
        tr.dataset.key = key;
        tr.classList.add('rep-row');
        tr.style.cursor = 'pointer';
        if (key === selectedKey) tr.style.background = '#dbeafe';
        tr.addEventListener('click', e => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          setSelected(key === selectedKey ? null : key);
        });
      });
    }
    wrap.querySelectorAll('.rep-radio').forEach(rb => {
      rb.checked = rb.dataset.key === selectedKey;
      rb.addEventListener('change', () => { if (rb.checked) setSelected(rb.dataset.key); });
    });
    const _rdb=document.getElementById('rep-deliver-btn');
    if(_rdb)_rdb.onclick=()=>{if(selectedKey)quickDeliver(allData.find(r=>r._key===selectedKey));};
    const _rsb=document.getElementById('rep-status-btn');
    if(_rsb)_rsb.onclick=()=>{if(selectedKey)quickChangeStatus(allData.find(r=>r._key===selectedKey));};
  }

  async function quickDeliver(record) {
  if (!record) return;
  const ex = document.getElementById('dv-modal-wrap');
  if (ex) ex.remove();
  _dvItems = (record.deliveryItems && record.deliveryItems.length)
    ? record.deliveryItems.map(i => ({...i}))
    : [{desc: record.issue || '', qty: 1, price: +(record.cost || 0)}];
  const fmtN = n => (+n||0).toLocaleString('vi-VN');
  const today = new Date().toISOString().slice(0,10);
  const dep = +(record.deposit || 0);
  let _dvUnsubInv = null;
  const wrap = document.createElement('div');
  wrap.id = 'dv-modal-wrap';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;';
  const pmSel = v => (record.paymentMethod || 'Tiá»n máº·t') === v ? ' selected' : '';
  wrap.innerHTML =
    '<div style="background:#fff;border-radius:12px;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">' +
    '<div style="background:#1a3a6b;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">' +
    '<span style="font-size:17px;font-weight:700">ð Giao mÃ¡y &amp; Xuáº¥t bill</span>' +
    '<button id="dv-x" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer">Ã</button>' +
    '</div><div style="padding:16px">' +
    '<div style="background:#f0f4ff;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:1.8">' +
    '<strong>ð¤ ' + (record.customerName||'')+'</strong> â '+(record.phone||'')+'<br>' +
    'ð± '+(record.device||'')+( record.serial?' | S/N: '+record.serial:'')+'<br>' +
    'ð§ '+(record.issue||'')+'</div>' +
    '<div style="font-weight:600;margin-bottom:6px">ð Háº¡ng má»¥c dá»ch vá»¥ / linh kiá»n</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">' +
    '<thead><tr style="background:#f5f5f5">' +
    '<th style="padding:6px 8px;border:1px solid #ddd;text-align:left">MÃ´ táº£</th>' +
    '<th style="padding:6px 8px;border:1px solid #ddd;width:55px">SL</th>' +
    '<th style="padding:6px 8px;border:1px solid #ddd;width:110px">ÄÆ¡n giÃ¡</th>' +
    '<th style="padding:6px 8px;border:1px solid #ddd;width:32px"></th>' +
    '</tr></thead><tbody id="dv-tbody"></tbody></table>' +
    '<button id="dv-add" style="font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #1a3a6b;color:#1a3a6b;background:#fff;cursor:pointer;margin-bottom:10px">ï¼ ThÃªm hÃ ng</button>' +
    '<div style="margin-bottom:10px"><div style="font-size:12px;color:#666;margin-bottom:4px">ð Chá»n linh kiá»n tá»« kho:</div>' +
    '<select id="dv-inv" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc;font-size:13px">' +
    '<option value="">-- Chá»n sáº£n pháº©m --</option></select></div>' +
    '<div style="background:#f9f9f9;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tá»ng háº¡ng má»¥c:</span><span id="dv-sub" style="font-weight:600"></span></div>' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tiá»n cá»c:</span><span style="color:#e74c3c">' + fmtN(dep) + ' â«</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #ddd;font-size:14px;font-weight:700">' +
    '<span>ð° CÃN Láº I THANH TOáº¢N:</span><span id="dv-rem" style="color:#1a3a6b"></span></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:13px">' +
    '<div><label style="display:block;margin-bottom:3px;color:#555">Thanh toÃ¡n thÃªm (â«)</label>' +
    '<input id="dv-paid" type="number" value="' + +(record.deliveryPaid||0) + '" min="0" oninput="window._dvCalc()" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box"></div>' +
    '<div><label style="display:block;margin-bottom:3px;color:#555">Giáº£m giÃ¡ (â«)</label>' +
    '<input id="dv-disc" type="number" value="' + +(record.discount||0) + '" min="0" oninput="window._dvCalc()" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box"></div>' +
    '<div><label style="display:block;margin-bottom:3px;color:#555">Báº£o hÃ nh (thÃ¡ng)</label>' +
    '<input id="dv-wm" type="number" value="' + +(record.warrantyMonths||3) + '" min="0" max="24" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box"></div>' +
    '<div><label style="display:block;margin-bottom:3px;color:#555">NgÃ y giao</label>' +
    '<input id="dv-dt" type="date" value="' + (record.deliveredDate||today) + '" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box"></div>' +
    '<div style="grid-column:1/-1"><label style="display:block;margin-bottom:3px;color:#555">HÃ¬nh thÆ°Ìc thanh toÃ¡n</label>' +
    '<select id="dv-pm" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">' +
    '<option value="Tiá»n máº·t"' + pmSel('Tiá»n máº·t') + '>Tiá»n máº·t</option>' +
    '<option value="Chuyá»n khoáº£n"' + pmSel('Chuyá»n khoáº£n') + '>Chuyá»n khoáº£n</option>' +
    '<option value="Tiá»n máº·t + CK"' + pmSel('Tiá»n máº·t + CK') + '>Tiá»n máº·t + CK</option>' +
    '</select></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
    '<button id="dv-cancel" style="padding:8px 18px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer">Há»§y</button>' +
    '<button id="dv-print" style="padding:8px 18px;border-radius:8px;border:none;background:#6c757d;color:#fff;cursor:pointer">ð¨ In bill</button>' +
    '<button id="dv-ok" style="padding:8px 18px;border-radius:8px;border:none;background:#1a3a6b;color:#fff;cursor:pointer;font-weight:600">â XÃ¡c nháº­n giao + In</button>' +
    '</div></div></div>';
  document.body.appendChild(wrap);
  window._dvCalc = () => {
    const sub = _dvItems.reduce((s, i) => s + (+(i.qty||1)) * (+(i.price||0)), 0);
    const paid = +(document.getElementById('dv-paid')?.value || 0);
    const disc = +(document.getElementById('dv-disc')?.value || 0);
    const rem = Math.max(0, sub - dep - paid - disc);
    const eS = document.getElementById('dv-sub');
    const eR = document.getElementById('dv-rem');
    if (eS) eS.textContent = fmtN(sub) + ' â«';
    if (eR) eR.textContent = fmtN(rem) + ' â«';
  };
  window._dvRm = i => {
    if (_dvItems.length > 1) _dvItems.splice(i, 1);
    _rDv(); window._dvCalc();
  };
  window._dvSet = (i, f, v) => {
    _dvItems[i][f] = (f === 'desc') ? v : +v;
    window._dvCalc();
  };
  function _rDv() {
    const tb = document.getElementById('dv-tbody');
    if (!tb) return;
    tb.innerHTML = _dvItems.map((it, i) => (
      '<tr>' +
      '<td style="padding:4px;border:1px solid #eee"><input value="' + (it.desc||'')+
      '" oninput="window._dvSet(' + i + ',\'desc\',this.value)" style="width:100%;border:none;padding:3px;font-size:12px"></td>' +
      '<td style="padding:4px;border:1px solid #eee"><input type="number" value="' + (+(it.qty||1)) +
      '" min="1" oninput="window._dvSet(' + i + ',\'qty\',this.value)" style="width:100%;border:none;padding:3px;font-size:12px;text-align:center"></td>' +
      '<td style="padding:4px;border:1px solid #eee"><input type="number" value="' + (+(it.price||0)) +
      '" min="0" oninput="window._dvSet(' + i + ',\'price\',this.value)" style="width:100%;border:none;padding:3px;font-size:12px;text-align:right"></td>' +
      '<td style="padding:4px;text-align:center;border:1px solid #eee"><button onclick="window._dvRm(' + i + ')" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;line-height:1">Ã</button></td>' +
      '</tr>'
    )).join('');
    window._dvCalc();
  }
  _rDv();
  window._dvCalc();
  document.getElementById('dv-add').onclick = () => { _dvItems.push({desc:'',qty:1,price:0}); _rDv(); };
  _dvUnsubInv = onSnapshot('inventory', items => {
    const sel = document.getElementById('dv-inv');
    if (!sel) return;
    window._dvInv = items.filter(p => +(p.qty||0) > 0);
    sel.innerHTML = '<option value="">-- Chá»n sáº£n pháº©m --</option>' +
      window._dvInv.map((p, idx) =>
        '<option value="' + idx + '">' + (p.name||'') + ' â ' + fmtN(+(p.price||0)) + ' â« (cÃ²n ' + p.qty + ')</option>'
      ).join('');
  });
  document.getElementById('dv-inv').onchange = function() {
    const idx = this.value;
    if (idx === '') return;
    const p = (window._dvInv || [])[+idx];
    if (!p) return;
    _dvItems.push({desc: p.name || '', qty: 1, price: +(p.price || 0)});
    _rDv();
    this.value = '';
  };
  function _closeDv() {
    if (_dvUnsubInv) { try { _dvUnsubInv(); } catch(e){} _dvUnsubInv = null; }
    delete window._dvCalc; delete window._dvRm; delete window._dvSet; delete window._dvInv;
    const el = document.getElementById('dv-modal-wrap');
    if (el) el.remove();
  }
  function _collectDv() {
    return {
      warrantyMonths: +(document.getElementById('dv-wm')?.value || 0),
      deliveredDate: document.getElementById('dv-dt')?.value || today,
      deliveryPaid: +(document.getElementById('dv-paid')?.value || 0),
      discount: +(document.getElementById('dv-disc')?.value || 0),
      paymentMethod: document.getElementById('dv-pm')?.value || 'Tiá»n máº·t',
      cost: _dvItems.reduce((s, i) => s + (+(i.qty||1)) * (+(i.price||0)), 0),
    };
  }
  document.getElementById('dv-x').onclick = _closeDv;
  document.getElementById('dv-cancel').onclick = _closeDv;
  wrap.onclick = e => { if (e.target === wrap) _closeDv(); };
  document.getElementById('dv-print').onclick = () => {
    const d = _collectDv();
    printWarrantyBill({...record, ...d, deliveryItems: [..._dvItems]});
  };
  document.getElementById('dv-ok').onclick = async () => {
    const btn = document.getElementById('dv-ok');
    if (btn) btn.disabled = true;
    const d = _collectDv();
    const updates = {
      status: 'ÄÃ£ giao',
      deliveredDate: d.deliveredDate,
      deliveryItems: [..._dvItems],
      warrantyMonths: d.warrantyMonths,
      deliveryPaid: d.deliveryPaid,
      discount: d.discount,
      paymentMethod: d.paymentMethod,
      cost: d.cost,
    };
    try {
      await updateItem(COLLECTION, record._key, updates);
      toast('â ÄÃ£ giao mÃ¡y thÃ nh cÃ´ng');
      _closeDv();
      printWarrantyBill({...record, ...updates});
    } catch(err) {
      toast('â Lá»i: ' + err.message);
      if (btn) btn.disabled = false;
    }
  };
}

function openForm(record) {
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = `
      <style>#rep-form-wrap .form-group{margin-bottom:8px}#rep-form-wrap label{font-size:.74rem;font-weight:600;margin-bottom:3px;display:block;color:#555}#rep-form-wrap input,#rep-form-wrap select{padding:1px 5px;height:24px;font-size:.82rem}#rep-form-wrap textarea{padding:2px 5px;font-size:.82rem}#rep-form-wrap .form-card{max-width:920px}#rep-edit-btn,#rep-del-btn,#rep-print-btn{display:none}.rep-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px}.rep-modal .form-card{margin:2rem auto;padding:1.5rem 2rem;max-width:860px;width:100%}</style>
      <div class="form-card" style="background:#dbeafe;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
        <h3>${record ? 'CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t phiÃ¡ÂºÂ¿u' : 'ThÃÂªm phiÃ¡ÂºÂ¿u mÃ¡Â»Âi'}</h3>
        <div class="form-grid" style="gap:.2rem">
          <div class="form-group"><label>KhÃÂ¡ch hÃÂ ng *</label><input id="f-customerName" type="text" value="${record?.customerName||''}"/></div>
          <div class="form-group"><label>SÃ¡Â»Â ÃÂiÃ¡Â»Ân thoÃ¡ÂºÂ¡i</label><input id="f-phone" type="text" value="${record?.phone||''}"/></div>
          <div class="form-group"><label>ThiÃ¡ÂºÂ¿t bÃ¡Â»Â *</label><input id="f-device" type="text" value="${record?.device||''}" placeholder="VD: LAPTOP ASUS X556"/></div>
          <div class="form-group"><label>Serial</label><input id="f-serial" type="text" value="${record?.serial||''}"/></div>
          <div class="form-group"><label>ÃÂÃ¡Â»Âa chÃ¡Â»Â</label><input id="f-address" type="text" value="${record?.address||''}"/></div>
          <div class="form-group"><label>MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u mÃÂ¡y</label><input id="f-password" type="text" value="${record?.password||''}"/></div>
          <div class="form-group"><label>PhÃ¡Â»Â¥ kiÃ¡Â»Ân ÃÂi kÃÂ¨m</label><input id="f-accessories" type="text" value="${record?.accessories||''}"/></div>
          <div class="form-group"><label>KÃ¡Â»Â¹ thuÃ¡ÂºÂ­t viÃÂªn</label><input id="f-techName" type="text" value="${record?.techName||''}"/></div>
          <div class="form-group"><label>NgÃÂ y nhÃ¡ÂºÂ­n</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||today}"/></div>
          <div class="form-group"><label>NgÃÂ y giao</label><input id="f-deliveredDate" type="date" value="${record?.deliveredDate||''}"/></div>
          <div class="form-group"><label>Chi phÃÂ­ sÃ¡Â»Â­a (ÃÂ)</label><input id="f-cost" type="number" value="${record?.cost||0}"/></div>
          <div class="form-group"><label>ÃÂÃ¡ÂºÂ·t cÃ¡Â»Âc (ÃÂ)</label><input id="f-deposit" type="number" value="${record?.deposit||0}"/></div>
          <div class="form-group"><label>HÃÂ¬nh thÃ¡Â»Â©c TT</label>
            <select id="f-paymentType">${['TiÃ¡Â»Ân mÃ¡ÂºÂ·t','ChuyÃ¡Â»Ân khoÃ¡ÂºÂ£n','CÃÂ´ng nÃ¡Â»Â£'].map(p=>'<option '+(record?.paymentType===p?'selected':'')+'>'+p+'</option>').join('')}</select>
          </div>
          <div class="form-group"><label>TrÃ¡ÂºÂ¡ng thÃÂ¡i</label>
            <select id="f-status">${STATUS_LIST.map(s=>'<option '+((record?.status||'TiÃ¡ÂºÂ¿p nhÃ¡ÂºÂ­n')===s?'selected':'')+'>'+s+'</option>').join('')}</select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>CÃ¡ÂºÂ¥u hÃÂ¬nh</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.35rem;margin-top:.25rem"><input id="f-cpu" type="text" placeholder="CPU" value="${record?.cpu||''}" /><input id="f-ram" type="text" placeholder="RAM" value="${record?.ram||''}" /><input id="f-ssd" type="text" placeholder="SSD" value="${record?.ssd||''}" /><input id="f-vga" type="text" placeholder="VGA" value="${record?.vga||''}" /></div></div>
        </div>
        <div class="form-group" style="margin-top:.4rem"><label>TÃÂ¬nh trÃ¡ÂºÂ¡ng ban ÃÂÃ¡ÂºÂ§u</label><textarea id="f-initialCondition" rows="3" style="width:100%;resize:vertical">${record?.initialCondition||''}</textarea></div>
        <div class="form-group" style="margin-top:.4rem"><label>YÃÂªu cÃ¡ÂºÂ§u sÃ¡Â»Â­a chÃ¡Â»Â¯a</label><textarea id="f-repairRequest" rows="3" style="width:100%;resize:vertical">${record?.repairRequest||''}</textarea></div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t' : 'LÃÂ°u phiÃ¡ÂºÂ¿u'}</button>
          <button id="f-print" class="btn btn--secondary">Ã°ÂÂÂ¨ In phiÃ¡ÂºÂ¿u</button>
          <button id="f-cancel" class="btn btn--secondary">HÃ¡Â»Â§y</button>
        </div>
      </div>
    `;
    formWrap.classList.add('rep-modal');formWrap.querySelector('.form-card').style.background='#dbeafe';
    formWrap.querySelector('#f-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal'); });
    formWrap.querySelector('#f-print').addEventListener('click', () => {
      const fv = id => formWrap.querySelector('#'+id).value;
      const d = {
        customerName: fv('f-customerName'), phone: fv('f-phone'), address: fv('f-address'),
        device: fv('f-device'), serial: fv('f-serial'), password: fv('f-password'),
        accessories: fv('f-accessories'), techName: fv('f-techName'),
        receivedDate: fv('f-receivedDate'), deliveredDate: fv('f-deliveredDate'),
        cost: fv('f-cost'), deposit: fv('f-deposit'), paymentType: fv('f-paymentType'),
        status: fv('f-status'), cpu: fv('f-cpu'), ram: fv('f-ram'), ssd: fv('f-ssd'), vga: fv('f-vga'), initialCondition: fv('f-initialCondition'),
        repairRequest: fv('f-repairRequest')
      };
      printReceipt(d);
    });
    formWrap.querySelector('#f-save').addEventListener('click', async () => {
      const customerName = formWrap.querySelector('#f-customerName').value.trim();
      if (!customerName) { toast('Vui lÃÂ²ng nhÃ¡ÂºÂ­p khÃÂ¡ch hÃÂ ng', 'error'); return; }
      const data = {
        customerName,
        phone:          formWrap.querySelector('#f-phone').value.trim(),
        address:        formWrap.querySelector('#f-address').value.trim(),
        device:         formWrap.querySelector('#f-device').value.trim(),
        serial:         formWrap.querySelector('#f-serial').value.trim(),
        password:       formWrap.querySelector('#f-password').value.trim(),
        accessories:    formWrap.querySelector('#f-accessories').value.trim(),
        techName:       formWrap.querySelector('#f-techName').value.trim(),
        receivedDate:   formWrap.querySelector('#f-receivedDate').value,
        deliveredDate:  formWrap.querySelector('#f-deliveredDate').value,
        cost:           parseFloat(formWrap.querySelector('#f-cost').value) || 0,
        deposit:        parseFloat(formWrap.querySelector('#f-deposit').value) || 0,
        paymentType:    formWrap.querySelector('#f-paymentType').value,
        status:         formWrap.querySelector('#f-status').value,
        cpu:            formWrap.querySelector('#f-cpu').value.trim(),
        ram:            formWrap.querySelector('#f-ram').value.trim(),
        ssd:            formWrap.querySelector('#f-ssd').value.trim(),
        vga:            formWrap.querySelector('#f-vga').value.trim(),
        initialCondition: formWrap.querySelector('#f-initialCondition').value.trim(),
        repairRequest:  formWrap.querySelector('#f-repairRequest').value.trim(),
        ts: record?.ts || Date.now()
      };
      try {
        if (record) { await updateItem(COLLECTION, record._key, data); toast('ÃÂÃÂ£ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t phiÃ¡ÂºÂ¿u'); }
        else { await addItem(COLLECTION, data); toast('ÃÂÃÂ£ thÃÂªm phiÃ¡ÂºÂ¿u mÃ¡Â»Âi'); }
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal');
      } catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
    });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmDelete(key) {
    const ok = await showModal('XÃÂ¡c nhÃ¡ÂºÂ­n', 'XÃÂ³a phiÃ¡ÂºÂ¿u sÃ¡Â»Â­a chÃ¡Â»Â¯a nÃÂ y?', true);
    if (!ok) return;
    try { await updateItem(COLLECTION, key, {deleted:true, deletedAt:Date.now()}); toast('ÃÂÃÂ£ xÃÂ³a phiÃ¡ÂºÂ¿u'); setSelected(null); }
    catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
  }
}
