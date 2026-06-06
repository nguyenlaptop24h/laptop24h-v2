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
        <button class="btn btn--sm btn--secondary cust-edit" data-key="${c._key}">Sửa</button>
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

  function openForm(record) {
    const wrap = document.getElementById('cust-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-card">
        <h3>${record ? 'Cập nhật khách hàng' : 'Thêm khách hàng'}</h3>
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
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu'}</button>
          <button id="f-cancel" class="btn btn--secondary">Hủy</button>
        </div>
      </div>
    `;

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
    });

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
  var myReps = allReps.filter(function(r){ return (phone && r.phone === phone) || (name && r.customerName === name); });
  var open = myReps.filter(function(r){ return ['Tiếp nhận','\u0110ang sửa'].indexOf(r.status||'') >= 0; });
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
    return '<tr><td style="padding:4px 6px">'+( r.device||'')+' '+(r.serial||'')+'</td><td style="padding:4px 6px;color:'+(r.status==='Đang sửa'?'#e67e22':'#3498db')+'">'+( r.status||'')+'</td><td style="padding:4px 6px">'+(r.receivedDate||'').slice(0,10)+'</td><td style="padding:4px 6px;text-align:right">'+fmtN(r.cost||0)+'đ</td></tr>';
  }).join('') : '<tr><td colspan="4" style="text-align:center;color:#888;padding:8px">Không có máy tại shop</td></tr>';
  var monthRows = months.map(function(m){
    return '<tr><td style="padding:4px 6px">'+m.lbl+'</td><td style="padding:4px 6px;text-align:center">'+m.count+'</td><td style="padding:4px 6px;text-align:right;color:#16a34a">'+fmtN(m.prf)+'đ</td></tr>';
  }).join('');
  var html = '<div style="min-width:480px;max-height:70vh;overflow-y:auto">'+
    '<div style="display:flex;gap:16px;margin-bottom:14px;padding:10px;background:#f0f9ff;border-radius:8px;text-align:center">'+
      '<div><div style="font-size:24px;font-weight:700;color:#1d4ed8">'+myReps.length+'</div><div style="font-size:11px;color:#555">Tổng phiếu</div></div>'+
      '<div><div style="font-size:24px;font-weight:700;color:#dc2626">'+open.length+'</div><div style="font-size:11px;color:#555">Đang tại shop</div></div>'+
      '<div><div style="font-size:20px;font-weight:700;color:#16a34a">'+fmtN(totalProfit)+'đ</div><div style="font-size:11px;color:#555">Tổng lợi nhuận</div></div>'+
    '</div>'+
    (open.length>0?'<div style="margin-bottom:12px"><div style="font-weight:600;color:#dc2626;margin-bottom:5px">📍 Máy đang tại shop ('+open.length+')</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#fee2e2;font-weight:600"><th style="padding:4px 6px;text-align:left">Thiết bị / Serial</th><th>TT</th><th>Ngày nhận</th><th style="text-align:right">Chi phí</th></tr>'+openRows+'</table></div>':'')+
    '<div><div style="font-weight:600;color:#1d4ed8;margin-bottom:5px">📅 Thống kê 6 tháng gần nhất</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#dbeafe;font-weight:600"><th style="padding:4px 6px;text-align:left">Tháng</th><th style="text-align:center">Số máy</th><th style="text-align:right">Lợi nhuận</th></tr>'+monthRows+'</table></div>'+
  '</div>';
  showModal('Thống kê: '+name+' ('+phone+')', html);
}
}
