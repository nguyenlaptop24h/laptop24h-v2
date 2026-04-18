// modules/repairs.js - Phiáº¿u sá»­a chá»¯a
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';

const STATUS_LIST = ['Tiáº¿p nháº­n','Äang sá»­a','HoÃ n thÃ nh','ÄÃ£ giao','Huá»·'];
const STATUS_CLASS = {
  'Tiáº¿p nháº­n': 'badge-blue',
  'Äang sá»­a':  'badge-orange',
  'HoÃ n thÃ nh':'badge-green',
  'ÄÃ£ giao':   'badge-purple',
  'Huá»·':       'badge-red'
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDeliveryItems(items) {
  if (!items || !items.length) return '';
  if (typeof items === 'string') return items;
  return items.map(i => (i.desc || '') + (i.qty > 1 ? ' x' + i.qty : '')).filter(Boolean).join(', ');
}

function printWarrantyBill(record) {
  const giao = record.deliveredDate || record.receivedDate || '';
  let warrantyEnd = 'KhÃ´ng báº£o hÃ nh';
  if (record.warrantyMonths > 0 && giao) {
    const d = new Date(giao);
    d.setMonth(d.getMonth() + (record.warrantyMonths || 0));
    warrantyEnd = d.toLocaleDateString('vi-VN');
  }
  const remaining = (record.cost || 0) - (record.deposit || 0) - (record.discount || 0);
  const win = window.open('', '_blank', 'width=420,height=650');
  win.document.write('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Bill Báº£o HÃ nh</title><style>' +
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
  '<div class="header"><h2>LAPTOP 24H</h2><p>Äá»a chá» cá»­a hÃ ng cá»§a báº¡n | SÄT: 0xxx xxx xxx</p></div>' +
  '<div class="divider"></div>' +
  '<div class="title">Phiáº¿u Báº£o HÃ nh</div>' +
  '<table>' +
  '<tr><td>KhÃ¡ch hÃ ng:</td><td>' + (record.customerName || '') + '</td></tr>' +
  '<tr><td>SÄT:</td><td>' + (record.phone || '') + '</td></tr>' +
  (record.address ? '<tr><td>Äá»a chá»:</td><td>' + record.address + '</td></tr>' : '') +
  '<tr><td>Thiáº¿t bá»:</td><td>' + (record.device || '') + '</td></tr>' +
  (record.serial ? '<tr><td>Serial:</td><td>' + record.serial + '</td></tr>' : '') +
  (record.accessories ? '<tr><td>Phá»¥ kiá»n:</td><td>' + record.accessories + '</td></tr>' : '') +
  '<tr><td>NgÃ y nháº­n:</td><td>' + formatDate(record.receivedDate || record.ts) + '</td></tr>' +
  '<tr><td>NgÃ y giao:</td><td>' + (record.deliveredDate ? formatDate(record.deliveredDate) : '--') + '</td></tr>' +
  (record.issue ? '<tr><td>Váº¥n Äá»:</td><td>' + record.issue + '</td></tr>' : '') +
  (record.techName ? '<tr><td>KTV:</td><td>' + record.techName + '</td></tr>' : '') +
  '</table>' +
  '<div class="divider"></div>' +
  '<table>' +
  '<tr><td>Chi phÃ­ sá»­a:</td><td>' + formatVND(record.cost || 0) + '</td></tr>' +
  (record.deposit > 0 ? '<tr><td>Äáº·t cá»c:</td><td>' + formatVND(record.deposit) + '</td></tr>' : '') +
  (record.discount > 0 ? '<tr><td>Giáº£m giÃ¡:</td><td>- ' + formatVND(record.discount) + '</td></tr>' : '') +
  '<tr class="total-row"><td>CÃ²n láº¡i:</td><td>' + formatVND(remaining) + '</td></tr>' +
  '<tr><td>HÃ¬nh thá»©c TT:</td><td>' + (record.paymentType || 'Tiá»n máº·t') + '</td></tr>' +
  '</table>' +
  '<div class="wbox">' +
  '<div class="wlabel">Báº£o hÃ nh Äáº¿n</div>' +
  '<div class="wvalue">' + warrantyEnd + '</div>' +
  (record.warrantyMonths > 0 ? '<div class="wlabel">(' + record.warrantyMonths + ' thÃ¡ng ká» tá»« ngÃ y giao)</div>' : '') +
  '</div>' +
  (record.processNote ? '<div style="font-size:11px;color:#555;margin-bottom:6px"><em>Ghi chÃº: ' + record.processNote + '</em></div>' : '') +
  '<div class="sig">' +
  '<div><div class="line">KhÃ¡ch hÃ ng</div></div>' +
  '<div><div class="line">Ká»¹ thuáº­t viÃªn</div></div>' +
  '</div>' +
  '<div class="footer"><p>Cáº£m Æ¡n quÃ½ khÃ¡ch ÄÃ£ tin tÆ°á»ng sá»­ dá»¥ng dá»ch vá»¥!</p><p>In lÃºc: ' + new Date().toLocaleString('vi-VN') + '</p></div>' +
  '<div class="btn-bar"><button class="btn-print" onclick="window.print()">ð¨ In</button><button class="btn-close" onclick="window.close()">ÄÃ³ng</button></div>' +
  '</body></html>');
  win.document.close();
}

export async function mount(container) {
  const today = todayStr();

  container.innerHTML = `
    <div class="module-header">
      <h2>Phiáº¿u sá»­a chá»¯a</h2>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">
      <input id="rep-search" type="text" placeholder="ð TÃ¬m kiáº¿m..." class="search-input" style="flex:1;min-width:160px"/>
      <select id="rep-status-filter" class="search-input" style="width:145px">
        <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
        ${STATUS_LIST.map(s => '<option>' + s + '</option>').join('')}
      </select>
      <label style="font-size:.85rem;color:#555">Tá»«:</label>
      <input id="rep-date-from" type="date" class="search-input" style="width:145px" value="${today}"/>
      <label style="font-size:.85rem;color:#555">Äáº¿n:</label>
      <input id="rep-date-to"   type="date" class="search-input" style="width:145px" value="${today}"/>
      <button id="rep-clear-date" class="btn btn--secondary" style="font-size:.83rem;padding:.35rem .8rem">Táº¥t cáº£ ngÃ y</button>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem;padding:.4rem;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
      <button id="rep-add" class="btn btn--primary" style="padding:.6rem 2rem;font-size:1rem;border-radius:8px;box-shadow:0 2px 6px rgba(37,99,235,.25)">+ ThÃªm phiáº¿u má»i</button>
      <div style="width:1px;height:28px;background:#e5e7eb;margin:0 .25rem"></div>
      <button id="rep-edit-btn" class="btn btn--secondary" disabled style="opacity:.4">â</button>
      <button id="rep-del-btn"  class="btn btn--danger"    disabled style="opacity:.4">â</button>
      <button id="rep-print-btn" class="btn btn--secondary" disabled style="opacity:.4;background:#0ea5e9;color:#fff;border-color:#0ea5e9">ð¨ In bill BH</button>
      <span id="rep-sel-hint" style="font-size:.82rem;color:#888;margin-left:.25rem">â Chá»n 1 phiáº¿u Äá» thao tÃ¡c</span>
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
    if (rec) printWarrantyBill(rec);
  });

  function setSelected(key) {
    selectedKey = key;
    const on = !!key;
    [editBtn, delBtn, printBtn].forEach(b => { b.disabled = !on; b.style.opacity = on ? '1' : '.4'; });
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
    if (!data.length) { wrap.innerHTML = '<p style="padding:1rem;color:#888">KhÃ´ng cÃ³ dá»¯ liá»u</p>'; return; }
    const cols = [
      { label: '', key: r => '<input type="radio" class="rep-radio" data-key="' + r._key + '" name="rep-sel" style="cursor:pointer;accent-color:#2563eb">' },
      { label: 'NgÃ y nháº­n',  key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'KhÃ¡ch hÃ ng', key: r => r.customerName || '' },
      { label: 'SÄT',        key: r => r.phone || '' },
      { label: 'Thiáº¿t bá»',   key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',     key: r => r.serial || '' },
      { label: 'KTV',        key: r => r.techName || '' },
      { label: 'Chi phÃ­',    key: r => formatVND(r.cost || 0) },
      { label: 'Tráº¡ng thÃ¡i', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' }
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
    const ok = await showModal('Giao mÃ¡y', 'XÃ¡c nháº­n giao mÃ¡y cho: ' + record.customerName + '?', true);
    if (!ok) return;
    try {
      await updateItem(COLLECTION, record._key, { ...record, status: 'ÄÃ£ giao', deliveredDate: todayStr() });
      toast('â ÄÃ£ giao mÃ¡y thÃ nh cÃ´ng');
    } catch(e) { toast('Lá»i: ' + e.message, 'error'); }
  }

  function quickChangeStatus(record) {
    if (!record) return;
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = '<div class="form-card" style="max-width:360px;margin:1rem auto;padding:1.2rem">' +
      '<h3 style="margin:0 0 .4rem">â Äá»i tráº¡ng thÃ¡i</h3>' +
      '<p style="color:#555;margin:0 0 .8rem;font-size:.88rem"><strong>' + record.customerName + '</strong> â ' + (record.device||'') + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:.35rem">' +
      STATUS_LIST.map(s =>
        '<button class="btn ' + (s===record.status?'btn--primary':'btn--secondary') + ' qs-btn" data-status="' + s + '"' +
        ' style="text-align:left;justify-content:flex-start' + (s===record.status?'':';background:#f9fafb') + '">' +
        (s===record.status?'â ':'') + s + '</button>'
      ).join('') +
      '</div><button id="qs-cancel" class="btn btn--secondary" style="width:100%;margin-top:.6rem">Há»§y</button></div>';
    formWrap.querySelectorAll('.qs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ns = btn.dataset.status;
        const update = { ...record, status: ns };
        if (ns === 'ÄÃ£ giao' && !record.deliveredDate) update.deliveredDate = todayStr();
        try { await updateItem(COLLECTION, record._key, update); toast('â ' + ns); formWrap.innerHTML = ''; }
        catch(e) { toast('Lá»i: ' + e.message, 'error'); }
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
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiáº¿u nháº­n mÃ¡y</title><style>'+css+'</style></head><body>'
    + '<h2>LAPTOP 24H</h2>'
    + '<div class="sub">PHIáº¾U NHáº­N MÃY</div>'
    + '<div class="sec">THÃNG TIN KHÃCH HÃNG</div><table>'
    + r('KhÃ¡ch hÃ ng:',d.customerName)
    + r('Äiá»n thoáº¡i:',d.phone)
    + r('Äá»a chá»:',d.address)
    + '</table><div class="sec">THÃNG TIN THIáº¿t Bá»</div><table>'
    + r('Thiáº¿t bá»:',d.device)
    + r('Serial:',d.serial)
    + r('Máº­t kháº©u:',d.password)
    + r('Phá»¥ kiá»n kÃ¨m:',d.accessories)
    
    + '</table><div class="sec">Cáº¤U HÃNH MÃY</div><table>'
    + r('CPU:',d.cpu)
    + r('RAM:',d.ram)
    + r('SSD:',d.ssd)
    + r('VGA:',d.vga)
    + '</table><div class="sec">THÃNG TIN Sá»ªa CHá»®a</div><table>'
    + r('Ká»¹ thuáº­t viÃªn:',d.techName)
    + r('NgÃ y nháº­n:',d.receivedDate)
    + r('NgÃ y tráº£ dá»± kiáº¿n:',d.deliveredDate)
    + r('TÃ¬nh tráº¡ng ban Äáº§u:',d.initialCondition)
    + r('YÃªu cáº§u sá»­a chá»®a:',d.repairRequest)
    + r('Tráº¡ng thÃ¡i:',d.status)
    + '</table><div class="sec">THANH TOÃN</div><table>'
    + r('Chi phÃ­ Æ°á»c tÃ­nh:',d.cost)
    + r('Äáº·t cá»c:',d.deposit)
    + r('HÃ¬nh thá»©c thanh toÃ¡n:',d.paymentType)
    + '</table>'
    + '<div class="sign">'
    + '<div style="width:45%"><div class="line">KhÃ¡ch hÃ ng kÃ½ tÃªn</div></div>'
    + '<div style="width:45%"><div class="line">Ká»¹ thuáº­t viÃªn</div></div>'
    + '</div>'
    + '<div class="np" style="text-align:center;margin-top:14px">'
    + '<button onclick="window.print()" style="padding:7px 22px;font-size:14px;cursor:pointer">&#128424; In phiáº¿u</button>'
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
<div class="rfm-head"><h2>🔧 Phiếu Nhận Máy Sửa</h2><button class="rfm-x" onclick="document.getElementById('f-cancel').click()">✕</button></div>
<div class="rfm-body">
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>TÊN KHÁCH HÀNG *</label><input id="f-customerName" type="text" placeholder="Tên KH..." value="${record?.customerName||''}"></div><div class="rfm-f"><label>SỐ ĐIỆN THOẠI *</label><input id="f-phone" type="text" placeholder="0xxx..." value="${record?.phone||''}"></div><div class="rfm-f"><label>ĐỊA CHỈ</label><input id="f-address" type="text" placeholder="Địa chỉ..." value="${record?.address||''}"></div></div>
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>THIẾT BỊ *</label><input id="f-device" type="text" placeholder="Dell Inspiron 15 3520" value="${record?.device||''}"></div><div class="rfm-f"><label>SERIAL / IMEI</label><input id="f-serial" type="text" placeholder="SN12345..." value="${record?.serial||''}"></div><div class="rfm-f"><label>MẬT KHẨU MÁY</label><input id="f-password" type="text" placeholder="Password..." value="${record?.password||''}"></div></div>
<div class="rfm-r rfm-r4">
<div class="rfm-f"><label>CPU</label><input id="f-cpu" placeholder="Intel i5-..." value="${record?.cpu||''}"></div>
<div class="rfm-f"><label>RAM</label><input id="f-ram" placeholder="8GB DDR4" value="${record?.ram||''}"></div>
<div class="rfm-f"><label>SSD</label><input id="f-ssd" placeholder="256GB NVMe" value="${record?.ssd||''}"></div>
<div class="rfm-f"><label>VGA</label><input id="f-vga" placeholder="GTX 1650" value="${record?.vga||''}"></div>
</div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>TÌNH TRẠNG KHI NHẬN (MÔ TẢ LỖI)</label><textarea id="f-initialCondition" placeholder="Không lên nguồn, màn hình trắng, bàn phím liệt...">${record?.initialCondition||''}</textarea></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>PHỤ KIỆN KÈM THEO</label><input id="f-accessories" type="text" placeholder="Sạc, túi, chuột..." value="${record?.accessories||''}"></div></div>
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>NGÀY NHẬN *</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||new Date().toISOString().slice(0,10)}"></div><div class="rfm-f"><label>CHI PHÍ DỰ KIẾN (Đ)</label><input id="f-cost" type="text" data-fmt="number" value="${String(record?.cost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div><div class="rfm-f"><label>TIỀN CỌC (Đ)</label><input id="f-deposit" type="text" data-fmt="number" value="${String(record?.deposit||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>VỐN LINH KIỆN (Đ)</label><input id="f-partsCost" type="text" data-fmt="number" value="${String(record?.partsCost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
<div class="rfm-r rfm-r2"><div class="rfm-f"><label>BẢO HÀNH SỬA CHỮA</label><select id="f-warranty"><option value="3 tháng" ${(record?.warranty||'3 tháng')==='3 tháng'?'selected':''}>3 tháng</option><option value="6 tháng" ${record?.warranty==='6 tháng'?'selected':''}>6 tháng</option><option value="1 năm" ${record?.warranty==='1 năm'?'selected':''}>1 năm</option><option value="Không bảo hành" ${record?.warranty==='Không bảo hành'?'selected':''}>Không bảo hành</option></select></div><div class="rfm-f"><label>KỸ THUẬT VIÊN</label><input id="f-techName" type="text" placeholder="Tên KTV..." value="${record?.techName||''}"></div></div>
<div class="rfm-r rfm-r1"><div class="rfm-f"><label>GHI CHÚ NỘI BỘ</label><textarea id="f-internalNote" placeholder="Chỉ nhân viên thấy...">${record?.internalNote||''}</textarea></div></div>
<input type="hidden" id="f-repairRequest" value="${record?.repairRequest||''}">
<input type="hidden" id="f-status" value="${record?.status||'Tiếp nhận'}">
<input type="hidden" id="f-paymentType" value="${record?.paymentType||'Tiền mặt'}">
<input type="hidden" id="f-deliveredDate" value="${record?.deliveredDate||''}">
</div>
<div class="rfm-foot"><button class="rfm-cancbtn" id="f-cancel">Hủy</button><button id="f-print" style="padding:9px 22px;border:1.5px solid #0ea5e9;background:#0ea5e9;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500">🖨 In phiếu</button><button class="rfm-savbtn" id="f-save">💾 Lưu phiếu</button></div>
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
      if (!customerName) { toast('Vui lÃ²ng nháº­p khÃ¡ch hÃ ng', 'error'); return; }
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
        if (record) { await updateItem(COLLECTION, record._key, data); toast('ÄÃ£ cáº­p nháº­t phiáº¿u'); }
        else { await addItem(COLLECTION, data); toast('ÄÃ£ thÃªm phiáº¿u má»i'); }
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal');
      } catch(e) { toast('Lá»i: ' + e.message, 'error'); }
    });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmDelete(key) {
    const ok = await showModal('XÃ¡c nháº­n', 'XÃ³a phiáº¿u sá»­a chá»¯a nÃ y?', true);
    if (!ok) return;
    try { await deleteItem(COLLECTION, key); toast('ÄÃ£ xÃ³a phiáº¿u'); setSelected(null); }
    catch(e) { toast('Lá»i: ' + e.message, 'error'); }
  }
}
