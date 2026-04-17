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
      <button id="rep-edit-btn" class="btn btn--secondary" disabled style="opacity:.4">â Sá»­a</button>
      <button id="rep-del-btn"  class="btn btn--danger"    disabled style="opacity:.4">â XÃ³a</button>
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
      { label: 'Tráº¡ng thÃ¡i', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' },
      { label: '',           key: r =>
          '<div style="display:flex;gap:.3rem">' +
          (r.status !== 'ÄÃ£ giao' && r.status !== 'Huá»·'
            ? '<button class="btn btn--sm btn--primary rep-deliver" data-key="' + r._key + '" style="background:#16a34a;white-space:nowrap">ð¦ Giao</button>' : '') +
          '<button class="btn btn--sm btn--primary rep-status" data-key="' + r._key + '" style="background:#7c3aed" title="Äá»i tráº¡ng thÃ¡i">â</button>' +
          '</div>'
      }
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
          if (e.target.classList.contains('btn') || e.target.closest('.btn')) return;
          setSelected(key === selectedKey ? null : key);
        });
      });
    }

    wrap.querySelectorAll('.rep-radio').forEach(rb => {
      rb.checked = rb.dataset.key === selectedKey;
      rb.addEventListener('change', () => { if (rb.checked) setSelected(rb.dataset.key); });
    });
    wrap.querySelectorAll('.rep-deliver').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); quickDeliver(data.find(r => r._key === btn.dataset.key)); })
    );
    wrap.querySelectorAll('.rep-status').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); quickChangeStatus(data.find(r => r._key === btn.dataset.key)); })
    );
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

  function openForm(record) {
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = `
      <div class="form-card">
        <h3>${record ? 'Cáº­p nháº­t phiáº¿u' : 'ThÃªm phiáº¿u má»i'}</h3>
        <div class="form-grid" style="gap:.2rem">
          <div class="form-group"><label>KhÃ¡ch hÃ ng *</label><input id="f-customerName" type="text" value="${record?.customerName||''}"/></div>
          <div class="form-group"><label>Sá» Äiá»n thoáº¡i</label><input id="f-phone" type="text" value="${record?.phone||''}"/></div>
          <div class="form-group"><label>Thiáº¿t bá» *</label><input id="f-device" type="text" value="${record?.device||''}" placeholder="VD: LAPTOP ASUS X556"/></div>
          <div class="form-group"><label>Serial</label><input id="f-serial" type="text" value="${record?.serial||''}"/></div>
          <div class="form-group"><label>Äá»a chá»</label><input id="f-address" type="text" value="${record?.address||''}"/></div>
          <div class="form-group"><label>Máº­t kháº©u mÃ¡y</label><input id="f-password" type="text" value="${record?.password||''}"/></div>
          <div class="form-group"><label>Phá»¥ kiá»n Äi kÃ¨m</label><input id="f-accessories" type="text" value="${record?.accessories||''}"/></div>
          <div class="form-group"><label>Ká»¹ thuáº­t viÃªn</label><input id="f-techName" type="text" value="${record?.techName||''}"/></div>
          <div class="form-group"><label>NgÃ y nháº­n</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||today}"/></div>
          <div class="form-group"><label>NgÃ y giao</label><input id="f-deliveredDate" type="date" value="${record?.deliveredDate||''}"/></div>
          <div class="form-group"><label>Chi phÃ­ sá»­a (Ä)</label><input id="f-cost" type="number" value="${record?.cost||0}"/></div>
          <div class="form-group"><label>Äáº·t cá»c (Ä)</label><input id="f-deposit" type="number" value="${record?.deposit||0}"/></div>
          <div class="form-group"><label>HÃ¬nh thá»©c TT</label>
            <select id="f-paymentType">${['Tiá»n máº·t','Chuyá»n khoáº£n','CÃ´ng ná»£'].map(p=>'<option '+(record?.paymentType===p?'selected':'')+'>'+p+'</option>').join('')}</select>
          </div>
          <div class="form-group"><label>Tráº¡ng thÃ¡i</label>
            <select id="f-status">${STATUS_LIST.map(s=>'<option '+((record?.status||'Tiáº¿p nháº­n')===s?'selected':'')+'>'+s+'</option>').join('')}</select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>Cáº¥u hÃ¬nh</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.35rem;margin-top:.25rem"><input id="f-cpu" type="text" placeholder="CPU" value="${record?.cpu||''}" /><input id="f-ram" type="text" placeholder="RAM" value="${record?.ram||''}" /><input id="f-ssd" type="text" placeholder="SSD" value="${record?.ssd||''}" /><input id="f-vga" type="text" placeholder="VGA" value="${record?.vga||''}" /></div></div>
        </div>
        <div class="form-group" style="margin-top:.4rem"><label>TÃ¬nh tráº¡ng ban Äáº§u</label><textarea id="f-initialCondition" rows="3" style="width:100%;resize:vertical">${record?.initialCondition||''}</textarea></div>
        <div class="form-group" style="margin-top:.4rem"><label>YÃªu cáº§u sá»­a chá»¯a</label><textarea id="f-repairRequest" rows="3" style="width:100%;resize:vertical">${record?.repairRequest||''}</textarea></div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cáº­p nháº­t' : 'LÆ°u phiáº¿u'}</button>
          <button id="f-cancel" class="btn btn--secondary">Há»§y</button>
        </div>
      </div>
    `;
    formWrap.querySelector('#f-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; });
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
        if (record) { await updateItem(COLLECTION, record._key, data); toast('ÄÃ£ cáº­p nháº­t phiáº¿u'); }
        else { await addItem(COLLECTION, data); toast('ÄÃ£ thÃªm phiáº¿u má»i'); }
        formWrap.innerHTML = '';
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
