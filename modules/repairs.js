// modules/repairs.js - Phiếu sửa chữa
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';

const STATUS_LIST = ['Tiếp nhận','Đang sửa','Hoàn thành','Đã giao','Huỷ'];
const STATUS_CLASS = {
  'Tiếp nhận': 'badge-blue',
  'Đang sửa':  'badge-orange',
  'Hoàn thành':'badge-green',
  'Đã giao':   'badge-purple',
  'Huỷ':       'badge-red'
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDeliveryItems(items) {
  if (!items || !items.length) return '';
  if (typeof items === 'string') return items;
  return items.map(i => (i.desc || '') + (i.qty > 1 ? ' x' + i.qty : '')).filter(Boolean).join(', ');
}

function printWarrantyBill(record) {
  const giao = record.deliveredDate || record.receivedDate || '';
  let warrantyEnd = 'Không bảo hành';
  if (record.warrantyMonths > 0 && giao) {
    const d = new Date(giao);
    d.setMonth(d.getMonth() + (record.warrantyMonths || 0));
    warrantyEnd = d.toLocaleDateString('vi-VN');
  }
  const remaining = (record.cost || 0) - (record.deposit || 0) - (record.discount || 0);
  const win = window.open('', '_blank', 'width=420,height=650');
  win.document.write('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Bill Bảo Hành</title><style>' +
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
  '.rep-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;overflow-y:auto;display:flex;align-items:center;justify-content:center;padding:2rem 1rem}' +
  '.rep-modal .form-card{margin:0 auto;background:#dbeafe;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.25)}' +
  '</style></head><body>' +
  '<div class="header"><h2>LAPTOP 24H</h2><p>Địa chỉ cửa hàng của bạn | SĐT: 0xxx xxx xxx</p></div>' +
  '<div class="divider"></div>' +
  '<div class="title">Phiếu Bảo Hành</div>' +
  '<table>' +
  '<tr><td>Khách hàng:</td><td>' + (record.customerName || '') + '</td></tr>' +
  '<tr><td>SĐT:</td><td>' + (record.phone || '') + '</td></tr>' +
  (record.address ? '<tr><td>Địa chỉ:</td><td>' + record.address + '</td></tr>' : '') +
  '<tr><td>Thiết bị:</td><td>' + (record.device || '') + '</td></tr>' +
  (record.serial ? '<tr><td>Serial:</td><td>' + record.serial + '</td></tr>' : '') +
  (record.accessories ? '<tr><td>Phụ kiện:</td><td>' + record.accessories + '</td></tr>' : '') +
  '<tr><td>Ngày nhận:</td><td>' + formatDate(record.receivedDate || record.ts) + '</td></tr>' +
  '<tr><td>Ngày giao:</td><td>' + (record.deliveredDate ? formatDate(record.deliveredDate) : '--') + '</td></tr>' +
  (record.issue ? '<tr><td>Vấn đề:</td><td>' + record.issue + '</td></tr>' : '') +
  (record.techName ? '<tr><td>KTV:</td><td>' + record.techName + '</td></tr>' : '') +
  '</table>' +
  '<div class="divider"></div>' +
  '<table>' +
  '<tr><td>Chi phí sửa:</td><td>' + formatVND(record.cost || 0) + '</td></tr>' +
  (record.deposit > 0 ? '<tr><td>Đặt cọc:</td><td>' + formatVND(record.deposit) + '</td></tr>' : '') +
  (record.discount > 0 ? '<tr><td>Giảm giá:</td><td>- ' + formatVND(record.discount) + '</td></tr>' : '') +
  '<tr class="total-row"><td>Còn lại:</td><td>' + formatVND(remaining) + '</td></tr>' +
  '<tr><td>Hình thức TT:</td><td>' + (record.paymentType || 'Tiền mặt') + '</td></tr>' +
  '</table>' +
  '<div class="wbox">' +
  '<div class="wlabel">Bảo hành đến</div>' +
  '<div class="wvalue">' + warrantyEnd + '</div>' +
  (record.warrantyMonths > 0 ? '<div class="wlabel">(' + record.warrantyMonths + ' tháng kể từ ngày giao)</div>' : '') +
  '</div>' +
  (record.processNote ? '<div style="font-size:11px;color:#555;margin-bottom:6px"><em>Ghi chú: ' + record.processNote + '</em></div>' : '') +
  '<div class="sig">' +
  '<div><div class="line">Khách hàng</div></div>' +
  '<div><div class="line">Kỹ thuật viên</div></div>' +
  '</div>' +
  '<div class="footer"><p>Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ!</p><p>In lúc: ' + new Date().toLocaleString('vi-VN') + '</p></div>' +
  '<div class="btn-bar"><button class="btn-print" onclick="window.print()">🖨 In</button><button class="btn-close" onclick="window.close()">Đóng</button></div>' +
  '</body></html>');
  win.document.close();
}

export async function mount(container) {
  const today = todayStr();

  container.innerHTML = `
    <div class="module-header">
      <h2>Phiếu sửa chữa</h2>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">
      <input id="rep-search" type="text" placeholder="🔍 Tìm kiếm..." class="search-input" style="flex:1;min-width:160px"/>
      <select id="rep-status-filter" class="search-input" style="width:145px">
        <option value="">Tất cả trạng thái</option>
        ${STATUS_LIST.map(s => '<option>' + s + '</option>').join('')}
      </select>
      <label style="font-size:.85rem;color:#555">Từ:</label>
      <input id="rep-date-from" type="date" class="search-input" style="width:145px" value="${today}"/>
      <label style="font-size:.85rem;color:#555">Đến:</label>
      <input id="rep-date-to"   type="date" class="search-input" style="width:145px" value="${today}"/>
      <button id="rep-clear-date" class="btn btn--secondary" style="font-size:.83rem;padding:.35rem .8rem">Tất cả ngày</button>
    </div>
    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem;padding:.4rem;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
      <button id="rep-add" class="btn btn--primary" style="padding:.6rem 2rem;font-size:1rem;border-radius:8px;box-shadow:0 2px 6px rgba(37,99,235,.25)">+ Thêm phiếu mới</button>
      <div style="width:1px;height:28px;background:#e5e7eb;margin:0 .25rem"></div>
      <button id="rep-edit-btn" class="btn btn--secondary" style="display:none">✎ Sửa</button>
      <button id="rep-del-btn"  class="btn btn--danger"    style="display:none">✕ Xóa</button>
      <button id="rep-print-btn" class="btn btn--secondary" style="display:none">🖨 In bill BH</button>
      <span id="rep-sel-hint" style="font-size:.82rem;color:#888;margin-left:.25rem">← Chọn 1 phiếu để thao tác</span>
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
    document.querySelectorAll('.rep-deliver,.rep-status').forEach(b => b.style.display = 'none');
    if (key) { const selRow = container.querySelector('tr[data-key="' + key + '"]'); if (selRow) selRow.querySelectorAll('.rep-deliver,.rep-status').forEach(b => b.style.display = ''); }
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
    if (!data.length) { wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>'; return; }
    const cols = [
      { label: '', key: r => '<input type="radio" class="rep-radio" data-key="' + r._key + '" name="rep-sel" style="cursor:pointer;accent-color:#2563eb">' },
      { label: 'Ngày nhận',  key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'Khách hàng', key: r => r.customerName || '' },
      { label: 'SĐT',        key: r => r.phone || '' },
      { label: 'Thiết bị',   key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',     key: r => r.serial || '' },
      { label: 'KTV',        key: r => r.techName || '' },
      { label: 'Chi phí',    key: r => formatVND(r.cost || 0) },
      { label: 'Trạng thái', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' },
      { label: '',           key: r =>
          '<div style="display:flex;gap:.3rem">' +
          (r.status !== 'Đã giao' && r.status !== 'Huỷ'
            ? '<button class="btn btn--sm btn--primary rep-deliver" style="display:none" data-key="' + r._key + '" style="background:#16a34a;white-space:nowrap">📦 Giao</button>' : '') +
          '<button class="btn btn--sm btn--primary rep-status" style="display:none" data-key="' + r._key + '" style="background:#7c3aed" title="Đổi trạng thái">⇄</button>' +
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
        
    const _hs=!!wrap.querySelector('tr.selected');
    ['rep-edit-btn','rep-del-btn','rep-print-btn'].forEach(function(_id){const _b=wrap.querySelector('#'+_id);if(_b)_b.style.display=_hs?'':'none';});
    const _sh=wrap.querySelector('#rep-sel-hint');if(_sh)_sh.style.display=_hs?'none':'';});
    document.querySelectorAll('.rep-deliver,.rep-status').forEach(b=>b.style.display='none');if(_hs)tr.querySelectorAll('.rep-deliver,.rep-status').forEach(b=>b.style.display='');
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
    const ok = await showModal('Giao máy', 'Xác nhận giao máy cho: ' + record.customerName + '?', true);
    if (!ok) return;
    try {
      await updateItem(COLLECTION, record._key, { ...record, status: 'Đã giao', deliveredDate: todayStr() });
      toast('✅ Đã giao máy thành công');
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }

  function quickChangeStatus(record) {
    if (!record) return;
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = '<div class="form-card" style="background:#dbeafe;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.25);max-width:360px;margin:1rem auto;padding:1.2rem">' +
      '<h3 style="margin:0 0 .4rem">⇄ Đổi trạng thái</h3>' +
      '<p style="color:#555;margin:0 0 .8rem;font-size:.88rem"><strong>' + record.customerName + '</strong> — ' + (record.device||'') + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:.35rem">' +
      STATUS_LIST.map(s =>
        '<button class="btn ' + (s===record.status?'btn--primary':'btn--secondary') + ' qs-btn" data-status="' + s + '"' +
        ' style="text-align:left;justify-content:flex-start' + (s===record.status?'':';background:#f9fafb') + '">' +
        (s===record.status?'✓ ':'') + s + '</button>'
      ).join('') +
      '</div><button id="qs-cancel" class="btn btn--secondary" style="width:100%;margin-top:.6rem">Hủy</button></div>';
    formWrap.querySelectorAll('.qs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ns = btn.dataset.status;
        const update = { ...record, status: ns };
        if (ns === 'Đã giao' && !record.deliveredDate) update.deliveredDate = todayStr();
        try { await updateItem(COLLECTION, record._key, update); toast('✅ ' + ns); formWrap.innerHTML = ''; }
        catch(e) { toast('Lỗi: ' + e.message, 'error'); }
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
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu nhận máy</title><style>'+css+'</style></head><body>'
    + '<h2>LAPTOP 24H</h2>'
    + '<div class="sub">PHIẾU NHậN MÁY</div>'
    + '<div class="sec">THÔNG TIN KHÁCH HÀNG</div><table>'
    + r('Khách hàng:',d.customerName)
    + r('Điện thoại:',d.phone)
    + r('Địa chỉ:',d.address)
    + '</table><div class="sec">THÔNG TIN THIết Bị</div><table>'
    + r('Thiết bị:',d.device)
    + r('Serial:',d.serial)
    + r('Mật khẩu:',d.password)
    + r('Phụ kiện kèm:',d.accessories)
    
    + '</table><div class="sec">CẤU HÌNH MÁY</div><table>'
    + r('CPU:',d.cpu)
    + r('RAM:',d.ram)
    + r('SSD:',d.ssd)
    + r('VGA:',d.vga)
    + '</table><div class="sec">THÔNG TIN SỪa CHỮa</div><table>'
    + r('Kỹ thuật viên:',d.techName)
    + r('Ngày nhận:',d.receivedDate)
    + r('Ngày trả dự kiến:',d.deliveredDate)
    + r('Tình trạng ban đầu:',d.initialCondition)
    + r('Yêu cầu sửa chỮa:',d.repairRequest)
    + r('Trạng thái:',d.status)
    + '</table><div class="sec">THANH TOÁN</div><table>'
    + r('Chi phí ước tính:',d.cost)
    + r('Đặt cọc:',d.deposit)
    + r('Hình thức thanh toán:',d.paymentType)
    + '</table>'
    + '<div class="sign">'
    + '<div style="width:45%"><div class="line">Khách hàng ký tên</div></div>'
    + '<div style="width:45%"><div class="line">Kỹ thuật viên</div></div>'
    + '</div>'
    + '<div class="np" style="text-align:center;margin-top:14px">'
    + '<button onclick="window.print()" style="padding:7px 22px;font-size:14px;cursor:pointer">&#128424; In phiếu</button>'
    + '</div>'
    + '</body></html>';
  var w = window.open('', '_blank', 'width=640,height=820');
  w.document.write(html);
  w.document.close();
}

function openForm(record) {
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = `
      <style>#rep-form-wrap .form-group{margin-bottom:8px}#rep-form-wrap label{font-size:.74rem;font-weight:600;margin-bottom:3px;display:block;color:#555}#rep-form-wrap input,#rep-form-wrap select{padding:1px 5px;height:24px;font-size:.82rem}#rep-form-wrap textarea{padding:2px 5px;font-size:.82rem}#rep-form-wrap .form-card{max-width:920px}#rep-edit-btn,#rep-del-btn,#rep-print-btn{display:none}.rep-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px}.rep-modal .form-card{margin:2rem auto;padding:1.5rem 2rem;max-width:860px;width:100%}</style>
      <div class="form-card" style="background:#dbeafe;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
        <h3>${record ? 'Cập nhật phiếu' : 'Thêm phiếu mới'}</h3>
        <div class="form-grid" style="gap:.2rem">
          <div class="form-group"><label>Khách hàng *</label><input id="f-customerName" type="text" value="${record?.customerName||''}"/></div>
          <div class="form-group"><label>Số điện thoại</label><input id="f-phone" type="text" value="${record?.phone||''}"/></div>
          <div class="form-group"><label>Thiết bị *</label><input id="f-device" type="text" value="${record?.device||''}" placeholder="VD: LAPTOP ASUS X556"/></div>
          <div class="form-group"><label>Serial</label><input id="f-serial" type="text" value="${record?.serial||''}"/></div>
          <div class="form-group"><label>Địa chỉ</label><input id="f-address" type="text" value="${record?.address||''}"/></div>
          <div class="form-group"><label>Mật khẩu máy</label><input id="f-password" type="text" value="${record?.password||''}"/></div>
          <div class="form-group"><label>Phụ kiện đi kèm</label><input id="f-accessories" type="text" value="${record?.accessories||''}"/></div>
          <div class="form-group"><label>Kỹ thuật viên</label><input id="f-techName" type="text" value="${record?.techName||''}"/></div>
          <div class="form-group"><label>Ngày nhận</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||today}"/></div>
          <div class="form-group"><label>Ngày giao</label><input id="f-deliveredDate" type="date" value="${record?.deliveredDate||''}"/></div>
          <div class="form-group"><label>Chi phí sửa (đ)</label><input id="f-cost" type="number" value="${record?.cost||0}"/></div>
          <div class="form-group"><label>Đặt cọc (đ)</label><input id="f-deposit" type="number" value="${record?.deposit||0}"/></div>
          <div class="form-group"><label>Hình thức TT</label>
            <select id="f-paymentType">${['Tiền mặt','Chuyển khoản','Công nợ'].map(p=>'<option '+(record?.paymentType===p?'selected':'')+'>'+p+'</option>').join('')}</select>
          </div>
          <div class="form-group"><label>Trạng thái</label>
            <select id="f-status">${STATUS_LIST.map(s=>'<option '+((record?.status||'Tiếp nhận')===s?'selected':'')+'>'+s+'</option>').join('')}</select>
          </div>
          <div class="form-group" style="grid-column:1/-1"><label>Cấu hình</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.35rem;margin-top:.25rem"><input id="f-cpu" type="text" placeholder="CPU" value="${record?.cpu||''}" /><input id="f-ram" type="text" placeholder="RAM" value="${record?.ram||''}" /><input id="f-ssd" type="text" placeholder="SSD" value="${record?.ssd||''}" /><input id="f-vga" type="text" placeholder="VGA" value="${record?.vga||''}" /></div></div>
        </div>
        <div class="form-group" style="margin-top:.4rem"><label>Tình trạng ban đầu</label><textarea id="f-initialCondition" rows="3" style="width:100%;resize:vertical">${record?.initialCondition||''}</textarea></div>
        <div class="form-group" style="margin-top:.4rem"><label>Yêu cầu sửa chữa</label><textarea id="f-repairRequest" rows="3" style="width:100%;resize:vertical">${record?.repairRequest||''}</textarea></div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu phiếu'}</button>
          <button id="f-print" class="btn btn--secondary">🖨 In phiếu</button>
          <button id="f-cancel" class="btn btn--secondary">Hủy</button>
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
      if (!customerName) { toast('Vui lòng nhập khách hàng', 'error'); return; }
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
        if (record) { await updateItem(COLLECTION, record._key, data); toast('Đã cập nhật phiếu'); }
        else { await addItem(COLLECTION, data); toast('Đã thêm phiếu mới'); }
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal');
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa phiếu sửa chữa này?', true);
    if (!ok) return;
    try { await deleteItem(COLLECTION, key); toast('Đã xóa phiếu'); setSelected(null); }
    catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }
}
