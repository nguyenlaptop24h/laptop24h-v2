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

function openEditRepairBH(rec) {
  const ov = document.createElement('div');
  ov.id = 'rep-bh-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  const v = s => (s||'').toString().replace(/"/g,'&quot;');
  ov.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:1.5rem;width:min(500px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,.2)">' +
    '<h3 style="margin:0 0 1rem;font-size:1.1rem;color:#1e293b">&#x270f;&#xfe0f; Sửa Bill Bảo Hành</h3>' +
    '<label style="display:block;margin-bottom:.65rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Tên khách hàng</span>' +
    '<input id="rbh-name" value="' + v(rec.customerName) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '<label style="display:block;margin-bottom:.65rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Số điện thoại</span>' +
    '<input id="rbh-phone" value="' + v(rec.phone) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '<label style="display:block;margin-bottom:.65rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Thiết bị</span>' +
    '<input id="rbh-device" value="' + v(rec.device) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '<label style="display:block;margin-bottom:.65rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Serial</span>' +
    '<input id="rbh-serial" value="' + v(rec.serial) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '<label style="display:block;margin-bottom:.65rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Công việc sửa chữa</span>' +
    '<textarea id="rbh-note" rows="3" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem;resize:vertical">' + v(rec.processNote) + '</textarea></label>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.65rem">' +
    '<label><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Ngày giao máy</span>' +
    '<input id="rbh-date" type="date" value="' + v(rec.deliveredDate) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '<label><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.2rem">Bảo hành (tháng)</span>' +
    '<input id="rbh-months" type="number" min="0" max="60" value="' + (rec.warrantyMonths||0) + '" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:.45rem .7rem"></label>' +
    '</div>' +
    '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">' +
    '<button id="rbh-cancel" style="padding:.45rem 1rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer">Hủy</button>' +
    '<button id="rbh-save" style="padding:.45rem 1rem;border:none;border-radius:6px;background:#f59e0b;color:#fff;cursor:pointer;font-weight:600">&#x1f4be; Lưu &amp; In BH</button>' +
    '</div></div>';
  document.body.appendChild(ov);
  document.getElementById('rbh-cancel').onclick = () => ov.remove();
  document.getElementById('rbh-save').onclick = async () => {
    const updated = {
      customerName:   document.getElementById('rbh-name').value.trim(),
      phone:          document.getElementById('rbh-phone').value.trim(),
      device:         document.getElementById('rbh-device').value.trim(),
      serial:         document.getElementById('rbh-serial').value.trim(),
      processNote:    document.getElementById('rbh-note').value.trim(),
      deliveredDate:  document.getElementById('rbh-date').value,
      warrantyMonths: parseInt(document.getElementById('rbh-months').value) || 0
    };
    await updateItem(COLLECTION, rec._key, updated);
    ov.remove();
    printWarrantyBill({ ...rec, ...updated });
  };
}

function printWarrantyBill(record) {
  const key = record._key || '';
  const e = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const s = (f) => '<span data-s="'+f+'">'+e(record[f])+'</span>';
  const w = window.open('', '_blank', 'width=820,height=750,scrollbars=yes');
  if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu Bảo Hành</title>'
    +'<style>'
    +'body{font:13px Arial;margin:0;padding:16px}'
    +'h2{text-align:center;font-size:17px;margin:0 0 4px}'
    +'.sub{text-align:center;font-size:12px;color:#555;margin-bottom:10px}'
    +'table{width:100%;border-collapse:collapse}'
    +'td{padding:4px 6px;vertical-align:top;border-bottom:1px solid #eee}'
    +'.lb{width:38%;font-weight:bold}'
    +'.sec{font-weight:bold;background:#f3f4f6;padding:4px 6px;font-size:12px}'
    +'.bbar{text-align:center;margin-top:14px;padding:8px;border-top:1px solid #ddd}'
    +'.bbar button{padding:7px 18px;margin:0 4px;cursor:pointer;border:1px solid #ccc;border-radius:4px;font-size:13px}'
    +'.be{background:#f59e0b;color:#fff;border-color:#d97706}'
    +'.bp{background:#2563eb;color:#fff;border-color:#2563eb}'
    +'#msg{display:none;color:#16a34a;font-weight:bold;margin-top:8px}'
    +'#modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:1000;overflow-y:auto}'
    +'.mbox{background:#fff;margin:20px auto;padding:20px;max-width:560px;border-radius:8px}'
    +'.mbox h3{margin:0 0 14px;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:8px}'
    +'.fr{display:flex;margin-bottom:8px;align-items:flex-start}'
    +'.fr label{width:42%;font-size:12px;font-weight:bold;padding-top:6px}'
    +'.fr input,.fr textarea{flex:1;border:1px solid #ccc;border-radius:4px;padding:5px 8px;font:13px Arial;box-sizing:border-box}'
    +'.fr textarea{height:56px;resize:vertical}'
    +'.fsec{font-weight:bold;background:#f3f4f6;padding:4px 8px;margin:10px 0 6px;border-radius:4px;font-size:12px}'
    +'.mbtns{text-align:right;margin-top:14px;border-top:1px solid #ddd;padding-top:12px}'
    +'.mbtns button{padding:8px 20px;margin-left:8px;cursor:pointer;border:1px solid #ccc;border-radius:4px;font-size:13px}'
    +'.bsave{background:#16a34a;color:#fff;border-color:#16a34a}'
    +'@media print{.bbar{display:none!important}#modal{display:none!important}}'
    +'</style></head><body>'
    +'<h2>PHIếU BẢO HÀNH</h2><div class="sub">Laptop 24h</div>'
    +'<table>'
    +'<tr><td class="lb">Khách hàng</td><td>'+s('customerName')+'</td></tr>'
    +'<tr><td class="lb">Điện thoại</td><td>'+s('phone')+'</td></tr>'
    +'<tr><td class="lb">Địa chỉ</td><td>'+s('address')+'</td></tr>'
    +'<tr><td colspan="2" class="sec">THÔNG TIN THIẾT BẸ</td></tr>'
    +'<tr><td class="lb">Tên thiết bị</td><td>'+s('device')+'</td></tr>'
    +'<tr><td class="lb">Số Serial</td><td>'+s('serial')+'</td></tr>'
    +'<tr><td class="lb">Phụ kiện</td><td>'+s('accessories')+'</td></tr>'
    +'<tr><td colspan="2" class="sec">THÔNG TIN SỪ CHỪ</td></tr>'
    +'<tr><td class="lb">Tình trạng</td><td>'+s('issue')+'</td></tr>'
    +'<tr><td class="lb">Kỹ thuật viên</td><td>'+s('techName')+'</td></tr>'
    +'<tr><td class="lb">Ngày nhận</td><td>'+s('receivedDate')+'</td></tr>'
    +'<tr><td class="lb">Ngày giao</td><td>'+s('deliveredDate')+'</td></tr>'
    +'<tr><td colspan="2" class="sec">THANH TOÁN</td></tr>'
    +'<tr><td class="lb">Chi phí</td><td>'+s('cost')+'</td></tr>'
    +'<tr><td class="lb">Đặt cọc</td><td>'+s('deposit')+'</td></tr>'
    +'<tr><td class="lb">Giảm giá</td><td>'+s('discount')+'</td></tr>'
    +'<tr><td class="lb">Hình thức TT</td><td>'+s('paymentType')+'</td></tr>'
    +'<tr><td class="lb">Bảo hành (tháng)</td><td>'+s('warrantyMonths')+'</td></tr>'
    +'<tr><td colspan="2" class="sec">GHI CHÚ</td></tr>'
    +'<tr><td class="lb">Ghi chú xử lý</td><td>'+s('processNote')+'</td></tr>'
    +'</table>'
    +'<div class="bbar">'
    +(key ? '<button class="be" onclick="showEdit()">&#9998; Nội dung bill</button>' : '')
    +'<button class="bp" onclick="window.print()">&#128424; In phiếu</button>'
    +'<button onclick="window.close()">Đóng</button>'
    +'<div id="msg">&#10003; Đã lưu thành công!</div>'
    +'</div>'
    +'<div id="modal"><div class="mbox">'
    +'<h3>&#9998; Sửa nội dung phiếu bảo hành</h3>'
    +'<div class="fsec">Thông tin khách hàng</div>'
    +'<div class="fr"><label>Khách hàng</label><input id="f-customerName"></div>'
    +'<div class="fr"><label>Điện thoại</label><input id="f-phone"></div>'
    +'<div class="fr"><label>Địa chỉ</label><input id="f-address"></div>'
    +'<div class="fsec">Thiết bị</div>'
    +'<div class="fr"><label>Tên thiết bị</label><input id="f-device"></div>'
    +'<div class="fr"><label>Số Serial</label><input id="f-serial"></div>'
    +'<div class="fr"><label>Phụ kiện</label><input id="f-accessories"></div>'
    +'<div class="fsec">Sửa chữa</div>'
    +'<div class="fr"><label>Tình trạng</label><textarea id="f-issue"></textarea></div>'
    +'<div class="fr"><label>Kỹ thuật viên</label><input id="f-techName"></div>'
    +'<div class="fr"><label>Ngày nhận</label><input id="f-receivedDate"></div>'
    +'<div class="fr"><label>Ngày giao</label><input id="f-deliveredDate"></div>'
    +'<div class="fsec">Thanh toán</div>'
    +'<div class="fr"><label>Chi phí</label><input id="f-cost" type="number"></div>'
    +'<div class="fr"><label>Đặt cọc</label><input id="f-deposit" type="number"></div>'
    +'<div class="fr"><label>Giảm giá</label><input id="f-discount" type="number"></div>'
    +'<div class="fr"><label>Hình thức TT</label><input id="f-paymentType"></div>'
    +'<div class="fr"><label>Bảo hành (tháng)</label><input id="f-warrantyMonths" type="number"></div>'
    +'<div class="fsec">Ghi chú</div>'
    +'<div class="fr"><label>Ghi chú xử lý</label><textarea id="f-processNote"></textarea></div>'
    +'<div class="mbtns">'
    +'<button onclick="closeModal()">Hủy</button>'
    +'<button class="bsave" onclick="saveEdit()">&#128190; Lưu thay đổi</button>'
    +'</div></div></div>'
    +'<script>'
    +'var _k="'+key+'",'
    +'_fs=["customerName","phone","address","device","serial","accessories","issue","techName","receivedDate","deliveredDate","cost","deposit","discount","paymentType","warrantyMonths","processNote"],'
    +'_nf=["cost","deposit","discount","warrantyMonths"];'
    +'function showEdit(){'
    +'_fs.forEach(function(f){'
    +'var el=document.getElementById("f-"+f);'
    +'var sp=document.querySelector('[data-s="'+f+'"]');'
    +'if(el&&sp)el.value=sp.textContent;'
    +'});'
    +'document.getElementById("modal").style.display="block";'
    +'}'
    +'function closeModal(){document.getElementById("modal").style.display="none";}'
    +'function saveEdit(){'
    +'var d={};'
    +'_fs.forEach(function(f){'
    +'var el=document.getElementById("f-"+f);'
    +'if(el)d[f]=_nf.indexOf(f)>=0?(parseFloat(el.value)||0):el.value;'
    +'});'
    +'if(window.opener&&window.opener.repSaveFromBill){'
    +'window.opener.repSaveFromBill(_k,d).then(function(){'
    +'_fs.forEach(function(f){'
    +'var sp=document.querySelector('[data-s="'+f+'"]');'
    +'if(sp)sp.textContent=d[f]!==undefined?d[f]:"";'
    +'});'
    +'closeModal();'
    +'var m=document.getElementById("msg");'
    +'m.style.display="block";'
    +'setTimeout(function(){m.style.display="none";},3000);'
    +'});'
    +'}else{alert("Kh\u00F4ng th\u1EC3 l\u01B0u. M\u1EDF l\u1EA1i phi\u1EBFu t\u1EEB trang ch\u00EDnh.");}'
    +'}'
    +'</scr'+'ipt>'
    +'</body></html>');
  w.document.close();
}

window.repSaveFromBill = async function(key, data) {
  await updateItem('repairs', key, data);
};];
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
        setSelected(rec ? rec._key : null);
      });
    });
    // Row click — select by clicking anywhere on the row
    wrap.querySelectorAll('.rep-row').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', e => {
        if (e.target.classList.contains('rep-radio')) return;
        const key = tr.dataset.key;
        setSelected(selectedKey === key ? null : key);
      });
    });
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
    formWrap.innerHTML = '<div class="form-card" style="max-width:360px;margin:1rem auto;padding:1.2rem">' +
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
        if (record) { await updateItem(COLLECTION, record._key, data); logRepairToSheet({...data, key:record._key}, 'update'); toast('Đã cập nhật phiếu'); }
        else { const _r = await addItem(COLLECTION, data); logRepairToSheet({...data, key:_r?.key||''}, 'add'); toast('Đã thêm phiếu mới'); }
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal');
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function restoreRepair(key) {
  const item = allData.find(r => r.key === key);
  if (!item) return;
  const {deletedAt, ...rest} = item;
  try { await updateItem(COLLECTION, key, rest); toast('Khôi phục thành công'); filterData(); }
  catch(e) { toast('Lỗi: ' + e.message, 'error'); }
}
window.__restoreRepair = k => restoreRepair(k);

async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa phiếu sửa chữa này?', true);
    if (!ok) return;
    const item = allData.find(r => r.key === key);
    if (!item) return;
    try { await updateItem(COLLECTION, key, {...item, deletedAt: Date.now()}); toast('Đã xóa phiếu'); setSelected(null); }
    catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }
}
