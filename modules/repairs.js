// modules/repairs.js - Phiếu sửa chữa
import { addItem, updateItem, deleteItem, onSnapshot, getAll, getItem, getDB } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';
const RPL_BILL_KEY = 'rp_bill_tpl';

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
  const tpl = getRepBillTpl();
  const _br = (function(){try{return JSON.parse(sessionStorage.getItem('laptop24h_user')||'{}').branch||'';}catch(e){return '';}}());
  const addr  = _br==='cantho' ? '36 Mạc Thiên Tích, phường Ninh Kiều, Tp Cần Thơ' : (tpl.address || '');
  const phone = _br==='cantho' ? '0913.929.515' : (tpl.phone || '');
  const giao = record.deliveredDate || record.receivedDate || '';
  let warrantyEnd = 'Không bảo hành';
  if (record.warrantyMonths > 0 && giao) {
    const d = new Date(giao);
    d.setMonth(d.getMonth() + (record.warrantyMonths || 0));
    warrantyEnd = d.toLocaleDateString('vi-VN');
  }
  const remaining = (record.cost || 0) - (record.deposit || 0) - (record.discount || 0);
  const win = window.open('', '_blank', 'width=620,height=840');
  win.document.write('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Bill Bảo Hành</title><style>@page{size:A5 portrait;margin:8mm}' +
    '* { margin:0; padding:0; box-sizing:border-box; }' +
    'body { font-family: Arial, sans-serif; font-size: 12px; padding: 0; width: 132mm; max-width: 132mm; margin: 0 auto; }' +
    '.header { text-align: center; margin-bottom: 6px; }' +
    '.header h2 { font-size: 20px; font-weight: bold; letter-spacing: 1px; }' +
    '.header p { font-size: 11px; color: #555; }' +
    '.divider { border-top: 1px dashed #999; margin: 6px 0; }.rb-block{padding:4px 0;margin:2px 0}.rb-row{display:flex;align-items:flex-start;margin:2px 0;font-size:12px}.rb-lbl{color:#555;min-width:125px;font-weight:600;flex-shrink:0}.rb-val{flex:1;color:#222;line-height:1.5}' +
    '.title { text-align: center; font-size: 16px; font-weight: bold; margin: 6px 0; text-transform: uppercase; letter-spacing: 1px; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'td { padding: 2px 2px; vertical-align: top; font-size: 12.5px; }' +
    'td:first-child { width: 38%; font-weight: 600; color: #333; white-space: nowrap; }' +
    '.total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #333; padding-top: 4px; }' +
    '.wbox { border: 2px solid #2563eb; border-radius: 8px; padding: 7px; margin: 7px 0; text-align: center; }' +
    '.wbox .wlabel { font-size: 10.5px; color: #666; }' +
    '.wbox .wvalue { font-size: 17px; font-weight: bold; color: #2563eb; margin: 2px 0; }' +
    '.footer { text-align: center; font-size: 10px; color: #888; margin-top: 7px; }' +
    '.sig { display: flex; justify-content: space-between; margin-top: 16px; font-size: 12px; }' +
    '.sig div { text-align: center; width: 45%; }' +
    '.sig .line { border-top: 1px solid #333; margin-top: 22px; padding-top: 4px; }' +
    '.btn-bar { text-align: center; margin-top: 12px; }' +
    '.btn-bar button { padding: 6px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin: 0 4px; }' +
    '.btn-print { background: #2563eb; color: white; }' +
    '.btn-close { background: #6b7280; color: white; }' +
    '@media print { .btn-bar { display: none; } }' +
  '#rep-edit-btn,#rep-del-btn,#rep-print-btn{display:none}' +
  '.rep-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px}' +
  '.rep-modal .form-card{margin:0 auto}' +
  '</style></head><body>' +
  '<div class="header"><h2>' + (tpl.shopName || 'LAPTOP 24H') + '</h2>' + (addr ? '<p>' + addr + '</p>' : '') + (phone ? '<p>SĐT: ' + phone + '</p>' : '') + '</div>' +
  '<div class="divider"></div>' +
  '<div class="title">' + (tpl.title || 'Phiếu Bảo Hành') + '</div>' +
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
  ((record.repairRequest || (record.partsUsed && record.partsUsed.length)) ? '<div class="rb-block">' + (record.repairRequest ? '<div class="rb-row"><span class="rb-lbl">Nội dung sửa chữa:</span><span class="rb-val">' + record.repairRequest + '</span></div>' : '') + (record.partsUsed && record.partsUsed.length ? '<div class="rb-row"><span class="rb-lbl">Linh kiện thay thế:</span><span class="rb-val">' + record.partsUsed.map(function(pt){return pt.name+(pt.qty>1?' x'+pt.qty:'');}).join(', ') + '</span></div>' : '') + '</div><div class="divider"></div>' : '') +
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
  '<div class="footer"><p>' + (tpl.footer || 'Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ!') + '</p><p>In lúc: ' + new Date().toLocaleString('vi-VN') + '</p></div>' +
  '<div class="btn-bar"><button class="btn-print" onclick="window.print()">🖨 In</button><button class="btn-edit-content" onclick="if(window.opener){window.opener.document.getElementById(&apos;rep-edit-bh-btn&apos;).click();window.close();}">✏️ Sửa nội dung</button><button class="btn-close" onclick="window.close()">Đóng</button></div>' + '<script>(function(){var M=96/25.4,T=180*M;function f(){document.body.style.zoom=1;var b=document.querySelector(".btn-bar"),d=b?b.style.display:"";if(b)b.style.display="none";var h=document.body.scrollHeight;if(b)b.style.display=d;if(h>T)document.body.style.zoom=T/h;}f();window.addEventListener("beforeprint",f);})();</script>' +
  '</body></html>');
  win.document.close();
}

const REPAIRS_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzha41ZadrH6LNqgttslMWyVN0OzFmFW1YW8CaWs2Yd_b8CF82xZhtqsM36XxJJZy8D5Q/exec';
function getRepBillTpl() { try { return JSON.parse(localStorage.getItem(RPL_BILL_KEY) || '{}'); } catch(e) { return {}; } }
function saveRepBillTpl(obj) { localStorage.setItem(RPL_BILL_KEY, JSON.stringify(obj)); }
const RPL_RECEIPT_KEY = 'rp_receipt_tpl';
let _recTpl = {};
try { _recTpl = JSON.parse(localStorage.getItem(RPL_RECEIPT_KEY) || '{}'); } catch(e) {}
function getReceiptTpl() { return _recTpl || {}; }
function saveReceiptTpl(obj) {
  _recTpl = obj;
  try { localStorage.setItem(RPL_RECEIPT_KEY, JSON.stringify(obj)); } catch(e) {}
  try { getDB().ref('repairReceiptTpl').set(obj); } catch(e) {}
}
function defaultReceiptCustomHtml() {
  return [
    '<div class="head">',
    '  <img class="logo" src="{{logo}}" alt="">',
    '  <div class="shop">',
    '    <div class="sn">{{shopName}}</div>',
    '    <div class="si">\u{1F4CD} {{shopAddr}}</div>',
    '    <div class="si">\u{1F4DE} Hotline: {{shopHot}}</div>',
    '  </div>',
    '  <div class="doc"><div class="dt">{{title}}</div><div class="dd">Ngày nhận: {{receivedDate}}</div></div>',
    '</div>',
    '<table class="info">',
    '  <tr><td class="sec" colspan="4">THÔNG TIN KHÁCH HÀNG</td></tr>',
    '  <tr><td class="lb">Khách hàng</td><td class="vl">{{customerName}}</td><td class="lb">SĐT</td><td class="vl">{{phone}}</td></tr>',
    '  <tr><td class="lb">Địa chỉ</td><td class="vl" colspan="3">{{address}}</td></tr>',
    '  <tr><td class="sec" colspan="4">THÔNG TIN THIẾT BỊ</td></tr>',
    '  <tr><td class="lb">Thiết bị</td><td class="vl">{{device}}</td><td class="lb">Serial</td><td class="vl">{{serial}}</td></tr>',
    '  <tr><td class="lb">Cấu hình</td><td class="vl" colspan="3">{{config}}</td></tr>',
    '  <tr><td class="lb">Mật khẩu</td><td class="vl">{{password}}</td><td class="lb">Phụ kiện</td><td class="vl">{{accessories}}</td></tr>',
    '  <tr><td class="sec" colspan="4">TÌNH TRẠNG & YÊU CẦU</td></tr>',
    '  <tr><td class="lb">Tình trạng ban đầu</td><td class="vl" colspan="3">{{initialCondition}}</td></tr>',
    '  <tr><td class="lb">Yêu cầu sửa chữa</td><td class="vl" colspan="3">{{repairRequest}}</td></tr>',
    '  <tr><td class="sec" colspan="4">CHI PHÍ & HẸN TRẢ</td></tr>',
    '  <tr><td class="lb">Chi phí ước tính</td><td class="vl">{{cost}}</td><td class="lb">Đặt cọc</td><td class="vl">{{deposit}}</td></tr>',
    '  <tr><td class="lb">Ngày trả dự kiến</td><td class="vl">{{deliveredDate}}</td><td class="lb">KTV</td><td class="vl">{{techName}}</td></tr>',
    '</table>',
    '<div class="warn">⚠️ LƯU Ý VỀ DỮ LIỆU: {{warning}}</div>',
    '<div class="terms"><b>Điều khoản:</b><br>{{terms}}</div>',
    '<div class="sign"><div><div class="sl">Khách hàng</div><div class="su">(ký, ghi rõ họ tên)</div></div><div><div class="sl">Người nhận máy</div><div class="su">(ký, ghi rõ họ tên)</div></div></div>'
  ].join('\n');
}
function openReceiptTplModal() {
  const t = getReceiptTpl();
  const ck = (k) => (t[k] === false ? '' : 'checked');
  const lbl = 'font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem';
  const inp = 'width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px';
  const tog = (k, text) => '<label style="display:flex;align-items:center;gap:.4rem;font-size:.84rem;color:#334155;padding:.2rem 0"><input type="checkbox" id="rct-'+k+'" '+ck(k)+'/>'+text+'</label>';
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.4rem;width:min(700px,96vw);max-height:92vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,.2)">
    <h3 style="margin:0 0 .3rem;font-size:1.1rem">\u{1F4CB} Cài đặt mẫu Phiếu nhận máy</h3>
    <p style="margin:0 0 .8rem;font-size:.8rem;color:#94a3b8">Tên / địa chỉ / hotline / logo lấy từ "\u{1F5A8} Mẫu bill". Ở đây tùy chỉnh toàn bộ phiếu nhận.</p>
    <div style="display:flex;gap:.4rem;margin-bottom:1rem;border-bottom:1px solid #e5e7eb">
      <button id="rct-tab-basic" type="button" style="background:none;border:none;padding:.5rem .9rem;cursor:pointer;font-size:.9rem;font-weight:600;border-bottom:2px solid #0891b2;color:#0891b2">⚙️ Tùy chọn</button>
      <button id="rct-tab-adv" type="button" style="background:none;border:none;padding:.5rem .9rem;cursor:pointer;font-size:.9rem;font-weight:600;border-bottom:2px solid transparent;color:#64748b">\u{1F527} Nâng cao (HTML)</button>
    </div>
    <div id="rct-pane-basic">
      <div style="font-size:.8rem;font-weight:700;color:#0891b2;margin:.1rem 0 .3rem">THÔNG TIN CỬA HÀNG <span style="font-weight:400;color:#94a3b8">(riêng phiếu này — để trống sẽ lấy từ Mẫu HĐ)</span></div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:.5rem;margin-bottom:.5rem">
        <label><span style="${lbl}">Tên cửa hàng</span><input id="rct-shopName" placeholder="LAPTOP 24H" style="${inp}"/></label>
        <label><span style="${lbl}">Hotline</span><input id="rct-shopHot" placeholder="0966 666 786" style="${inp}"/></label>
      </div>
      <label style="display:block;margin-bottom:.5rem"><span style="${lbl}">Địa chỉ</span><input id="rct-shopAddr" placeholder="Số nhà, đường, phường, tỉnh..." style="${inp}"/></label>
      <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.8rem;padding:.5rem .7rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px">
        <img id="rct-logo-prev" alt="" style="height:36px;max-width:140px;object-fit:contain;display:none"/>
        <div style="flex:1"><span style="${lbl}">Logo (tải ảnh lên — tự thu nhỏ)</span><input type="file" id="rct-logo-file" accept="image/*" style="font-size:.8rem"/></div>
        <button id="rct-logo-clear" type="button" class="btn btn--secondary" style="font-size:.78rem;padding:.3rem .7rem">Xóa logo</button>
      </div>
      <hr style="border:none;border-top:1px solid #eef2f7;margin:.2rem 0 .8rem"/>
      <div style="display:flex;gap:.6rem;margin-bottom:.7rem;flex-wrap:wrap">
        <label style="flex:2;min-width:160px"><span style="${lbl}">Tiêu đề phiếu</span><input id="rct-title" placeholder="PHIẾU NHẬN MÁY" style="${inp}"/></label>
        <label style="flex:1;min-width:90px"><span style="${lbl}">Khổ giấy</span><select id="rct-paper" style="${inp}"><option value="A5">A5</option><option value="A4">A4</option></select></label>
        <label style="flex:1;min-width:90px"><span style="${lbl}">Cỡ chữ (%)</span><input id="rct-scale" type="number" min="60" max="160" step="5" style="${inp}"/></label>
        <label style="flex:1;min-width:90px"><span style="${lbl}">Số liên</span><select id="rct-copies" style="${inp}"><option value="2">2 liên</option><option value="1">1 liên</option></select></label>
      </div>
      <div style="font-size:.8rem;font-weight:700;color:#0891b2;margin:.6rem 0 .3rem">TÊN CÁC MỤC</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.7rem">
        <label><span style="${lbl}">Mục khách hàng</span><input id="rct-secC" style="${inp}"/></label>
        <label><span style="${lbl}">Mục thiết bị</span><input id="rct-secD" style="${inp}"/></label>
        <label><span style="${lbl}">Mục tình trạng</span><input id="rct-secS" style="${inp}"/></label>
        <label><span style="${lbl}">Mục chi phí</span><input id="rct-secP" style="${inp}"/></label>
      </div>
      <div style="font-size:.8rem;font-weight:700;color:#0891b2;margin:.6rem 0 .3rem">HIỆN / ẨN CÁC DÒNG</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.1rem .8rem;margin-bottom:.7rem;padding:.5rem .7rem;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
        ${tog('showAddress','Địa chỉ')}
        ${tog('showSerial','Serial')}
        ${tog('showConfig','Cấu hình')}
        ${tog('showPassword','Mật khẩu')}
        ${tog('showAccessories','Phụ kiện')}
        ${tog('showInitial','Tình trạng ban đầu')}
        ${tog('showRequest','Yêu cầu sửa')}
        ${tog('showCost','Chi phí')}
        ${tog('showDeposit','Đặt cọc')}
        ${tog('showDelivered','Ngày trả')}
        ${tog('showTech','KTV')}
        ${tog('showWarn','Ô cảnh báo')}
        ${tog('showTerms','Điều khoản')}
        ${tog('showSign','Ô chữ ký')}
      </div>
      <label style="display:block;margin-bottom:.6rem"><span style="${lbl}">Cảnh báo dữ liệu (ô đậm)</span><textarea id="rct-warn" rows="2" placeholder="Cửa hàng KHÔNG chịu trách nhiệm về dữ liệu..." style="${inp};resize:vertical"></textarea></label>
      <label style="display:block;margin-bottom:.6rem"><span style="${lbl}">Điều khoản nhận máy (mỗi dòng 1 ý)</span><textarea id="rct-terms" rows="4" placeholder="Mỗi dòng là một điều khoản..." style="${inp};resize:vertical"></textarea></label>
      <label style="display:block;margin-bottom:.3rem"><span style="${lbl}">Ghi chú cuối phiếu (footer, tùy chọn)</span><input id="rct-footer" placeholder="Cảm ơn quý khách..." style="${inp}"/></label>
    </div>
    <div id="rct-pane-adv" style="display:none">
      <p style="font-size:.8rem;color:#64748b;margin:0 0 .5rem;line-height:1.6">Sửa trực tiếp mã HTML của <b>một liên</b> (hệ thống tự nhân bản theo "Số liên"). Dùng các biến: <code>{{shopName}} {{shopAddr}} {{shopHot}} {{logo}} {{title}} {{receivedDate}} {{customerName}} {{phone}} {{address}} {{device}} {{serial}} {{config}} {{password}} {{accessories}} {{initialCondition}} {{repairRequest}} {{cost}} {{deposit}} {{deliveredDate}} {{techName}} {{warning}} {{terms}} {{footer}}</code></p>
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.86rem;color:#334155;margin-bottom:.5rem"><input type="checkbox" id="rct-useCustom"/> <b>Dùng mẫu HTML tự thiết kế</b> (bỏ qua tab Tùy chọn)</label>
      <button id="rct-loaddef" type="button" class="btn btn--secondary" style="font-size:.8rem;padding:.3rem .7rem;margin-bottom:.5rem">↩ Chèn mẫu mặc định để sửa</button>
      <textarea id="rct-custom" rows="14" placeholder="Dán / sửa HTML ở đây..." style="${inp};resize:vertical;font-family:monospace;font-size:.78rem;line-height:1.5"></textarea>
    </div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem"><button id="rct-cancel" type="button" class="btn btn--secondary">Hủy</button><button id="rct-save" type="button" class="btn btn--primary">\u{1F4BE} Lưu mẫu</button></div>
  </div>`;
  document.body.appendChild(ov);
  const g = id => document.getElementById(id);
  g('rct-title').value = t.title || '';
  g('rct-paper').value = t.paper || 'A5';
  g('rct-scale').value = t.fontScale || 100;
  g('rct-copies').value = String(t.copies || 2);
  g('rct-secC').value = t.secCustomer || 'THÔNG TIN KHÁCH HÀNG';
  g('rct-secD').value = t.secDevice || 'THÔNG TIN THIẾT BỊ';
  g('rct-secS').value = t.secStatus || 'TÌNH TRẠNG & YÊU CẦU';
  g('rct-secP').value = t.secCost || 'CHI PHÍ & HẸN TRẢ';
  g('rct-warn').value = t.warning || '';
  g('rct-terms').value = t.terms || '';
  g('rct-footer').value = t.footer || '';
  g('rct-custom').value = t.customHtml || '';
  g('rct-useCustom').checked = !!t.useCustom;
  let pendingLogo = (typeof t.logo === 'string') ? t.logo : '';
  const logoPrev = g('rct-logo-prev');
  const setLogoPrev = () => { if (pendingLogo && pendingLogo.length > 10) { logoPrev.src = pendingLogo; logoPrev.style.display = 'block'; } else { logoPrev.style.display = 'none'; } };
  g('rct-shopName').value = t.shopName || '';
  g('rct-shopHot').value = t.shopHot || '';
  g('rct-shopAddr').value = t.shopAddr || '';
  setLogoPrev();
  g('rct-logo-file').onchange = (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => { const mw = 320; const scq = Math.min(1, mw / im.width); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * scq); cv.height = Math.round(im.height * scq); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); try { pendingLogo = cv.toDataURL('image/png'); } catch(e) { pendingLogo = rd.result; } setLogoPrev(); }; im.src = rd.result; };
    rd.readAsDataURL(f);
  };
  g('rct-logo-clear').onclick = () => { pendingLogo = ''; g('rct-logo-file').value = ''; setLogoPrev(); };
  const showTab = adv => {
    g('rct-pane-basic').style.display = adv ? 'none' : 'block';
    g('rct-pane-adv').style.display = adv ? 'block' : 'none';
    g('rct-tab-basic').style.borderBottom = adv ? '2px solid transparent' : '2px solid #0891b2';
    g('rct-tab-basic').style.color = adv ? '#64748b' : '#0891b2';
    g('rct-tab-adv').style.borderBottom = adv ? '2px solid #0891b2' : '2px solid transparent';
    g('rct-tab-adv').style.color = adv ? '#0891b2' : '#64748b';
  };
  g('rct-tab-basic').onclick = () => showTab(false);
  g('rct-tab-adv').onclick = () => showTab(true);
  g('rct-loaddef').onclick = () => { g('rct-custom').value = defaultReceiptCustomHtml(); g('rct-useCustom').checked = true; };
  g('rct-cancel').onclick = () => ov.remove();
  g('rct-save').onclick = () => {
    const gv = id => (g(id) ? g(id).value : '');
    const gc = id => !!(g(id) && g(id).checked);
    saveReceiptTpl({
      title: gv('rct-title').trim(),
      shopName: gv('rct-shopName').trim(),
      shopAddr: gv('rct-shopAddr').trim(),
      shopHot: gv('rct-shopHot').trim(),
      logo: pendingLogo,
      paper: gv('rct-paper'),
      fontScale: parseInt(gv('rct-scale')) || 100,
      copies: parseInt(gv('rct-copies')) || 2,
      secCustomer: gv('rct-secC').trim(),
      secDevice: gv('rct-secD').trim(),
      secStatus: gv('rct-secS').trim(),
      secCost: gv('rct-secP').trim(),
      showAddress: gc('rct-showAddress'), showSerial: gc('rct-showSerial'),
      showConfig: gc('rct-showConfig'), showPassword: gc('rct-showPassword'),
      showAccessories: gc('rct-showAccessories'), showInitial: gc('rct-showInitial'),
      showRequest: gc('rct-showRequest'), showCost: gc('rct-showCost'),
      showDeposit: gc('rct-showDeposit'), showDelivered: gc('rct-showDelivered'),
      showTech: gc('rct-showTech'), showWarn: gc('rct-showWarn'),
      showTerms: gc('rct-showTerms'), showSign: gc('rct-showSign'),
      warning: gv('rct-warn').trim(),
      terms: gv('rct-terms').trim(),
      footer: gv('rct-footer').trim(),
      useCustom: gc('rct-useCustom'),
      customHtml: gv('rct-custom')
    });
    toast('Đã lưu mẫu phiếu nhận ✓');
    ov.remove();
  };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}
function openRepBillTplModal() {
  const t = getRepBillTpl();
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.5rem;width:min(480px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,.2)">
    <h3 style="margin:0 0 1rem;font-size:1.1rem">🖨 Cài đặt nội dung Bill Bảo Hành</h3>
    <label style="display:block;margin-bottom:.75rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem">Tên cửa hàng</span><input id="rbt-shop" style="width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px"/></label>
    <label style="display:block;margin-bottom:.75rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem">Địa chỉ</span><input id="rbt-addr" style="width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px"/></label>
    <label style="display:block;margin-bottom:.75rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem">Số điện thoại</span><input id="rbt-phone" style="width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px"/></label>
    <label style="display:block;margin-bottom:.75rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem">Tiêu đề bill</span><input id="rbt-title" placeholder="Bill Bảo Hành" style="width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px"/></label>
    <label style="display:block;margin-bottom:1rem"><span style="font-size:.82rem;color:#64748b;display:block;margin-bottom:.3rem">Lời cảm ơn / Footer</span><textarea id="rbt-footer" rows="3" style="width:100%;box-sizing:border-box;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:6px;resize:vertical"></textarea></label>
    <div style="display:flex;gap:.5rem;justify-content:flex-end"><button id="rbt-cancel" class="btn btn--secondary">Hủy</button><button id="rbt-save" class="btn btn--primary">💾 Lưu mẫu</button></div>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById('rbt-shop').value = t.shopName || '';
  document.getElementById('rbt-addr').value = t.address || '';
  document.getElementById('rbt-phone').value = t.phone || '';
  document.getElementById('rbt-title').value = t.title || '';
  document.getElementById('rbt-footer').value = t.footer || '';
  document.getElementById('rbt-cancel').onclick = () => ov.remove();
  document.getElementById('rbt-save').onclick = () => {
    saveRepBillTpl({
      shopName: document.getElementById('rbt-shop').value.trim(),
      address:  document.getElementById('rbt-addr').value.trim(),
      phone:    document.getElementById('rbt-phone').value.trim(),
      title:    document.getElementById('rbt-title').value.trim(),
      footer:   document.getElementById('rbt-footer').value.trim(),
    });
    toast('Đã lưu mẫu bill ✓');
    ov.remove();
  };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}
function logRepairToSheet(data, action) {
    try { fetch(REPAIRS_SHEET_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}).catch(()=>{}); } catch(e){}
}

export async function mount(container) {
  const today = todayStr();

  container.innerHTML = `
    <div id="rep-sticky" style="position:sticky;top:0;z-index:30;background:#fff;padding:.45rem 0 .55rem;box-shadow:0 4px 8px rgba(0,0,0,.05)">
    <div class="module-header" style="display:flex;align-items:center">
      <h2>Phiếu sửa chữa</h2>
      <button id="rep-trash-btn" style="margin-left:auto;padding:4px 14px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:13px">🗑 Thùng rác</button>
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
      <button id="rep-edit-btn" class="btn btn--secondary" disabled style="opacity:.4">✎</button>
      <button id="rep-del-btn"  class="btn btn--danger"    disabled style="opacity:.4">✕</button>
      <button id="rep-print-btn" class="btn btn--secondary" disabled style="opacity:.4;background:#0ea5e9;color:#fff;border-color:#0ea5e9">🖨 In bill BH</button>
      <button id="rep-edit-bh-btn" class="btn" disabled style="opacity:.4;background:#f59e0b;color:#fff;border-color:#f59e0b">&#x270f;&#xfe0f; Sửa BH</button>
        <button id="rep-bill-tpl-btn" class="btn" style="background:#8b5cf6;color:#fff;border-color:#8b5cf6;font-size:.85rem">🖨 Mẫu bill</button>
        <button id="rep-receipt-tpl-btn" class="btn" style="background:#0891b2;color:#fff;border-color:#0891b2;font-size:.85rem">📋 Mẫu phiếu nhận</button>
      <button id="rep-status-btn" class="btn" disabled style="opacity:.4;background:#f59e0b;color:#fff;border:1px solid #d97706">&#x21C4; Đổi TT</button>
      <span id="rep-sel-hint" style="font-size:.82rem;color:#888;margin-left:.25rem">← Chọn 1 phiếu để thao tác</span>
    </div>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap"></div>
  `;

  let allData = [];
  let currentPage = 1;
  const PAGE_SIZE = 20;
  let selectedKey = null;
  let selectedKeys = new Set();
let showTrash = false;

  const searchEl   = container.querySelector('#rep-search');
  const statusEl   = container.querySelector('#rep-status-filter');
  const dateFromEl = container.querySelector('#rep-date-from');
  const dateToEl   = container.querySelector('#rep-date-to');
  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    filterData();
  });
  try { getDB().ref('repairReceiptTpl').on('value', sn => { const v = sn.val(); if (v) { _recTpl = v; try { localStorage.setItem(RPL_RECEIPT_KEY, JSON.stringify(v)); } catch(e) {} } }); } catch(e) {}
  container.addEventListener('unmount', () => unsub && unsub());

  window.__editNote = (key) => {
    const rec = allData.find(r => r._key === key);
    if (!rec) return;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.2rem;width:min(440px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <h3 style="margin:0 0 .2rem;font-size:1rem">📝 Ghi chú nội bộ</h3>
      <p style="margin:0 0 .7rem;font-size:.8rem;color:#94a3b8">${(rec.customerName||'')} — ${(rec.device||'')}</p>
      <textarea id="qn-text" rows="4" placeholder="VD: Cần hoàn thành gấp, báo giá cho khách sớm..." style="width:100%;box-sizing:border-box;padding:.5rem .7rem;border:1px solid #cbd5e1;border-radius:8px;resize:vertical;font-size:.9rem"></textarea>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem"><button id="qn-cancel" class="btn btn--secondary">Hủy</button><button id="qn-save" class="btn btn--primary">💾 Lưu</button></div>
    </div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector('#qn-text'); ta.value = rec.internalNote || ''; ta.focus();
    const close = () => ov.remove();
    ov.querySelector('#qn-cancel').onclick = close;
    ov.querySelector('#qn-save').onclick = async () => {
      const note = ta.value.trim();
      try {
        const merged = { ...rec, internalNote: note };
        delete merged._key;
        await updateItem(COLLECTION, key, merged);
        logRepairToSheet({ ...merged, key: key }, 'update');
        toast('Đã lưu ghi chú ✓');
        close();
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    };
  };

  const editBtn    = container.querySelector('#rep-edit-btn');
  const statusBtn = container.querySelector('#rep-status-btn');
  const delBtn     = container.querySelector('#rep-del-btn');
  const printBtn   = container.querySelector('#rep-print-btn');
  const editBhBtn   = container.querySelector('#rep-edit-bh-btn');
  const trashBtn      = container.querySelector('#rep-trash-btn');
  const selHint    = container.querySelector('#rep-sel-hint');
  const billTplBtn = container.querySelector('#rep-bill-tpl-btn');

  function applyFilter() { currentPage = 1; filterData(); }
  searchEl.addEventListener('input', applyFilter);
  statusEl.addEventListener('change', applyFilter);
  dateFromEl.addEventListener('change', applyFilter);
  dateToEl.addEventListener('change', applyFilter);
  trashBtn?.addEventListener('click', () => { showTrash = !showTrash; trashBtn.textContent = showTrash ? '← Quay lại' : '🗑 Thùng rác'; applyFilter(); });
  billTplBtn?.addEventListener('click', () => openRepBillTplModal());
  container.querySelector('#rep-receipt-tpl-btn')?.addEventListener('click', () => openReceiptTplModal());

  container.querySelector('#rep-clear-date').addEventListener('click', () => {
    dateFromEl.value = ''; dateToEl.value = ''; applyFilter();
  });
  container.querySelector('#rep-add').addEventListener('click', () => openForm(null));

  editBtn.addEventListener('click', () => {
    const rec = allData.find(r => r._key === selectedKey);
    if (rec) openForm(rec);
  });
  delBtn.addEventListener('click', () => { if (selectedKeys.size) confirmDeleteKeys([...selectedKeys]); });
  printBtn.addEventListener('click', () => {
    const rec = allData.find(r => r._key === selectedKey);
    if (rec) printWarrantyBill(rec);
  });
  statusBtn.addEventListener('click', () => {
  if (selectedKeys.size > 1) { bulkChangeStatus([...selectedKeys]); }
  else { const rec = allData.find(r => r._key === selectedKey); if (rec) quickChangeStatus(rec); }
});
  editBhBtn.addEventListener('click', () => { const rec = allData.find(r => r._key === selectedKey); if (rec) openEditRepairBH(rec); });

  function setSelected(key) {
    selectedKey = key;
    selectedKeys = key ? new Set([key]) : new Set();
    updateBtnStates();
    const selHint = container.querySelector('#rep-sel-hint');
    if (selHint) selHint.textContent = key ? 'Đã chọn 1 phiếu' : '';
  }

  function updateBtnStates() {
    const n = selectedKeys.size;
    const one = n === 1;
    selectedKey = one ? [...selectedKeys][0] : null;
    [editBtn, printBtn, editBhBtn].forEach(b => { b.disabled = !one; b.style.opacity = one ? '1' : '.4'; });
statusBtn.disabled = !n; statusBtn.style.opacity = n ? '1' : '.4';
statusBtn.textContent = n > 1 ? '⇄ Đổi TT (' + n + ')' : '⇄ Đổi TT';
    delBtn.disabled = !n; delBtn.style.opacity = n ? '1' : '.4';
    delBtn.textContent = n > 1 ? 'Xóa (' + n + ')' : 'Xóa';
  }

  function filterData() {
    const q    = searchEl.value.toLowerCase();
    const st   = statusEl.value;
    const from = dateFromEl.value;
    const to   = dateToEl.value;
    const filtered = allData.filter(r => {
      if (showTrash) return !!r.deletedAt;
      if (r.deletedAt) return false;
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
      { label: '<input type="checkbox" id="rep-chk-all" title="Chọn tất cả" style="cursor:pointer;accent-color:#2563eb">', key: r => '<input type="checkbox" class="rep-chk" data-key="' + r._key + '" style="cursor:pointer;accent-color:#2563eb">' },
      { label: 'Ngày nhận',  key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'Khách hàng', key: r => r.customerName || '' },
      { label: 'SĐT',        key: r => r.phone || '' },
      { label: 'Thiết bị',   key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',     key: r => r.serial || '' },
      { label: 'KTV',        key: r => r.techName || '' },
      { label: 'Chi phí',    key: r => formatVND(r.cost || 0) },
      { label: 'Trạng thái', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' }
    ,
      { label: showTrash ? 'Thao tác' : 'Ghi chú', key: r => showTrash
          ? '<button onclick="window.__restoreRepair(\''+r._key+'\')" style="padding:2px 8px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Khôi phục</button>'
          : '<span onclick="window.__editNote(\''+r._key+'\')" title="Bấm để sửa ghi chú" style="cursor:pointer;display:inline-block;max-width:240px;white-space:normal;line-height:1.35;'+(r.internalNote ? 'color:#b45309;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:3px 8px;font-size:.82rem;font-weight:600' : 'color:#cbd5e1;font-size:.8rem;border:1px dashed #e2e8f0;border-radius:6px;padding:3px 8px')+'">'+(r.internalNote ? '📝 '+String(r.internalNote).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '＋ ghi chú')+'</span>' }];
    const ths = cols.map(c => '<th style="padding:.5rem .75rem;border-bottom:2px solid #e5e7eb;text-align:left;font-size:.8rem;font-weight:600;color:#374151;white-space:nowrap">' + c.label + '</th>').join('');
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const pageData = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const trs = pageData.map(r =>
      '<tr class="rep-row" data-key="' + r._key + '">' +
      cols.map(c => '<td style="padding:.45rem .75rem;border-bottom:1px solid #f3f4f6;font-size:.85rem;vertical-align:middle">' + c.key(r) + '</td>').join('') +
      '</tr>'
    ).join('');
    const pgBtn = (pg, lbl, dis) => '<button class="rep-page-btn" data-page="' + pg + '"' + (dis ? ' disabled' : '') + ' style="padding:.35rem .8rem;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:.85rem' + (dis ? ';opacity:.4;cursor:default' : '') + '">' + lbl + '</button>';
    const pager = '<div style="display:flex;gap:.5rem;align-items:center;justify-content:center;margin-top:.7rem;flex-wrap:wrap">' +
      (totalPages > 1 ? pgBtn('prev', '\u2039 Tr\u01b0\u1edbc', currentPage <= 1) : '') +
      '<span style="font-size:.85rem;color:#374151">Trang ' + currentPage + '/' + totalPages + ' \u00b7 ' + total + ' phi\u1ebfu</span>' +
      (totalPages > 1 ? pgBtn('next', 'Sau \u203a', currentPage >= totalPages) : '') +
      '</div>';
    wrap.innerHTML = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:700px">' +
      '<thead><tr style="background:#f9fafb">' + ths + '</tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>' + pager;
    wrap.querySelectorAll('.rep-page-btn').forEach(function(b){ b.addEventListener('click', function(){ if (b.dataset.page === 'prev' && currentPage > 1) currentPage--; else if (b.dataset.page === 'next' && currentPage < totalPages) currentPage++; renderTable(data); }); });
    const chkAll = wrap.querySelector('#rep-chk-all');
    if (chkAll) chkAll.addEventListener('change', () => {
      wrap.querySelectorAll('.rep-chk').forEach(c => { c.checked = chkAll.checked; });
      selectedKeys = new Set(chkAll.checked ? data.map(r => r._key) : []);
      updateBtnStates();
    });
    wrap.querySelectorAll('.rep-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        if (chk.checked) selectedKeys.add(chk.dataset.key);
        else selectedKeys.delete(chk.dataset.key);
        const allChks = wrap.querySelectorAll('.rep-chk');
        const ca = wrap.querySelector('#rep-chk-all');
        if (ca) { ca.checked = [...allChks].every(x => x.checked); ca.indeterminate = !ca.checked && [...allChks].some(x => x.checked); }
        updateBtnStates();
      });
    });
    // Row click — toggle checkbox
    wrap.querySelectorAll('.rep-row').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', e => {
        if (e.target.classList.contains('rep-chk') || e.target.tagName === 'BUTTON') return;
        const chk = tr.querySelector('.rep-chk');
        if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
      });
    });
  }

  function quickDeliver(record) {
    if (!record) return;
    showModal({
      title: 'Giao máy',
      body: 'Xác nhận giao máy cho: <strong>' + (record.customerName||'') + '</strong>?',
      confirmText: 'Giao máy',
      onConfirm: async () => {
        try {
          await updateItem(COLLECTION, record._key, { ...record, status: 'Đã giao', deliveredDate: todayStr() });
          toast('✅ Đã giao máy thành công');
        } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
      }
    });
  }

  function bulkChangeStatus(keys) {
  const formWrap = container.querySelector('#rep-form-wrap');
  const count = keys.length;
  formWrap.innerHTML = '<div class="form-card" style="max-width:360px;margin:1rem auto;padding:1.2rem">' +
    '<h3 style="margin:0 0 .8rem;font-size:1rem">⇄ Đổi trạng thái ' + count + ' phiếu</h3>' +
    '<p style="color:#555;margin:0 0 .8rem;font-size:.88rem">Chọn trạng thái mới áp dụng cho tất cả:</p>' +
    '<div style="display:flex;flex-direction:column;gap:.35rem">' +
    STATUS_LIST.map(s =>
      '<button class="btn btn--secondary qs-bulk-btn" data-status="' + s + '" style="text-align:left;justify-content:flex-start;background:#f9fafb">' + s + '</button>'
    ).join('') +
    '</div><button id="qs-bulk-cancel" class="btn btn--secondary" style="width:100%;margin-top:.6rem">Hủy</button></div>';
  formWrap.querySelectorAll('.qs-bulk-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ns = btn.dataset.status;
      btn.disabled = true; btn.textContent = 'Đang lưu...';
      let ok = 0, fail = 0;
      for (const key of keys) {
        const rec = allData.find(r => r._key === key);
        if (!rec) { fail++; continue; }
        const update = { ...rec, status: ns };
        if (ns === 'Đã giao' && !rec.deliveredDate) update.deliveredDate = todayStr();
        try { await updateItem(COLLECTION, key, update); ok++; }
        catch(e) { fail++; }
      }
      toast('Đã đổi ' + ok + ' phiếu → "' + ns + '"' + (fail ? ', ' + fail + ' lỗi' : ''));
      formWrap.innerHTML = '';
      selectedKeys = new Set(); updateBtnStates();
    });
  });
  formWrap.querySelector('#qs-bulk-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; });
  formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const remaining = (record.cost || 0) - (record.deposit || 0) - (record.discount || 0);
        if (ns === 'Đã giao' && remaining > 0) { askDeliverPayment(record, remaining, formWrap); return; }
        const update = { ...record, status: ns };
        if (ns === 'Đã giao' && !record.deliveredDate) update.deliveredDate = todayStr();
        try { await updateItem(COLLECTION, record._key, update); toast('✅ ' + ns); formWrap.innerHTML = ''; selectedKeys = new Set(); updateBtnStates(); }
        catch(e) { toast('Lỗi: ' + e.message, 'error'); }
      });
    });
    formWrap.querySelector('#qs-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; selectedKeys = new Set(); updateBtnStates(); });
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function askDeliverPayment(record, remaining, formWrap) {
    formWrap.innerHTML = '<div class="form-card" style="max-width:380px;margin:1rem auto;padding:1.2rem">' +
      '<h3 style="margin:0 0 .4rem">\uD83D\uDE9A Giao máy \u2014 thanh toán</h3>' +
      '<p style="color:#555;margin:0 0 .8rem;font-size:.88rem"><strong>' + (record.customerName || '') + '</strong> \u2014 còn lại <strong style="color:#dc2626">' + formatVND(remaining) + '</strong></p>' +
      '<div style="display:flex;flex-direction:column;gap:.5rem">' +
      '<button id="dp-paid" class="btn btn--primary" style="justify-content:flex-start">\u2705 Đã thanh toán đủ</button>' +
      '<button id="dp-debt" class="btn" style="justify-content:flex-start;background:#f59e0b;color:#fff;border-color:#f59e0b">\uD83D\uDCB0 Ghi công nợ ' + formatVND(remaining) + '</button>' +
      '</div><button id="dp-cancel" class="btn btn--secondary" style="width:100%;margin-top:.6rem">Hủy</button></div>';
    const done = () => { formWrap.innerHTML = ''; selectedKeys = new Set(); updateBtnStates(); };
    const today = todayStr();
    formWrap.querySelector('#dp-paid').addEventListener('click', async () => {
      try {
        await updateItem(COLLECTION, record._key, { ...record, status: 'Đã giao', deliveredDate: record.deliveredDate || today, paymentStatus: 'paid' });
        toast('\u2705 Đã giao \u2014 đã thanh toán'); done();
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
    formWrap.querySelector('#dp-debt').addEventListener('click', async () => {
      try {
        const dev = (record.device || '') + (record.serial ? (' / ' + record.serial) : '');
        const note = 'Nợ phiếu sửa: ' + dev + ' \u2014 nhận ' + (record.receivedDate ? formatDate(record.receivedDate) : '?') + ', giao ' + formatDate(today) + '. Còn lại ' + formatVND(remaining) + '.';
        await addItem('debts', { name: record.customerName || '', phone: record.phone || '', amount: remaining, paid: 0, status: 'unpaid', dueDate: '', note: note, source: 'repair', repairKey: record._key });
        await updateItem(COLLECTION, record._key, { ...record, status: 'Đã giao', deliveredDate: record.deliveredDate || today, paymentStatus: 'debt' });
        toast('\u2705 Đã giao \u2014 đã ghi công nợ ' + formatVND(remaining)); done();
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
    formWrap.querySelector('#dp-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; });
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
    var T = {};
    try { T = JSON.parse(localStorage.getItem('sl_invoice_tpl') || '{}'); } catch(e) {}
    var LOGO24H = 'data:image/png;base64,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';
    var esc = function(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
    var money = function(n){ var x = Number(String(n==null?0:n).replace(/[^0-9]/g,''))||0; return x.toLocaleString('vi-VN') + 'd'; };
    var cfg = [d.cpu&&('CPU '+d.cpu), d.ram&&('RAM '+d.ram), d.ssd&&('SSD '+d.ssd), d.vga&&('VGA '+d.vga)].filter(Boolean).join('  /  ');
    var v = function(x){ return esc(x||'—'); };
    var R = getReceiptTpl();
    var shopName = (R.shopName && R.shopName.trim()) ? R.shopName : (T.shopName || 'LAPTOP 24H');
    var shopAddr = (R.shopAddr && R.shopAddr.trim()) ? R.shopAddr : (T.address || '');
    var shopHot  = (R.shopHot && R.shopHot.trim()) ? R.shopHot : (T.hotline || T.phone || '');
    shopHot = String(shopHot).replace(/^\s*hotline\s*:?\s*/i, '').trim();
    var shopLogo = (R.logo && R.logo.length > 10) ? R.logo : (T.logo || LOGO24H);
    var rTitle = R.title || 'PHIẾU NHẬN MÁY';
    var rPaper = (R.paper === 'A4') ? 'A4' : 'A5';
    var scale = (Number(R.fontScale)||100)/100; if (scale < 0.5) scale = 0.5; if (scale > 2) scale = 2;
    var copies = (Number(R.copies) === 1) ? 1 : 2;
    var on = function(k){ return R[k] !== false; };
    var secC = R.secCustomer || 'THÔNG TIN KHÁCH HÀNG';
    var secD = R.secDevice || 'THÔNG TIN THIẾT BỊ';
    var secS = R.secStatus || 'TÌNH TRẠNG & YÊU CẦU';
    var secP = R.secCost || 'CHI PHÍ & HẸN TRẢ';
    var rWarnHtml = (R.warning && R.warning.trim()) ? esc(R.warning) : 'Cửa hàng <b>KHÔNG chịu trách nhiệm</b> về dữ liệu trong máy. Nếu có dữ liệu cực kỳ quan trọng, vui lòng <b>trao đổi/sao lưu trực tiếp với nhân viên</b> trước khi giao máy.';
    var rTermsArr = (R.terms && R.terms.trim()) ? R.terms.split('\n').map(function(t){return t.trim();}).filter(Boolean) : ['Cửa hàng kiểm tra & báo giá trước khi sửa, khách đồng ý mới tiến hành.','Quý khách giữ phiếu này & xuất trình khi nhận máy.','Quá 30 ngày kể từ ngày hẹn trả mà không đến nhận, cửa hàng không chịu trách nhiệm bảo quản.','Khách đã kiểm tra & đồng ý tình trạng máy/phụ kiện ghi trên phiếu.'];
    var rTermsHtml = rTermsArr.map(function(t,i){ return (i+1)+') '+esc(t); }).join('<br>');
    var rFooter = (R.footer && R.footer.trim()) ? esc(R.footer) : '';

    var map = {
      shopName: esc(shopName), shopAddr: esc(shopAddr), shopHot: esc(shopHot), logo: shopLogo,
      title: esc(rTitle), receivedDate: esc(d.receivedDate||''),
      customerName: v(d.customerName), phone: v(d.phone), address: v(d.address),
      device: v(d.device), serial: v(d.serial), config: (cfg?esc(cfg):'—'),
      password: v(d.password), accessories: v(d.accessories),
      initialCondition: v(d.initialCondition), repairRequest: v(d.repairRequest),
      cost: money(d.cost), deposit: money(d.deposit),
      deliveredDate: v(d.deliveredDate), techName: v(d.techName),
      warning: rWarnHtml, terms: rTermsHtml, footer: rFooter
    };
    var subst = function(tpl){ return String(tpl).replace(/\{\{(\w+)\}\}/g, function(m,k){ return (map[k]!==undefined) ? map[k] : m; }); };

    var inner;
    if (R.useCustom && R.customHtml && R.customHtml.trim()) {
      inner = subst(R.customHtml);
    } else {
      var rows = '';
      rows += '<tr><td class="sec" colspan="4">'+esc(secC)+'</td></tr>';
      rows += '<tr><td class="lb">Khách hàng</td><td class="vl">'+v(d.customerName)+'</td><td class="lb">SĐT</td><td class="vl">'+v(d.phone)+'</td></tr>';
      if (on('showAddress')) rows += '<tr><td class="lb">Địa chỉ</td><td class="vl" colspan="3">'+v(d.address)+'</td></tr>';
      rows += '<tr><td class="sec" colspan="4">'+esc(secD)+'</td></tr>';
      if (on('showSerial')) rows += '<tr><td class="lb">Thiết bị</td><td class="vl">'+v(d.device)+'</td><td class="lb">Serial</td><td class="vl">'+v(d.serial)+'</td></tr>';
      else rows += '<tr><td class="lb">Thiết bị</td><td class="vl" colspan="3">'+v(d.device)+'</td></tr>';
      if (on('showConfig')) rows += '<tr><td class="lb">Cấu hình</td><td class="vl" colspan="3">'+(cfg?esc(cfg):'—')+'</td></tr>';
      if (on('showPassword') && on('showAccessories')) rows += '<tr><td class="lb">Mật khẩu</td><td class="vl">'+v(d.password)+'</td><td class="lb">Phụ kiện</td><td class="vl">'+v(d.accessories)+'</td></tr>';
      else if (on('showPassword')) rows += '<tr><td class="lb">Mật khẩu</td><td class="vl" colspan="3">'+v(d.password)+'</td></tr>';
      else if (on('showAccessories')) rows += '<tr><td class="lb">Phụ kiện</td><td class="vl" colspan="3">'+v(d.accessories)+'</td></tr>';
      if (on('showInitial') || on('showRequest')) {
        rows += '<tr><td class="sec" colspan="4">'+esc(secS)+'</td></tr>';
        if (on('showInitial')) rows += '<tr><td class="lb">Tình trạng ban đầu</td><td class="vl" colspan="3">'+v(d.initialCondition)+'</td></tr>';
        if (on('showRequest')) rows += '<tr><td class="lb">Yêu cầu sửa chữa</td><td class="vl" colspan="3">'+v(d.repairRequest)+'</td></tr>';
      }
      var cC=on('showCost'), cD=on('showDeposit'), cL=on('showDelivered'), cT=on('showTech');
      if (cC||cD||cL||cT) {
        rows += '<tr><td class="sec" colspan="4">'+esc(secP)+'</td></tr>';
        if (cC && cD) rows += '<tr><td class="lb">Chi phí ước tính</td><td class="vl">'+money(d.cost)+'</td><td class="lb">Đặt cọc</td><td class="vl">'+money(d.deposit)+'</td></tr>';
        else if (cC) rows += '<tr><td class="lb">Chi phí ước tính</td><td class="vl" colspan="3">'+money(d.cost)+'</td></tr>';
        else if (cD) rows += '<tr><td class="lb">Đặt cọc</td><td class="vl" colspan="3">'+money(d.deposit)+'</td></tr>';
        if (cL && cT) rows += '<tr><td class="lb">Ngày trả dự kiến</td><td class="vl">'+v(d.deliveredDate)+'</td><td class="lb">KTV</td><td class="vl">'+v(d.techName)+'</td></tr>';
        else if (cL) rows += '<tr><td class="lb">Ngày trả dự kiến</td><td class="vl" colspan="3">'+v(d.deliveredDate)+'</td></tr>';
        else if (cT) rows += '<tr><td class="lb">KTV</td><td class="vl" colspan="3">'+v(d.techName)+'</td></tr>';
      }
      inner = '<div class="head">' +
          (shopLogo ? '<img class="logo" src="'+shopLogo+'" alt="">' : '') +
          '<div class="shop">' +
            (shopLogo ? '' : '<div class="sn">'+esc(shopName)+'</div>') +
            (shopAddr ? '<div class="si">\u{1F4CD} '+esc(shopAddr)+'</div>' : '') +
            (shopHot ? '<div class="si">\u{1F4DE} Hotline: '+esc(shopHot)+'</div>' : '') +
          '</div>' +
          '<div class="doc"><div class="dt">'+esc(rTitle)+'</div><div class="dd">Ngày nhận: '+esc(d.receivedDate||'')+'</div></div>' +
        '</div>' +
        '<table class="info">'+rows+'</table>' +
        (on('showWarn') ? '<div class="warn">⚠️ LƯU Ý VỀ DỮ LIỆU: '+rWarnHtml+'</div>' : '') +
        (on('showTerms') ? '<div class="terms"><b>Điều khoản:</b><br>'+rTermsHtml+'</div>' : '') +
        (on('showSign') ? '<div class="sign"><div><div class="sl">Khách hàng</div><div class="su">(ký, ghi rõ họ tên)</div></div><div><div class="sl">Người nhận máy</div><div class="su">(ký, ghi rõ họ tên)</div></div></div>' : '') +
        (rFooter ? '<div class="ft">'+rFooter+'</div>' : '');
    }

    var fs = function(px){ return (px*scale).toFixed(1)+'px'; };
    var css = '@page{size:'+rPaper+' portrait;margin:8mm}' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:Arial,sans-serif;color:#1f2937;font-size:'+fs(11)+';width:' + (rPaper==='A4'?194:132) + 'mm;margin:0 auto}' +
      '.lien{padding:4px 0 6px}' +
      '.head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #000;padding-bottom:7px;margin-bottom:8px}' +
      '.logo{height:'+fs(42)+';width:auto;object-fit:contain}' +
      '.shop{flex:1}.sn{font-size:'+fs(18)+';font-weight:bold;color:#000;line-height:1.2;margin-bottom:1px}.si{font-size:'+fs(10)+';color:#222;line-height:1.5}' +
      '.doc{text-align:right}.dt{font-size:'+fs(14)+';font-weight:bold;letter-spacing:.5px;color:#000}.dd{font-size:'+fs(9.5)+';color:#333;margin-top:1px}' +
      '.info{width:100%;border-collapse:collapse;margin-bottom:8px}' +
      '.info td{border:1px solid #555;padding:5px 8px;font-size:'+fs(11)+';vertical-align:top;line-height:1.4;color:#000}' +
      '.info .lb{background:#ededed;color:#000;font-weight:700;width:20%;white-space:nowrap;font-size:'+fs(9.5)+'}' +
      '.info .vl{color:#000}' +
      '.info .sec{background:#d6d6d6;color:#000;font-weight:bold;font-size:'+fs(10)+';letter-spacing:.6px;padding:4px 8px}' +
      '.warn{border:2px solid #000;background:#f0f0f0;color:#000;font-weight:600;font-size:'+fs(10)+';padding:6px 9px;border-radius:6px;margin-bottom:8px;line-height:1.5}' +
      '.terms{font-size:'+fs(9.5)+';color:#000;line-height:1.7;margin-bottom:10px}' +
      '.ft{text-align:center;font-size:'+fs(9.5)+';color:#333;font-style:italic;margin-top:6px}' +
      '.sign{display:flex;justify-content:space-between;margin-top:8px}' +
      '.sign>div{width:46%;text-align:center;border-top:1px solid #333;padding-top:4px;margin-top:34px}' +
      '.sl{font-weight:bold;font-size:'+fs(11)+';color:#000}.su{font-size:'+fs(9)+';color:#333}' +
      '@media print{.np{display:none}}';

    var blocks = '';
    for (var ci=0; ci<copies; ci++){ blocks += '<div class="lien"' + (ci<copies-1 ? ' style="page-break-after:always"' : '') + '>' + inner + '</div>'; }

    var html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Phiếu nhận máy</title><style>'+css+'</style></head><body>' +
      blocks +
      '<div class="np" style="text-align:center;margin-top:10px"><button onclick="window.print()" style="padding:7px 22px;font-size:14px;cursor:pointer">\u{1F5A8} In phiếu</button></div>' +
      '<script>(function(){var M=96/25.4,PH=' + (rPaper==='A4'?281:194) + '*M;function f(){var L=document.querySelectorAll(".lien");for(var i=0;i<L.length;i++){var el=L[i];el.style.zoom=1;var h=el.scrollHeight;if(h>PH)el.style.zoom=PH/h;}}f();window.addEventListener("beforeprint",f);})();<\/script>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=600,height=860');
    w.document.write(html);
    w.document.close();
}


function openForm(record) {
    const formWrap = container.querySelector('#rep-form-wrap');
    formWrap.innerHTML = `<style>.rfm-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999}.rfm-card{background:#fff;border-radius:14px;width:820px;max-width:96vw;max-height:93vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.3);display:flex;flex-direction:column}.rfm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:2px solid #f1f5f9;flex-shrink:0}.rfm-head h2{margin:0;font-size:17px;font-weight:700;color:#1e293b}.rfm-head .rfm-x{background:#f8fafc;border:none;font-size:16px;cursor:pointer;color:#64748b;width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center}.rfm-head .rfm-x:hover{background:#e2e8f0}.rfm-body{padding:18px 22px;flex:1;overflow-y:auto}.rfm-r{display:grid;gap:12px;margin-bottom:14px}.rfm-r3{grid-template-columns:1fr 1fr 1fr}.rfm-r4{grid-template-columns:1fr 1fr 1fr 1fr}.rfm-r2{grid-template-columns:1fr 1fr}.rfm-r1{grid-template-columns:1fr}.rfm-f label{display:block;font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}.rfm-f input,.rfm-f textarea,.rfm-f select{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:8px;padding:9px 12px;font-size:14px;color:#1e293b;outline:none;transition:border .15s;background:#fff}.rfm-f input:focus,.rfm-f textarea:focus,.rfm-f select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}.rfm-f textarea{resize:vertical;min-height:78px;font-family:inherit}.rfm-foot{padding:14px 22px;border-top:2px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0}.rfm-cancbtn{padding:9px 22px;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;color:#374151;font-weight:500}.rfm-cancbtn:hover{background:#f8fafc}.rfm-savbtn{padding:9px 26px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700}.rfm-savbtn:hover{background:#1d4ed8}</style>
<div class="rfm-ov"><div class="rfm-card">
<div class="rfm-head"><h2>🔧 Phiếu Nhận Máy Sửa</h2><button class="rfm-x" onclick="document.getElementById('f-cancel').click()">✕</button></div>
<div class="rfm-body">
<div class="rfm-r" style="margin-bottom:6px"><div class="rfm-f" style="position:relative;flex:1"><label style="color:#0891b2;font-weight:700">🔍 TÌM KHÁCH HÀNG</label><input id="f-cust-search" type="text" placeholder="Nhập tên hoặc số điện thoại..." autocomplete="off" style="width:100%;box-sizing:border-box"><div id="f-cust-drop" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #c7d2fe;border-radius:6px;z-index:999;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.15)"></div></div></div>
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
<div class="rfm-r" style="display:block"><div style="background:#eef4ff;border:1px solid #c7d9f0;border-radius:8px;padding:10px;margin:0 0 4px"><div style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:.5px;margin-bottom:8px">LINH KIỆN Sử DỤNG</div><div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><div id="f-parts-combo" style="flex:1;position:relative"><input id="f-parts-search" type="text" autocomplete="off" placeholder="Gõ tên linh kiện để tìm..." style="width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px"><div id="f-parts-drop" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #c7d2fe;border-radius:6px;z-index:999;max-height:220px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.15)"></div></div><input id="f-parts-qty" type="number" min="1" value="1" style="width:52px;padding:7px 5px;border:1px solid #ccc;border-radius:6px;font-size:13px;text-align:center"><button type="button" id="f-parts-add" style="padding:7px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap">+ Thêm</button></div><div id="f-parts-list" style="max-height:160px;overflow-y:auto"></div><div style="margin-top:5px;text-align:right;font-size:12px;color:#444">Tổng LK: <b id="f-parts-total">0</b>₫ &nbsp;|&nbsp; Vốn LK: <b id="f-parts-vcost">0</b>₫</div></div></div>
<div class="rfm-r rfm-r3"><div class="rfm-f"><label>NGÀY NHẬN *</label><input id="f-receivedDate" type="date" value="${record?.receivedDate||new Date().toISOString().slice(0,10)}"></div><div class="rfm-f"><label>CÔNG SỬa (₫)</label><input id="f-serviceFee" type="text" data-fmt="number" value="${String(record?.serviceFee??record?.cost??0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div><div class="rfm-f"><label>TIỀN CỌC (Đ)</label><input id="f-deposit" type="text" data-fmt="number" value="${String(record?.deposit||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
<div class="rfm-r rfm-r2"><div class="rfm-f"><label>TỔNG TIỀN SỬa (₫)</label><input id="f-cost" type="text" data-fmt="number" readonly style="background:#eef4ff;font-weight:700;color:#1e40af" value="${String(record?.cost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div><div class="rfm-f"><label>VỐN LINH KIỆN (₫)</label><input id="f-partsCost" type="text" data-fmt="number" style="background:#fff" value="${String(record?.partsCost||0).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}"></div></div>
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
              serviceFee:    parseFloat((formWrap.querySelector('#f-serviceFee').value||'').replace(/\./g,'')) || 0,
              partsUsed:     _partsArr,
              partsCost:     parseFloat((formWrap.querySelector('#f-partsCost').value||'').replace(/\./g,'')) || 0,
        profit:        (parseFloat((formWrap.querySelector('#f-cost').value||'').replace(/\./g,''))||0) - (parseFloat((formWrap.querySelector('#f-partsCost').value||'').replace(/\./g,''))||0),
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
        if (record && record.partsUsed && record.partsUsed.length) { await restorePartsStock(record.partsUsed); }
        await deductPartsStock(_partsArr);
        formWrap.innerHTML = ''; formWrap.classList.remove('rep-modal'); selectedKeys = new Set(); updateBtnStates();
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
    
  // ── Parts Picker ──────────────────────────
  var _partsArr = (record && Array.isArray(record.partsUsed)) ? record.partsUsed.map(function(p){return Object.assign({},p);}) : [];
  var fmtN = function(n){ return String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,"."); };

  function renderPartsList() {
    var list = formWrap.querySelector("#f-parts-list");
    var tot  = _partsArr.reduce(function(s,p){return s+p.salePrice*p.qty;},0);
    var von  = _partsArr.reduce(function(s,p){return s+p.costPrice*p.qty;},0);
    formWrap.querySelector("#f-parts-total").textContent = fmtN(tot);
    formWrap.querySelector("#f-parts-vcost").textContent = fmtN(von);
    list.innerHTML = _partsArr.length ? _partsArr.map(function(p,i){
      return "<div style=\"display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #e0e8f4\">"
           + "<span style=\"flex:1;font-size:13px\">" + p.name + "</span>"
           + "<span style=\"font-size:12px;color:#666\">x" + p.qty + "</span>"
           + "<input type=\"text\" class=\"part-von-inp\" data-idx=\"" + i + "\" value=\"" + fmtN(p.costPrice) + "\" style=\"width:62px;font-size:11px;border:1px solid #d0d7e5;border-radius:3px;padding:1px 4px;text-align:right;color:#888\" placeholder=\"V\u1ed1n\">"
           + "<span style=\"font-size:13px;font-weight:600;color:#1d4ed8;min-width:68px;text-align:right\">" + fmtN(p.salePrice*p.qty) + "\u20ab</span>"
           + "<button type=\"button\" data-idx=\"" + i + "\" class=\"rm-part\" style=\"border:none;background:none;color:#ef4444;cursor:pointer;font-size:16px;padding:0 4px\">\u00d7</button>"
           + "</div>";
    }).join("") : "<div style=\"color:#aaa;font-size:12px;padding:2px 0\">Ch\u01b0a c\u00f3 linh ki\u1ec7n</div>";
    recalcTotals();
  }

  function recalcTotals() {
    var svc = parseFloat((formWrap.querySelector("#f-serviceFee").value||"").replace(/\./g,""))||0;
    var pT  = _partsArr.reduce(function(s,p){return s+p.salePrice*p.qty;},0);
    var vT  = _partsArr.reduce(function(s,p){return s+p.costPrice*p.qty;},0);
    formWrap.querySelector("#f-cost").value      = fmtN(svc+pT);
    if (vT > 0) formWrap.querySelector("#f-partsCost").value = fmtN(vT);
  }

  var _partsPool = [];
  var _partSel = null;
  var _searchEl = formWrap.querySelector("#f-parts-search");
  var _dropEl = formWrap.querySelector("#f-parts-drop");

  function renderPartDrop(q){
    if(!_dropEl) return;
    q = (q||"").toLowerCase().trim();
    var list = _partsPool.filter(function(p){
      return !q || (p.name||"").toLowerCase().indexOf(q)>=0 || (p.id||"").toLowerCase().indexOf(q)>=0;
    }).slice(0,60);
    if(!list.length){ _dropEl.innerHTML = '<div style="padding:8px 10px;color:#9ca3af;font-size:13px">Kh\u00f4ng c\u00f3 linh ki\u1ec7n ph\u00f9 h\u1ee3p</div>'; return; }
    _dropEl.innerHTML = list.map(function(p){
      return '<div class="part-opt" data-key="'+p._key+'" style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #f1f5f9">'+
        (p.name||"?")+' <span style="color:#16a34a">'+fmtN(p.price||p.cost||0)+'\u20ab</span> <span style="color:#64748b">(kho:'+(p.stock||0)+')</span></div>';
    }).join('');
  }

  (async function loadProds(){
    try {
      var custs = await getAll("customers"); window._repCusts = custs;
      var prods = await getAll("products");
      var cats = [];
      try { cats = await getAll("categories"); } catch(e){ cats = []; }
      // T\u00ecm danh m\u1ee5c g\u1ed1c "Linh ki\u1ec7n" + m\u1ecdi danh m\u1ee5c con
      var allow = null;
      var root = cats.find(function(c){ return !c.deletedAt && /linh\s*ki\u1ec7n/i.test(c.name||"") && !c.parentKey; })
              || cats.find(function(c){ return !c.deletedAt && /linh\s*ki\u1ec7n/i.test(c.name||""); });
      if (root) {
        allow = {}; allow[root._key] = 1;
        var queue = [root._key];
        while (queue.length) {
          var k = queue.shift();
          cats.filter(function(c){ return c.parentKey === k; }).forEach(function(c){ allow[c._key]=1; queue.push(c._key); });
        }
      }
      _partsPool = prods.filter(function(p){
        return !p.deletedAt && (p.stock||0)>0 && (!allow || allow[p.categoryKey]);
      }).sort(function(a,b){return (a.name||"").localeCompare(b.name||"","vi");});
      renderPartDrop("");
    } catch(e){ console.warn("loadProds",e); }
  })();

  if (_searchEl) {
    _searchEl.addEventListener("focus", function(){ renderPartDrop(_searchEl.value); _dropEl.style.display="block"; });
    _searchEl.addEventListener("input", function(){ _partSel=null; renderPartDrop(_searchEl.value); _dropEl.style.display="block"; });
    _searchEl.addEventListener("blur", function(){ setTimeout(function(){ if(_dropEl) _dropEl.style.display="none"; },160); });
    _searchEl.addEventListener("keydown", function(e){
      if(e.key==="Enter"){
        e.preventDefault();
        var q=(_searchEl.value||"").toLowerCase().trim();
        var first=_partsPool.filter(function(p){return !q||(p.name||"").toLowerCase().indexOf(q)>=0||(p.id||"").toLowerCase().indexOf(q)>=0;})[0];
        if(first) addPart(first);
      }
    });
  }
  if (_dropEl) {
    _dropEl.addEventListener("mousedown", function(e){
      var it = e.target.closest(".part-opt"); if(!it) return;
      e.preventDefault();
      var p = _partsPool.find(function(x){return x._key===it.dataset.key;});
      if(p) addPart(p);
    });
  }

  // Th\u00eam 1 linh ki\u1ec7n v\u00e0o danh s\u00e1ch (d\u00f9ng chung cho click g\u1ee3i \u00fd / Enter / n\u00fat +Th\u00eam)
  function addPart(p){
    if(!p) return;
    var qty = Math.max(1, parseInt(formWrap.querySelector("#f-parts-qty").value)||1);
    var ei  = _partsArr.findIndex(function(x){return x.invKey===p._key;});
    if(ei>=0){ _partsArr[ei].qty += qty; } else {
      _partsArr.push({invKey:p._key, name:p.name, qty:qty,
        salePrice:(Number(p.price)||Number(p.cost)||0), costPrice:Number(p.cost)||0});
    }
    _partSel=null;
    if(_searchEl){ _searchEl.value=""; _searchEl.focus(); }
    if(_dropEl) _dropEl.style.display="none";
    renderPartsList();
    recalcTotals();
  }

  renderPartsList();

  formWrap.querySelector("#f-parts-add").addEventListener("click", function(){
    var q=(_searchEl&&_searchEl.value||"").toLowerCase().trim();
    var pick = _partSel || _partsPool.filter(function(p){return !q||(p.name||"").toLowerCase().indexOf(q)>=0||(p.id||"").toLowerCase().indexOf(q)>=0;})[0];
    if(!pick){ toast("G\u00f5 v\u00e0 ch\u1ecdn linh ki\u1ec7n tr\u01b0\u1edbc","error"); return; }
    addPart(pick);
  });
  formWrap.querySelector("#f-parts-list").addEventListener("click", function(e){
    var btn = e.target.closest(".rm-part");
    if(!btn) return;
    _partsArr.splice(Number(btn.dataset.idx),1);
    renderPartsList();
  });
  formWrap.querySelector("#f-parts-list").addEventListener("input", function(e){
    var vi = e.target.classList.contains("part-von-inp") ? e.target : null;
    if(!vi) return;
    _partsArr[Number(vi.dataset.idx)].costPrice = parseFloat((vi.value||"").replace(/\./g,""))||0;
    recalcTotals();
  });
  formWrap.querySelector("#f-serviceFee").addEventListener("input", recalcTotals);

  // Customer search autocomplete
  var _searchInp = formWrap.querySelector('#f-cust-search');
  var _searchDrop = formWrap.querySelector('#f-cust-drop');
  if (_searchInp) {
    _searchInp.addEventListener('input', function() {
      var q = (_searchInp.value||'').trim().toLowerCase();
      _searchDrop.innerHTML = '';
      if (!q || !window._repCusts) { _searchDrop.style.display='none'; return; }
      var matches = window._repCusts.filter(function(x){ return (x.name||'').toLowerCase().includes(q)||(x.phone||'').includes(q); }).slice(0,10);
      if (!matches.length) { _searchDrop.style.display='none'; return; }
      matches.forEach(function(x){
        var item = document.createElement('div');
        item.style.cssText='padding:8px 10px;cursor:pointer;border-bottom:1px solid #eee;font-size:13px';
        item.innerHTML='<strong>'+x.name+'</strong> <span style="color:#888;font-size:12px">'+x.phone+'</span>';
        item.onmouseenter=function(){item.style.background='#f0f9ff';};
        item.onmouseleave=function(){item.style.background='';};
        item.onclick=function(){
          formWrap.querySelector('#f-customerName').value=x.name||'';
          formWrap.querySelector('#f-phone').value=x.phone||'';
          var addrF=formWrap.querySelector('#f-address'); if(addrF&&x.address) addrF.value=x.address;
          _searchInp.value=x.name||''; _searchDrop.style.display='none';
        };
        _searchDrop.appendChild(item);
      });
      _searchDrop.style.display='block';
    });
    document.addEventListener('click', function(e){ if(!_searchInp.contains(e.target)&&!_searchDrop.contains(e.target)) _searchDrop.style.display='none'; }, {once:false});
  }

formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function restoreRepair(key) {
  const item = allData.find(r => r._key === key);
  if (!item) return;
  const {deletedAt, _key: rk2, ...rest} = item;
  try { await updateItem(COLLECTION, key, {...rest, deletedAt: null}); logRepairToSheet({...rest, key: key}, 'add'); toast('Khôi phục thành công'); filterData(); }
  catch(e) { toast('Lỗi: ' + e.message, 'error'); }
}
window.__restoreRepair = k => restoreRepair(k);

async function confirmDeleteKeys(keys) {
    if (!keys || !keys.length) return;
    const names = keys.map(k => { const r = allData.find(x => x._key === k); return r ? (r.customerName||k) : k; }).join(', ');
    const perm = showTrash;
    showModal({
      title: (perm ? 'Xóa vĩnh viễn ' : 'Xác nhận xóa ') + keys.length + ' phiếu',
      body: 'Xóa phiếu của: <strong>' + names + '</strong>?',
      danger: true,
      confirmText: (perm ? 'Xóa vĩnh viễn ' : 'Xóa ') + keys.length + ' phiếu',
      onConfirm: async () => {
        let ok = 0, fail = 0;
        for (const key of keys) {
          try {
            if (perm) {
              await deleteItem(COLLECTION, key);
              allData = allData.filter(r => r._key !== key);
            } else {
              const item = allData.find(r => r._key === key);
              if (!item) { fail++; continue; }
              const { _key: rk, ...ci } = item;
                 const _dr = allData.find(function(r){return r._key===key;});
              if(_dr && _dr.partsUsed && _dr.partsUsed.length) await restorePartsStock(_dr.partsUsed);
              await updateItem(COLLECTION, key, {...ci, deletedAt: Date.now()});
              allData = allData.map(r => r._key === key ? {...r, deletedAt: Date.now()} : r);
            }
            logRepairToSheet({ key: key }, 'delete');
            ok++;
          } catch(e) { fail++; }
        }
        filterData();
        selectedKeys = new Set(); updateBtnStates();
        toast(ok + ' phiếu đã ' + (perm ? 'xóa vĩnh viễn' : 'xóa') + (fail ? ', ' + fail + ' lỗi' : ''));
      }
    });
  }
  async function confirmDelete(key) { confirmDeleteKeys([key]); }
}
async function restorePartsStock(partsUsed) {
  if (!partsUsed || !partsUsed.length) return;
  for (const p of partsUsed) {
    try { const prod = await getItem('products', p.invKey); if (prod) await updateItem('products', p.invKey, { stock: (prod.stock||0) + p.qty }); } catch(e) {}
  }
}
async function deductPartsStock(partsUsed) {
  if (!partsUsed || !partsUsed.length) return;
  for (const p of partsUsed) {
    try { const prod = await getItem('products', p.invKey); if (prod) await updateItem('products', p.invKey, { stock: Math.max(0, (prod.stock||0) - p.qty) }); } catch(e) {}
  }
}

