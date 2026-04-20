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
  const giao = record.deliveredDate || record.receivedDate || '';
  let warrantyEnd = 'KhÃÂ´ng bÃ¡ÂºÂ£o hÃÂ nh';
  if (record.warrantyMonths > 0 && giao) {
    const d = new Date(giao);
    d.setMonth(d.getMonth() + (record.warrantyMonths || 0));
    warrantyEnd = d.toLocaleDateString('vi-VN');
  }
  const remaining = (record.cost || 0) - (record.deposit || 0) - (record.discount || 0);
  const win = window.open('', '_blank', 'width=420,height=650');
  win.document.write('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Bill BÃ¡ÂºÂ£o HÃÂ nh</title><style>' +
    '* { margin:0; padding:0; box-sizing:border-box; }' +
    'body { font-family: Arial, sans-serif; font-size: 13px; padding: 16px; max-width: 380px; margin: 0 auto; }' +
    '.header { text-align: center; margin-bottom: 10px; }' +
    '.header h2 { font-size: 20px; font-weight: bold; letter-spacing: 1px; }' +
    '.header p { font-size: 12px; color: #555; }' +
    '.divider { border-top: 1px dashed #999; margin: 8px 0; }' +
    '.title { text-align: center; font-size: 15px; font-weight: bold; margin: 8px 0; text-transform: uppercase; letter-spacing: 1px; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'td { padding: 4px 2px; vertical-align: top; }' +
    'td:first-child { width: 38%; font-weight: 600; color: #333; white-space: nowrap; }' +
    '.total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #333; padding-top: 6px; }' +
    '.wbox { border: 2px solid #2563eb; border-radius: 8px; padding: 10px; margin: 10px 0; text-align: center; }' +
    '.wbox .wlabel { font-size: 11px; color: #666; }' +
    '.wbox .wvalue { font-size: 16px; font-weight: bold; color: #2563eb; margin: 2px 0; }' +
    '.footer { text-align: center; font-size: 11px; color: #888; margin-top: 12px; }' +
    '.sig { display: flex; justify-content: space-between; margin-top: 24px; font-size: 12px; }' +
    '.sig div { text-align: center; width: 45%; }' +
    '.sig .line { border-top: 1px solid #333; margin-top: 32px; padding-top: 4px; }' +
    '.btn-bar { text-align: center; margin-top: 12px; }' +
    '.btn-bar button { padding: 6px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin: 0 4px; }' +
    '.btn-print { background: #2563eb; color: white; }' +
    '.btn-close { background: #6b7280; color: white; }' +
    '@media print { .btn-bar { display: none; } }' +
  '#rep-edit-btn,#rep-del-btn,#rep-print-btn{display:none}' +
  '.rep-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px}' +
  '.rep-modal .form-card{margin:0 auto}' +
  '</style></head><body>' +
  '<div class="header"><h2>LAPTOP 24H</h2><p>ÃÂÃ¡Â»Âa chÃ¡Â»Â cÃ¡Â»Â­a hÃÂ ng cÃ¡Â»Â§a bÃ¡ÂºÂ¡n | SÃÂT: 0xxx xxx xxx</p></div>' +
  '<div class="divider"></div>' +
  '<div class="title">PhiÃ¡ÂºÂ¿u BÃ¡ÂºÂ£o HÃÂ nh</div>' +
  '<table>' +
  '<tr><td>KhÃÂ¡ch hÃÂ ng:</td><td>' + (record.customerName || '') + '</td></tr>' +
  '<tr><td>SÃÂT:</td><td>' + (record.phone || '') + '</td></tr>' +
  (record.address ? '<tr><td>ÃÂÃ¡Â»Âa chÃ¡Â»Â:</td><td>' + record.address + '</td></tr>' : '') +
  '<tr><td>ThiÃ¡ÂºÂ¿t bÃ¡Â»Â:</td><td>' + (record.device || '') + '</td></tr>' +
  (record.serial ? '<tr><td>Serial:</td><td>' + record.serial + '</td></tr>' : '') +
  (record.accessories ? '<tr><td>PhÃ¡Â»Â¥ kiÃ¡Â»Ân:</td><td>' + record.accessories + '</td></tr>' : '') +
  '<tr><td>NgÃÂ y nhÃ¡ÂºÂ­n:</td><td>' + formatDate(record.receivedDate || record.ts) + '</td></tr>' +
  '<tr><td>NgÃÂ y giao:</td><td>' + (record.deliveredDate ? formatDate(record.deliveredDate) : '--') + '</td></tr>' +
  (record.issue ? '<tr><td>VÃ¡ÂºÂ¥n ÃÂÃ¡Â»Â:</td><td>' + record.issue + '</td></tr>' : '') +
  (record.techName ? '<tr><td>KTV:</td><td>' + record.techName + '</td></tr>' : '') +
  '</table>' +
  '<div class="divider"></div>' +
  '<table>' +
  '<tr><td>Chi phÃÂ­ sÃ¡Â»Â­a:</td><td>' + formatVND(record.cost || 0) + '</td></tr>' +
  (record.deposit > 0 ? '<tr><td>ÃÂÃ¡ÂºÂ·t cÃ¡Â»Âc:</td><td>' + formatVND(record.deposit) + '</td></tr>' : '') +
  (record.discount > 0 ? '<tr><td>GiÃ¡ÂºÂ£m giÃÂ¡:</td><td>- ' + formatVND(record.discount) + '</td></tr>' : '') +
  '<tr class="total-row"><td>CÃÂ²n lÃ¡ÂºÂ¡i:</td><td>' + formatVND(remaining) + '</td></tr>' +
  '<tr><td>HÃÂ¬nh thÃ¡Â»Â©c TT:</td><td>' + (record.paymentType || 'TiÃ¡Â»Ân mÃ¡ÂºÂ·t') + '</td></tr>' +
  '</table>' +
  '<div class="wbox">' +
  '<div class="wlabel">BÃ¡ÂºÂ£o hÃÂ nh ÃÂÃ¡ÂºÂ¿n</div>' +
  '<div class="wvalue">' + warrantyEnd + '</div>' +
  (record.warrantyMonths > 0 ? '<div class="wlabel">(' + record.warrantyMonths + ' thÃÂ¡ng kÃ¡Â»Â tÃ¡Â»Â« ngÃÂ y giao)</div>' : '') +
  '</div>' +
  (record.processNote ? '<div style="font-size:11px;color:#555;margin-bottom:6px"><em>Ghi chÃÂº: ' + record.processNote + '</em></div>' : '') +
  '<div class="sig">' +
  '<div><div class="line">KhÃÂ¡ch hÃÂ ng</div></div>' +
  '<div><div class="line">KÃ¡Â»Â¹ thuÃ¡ÂºÂ­t viÃÂªn</div></div>' +
  '</div>' +
  '<div class="footer"><p>CÃ¡ÂºÂ£m ÃÂ¡n quÃÂ½ khÃÂ¡ch ÃÂÃÂ£ tin tÃÂ°Ã¡Â»Âng sÃ¡Â»Â­ dÃ¡Â»Â¥ng dÃ¡Â»Âch vÃ¡Â»Â¥!</p><p>In lÃÂºc: ' + new Date().toLocaleString('vi-VN') + '</p></div>' +
  '<div class="btn-bar"><button class="btn-print" onclick="window.print()">Ã°ÂÂÂ¨ In</button><button class="btn-close" onclick="window.close()">ÃÂÃÂ³ng</button></div>' +
  '</body></html>');
  win.document.close();
}

const REPAIRS_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyO2yd3dljhjaCjc3BCxJq1pQ54x6zOuCwrHoTh9Ep0wZrMvOiDqoVUcs7WXSXXxxv5tA/exec';
function logRepairToSheet(data, action) {
    try { fetch(REPAIRS_SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}).catch(()=>{}); } catch(e){}
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
      <button id="rep-edit-btn" class="btn btn--secondary" disabled style="opacity:.4">Ã¢ÂÂ</button>
      <button id="rep-del-btn"  class="btn btn--danger"    disabled style="opacity:.4">Ã¢ÂÂ</button>
      <button id="rep-print-btn" class="btn btn--secondary" disabled style="opacity:.4;background:#0ea5e9;color:#fff;border-color:#0ea5e9">Ã°ÂÂÂ¨ In bill BH</button>
      <button id="rep-status-btn" class="btn" disabled style="opacity:.4;background:#f59e0b;color:#fff;border:1px solid #d97706">&#x21C4; Đổi TT</button>
      <span id="rep-sel-hint" style="font-size:.82rem;color:#888;margin-left:.25rem">Ã¢ÂÂ ChÃ¡Â»Ân 1 phiÃ¡ÂºÂ¿u ÃÂÃ¡Â»Â thao tÃÂ¡c</span>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap"></div>
  `;

  let allData = [];
  let selectedKey = null;

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    filterData();
  });
  container.addEventListener('unmount', () => unsub && unsub());

  const searchEl   = container.querySelector('#rep-search');
  const statusEl   = container.querySelector('#rep-status-filter');
  const dateFromEl = container.querySelector('#rep-date-from');
  const dateToEl   = container.querySelector('#rep-date-to');
  const editBtn    = container.querySelector('#rep-edit-btn');
  const statusBtn = container.querySelector('#rep-status-btn');
  const delBtn     = container.querySelector('#rep-del-btn');
  const printBtn   = container.querySelector('#rep-print-btn');
  const selHint    = container.querySelector('#rep-sel-hint');

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
  statusBtn.addEventListener('click', () => { const rec = allData.find(r => r._key === selectedKey); if (rec) quickChangeStatus(rec); });
    if (rec) printWarrantyBill(rec);
  });

  function setSelected(key) {
    selectedKey = key;
    const on = !!key;
    [editBtn, delBtn, printBtn, statusBtn].forEach(b => { b.disabled = !on; b.style.opacity = on ? '1' : '.4'; });
    selHint.style.display = on ? 'none' : '';
    container.querySelectorAll('.rep-row').forEach(tr => {
      tr.style.background = tr.dataset.key === key ? '#dbeafe' : '';
    });
    container.querySelectorAll('.rep-radio').forEach(rb => { rb.checked = rb.dataset.key === key; });
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
      { label: 'TrÃ¡ÂºÂ¡ng thÃÂ¡i', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' }
    ];
    const ths = cols.map(c => '<th style="padding:.5rem .75rem;border-bottom:2px solid #e5e7eb;text-align:left;font-size:.8rem;font-weight:600;color:#374151;white-space:nowrap">' + c.label + '</th>').join('');
    const trs = data.map(r =>
      '<tr class="rep-row" data-key="' + r._key + '">' +
      cols.map(c => '<td style="padding:.45rem .75rem;border-bottom:1px solid #f3f4f6;font-size:.85rem;vertical-align:middle">' + c.key(r) + '</td>').join('') +
      '</tr>'
    ).join('');
    wrap.innerHTML = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:700px">' +
      '<thead><tr style="background:#f9fafb">' + ths + '</tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>';
    wrap.querySelectorAll('.rep-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        const rec = data.find(r => r._key === radio.dataset.key);
        setSelected(rec || null);
      });
    });
  }

  async function quickDeliver(record) {
    if (!record) return;
    const ok = await showModal('Giao mÃÂ¡y', 'XÃÂ¡c nhÃ¡ÂºÂ­n giao mÃÂ¡y cho: ' + record.customerName + '?', true);
    if (!ok) return;
    try {
      await updateItem(COLLECTION, record._key, { ...record, status: 'ÃÂÃÂ£ giao', deliveredDate: todayStr() });
      toast('Ã¢ÂÂ ÃÂÃÂ£ giao mÃÂ¡y thÃÂ nh cÃÂ´ng');
    } catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
  }

  function quickChangeStatus(record) {
    if (!record) return;
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = '<div class="form-card" style="max-width:360px;margin:1rem auto;padding:1.2rem">' +
      '<h3 style="margin:0 0 .4rem">Ã¢ÂÂ ÃÂÃ¡Â»Âi trÃ¡ÂºÂ¡ng thÃÂ¡i</h3>' +
      '<p style="color:#555;margin:0 0 .8rem;font-size:.88rem"><strong>' + record.customerName + '</strong> Ã¢ÂÂ ' + (record.device||'') + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:.35rem">' +
      STATUS_LIST.map(s =>
        '<button class="btn ' + (s===record.status?'btn--primary':'btn--secondary') + ' qs-btn" data-status="' + s + '"' +
        ' style="text-align:left;justify-content:flex-start' + (s===record.status?'':';background:#f9fafb') + '">' +
        (s===record.status?'Ã¢ÂÂ ':'') + s + '</button>'
      ).join('') +
      '</div><button id="qs-cancel" class="btn btn--secondary" style="width:100%;margin-top:.6rem">HÃ¡Â»Â§y</button></div>';
    formWrap.querySelectorAll('.qs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ns = btn.dataset.status;
        const update = { ...record, status: ns };
        if (ns === 'ÃÂÃÂ£ giao' && !record.deliveredDate) update.deliveredDate = todayStr();
        try { await updateItem(COLLECTION, record._key, update); toast('Ã¢ÂÂ ' + ns); formWrap.innerHTML = ''; }
        catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
      });
    });
    formWrap.querySelector('#qs-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deliveryItemsToText(items) {
    if (!items || !items.length) return '';
    if (typeof items === 'string') return items;
    return items.map(i => i.desc || '').filter(Boolean).join(', ');
  }
  function textToDeliveryItems(text) {
    if (!text) return [];
    return text.split(',').map(s => s.trim()).filter(Boolean).map(desc => ({ desc, price: 0, qty: 1 }));
  }

  function printReceipt(d) {
  var r = function(l,v){ return '<tr><td style="font-weight:bold;width:40%;padding:3px 6px;color:#444;vertical-align:top">'+l+'</td><td style="padding:3px 6px">'+(v||'')+'</td></tr>'; };
  var css = 'body{font-family:Arial,sans-serif;font-size:13px;padding:20px;color:#222}'
    + 'h2{text-align:center;font-size:18px;margin:0 0 2px}'
    + '.sub{text-align:center;font-size:14px;font-weight:bold;margin-bottom:12px;letter-spacing:1px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:8px}'
    + 'tr{border-bottom:1px solid #eee}'
    + '.sec{background:#eeeeee;font-weight:bold;padding:3px 8px;font-size:12px;margin-top:6px}'
    + '.sign{display:flex;justify-content:space-between;margin-top:30px}'
    + '.line{border-top:1px solid #999;margin-top:38px;padding-top:4px;font-size:12px;text-align:center}'
    + '@media print{.np{display:none}}';
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PhiÃ¡ÂºÂ¿u nhÃ¡ÂºÂ­n mÃÂ¡y</title><style>'+css+'</style></head><body>'
    + '<h2>LAPTOP 24H</h2>'
    + '<div class="sub">PHIÃ¡ÂºÂ¾U NHÃ¡ÂºÂ­N MÃÂY</div>'
    + '<div class="sec">THÃÂNG TIN KHÃÂCH HÃÂNG</div><table>'
    + r('KhÃÂ¡ch hÃÂ ng:',d.customerName)
    + r('ÃÂiÃ¡Â»Ân thoÃ¡ÂºÂ¡i:',d.phone)
    + r('ÃÂÃ¡Â»Âa chÃ¡Â»Â:',d.address)
    + '</table><div class="sec">THÃÂNG TIN THIÃ¡ÂºÂ¿t BÃ¡Â»Â</div><table>'
    + r('ThiÃ¡ÂºÂ¿t bÃ¡Â»Â:',d.device)
    + r('Serial:',d.serial)
    + r('MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u:',d.password)
    + r('PhÃ¡Â»Â¥ kiÃ¡Â»Ân kÃÂ¨m:',d.accessories)
    
    + '</table><div class="sec">CÃ¡ÂºÂ¤U HÃÂNH MÃÂY</div><table>'
    + r('CPU:',d.cpu)
    + r('RAM:',d.ram)
    + r('SSD:',d.ssd)
    + r('VGA:',d.vga)
    + '</table><div class="sec">THÃÂNG TIN SÃ¡Â»Âªa CHÃ¡Â»Â®a</div><table>'
    + r('KÃ¡Â»Â¹ thuÃ¡ÂºÂ­t viÃÂªn:',d.techName)
    + r('NgÃÂ y nhÃ¡ÂºÂ­n:',d.receivedDate)
    + r('NgÃÂ y trÃ¡ÂºÂ£ dÃ¡Â»Â± kiÃ¡ÂºÂ¿n:',d.deliveredDate)
    + r('TÃÂ¬nh trÃ¡ÂºÂ¡ng ban ÃÂÃ¡ÂºÂ§u:',d.initialCondition)
    + r('YÃÂªu cÃ¡ÂºÂ§u sÃ¡Â»Â­a chÃ¡Â»Â®a:',d.repairRequest)
    + r('TrÃ¡ÂºÂ¡ng thÃÂ¡i:',d.status)
    + '</table><div class="sec">THANH TOÃÂN</div><table>'
    + r('Chi phÃÂ­ ÃÂ°Ã¡Â»Âc tÃÂ­nh:',d.cost)
    + r('ÃÂÃ¡ÂºÂ·t cÃ¡Â»Âc:',d.deposit)
    + r('HÃÂ¬nh thÃ¡Â»Â©c thanh toÃÂ¡n:',d.paymentType)
    + '</table>'
    + '<div class="sign">'
    + '<div style="width:45%"><div class="line">KhÃÂ¡ch hÃÂ ng kÃÂ½ tÃÂªn</div></div>'
    + '<div style="width:45%"><div class="line">KÃ¡Â»Â¹ thuÃ¡ÂºÂ­t viÃÂªn</div></div>'
    + '</div>'
    + '<div class="np" style="text-align:center;margin-top:14px">'
    + '<button onclick="window.print()" style="padding:7px 22px;font-size:14px;cursor:pointer">&#128424; In phiÃ¡ÂºÂ¿u</button>'
    + '</div>'
    + '</body></html>';
  var w = window.open('', '_blank', 'width=640,height=820');
  w.document.write(html);
  w.document.close();
}

function openForm(record) {
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = `<style>.rfm-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999}.rfm-card{background:#fff;border-radius:14px;width:820px;max-width:96vw;max-height:93vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.3);display:flex;flex-direction:column}.rfm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:2px solid #f1f5f9;flex-shrink:0}.rfm-head h2{margin:0;font-size:17px;font-weight:700;color:#1e293b}.rfm-head .rfm-x{background:#f8fafc;border:none;font-size:16px;cursor:pointer;color:#64748b;width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center}.rfm-head .rfm-x:hover{background:#e2e8f0}.rfm-body{padding:18px 22px;flex:1;overflow-y:auto}.rfm-r{display:grid;gap:12px;margin-bottom:14px}.rfm-r3{grid-template-columns:1fr 1fr 1fr}.rfm-r4{grid-template-columns:1fr 1fr 1fr 1fr}.rfm-r2{grid-template-columns:1fr 1fr}.rfm-r1{grid-template-columns:1fr}.rfm-f label{display:block;font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}.rfm-f input,.rfm-f textarea,.rfm-f select{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:8px;padding:9px 12px;font-size:14px;color:#1e293b;outline:none;transition:border .15s;background:#fff}.rfm-f input:focus,.rfm-f textarea:focus,.rfm-f select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}.rfm-f textarea{resize:vertical;min-height:78px;font-family:inherit}.rfm-foot{padding:14px 22px;border-top:2px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0}.rfm-cancbtn{padding:9px 22px;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;color:#374151;font-weight:500}.rfm-cancbtn:hover{background:#f8fafc}.rfm-savbtn{padding:9px 26px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700}.rfm-savbtn:hover{background:#1d4ed8}</style>
<div class="rfm-ov"><div class="rfm-card">
<div class="rfm-head"><h2>ð§ Phiáº¿u Nháº­n MÃ¡y Sá»­a</h2><button class="rfm-x" onclick="document.getElementById('f-cancel').click()">â</button></div>
<div class="rfm-body">
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>TÃN KHÃCH HÃNG *</label><input id="f-customerName" type="text" placeholder="TÃªn KH..." value="${record?.customerName||''}"></div><div class="rfm-f"><label>Sá» ÄIá»N THOáº I *</label><input id="f-phone" type="text" placeholder="0xxx..." value="${record?.phone||''}"></div><div class="rfm-f"><label>Äá»A CHá»</label><input id="f-address" type="text" placeholder="Äá»a chá»..." value="${record?.address||''}"></div></div>
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>THIáº¾T Bá» *</label><input id="f-device" type="text" placeholder="Dell Inspiron 15 3520" value="${record?.device||''}"></div><div class="rfm-f"><label>SERIAL / IMEI</label><input id="f-serial" type="text" placeholder="SN12345..." value="${record?.serial||''}"></div><div class="rfm-f"><label>Máº¬T KHáº¨U MÃY</label><input id="f-password" type="text" placeholder="Password..." value="${record?.password||''}"></div></div>
<div class="rfm-r rfm-r4">
<div class="rfm-f"><label>CPU</label><input id="f-cpu" placeholder="Intel i5-..." value="${record?.cpu||''}"></div>
<div class="rfm-f"><label>RAM</label><input id="f-ram" placeholder="8GB DDR4" value="${record?.ram||''}"></div>
<div class="rfm-f"><label>SSD</label><input id="f-ssd" placeholder="256GB NVMe" value="${record?.ssd||''}"></div>
<div class="rfm-f"><label>VGA</label><input id="f-vga" placeholder="GTX 1650" value="${record?.vga||''}"></div>
</div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>TÃNH TRáº NG KHI NHáº¬N (MÃ Táº¢ Lá»I)</label><textarea id="f-initialCondition" placeholder="KhÃ´ng lÃªn nguá»n, mÃ n hÃ¬nh tráº¯ng, bÃ n phÃ­m liá»t...">${record?.initialCondition||''}</textarea></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>PHá»¤ KIá»N KÃM THEO</label><input id="f-accessories" type="text" placeholder="Sáº¡c, tÃºi, chuá»t..." value="${record?.accessories||''}"></div></div>
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>NGÃY NHáº¬N *</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||new Date().toISOString().slice(0,10)}"></div><div class="rfm-f"><label>CHI PHÃ Dá»° KIáº¾N (Ä)</label><input id="f-cost" type="text" data-fmt="number" value="${String(record?.cost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div><div class="rfm-f"><label>TIá»N Cá»C (Ä)</label><input id="f-deposit" type="text" data-fmt="number" value="${String(record?.deposit||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>Vá»N LINH KIá»N (Ä)</label><input id="f-partsCost" type="text" data-fmt="number" value="${String(record?.partsCost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
<div class="rfm-r rfm-r2"><div class="rfm-f"><label>Báº¢O HÃNH Sá»¬A CHá»®A</label><select id="f-warranty"><option value="3 thÃ¡ng" ${(record?.warranty||'3 thÃ¡ng')==='3 thÃ¡ng'?'selected':''}>3 thÃ¡ng</option><option value="6 thÃ¡ng" ${record?.warranty==='6 thÃ¡ng'?'selected':''}>6 thÃ¡ng</option><option value="1 nÄm" ${record?.warranty==='1 nÄm'?'selected':''}>1 nÄm</option><option value="KhÃ´ng báº£o hÃ nh" ${record?.warranty==='KhÃ´ng báº£o hÃ nh'?'selected':''}>KhÃ´ng báº£o hÃ nh</option></select></div><div class="rfm-f"><label>Ká»¸ THUáº¬T VIÃN</label><input id="f-techName" type="text" placeholder="TÃªn KTV..." value="${record?.techName||''}"></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>GHI CHÃ Ná»I Bá»</label><textarea id="f-internalNote" placeholder="Chá» nhÃ¢n viÃªn tháº¥y...">${record?.internalNote||''}</textarea></div></div>
<input type="hidden" id="f-repairRequest" value="${record?.repairRequest||''}">
<input type="hidden" id="f-status" value="${record?.status||'Tiáº¿p nháº­n'}">
<input type="hidden" id="f-paymentType" value="${record?.paymentType||'Tiá»n máº·t'}">
<input type="hidden" id="f-deliveredDate" value="${record?.deliveredDate||''}">
</div>
<div class="rfm-foot"><button class="rfm-cancbtn" id="f-cancel">Há»§y</button><button id="f-print" style="padding:9px 22px;border:1.5px solid #0ea5e9;background:#0ea5e9;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500">ð¨ In phiáº¿u</button><button class="rfm-savbtn" id="f-save">ð¾ LÆ°u phiáº¿u</button></div>
</div></div>`;
    formWrap.classList.add('rep-modal');
    formWrap.querySelector('#f-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal'); });
    formWrap.querySelector('#f-print').addEventListener('click', () => {
      const fv = id => formWrap.querySelector('#'+id).value;
      const d = {
        customerName: fv('f-customerName'), phone: fv('f-phone'), address: fv('f-address'),
        device: fv('f-device'), serial: fv('f-serial'), password: fv('f-password'),
        accessories: fv('f-accessories'), techName: fv('f-techName'),
        receivedDate: fv('f-receivedDate'), deliveredDate: fv('f-deliveredDate'),
        cost: Number((fv('f-cost')||'').replace(/\./g,''))||0, deposit: Number((fv('f-deposit')||'').replace(/\./g,''))||0, paymentType: fv('f-paymentType'), partsCost: Number((fv('f-partsCost')||'').replace(/\./g,''))||0, warranty: fv('f-warranty'), internalNote: fv('f-internalNote'),
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
        cost:           parseFloat((formWrap.querySelector('#f-cost').value||'').replace(/\./g,'')) || 0,
        deposit:        parseFloat((formWrap.querySelector('#f-deposit').value||'').replace(/\./g,'')) || 0,
              partsCost:     parseFloat((formWrap.querySelector('#f-partsCost').value||'').replace(/\./g,'')) || 0,
              warranty:      formWrap.querySelector('#f-warranty')?.value || '',
              internalNote:  formWrap.querySelector('#f-internalNote')?.value || '',
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
        if (record) { await updateItem(COLLECTION, record._key, data); logRepairToSheet({...data, key:record._key}, 'update'); toast('ÃÂÃÂ£ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t phiÃ¡ÂºÂ¿u'); }
        else { const _r = await addItem(COLLECTION, data); logRepairToSheet({...data, key:_r?.key||''}, 'add'); toast('ÃÂÃÂ£ thÃÂªm phiÃ¡ÂºÂ¿u mÃ¡Â»Âi'); }
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal');
      } catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
    });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmDelete(key) {
    const ok = await showModal('XÃÂ¡c nhÃ¡ÂºÂ­n', 'XÃÂ³a phiÃ¡ÂºÂ¿u sÃ¡Â»Â­a chÃ¡Â»Â¯a nÃÂ y?', true);
    if (!ok) return;
    try { await deleteItem(COLLECTION, key); toast('ÃÂÃÂ£ xÃÂ³a phiÃ¡ÂºÂ¿u'); setSelected(null); }
    catch(e) { toast('LÃ¡Â»Âi: ' + e.message, 'error'); }
  }
}
