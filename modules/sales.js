// modules/sales.js - Ban hang v6
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'sales';
registerRoute('#sales', mount);

const SALES_SHEET_URL = 'https://script.google.com/macros/s/AKfycby1EKgFp101WvCx7v_bTFthGM655wGJ35azbCicNomLw10xz6Fbt-Ycp6ug15FE1_9S/exec';
function logToSheet(data, action) {
  try { fetch(SALES_SHEET_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}).catch(()=>{}); } catch(e){}
}

export async function mount(container) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let unsub = null;
  let invItems = [];
  let currentList = [];
  let editKey = null;
  let filterMode = 'day';

  try {
    const snap = await firebase.database().ref('products').once('value');
    snap.forEach(c => { invItems.push({ _key: c.key, ...c.val() }); });
  } catch(e) {}

  container.innerHTML = `
    <div style="text-align:center;padding:1.25rem 1rem 0.5rem">
      <h2>B\u00e1n h\u00e0ng</h2>
      <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin:.5rem 0">
        <button id="sale-add" class="btn btn--primary" style="margin:0">+ B\u00e1n h\u00e0ng</button>
        <button id="sale-trash-btn" style="padding:.45rem .9rem;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:.85rem;color:#64748b">\uD83D\uDDD1 Th\u00f9ng r\u00e1c</button>
      </div>
      <div style="display:flex;gap:.4rem;justify-content:center;align-items:center;flex-wrap:wrap;margin:.35rem 0">
        <div style="display:flex;border-radius:8px;overflow:hidden;border:1.5px solid #cbd5e1">
          <button id="sale-mode-day" style="padding:.35rem .85rem;border:none;cursor:pointer;font-size:.82rem;font-weight:600;background:#1d4ed8;color:#fff">Ng\u00e0y</button>
          <button id="sale-mode-week" style="padding:.35rem .85rem;border:none;cursor:pointer;font-size:.82rem;font-weight:600;background:transparent;color:#475569">Tu\u1ea7n</button>
          <button id="sale-mode-month" style="padding:.35rem .85rem;border:none;cursor:pointer;font-size:.82rem;font-weight:600;background:transparent;color:#475569">Th\u00e1ng</button>
        </div>
        <input id="sale-date-filter" type="date" value="${todayStr}" style="padding:.35rem .6rem;border:1.5px solid #cbd5e1;border-radius:8px;font-size:.85rem">
      </div>
      <span id="sale-count" style="color:#888;font-size:.9rem"></span>
    </div>
    <div id="sale-form-wrap"></div>
    <div id="sale-list-wrap" style="padding:0 1rem 2rem"></div>
    <div id="sale-trash-wrap" style="display:none;padding:0 1rem 2rem"></div>
  `;

  const addBtn     = container.querySelector('#sale-add');
  const dateFilter = container.querySelector('#sale-date-filter');
  const formWrap   = container.querySelector('#sale-form-wrap');
  const listWrap   = container.querySelector('#sale-list-wrap');
  const countEl    = container.querySelector('#sale-count');
  const trashWrap  = container.querySelector('#sale-trash-wrap');
  const trashBtn   = container.querySelector('#sale-trash-btn');
  const modeDay    = container.querySelector('#sale-mode-day');
  const modeWeek   = container.querySelector('#sale-mode-week');
  const modeMonth  = container.querySelector('#sale-mode-month');

  function getWeekValue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const thu = new Date(d);
    thu.setDate(d.getDate() - ((d.getDay()+6)%7) + 3);
    const firstThu = new Date(thu.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((thu - firstThu) / 864e5 - 3 + (firstThu.getDay()+6)%7) / 7);
    return thu.getFullYear() + '-W' + String(wk).padStart(2, '0');
  }

  function daysAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 86400000);
    return d === 0 ? 'h\u00f4m nay' : d + ' ng\u00e0y tr\u01b0\u1edbc';
  }

  function setMode(mode) {
    filterMode = mode;
    modeDay.style.background   = mode==='day'   ? '#1d4ed8' : 'transparent';
    modeDay.style.color        = mode==='day'   ? '#fff'    : '#475569';
    modeWeek.style.background  = mode==='week'  ? '#1d4ed8' : 'transparent';
    modeWeek.style.color       = mode==='week'  ? '#fff'    : '#475569';
    modeMonth.style.background = mode==='month' ? '#1d4ed8' : 'transparent';
    modeMonth.style.color      = mode==='month' ? '#fff'    : '#475569';
    listWrap.style.display  = mode === 'trash' ? 'none' : '';
    trashWrap.style.display = mode === 'trash' ? ''     : 'none';
    if (mode === 'day') {
      dateFilter.style.display = '';
      dateFilter.type = 'date';
      if (!dateFilter.value) dateFilter.value = todayStr;
    } else if (mode === 'week') {
      dateFilter.style.display = '';
      dateFilter.type = 'week';
      dateFilter.value = getWeekValue(todayStr);
    } else if (mode === 'month') {
      dateFilter.style.display = '';
      dateFilter.type = 'month';
      dateFilter.value = todayStr.slice(0, 7);
    } else {
      dateFilter.style.display = 'none';
    }
    loadSales();
  }

  // ===================== GLOBAL PRODUCT DROPDOWN =====================
  let globalDrop = null;
  let dropTarget = null;

  function ensureGlobalDrop() {
    if (globalDrop && document.body.contains(globalDrop)) return;
    globalDrop = document.createElement('div');
    globalDrop.id = 'sf-prod-drop';
    globalDrop.style.cssText = 'display:none;position:fixed;background:#fff;border:1px solid #1a73e8;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:99999;max-height:220px;overflow-y:auto;min-width:220px';
    document.body.appendChild(globalDrop);
  }

  function positionDrop(inputEl) {
    const r = inputEl.getBoundingClientRect();
    globalDrop.style.top   = (r.bottom + 2) + 'px';
    globalDrop.style.left  = r.left + 'px';
    globalDrop.style.width = Math.max(r.width, 260) + 'px';
  }

  function hideDrop() {
    if (globalDrop) globalDrop.style.display = 'none';
    dropTarget = null;
  }

  function showDrop(q, inputEl, selectCb) {
    ensureGlobalDrop();
    if (!q) { hideDrop(); return; }
    const ql = q.toLowerCase();
    const hits = invItems.filter(p =>
      (p.name||'').toLowerCase().includes(ql) ||
      String(p.id||'').toLowerCase().includes(ql)
    ).slice(0, 10);
    if (!hits.length) { hideDrop(); return; }
    globalDrop.innerHTML = hits.map(p => `
      <div class="sp-opt" data-key="${p._key}"
        style="padding:.45rem .7rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;gap:.5rem">
        <div style="min-width:0">
          <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name||''}</div>
          <div style="font-size:.72rem;color:#888">${p.id||''} ${p.unit ? '\u00b7 '+p.unit : ''}</div>
        </div>
        <div style="font-size:.8rem;font-weight:700;color:#1a3a6b;white-space:nowrap;flex-shrink:0">${formatVND(p.price||0)}</div>
      </div>`).join('');
    globalDrop.querySelectorAll('.sp-opt').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const p = invItems.find(x => x._key === opt.dataset.key);
        if (p) selectCb(p);
        hideDrop();
      });
      opt.addEventListener('mouseover', () => { opt.style.background = '#f0f6ff'; });
      opt.addEventListener('mouseout',  () => { opt.style.background = ''; });
    });
    dropTarget = inputEl;
    positionDrop(inputEl);
    globalDrop.style.display = 'block';
  }

  // ===================== FORM =====================
  function openForm(existing) {
    editKey = existing ? existing._key : null;
    const d = existing || {};
    const rows = (d.items && d.items.length) ? d.items : [{ sku:'', name:'', qty:1, price:0, disc:0 }];

    const warranties = ['Kh\u00f4ng b\u1ea3o h\u00e0nh','1 th\u00e1ng','3 th\u00e1ng','6 th\u00e1ng','12 th\u00e1ng','18 th\u00e1ng','24 th\u00e1ng'];
    const wOpts = warranties.map(w => `<option value="${w}"${(d.warranty||'3 th\u00e1ng')===w?' selected':''}>${w}</option>`).join('');
    const pays = ['Ti\u1ec1n m\u1eb7t','Chuy\u1ec3n kho\u1ea3n','Qu\u1eb9t th\u1ebb'];
    const pOpts = pays.map(p => `<option value="${p}"${(d.payMethod||'Ti\u1ec1n m\u1eb7t')===p?' selected':''}>${p}</option>`).join('');

    formWrap.innerHTML = `
<div style="padding:0 0 80px">
  <style>
    #sale-form-wrap .fcard{background:#fff;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.09);padding:1rem 1.25rem;margin-bottom:1rem}
    #sale-form-wrap .fcard h3{margin:0 0 .85rem;font-size:.97rem;display:flex;align-items:center;gap:.4rem;color:#1e293b;font-weight:700}
    #sale-form-wrap label.flbl{font-size:.72rem;font-weight:700;color:#64748b;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.3px}
    #sale-form-wrap .finput,#sale-form-wrap .form-control{width:100%;box-sizing:border-box;padding:5px 8px;height:32px;font-size:.85rem;border:1px solid #cbd5e1;border-radius:6px;outline:none}
    #sale-form-wrap .finput:focus,#sale-form-wrap .form-control:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.15)}
    #sale-form-wrap table{width:100%;border-collapse:collapse}
    #sale-form-wrap thead th{font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;padding:6px 6px;text-align:left;background:#f8fafc;border-bottom:2px solid #e2e8f0}
    #sale-form-wrap tbody td{padding:3px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    #sale-form-wrap tbody td .finput,#sale-form-wrap tbody td .form-control{height:28px;font-size:.82rem;padding:3px 5px}
    #sale-form-wrap .rtotal{font-weight:600;font-size:.85rem;color:#1e293b;text-align:right;padding-right:6px;white-space:nowrap;min-width:90px}
    #sale-form-wrap .rdel{background:#fee2e2;color:#dc2626;border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;font-size:.9rem}
    #sale-form-wrap .rdel:hover{background:#fecaca}
  </style>
  <div class="fcard">
    <h3>\uD83D\uDC64 Th\u00f4ng tin kh\u00e1ch h\u00e0ng</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem">
      <div><label class="flbl">Kh\u00e1ch h\u00e0ng</label><input id="sf-customer" class="finput" placeholder="T\u00ean..." value="${d.customer||''}"></div>
      <div><label class="flbl">S\u1ed1 \u0111i\u1ec7n tho\u1ea1i</label><input id="sf-phone" class="finput" placeholder="0xxx..." value="${d.phone||''}"></div>
      <div><label class="flbl">Ghi ch\u00fa</label><input id="sf-note" class="finput" placeholder="Ghi ch\u00fa..." value="${d.note||''}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
      <div><label class="flbl">B\u1ea3o h\u00e0nh</label><select id="sf-warranty" class="finput">${wOpts}</select></div>
      <div><label class="flbl">Thanh to\u00e1n</label><select id="sf-paymethod" class="finput">${pOpts}</select></div>
    </div>
  </div>
  <div class="fcard">
    <h3>\uD83D\uDED2 Danh s\u00e1ch s\u1ea3n ph\u1ea9m</h3>
    <table>
      <thead><tr>
        <th style="width:90px">M\u00e3 SP</th><th>T\u00ean SP</th>
        <th style="width:52px;text-align:center">SL</th>
        <th style="width:110px;text-align:right">\u0110\u01a1n gi\u00e1</th>
        <th style="width:68px;text-align:center">G.Gi\u00e1%</th>
        <th style="width:110px;text-align:right">Th\u00e0nh ti\u1ec1n</th>
        <th style="width:36px"></th>
      </tr></thead>
      <tbody id="sf-rows"></tbody>
    </table>
    <button id="sf-add-row" style="margin-top:.5rem;padding:5px 14px;font-size:.85rem;background:#f8fafc;border:1px dashed #94a3b8;border-radius:6px;cursor:pointer;color:#475569;font-weight:600">+ Th\u00eam d\u00f2ng</button>
  </div>
  <div class="fcard">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid #f1f5f9">
      <span style="color:#475569">T\u1ed5ng ti\u1ec1n h\u00e0ng</span>
      <span id="sf-subtotal" style="font-weight:600;font-size:.95rem">0 \u0111</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid #f1f5f9">
      <span style="color:#475569">Gi\u1ea3m gi\u00e1 th\u00eam (\u0111)</span>
      <input id="sf-extra-disc" type="number" class="finput" value="${d.extraDiscount||0}" style="width:120px;text-align:right;font-weight:600">
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:#1a3a6b;border-radius:8px;padding:.7rem 1rem;margin:.5rem 0">
      <span style="color:#fff;font-weight:700;text-transform:uppercase">T\u1ed5ng thanh to\u00e1n</span>
      <span id="sf-total" style="color:#fff;font-weight:700;font-size:1.1rem">0 \u0111</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0">
      <span style="color:#475569">Kh\u00e1ch tr\u1ea3 (\u0111)</span>
      <input id="sf-paid" type="number" class="finput" value="${d.paid||0}" style="width:120px;text-align:right;font-weight:600">
    </div>
  </div>
</div>
<div style="position:sticky;bottom:0;left:0;right:0;display:flex;gap:.5rem;padding:.65rem 1rem;background:#fff;border-top:2px solid #e2e8f0;box-shadow:0 -2px 12px rgba(0,0,0,.08)">
  <button id="sf-print" style="flex:1;padding:.6rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">\uD83D\uDDB8 In Bill + BH</button>
  <button id="sf-save" style="flex:1.5;padding:.6rem;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">\uD83D\uDCBE L\u01b0u \u0110\u01a1n H\u00e0ng</button>
  ${existing ? `<button id="sf-del" style="padding:.6rem .75rem;background:#fff;color:#dc2626;border:1.5px solid #dc2626;border-radius:8px;font-size:1rem;cursor:pointer">\uD83D\uDDD1</button>` : ''}
</div>
`;

    rows.forEach(r => addRow(r));
    recalc();

    formWrap.querySelector('#sf-add-row').onclick = () => { addRow({}); recalc(); };
    formWrap.querySelector('#sf-extra-disc').oninput = recalc;
    formWrap.querySelector('#sf-save').onclick = saveForm;
    formWrap.querySelector('#sf-print').onclick = () => {
      const rr = Array.from(formWrap.querySelectorAll('#sf-rows tr')).map(tr => ({
        sku: tr.querySelector('.rsku')?.value||'', name: tr.querySelector('.rname')?.value||'',
        qty: parseFloat(tr.querySelector('.rqty')?.value)||1,
        price: parseFloat(tr.querySelector('.rprice')?.value)||0,
        disc: parseFloat(tr.querySelector('.rdisc')?.value)||0
      }));
      const sub = rr.reduce((s,r) => s + r.qty*r.price*(1-r.disc/100), 0);
      const ex = parseFloat(formWrap.querySelector('#sf-extra-disc')?.value)||0;
      printSaleBill({
        customer: formWrap.querySelector('#sf-customer')?.value||'',
        phone: formWrap.querySelector('#sf-phone')?.value||'',
        note: formWrap.querySelector('#sf-note')?.value||'',
        warranty: formWrap.querySelector('#sf-warranty')?.value||'',
        payMethod: formWrap.querySelector('#sf-paymethod')?.value||'',
        date: dateFilter.value||'', items: rr, subtotal: sub, extraDiscount: ex,
        total: Math.max(0, sub-ex),
        paid: parseFloat(formWrap.querySelector('#sf-paid')?.value)||0
      });
    };
    if (existing) {
      formWrap.querySelector('#sf-del').onclick = () => showModal({
        title: 'X\u00f3a \u0111\u01a1n h\u00e0ng',
        body: '\u0110\u01a1n s\u1ebd v\u00e0o th\u00f9ng r\u00e1c, t\u1ef1 x\u00f3a sau 7 ng\u00e0y.',
        confirmText: 'X\u00f3a',
        onConfirm: async () => {
          await updateItem(COLLECTION, existing._key, { ...existing, deletedAt: Date.now() });
          formWrap.innerHTML = ''; editKey = null;
          toast('\u0110\u00e3 chuy\u1ec3n v\u00e0o th\u00f9ng r\u00e1c');
        }
      });
    }
  }

  // ===================== ADD ROW =====================
  function addRow(item) {
    item = item || {};
    const tbody = formWrap.querySelector('#sf-rows');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f5f5f5';
    const nm = String(item.name||'').replace(/"/g,'&quot;');
    tr.innerHTML = `
      <td style="padding:.32rem .4rem"><input class="rsku form-control" style="font-size:.8rem;width:70px" placeholder="M\u00e3" value="${item.sku||''}"></td>
      <td style="padding:.32rem .4rem"><input class="rname form-control" style="font-size:.8rem;width:100%" placeholder="G\u00f5 t\u00ean SP..." value="${nm}" autocomplete="off"></td>
      <td style="padding:.32rem .4rem"><input class="rqty form-control" type="number" min="1" value="${item.qty||1}" style="text-align:center;font-size:.8rem;width:48px"></td>
      <td style="padding:.32rem .4rem"><input class="rprice form-control" type="number" min="0" value="${item.price||0}" style="text-align:right;font-size:.8rem;width:100px"></td>
      <td style="padding:.32rem .4rem"><input class="rdisc form-control" type="number" min="0" max="100" value="${item.disc||0}" style="text-align:center;font-size:.8rem;width:55px"></td>
      <td class="rtotal" style="padding:.32rem .4rem;text-align:right;font-weight:600;font-size:.85rem;white-space:nowrap;color:#1a3a6b">0 \u0111</td>
      <td style="padding:.32rem .4rem"><button class="rdel" style="background:#ff4d4f;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:.85rem;line-height:1">\u00d7</button></td>
    `;
    const rname = tr.querySelector('.rname');
    const rsku  = tr.querySelector('.rsku');
    const rprice = tr.querySelector('.rprice');
    function selectProduct(p) { rname.value=p.name||''; rsku.value=p.id||''; rprice.value=p.price||0; recalc(); }
    rname.addEventListener('input',  () => showDrop(rname.value.trim(), rname, selectProduct));
    rname.addEventListener('focus',  () => { if (rname.value.trim()) showDrop(rname.value.trim(), rname, selectProduct); });
    rname.addEventListener('blur',   () => setTimeout(() => { if (dropTarget===rname) hideDrop(); }, 200));
    rname.addEventListener('keydown', e => {
      if (e.key==='Escape') hideDrop();
      if (e.key==='Enter' && globalDrop && globalDrop.style.display!=='none') {
        const first = globalDrop.querySelector('.sp-opt');
        if (first) { e.preventDefault(); const p=invItems.find(x=>x._key===first.dataset.key); if(p) selectProduct(p); hideDrop(); }
      }
    });
    tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalc));
    tr.querySelector('.rdel').onclick = () => { tr.remove(); recalc(); };
    tbody.appendChild(tr);
    const q=parseFloat(item.qty)||1, p=parseFloat(item.price)||0, dc=parseFloat(item.disc)||0;
    tr.querySelector('.rtotal').textContent = formatVND(q*p*(1-dc/100));
  }

  // ===================== RECALC =====================
  function recalc() {
    let sub = 0;
    formWrap.querySelectorAll('#sf-rows tr').forEach(tr => {
      const q=parseFloat(tr.querySelector('.rqty')?.value)||0;
      const p=parseFloat(tr.querySelector('.rprice')?.value)||0;
      const d=parseFloat(tr.querySelector('.rdisc')?.value)||0;
      const t=q*p*(1-d/100);
      const cell=tr.querySelector('.rtotal');
      if (cell) cell.textContent=formatVND(t);
      sub+=t;
    });
    const ex=parseFloat(formWrap.querySelector('#sf-extra-disc')?.value)||0;
    const sel=s=>formWrap.querySelector(s);
    if (sel('#sf-subtotal')) sel('#sf-subtotal').textContent=formatVND(sub);
    if (sel('#sf-total')) sel('#sf-total').textContent=formatVND(Math.max(0,sub-ex));
  }

  // ===================== SAVE =====================
  async function saveForm() {
    const rows = Array.from(formWrap.querySelectorAll('#sf-rows tr')).map(tr => {
      const q=parseFloat(tr.querySelector('.rqty')?.value)||1;
      const p=parseFloat(tr.querySelector('.rprice')?.value)||0;
      const d=parseFloat(tr.querySelector('.rdisc')?.value)||0;
      return { sku:tr.querySelector('.rsku')?.value||'', name:tr.querySelector('.rname')?.value||'', qty:q, price:p, disc:d, total:q*p*(1-d/100) };
    });
    const sub=rows.reduce((s,r)=>s+r.total,0);
    const ex=parseFloat(formWrap.querySelector('#sf-extra-disc')?.value)||0;
    const g=id=>formWrap.querySelector(id)?.value||'';
    const data = {
      customer:g('#sf-customer'), phone:g('#sf-phone'), note:g('#sf-note'),
      warranty:g('#sf-warranty'), payMethod:g('#sf-paymethod'),
      date:dateFilter.value, items:rows, subtotal:sub, extraDiscount:ex,
      total:Math.max(0,sub-ex), paid:parseFloat(formWrap.querySelector('#sf-paid')?.value)||0,
      createdAt:Date.now()
    };
    try {
      if (editKey) { await updateItem(COLLECTION, editKey, data); toast('C\u1eadp nh\u1eadt th\u00e0nh c\u00f4ng'); await logToSheet({...data, key:editKey}, 'update'); }
      else { const _r = await addItem(COLLECTION, data); toast('L\u01b0u \u0111\u01a1n th\u00e0nh c\u00f4ng'); await logToSheet({...data, key:_r?.key||''}, 'add'); }
      formWrap.innerHTML=''; editKey=null;
    } catch(e) { toast('L\u1ed7i: '+e.message); }
  }

  // ===================== LIST =====================
  function renderList(items) {
    currentList = items;
    countEl.textContent = '(' + items.length + ')';
    if (!items.length) {
      listWrap.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem 0">Ch\u01b0a c\u00f3 \u0111\u01a1n n\u00e0o</p>';
      return;
    }
    const _doanhthu = items.reduce((s,i)=>s+(parseFloat(i.total)||0),0);
    listWrap.innerHTML = `<div style="background:#1a3a6b;color:#fff;padding:8px 14px;border-radius:8px;margin-bottom:10px;display:flex;gap:20px;font-size:13px">📊 <b>${items.length}</b> đơn hàng &nbsp;|  💰 Doanh thu: <b>${_doanhthu.toLocaleString('vi-VN')}đ</b></div>` +
  `<div id="sale-shared-acts" style="display:none;margin-bottom:.8rem;padding:.5rem .8rem;background:#eef5ff;border-radius:8px;border:1px solid #c7defa;gap:.5rem;flex-wrap:wrap;align-items:center">` +
  `<span style="flex:1;font-size:.85rem;color:#555">&#9432; � ch�n: <b id="sale-sel-name"></b></span>` +
  `<button id="sale-act-detail" style="background:#e0f0ff;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">Chi ti�t</button>` +
  `<button id="sale-act-print" style="background:#dcfce7;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">In</button>` +
  `<button id="sale-act-bh" style="background:#fef9c3;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">BH</button>` +
  `<button id="sale-act-edit-bh" style="background:#fb923c;color:#fff;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">Sửa BH</button>` +
  `<button id="sale-act-edit" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">S�a</button>` +
  `<button id="sale-act-del" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:.35rem .8rem;cursor:pointer">X�a</button>` +
  `</div>`
  + items.map(s => `
      <div class="card" style="background:#fff; ;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.07);margin-botconst _r = await addItem(COLLECTION, data); >
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1">
            <input type="checkbox" class="sale-cb" data-key="${s._key}" style="cursor:pointer;width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600">${s.customer||'Kh\u00e1ch l\u1ebb'}</div>
              <div style="font-size:.78rem;color:#888;margin-top:.15rem">${[s.phone,s.note].filter(Boolean).join(' \u00b7 ')}</div>
            </div>
          </label>
          <div style="text-align:right;flex-shrink:0;margin-left:.5rem">
            <div style="font-weight:700;color:#1a3a6b">${formatVND(s.total||0)}</div>
            <div style="font-size:.72rem;color:#888">${s.date||''} \u00b7 ${s.payMethod||''}</div>
          </div>
        </div>
      </div>
    `).join('');



        let _selKey = null;
    listWrap.querySelectorAll('.sale-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          listWrap.querySelectorAll('.sale-cb').forEach(o => { if (o !== cb) o.checked = false; });
          _selKey = cb.dataset.key;
          const bar = document.getElementById('sale-shared-acts');
          if (bar) {
            bar.style.display = 'flex';
            const _s = currentList.find(x => x._key === _selKey);
            const nm = document.getElementById('sale-sel-name');
            if (nm) nm.textContent = (_s && _s.customer) ? _s.customer : '';
          }
        } else {
          _selKey = null;
          const bar = document.getElementById('sale-shared-acts');
          if (bar) bar.style.display = 'none';
        }
      });
    });
    const _getS = () => currentList.find(x => x._key === _selKey);
    document.getElementById('sale-act-detail').onclick = () => {
      const s = _getS(); if (!s) return;
            const rhtml = (s.items||[]).map(r =>
        `<tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:.3rem .4rem">${r.sku||''}</td><td style="padding:.3rem .4rem">${r.name||''}</td>
          <td style="padding:.3rem .4rem;text-align:center">${r.qty}</td>
          <td style="padding:.3rem .4rem;text-align:right">${formatVND(r.price)}</td>
          <td style="padding:.3rem .4rem;text-align:center">${r.disc||0}%</td>
          <td style="padding:.3rem .4rem;text-align:right;font-weight:600">${formatVND(r.total||0)}</td>
        </tr>`).join('');
      showModal({ title: 'Chi ti\u1ebft: '+(s.customer||'Kh\u00e1ch l\u1ebb'),
        body: `<p style="font-size:.85rem;color:#666;margin-bottom:.5rem">\uD83D\uDCC5 ${s.date} | ${s.payMethod||''} | BH: ${s.warranty||''}</p>
          <table style="width:100%;font-size:.82rem;border-collapse:collapse">
            <thead><tr style="background:#f8f9fa;font-size:.7rem;text-transform:uppercase">
              <th style="padding:.3rem .4rem;text-align:left">M\u00e3</th><th style="padding:.3rem .4rem;text-align:left">T\u00ean</th>
              <th style="padding:.3rem .4rem;text-align:center">SL</th><th style="padding:.3rem .4rem;text-align:right">\u0110G</th>
              <th style="padding:.3rem .4rem;text-align:center">Gi\u1ea3m</th><th style="padding:.3rem .4rem;text-align:right">TT</th>
            </tr></thead><tbody>${rhtml}</tbody></table>
          <p style="text-align:right;font-weight:700;margin-top:.5rem">T\u1ed5ng: ${formatVND(s.total||0)}</p>`
      });

    };
    document.getElementById('sale-act-print').onclick = () => { const s = _getS(); if (s) printSaleBill(s); };
    document.getElementById('sale-act-bh').onclick = () => { const s = _getS(); if (s) printWarrantySlip(s); };
    document.getElementById('sale-act-edit-bh').onclick = () => { const s = _getS(); if (s) openEditBH(s); };
    document.getElementById('sale-act-edit').onclick = () => { const s = _getS(); if (s) { openForm(s); window.scrollTo(0,0); } };
    document.getElementById('sale-act-del').onclick = () => {
      const item = _getS(); if (!item) return;
      showModal({
        title: 'X�a �n h�ng', body: '�n s�d v�o th�ng r�c, t� x�a sau 7 ng�y.',
        confirmText: 'X�a',
        onConfirm: async () => {
          await updateItem(COLLECTION, item._key, { ...item, deletedAt: Date.now() });
          logToSheet({...item, deletedAt: Date.now()}, 'delete');
          toast('� chuy�n v�o th�ng r�c');
        }
      });
    };
  }

  // ===================== TRASH =====================
  function renderTrash(items) {
    const now = Date.now();
    const WEEK = 7*24*60*60*1000;
    const trashItems = items.filter(s => s.deletedAt && (now-s.deletedAt) < WEEK);
    countEl.textContent = '(' + trashItems.length + ')';
    if (!trashItems.length) {
      trashWrap.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem 0">\uD83D\uDDD1 Th\u00f9ng r\u00e1c tr\u1ed1ng</p>';
      return;
    }
    trashWrap.innerHTML = `<p style="font-size:.82rem;color:#dc2626;padding:.3rem 0 .6rem;font-weight:600">\uD83D\uDDD1 Th\u00f9ng r\u00e1c \u00b7 T\u1ef1 x\u00f3a sau 7 ng\u00e0y</p>` +
      trashItems.map(s => `
        <div style="background:#fff7f7;border:1px solid #fecaca;border-radius:10px;margin-bottom:.65rem;padding:.8rem 1rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.45rem">
            <div>
              <div style="font-weight:600;color:#374151">${s.customer||'Kh\u00e1ch l\u1ebb'}</div>
              <div style="font-size:.75rem;color:#9ca3af;margin-top:2px">${s.date||''} \u00b7 ${s.payMethod||''} \u00b7 X\u00f3a ${daysAgo(s.deletedAt)}</div>
            </div>
            <div style="font-weight:700;color:#1a3a6b;margin-left:.5rem">${formatVND(s.total||0)}</div>
          </div>
          <div style="display:flex;gap:.4rem">
            <button class="btn-restore" data-key="${s._key}" style="padding:4px 12px;background:#dcfce7;color:#16a34a;border:1px solid #86efac;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600">\u21a9 Kh\u00f4i ph\u1ee5c</button>
            <button class="btn-print" data-key="${s._key}" style="padding:4px 10px;background:#f0f9ff;color:#0284c7;border:1px solid #7dd3fc;border-radius:6px;cursor:pointer;font-size:.8rem">\uD83D\uDDB8 In</button>
          </div>
        </div>
      `).join('');

    trashWrap.querySelectorAll('.btn-restore').forEach(b => b.onclick = async () => {
      const item = trashItems.find(x => x._key === b.dataset.key);
      if (!item) return;
      const { deletedAt, ...rest } = item;
      await updateItem(COLLECTION, b.dataset.key, rest);
      logToSheet(rest, 'restore');
      toast('\u0110\u00e3 kh\u00f4i ph\u1ee5c \u0111\u01a1n h\u00e0ng');
    });

    trashWrap.querySelectorAll('.btn-print').forEach(b => b.onclick = () => {
      const s = trashItems.find(x => x._key === b.dataset.key);
      if (s) printSaleBill(s);
    });
  }

  // ===================== LOAD =====================
  function loadSales() {
    if (unsub) { unsub(); unsub = null; }
    const val = dateFilter.value;
    unsub = onSnapshot(COLLECTION, all => {
      const now = Date.now();
      const WEEK = 7*24*60*60*1000;
      all.filter(s => s.deletedAt && (now-s.deletedAt) > WEEK)
        .forEach(s => deleteItem(COLLECTION, s._key).catch(()=>{}));
      if (filterMode === 'trash') { renderTrash(all.filter(s => s.deletedAt)); return; }
      const active = all.filter(s => !s.deletedAt);
      let filtered;
      if (filterMode === 'day') {
        filtered = active.filter(s => (s.date||'').startsWith(val));
      } else if (filterMode === 'week') {
        filtered = active.filter(s => getWeekValue(s.date||'') === val);
      } else if (filterMode === 'month') {
        filtered = active.filter(s => (s.date||'').startsWith(val));
      } else {
        filtered = active;
      }
      renderList(filtered);
    });
  }

  modeDay.onclick   = () => setMode('day');
  modeWeek.onclick  = () => setMode('week');
  modeMonth.onclick = () => setMode('month');
  trashBtn.onclick  = () => {
    filterMode = 'trash';
    listWrap.style.display = 'none'; trashWrap.style.display = '';
    dateFilter.style.display = 'none';
    modeDay.style.background = 'transparent'; modeDay.style.color = '#475569';
    modeWeek.style.background = 'transparent'; modeWeek.style.color = '#475569';
    modeMonth.style.background = 'transparent'; modeMonth.style.color = '#475569';
    loadSales();
  };
  addBtn.onclick = () => { editKey=null; openForm(null); window.scrollTo(0, formWrap.offsetTop-60); };
  dateFilter.addEventListener('change', loadSales);

  function printSaleBill(d) {
  const key = d._key || '';
  const e = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const fmt = n => (parseFloat(n)||0).toLocaleString('vi-VN');
  const items = Array.isArray(d.items) ? d.items : [];
  const itemRows = items.map((it,idx) =>
    '<tr>'
    +'<td style="font-size:11px">'+e(it.sku||'')+'</td>'
    +'<td>'+e(it.name||'')+'</td>'
    +'<td style="text-align:right">'+e(it.qty||0)+'</td>'
    +'<td style="text-align:right">'+fmt(it.price)+'</td>'
    +'<td style="text-align:right">'+fmt(it.disc||0)+'</td>'
    +'<td style="text-align:right">'+fmt((parseFloat(it.qty)||0)*(parseFloat(it.price)||0)-(parseFloat(it.disc)||0))+'</td>'
    +'</tr>'
  ).join('');
  const total = parseFloat(d.total)||0;
  const paid = parseFloat(d.paid)||0;
  const debt = total - paid;
  const w = window.open('', '_blank', 'width=820,height=750,scrollbars=yes');
  if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hóa Đơn</title>'
    +'<style>body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:16px}h2{text-align:center;margin:0 0 2px;font-size:17px}.sub{text-align:center;font-size:12px;margin-bottom:10px;color:#555}table{width:100%;border-collapse:collapse}th,td{padding:4px 5px;border:1px solid #ddd;font-size:12px}th{background:#f3f4f6;text-align:left}.nr{text-align:right}.info-table td{border:none;padding:3px 5px}.lb{width:35%;font-weight:bold}.vl{width:65%}.bi{width:100%;border:none;border-bottom:1px dashed #aaa;background:transparent;font:12px Arial;padding:1px 2px;outline:none;box-sizing:border-box}.bi:focus{border-bottom:1px solid #2563eb;background:#eff6ff}.bbar{text-align:center;margin-top:14px;padding:8px;border-top:1px solid #ddd}.bbar button{padding:7px 18px;margin:0 4px;cursor:pointer;border:1px solid #ccc;border-radius:4px;font-size:13px}.bs{background:#16a34a;color:#fff;border-color:#16a34a}.bp{background:#2563eb;color:#fff;border-color:#2563eb}#msg{display:none;color:#16a34a;font-weight:bold;margin-top:8px}.tot-row{font-weight:bold;background:#f9fafb}@media print{.bbar{display:none!important}.bi{border:none!important;background:transparent!important;border-bottom:1px solid #999!important}}</style>'
    +'</head><body>'
    +'<h2>HÓA ĐƠN BÁN HÀNG</h2><div class="sub">Laptop 24h</div>'
    +'<table class="info-table" style="margin-bottom:8px">'
    +'<tr><td class="lb">Khách hàng</td><td class="vl"><input class="bi" data-f="customer" value="'+e(d.customer)+'"></td>'
    +'<td class="lb">Điện thoại</td><td class="vl"><input class="bi" data-f="phone" value="'+e(d.phone)+'"></td></tr>'
    +'<tr><td class="lb">Ngày</td><td class="vl">'+e(d.date||new Date().toLocaleDateString('vi-VN'))+'</td>'
    +'<td class="lb">Thanh toán</td><td class="vl"><input class="bi" data-f="payMethod" value="'+e(d.payMethod)+'"></td></tr>'
    +'<tr><td class="lb">Bảo hành</td><td class="vl"><input class="bi" data-f="warranty" value="'+e(d.warranty)+'"></td>'
    +'<td class="lb">Ghi chú</td><td class="vl"><input class="bi" data-f="note" value="'+e(d.note)+'"></td></tr>'
    +'</table>'
    +'<table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th class="nr">SL</th><th class="nr">Đơn giá</th><th class="nr">CK</th><th class="nr">Thành tiền</th></tr></thead>'
    +'<tbody>'+itemRows+'</tbody></table>'
    +'<table style="margin-top:6px;width:50%;margin-left:50%"><tr class="tot-row"><td>Tổng cộng</td><td class="nr">'+fmt(total)+'đ</td></tr>'
    +'<tr><td>Đã trả</td><td class="nr"><input class="bi nr" data-f="paid" type="number" value="'+paid+'" style="text-align:right;width:100%"></td></tr>'
    +'<tr class="tot-row"><td>Còn lại</td><td class="nr" id="debt">'+fmt(debt)+'đ</td></tr></table>'
    +'<div class="bbar">'
    +(key ? '<button class="bs" onclick="saveBill()">&#128190; Lưu</button>' : '')
    +'<button class="bp" onclick="window.print()">&#128424; In hóa đơn</button>'
    +'<button onclick="window.close()">Đóng</button>'
    +'<div id="msg">&#10003; Đã lưu thành công!</div>'
    +'</div>'
    +'<script>var _k="'+key+'",_tot='+total+';'
    +'document.querySelector("[data-f=paid]").addEventListener("input",function(){'
    +'var debt=_tot-(parseFloat(this.value)||0);'
    +'document.getElementById("debt").textContent=debt.toLocaleString("vi-VN")+"đ";'
    +'});'
    +'function saveBill(){'
    +'var d={};'
    +'document.querySelectorAll(".bi[data-f]").forEach(function(el){'
    +'d[el.dataset.f]=el.type==="number"?(parseFloat(el.value)||0):el.value;'
    +'});'
    +'if(window.opener&&window.opener.saleSaveFromBill){'
    +'window.opener.saleSaveFromBill(_k,d).then(function(){'
    +'document.getElementById("msg").style.display="block";'
    +'setTimeout(function(){document.getElementById("msg").style.display="none";},3000);'
    +'});'
    +'}else{alert("Không thể lưu. Mở lại phiếu từ trang chính.");}'
    +'}'
    +'</scr'+'ipt>'
    +'</body></html>');
  w.document.close();
}

window.saleSaveFromBill = async function(key, data) {
  await updateItem('sales', key, data);
};


function openEditBH(sale) {
  const warranties = ['3 tháng','6 tháng','12 tháng','18 tháng','24 tháng'];
  const wOpts = warranties.map(w => `<option value="${w}"${(sale.warranty||'3 tháng')===w?' selected':''}>${w}</option>`).join('');
  const ov = document.createElement('div');
  ov.id = 'bh-edit-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.5rem;width:min(380px,92vw);box-shadow:0 4px 24px rgba(0,0,0,.2)">
      <h3 style="margin:0 0 1rem;text-align:center;color:#92400e">&#x2712;&#xfe0f; Sửa Bill Bảo Hành</h3>
      <div style="margin-bottom:.75rem"><label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.25rem">Khách hàng</label>
        <input id="bh-customer" value="${(sale.customer||'').replace(/"/g,'&quot;')}" style="width:100%;padding:.4rem .6rem;border:1px solid #ddd;border-radius:6px;box-sizing:border-box"></div>
      <div style="margin-bottom:.75rem"><label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.25rem">Số điện thoại</label>
        <input id="bh-phone" value="${(sale.phone||'').replace(/"/g,'&quot;')}" style="width:100%;padding:.4rem .6rem;border:1px solid #ddd;border-radius:6px;box-sizing:border-box"></div>
      <div style="margin-bottom:.75rem"><label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.25rem">Ngày mua</label>
        <input id="bh-date" type="date" value="${sale.date||''}" style="width:100%;padding:.4rem .6rem;border:1px solid #ddd;border-radius:6px;box-sizing:border-box"></div>
      <div style="margin-bottom:1rem"><label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.25rem">Thời hạn bảo hành</label>
        <select id="bh-warranty" style="width:100%;padding:.4rem .6rem;border:1px solid #ddd;border-radius:6px;box-sizing:border-box">${wOpts}</select></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button id="bh-cancel" style="padding:.45rem 1rem;border:1px solid #ddd;border-radius:6px;background:#f9fafb;cursor:pointer">Hủy</button>
        <button id="bh-save" style="padding:.45rem 1rem;border:none;border-radius:6px;background:#f59e0b;color:#fff;font-weight:600;cursor:pointer">Lưu &amp; In BH</button>
      </div></div>`;
  document.body.appendChild(ov);
  document.getElementById('bh-cancel').onclick = () => document.body.removeChild(ov);
  document.getElementById('bh-save').onclick = async () => {
    const updated = { ...sale,
      customer: document.getElementById('bh-customer').value.trim(),
      phone: document.getElementById('bh-phone').value.trim(),
      date: document.getElementById('bh-date').value,
      warranty: document.getElementById('bh-warranty').value
    };
    await updateItem(COLLECTION, sale._key, updated);
    logToSheet({...updated, key: sale._key}, 'update');
    toast('Đã cập nhật bảo hành');
    document.body.removeChild(ov);
    printWarrantySlip(updated);
  };
}

function printWarrantySlip(d) {
  var fmt = n => Number(n||0).toLocaleString('vi-VN');
  var itemRows = (d.items||[]).map((it,i) =>
    '<tr><td style="padding:4px 6px;text-align:center">'+(i+1)+'</td>'+
    '<td style="padding:4px 6px">'+(it.name||it.sku||'')+'</td>'+
    '<td style="padding:4px 6px;text-align:center">'+(it.qty||1)+'</td>'+
    '<td style="padding:4px 6px;text-align:right">'+fmt(it.price)+'\u0111</td></tr>'
  ).join('');
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'+
    '<title>Phi\u1ebfu B\u1ea3o H\u00e0nh</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;padding:16px;max-width:400px;margin:auto}'+
    'h2{text-align:center;font-size:18px;margin-bottom:2px}'+
    '.sub{text-align:center;font-size:11px;color:#555;margin-bottom:12px}'+
    '.title{text-align:center;font-size:15px;font-weight:bold;margin:10px 0;text-transform:uppercase;border:2px solid #000;padding:6px}'+
    '.info{margin:5px 0}.info b{font-weight:bold}'+
    'table{width:100%;border-collapse:collapse;margin:8px 0}'+
    'th{background:#333;color:#fff;padding:5px 6px;font-size:12px}'+
    'td{border-bottom:1px solid #eee;font-size:12px}'+
    '.bh{background:#fffbe6;border:2px solid #f59e0b;border-radius:6px;padding:8px;margin:10px 0;text-align:center;font-size:15px;font-weight:bold}'+
    '.sign{display:flex;justify-content:space-between;margin-top:20px;font-size:12px}'+
    '.line{border-top:1px solid #333;margin-top:28px;padding-top:3px;text-align:center;font-size:11px;color:#555}'+
    '@media print{body{padding:4px}}</style></head><body>'+
    '<h2>LAPTOP 24H</h2>'+
    '<div class="sub">\u0110T: 0909 xxx xxx</div>'+
    '<div class="title">PHI\u1EBCU B\u1EA2O H\u00c0NH</div>'+
    '<div class="info">Kh\u00e1ch h\u00e0ng: <b>'+(d.customer||'')+'</b></div>'+
    '<div class="info">S\u0110T: <b>'+(d.phone||'')+'</b></div>'+
    '<div class="info">Ng\u00e0y mua: <b>'+(d.date||'')+'</b></div>'+
    '<table><thead><tr><th>#</th><th>S\u1ea3n ph\u1ea9m</th><th>SL</th><th>\u0110\u01a1n gi\u00e1</th></tr></thead><tbody>'+itemRows+'</tbody></table>'+
    '<div class="bh">B\u1ea2O H\u00c0NH: '+(d.warranty||'Kh\u00f4ng b\u1ea3o h\u00e0nh')+'</div>'+
    '<p style="font-size:11px;color:#555;margin:4px 0">* B\u1ea3o h\u00e0nh t\u00ednh t\u1eeb ng\u00e0y mua. Mang phi\u1ebfu n\u00e0y khi c\u1ea7n b\u1ea3o h\u00e0nh.</p>'+
    '<div class="sign">'+
    '<div>Kh\u00e1ch h\u00e0ng<br><br><br><span style="font-size:11px;color:#777">(K\u00fd t\u00ean)</span></div>'+
    '<div style="text-align:right">C\u1eeda h\u00e0ng<br><br><br><span style="font-size:11px;color:#777">(K\u00fd t\u00ean, \u0111\u00f3ng d\u1ea5u)</span></div>'+
    '</div>'+
    '<div class="line">C\u1ea3m \u01a1n qu\u00fd kh\u00e1ch \u0111\u00e3 tin t\u01b0\u1edfng Laptop 24H!</div>'+
    '</body></html>';
  var _pif = document.createElement('iframe');
  _pif.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
  document.body.appendChild(_pif);
  var _pd = _pif.contentDocument || _pif.contentWindow.document;
  _pd.open(); _pd.write(html); _pd.close();
  _pif.contentWindow.focus();
  _pif.contentWindow.print();
  setTimeout(function(){ document.body.removeChild(_pif); }, 500);
}

  loadSales();
}
