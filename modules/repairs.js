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

export async function mount(container) {
  const today = todayStr();

  container.innerHTML = `
    <div class="module-header">
      <h2>Phiếu sửa chữa</h2>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.75rem">
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
    <div style="text-align:center;margin:.75rem 0 1rem">
      <button id="rep-add" class="btn btn--primary" style="padding:.75rem 3rem;font-size:1.1rem;border-radius:10px;box-shadow:0 2px 8px rgba(37,99,235,.3)">
        + Thêm phiếu mới
      </button>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap"></div>
  `;

  let allData = [];

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    filterData();
  });

  container.addEventListener('unmount', () => unsub && unsub());

  const searchEl   = container.querySelector('#rep-search');
  const statusEl   = container.querySelector('#rep-status-filter');
  const dateFromEl = container.querySelector('#rep-date-from');
  const dateToEl   = container.querySelector('#rep-date-to');

  searchEl.addEventListener('input', filterData);
  statusEl.addEventListener('change', filterData);
  dateFromEl.addEventListener('change', filterData);
  dateToEl.addEventListener('change', filterData);

  container.querySelector('#rep-clear-date').addEventListener('click', () => {
    dateFromEl.value = '';
    dateToEl.value   = '';
    filterData();
  });

  container.querySelector('#rep-add').addEventListener('click', () => openForm(null));

  function filterData() {
    const q    = searchEl.value.toLowerCase();
    const st   = statusEl.value;
    const from = dateFromEl.value;
    const to   = dateToEl.value;

    const filtered = allData.filter(r => {
      const matchQ = !q ||
        (r.customerName||'').toLowerCase().includes(q) ||
        (r.phone||'').toLowerCase().includes(q) ||
        (r.device||'').toLowerCase().includes(q) ||
        (r.serial||'').toLowerCase().includes(q) ||
        formatDeliveryItems(r.deliveryItems).toLowerCase().includes(q);
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
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Ngày nhận',  key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'Khách hàng', key: r => r.customerName || '' },
      { label: 'SĐT',        key: r => r.phone || '' },
      { label: 'Thiết bị',   key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',     key: r => r.serial || '' },
      { label: 'KTV',        key: r => r.techName || '' },
      { label: 'Chi phí',    key: r => formatVND(r.cost || 0) },
      { label: 'Trạng thái', key: r => '<span class="badge ' + (STATUS_CLASS[r.status]||'badge-gray') + '">' + (r.status||'') + '</span>' },
      { label: 'Thao tác',   key: r => '<div style="display:flex;gap:.3rem;flex-wrap:wrap">' +
          '<button class="btn btn--sm btn--secondary rep-edit" data-key="' + r._key + '">✎ Sửa</button>' +
          '<button class="btn btn--sm btn--primary rep-status" data-key="' + r._key + '" style="background:#7c3aed">⇄ Trạng thái</button>' +
          (r.status !== 'Đã giao' && r.status !== 'Huỷ'
            ? '<button class="btn btn--sm btn--primary rep-deliver" data-key="' + r._key + '" style="background:#16a34a">📦 Giao máy</button>'
            : '') +
          (isAdmin() ? '<button class="btn btn--sm btn--danger rep-del" data-key="' + r._key + '">✕</button>' : '') +
          '</div>'
      }
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.rep-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(r => r._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.rep-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
    wrap.querySelectorAll('.rep-status').forEach(btn =>
      btn.addEventListener('click', () => quickChangeStatus(data.find(r => r._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.rep-deliver').forEach(btn =>
      btn.addEventListener('click', () => quickDeliver(data.find(r => r._key === btn.dataset.key)))
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
    formWrap.innerHTML = '<div class="form-card" style="max-width:380px;margin:1rem auto;padding:1.5rem">' +
      '<h3 style="margin:0 0 .5rem">⇄ Thay đổi trạng thái</h3>' +
      '<p style="color:#555;margin:0 0 1rem;font-size:.9rem"><strong>' + record.customerName + '</strong> — ' + (record.device||'') + '</p>' +
      '<div style="display:flex;flex-direction:column;gap:.4rem">' +
      STATUS_LIST.map(s =>
        '<button class="btn ' + (s === record.status ? 'btn--primary' : 'btn--secondary') + ' qs-btn"' +
        ' data-status="' + s + '"' +
        ' style="text-align:left;justify-content:flex-start' + (s === record.status ? '' : ';background:#f9fafb') + '">' +
        (s === record.status ? '✓ ' : '') + s +
        '</button>'
      ).join('') +
      '</div>' +
      '<button id="qs-cancel" class="btn btn--secondary" style="width:100%;margin-top:.75rem">Hủy</button>' +
      '</div>';
    formWrap.querySelectorAll('.qs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        const update = { ...record, status: newStatus };
        if (newStatus === 'Đã giao' && !record.deliveredDate) update.deliveredDate = todayStr();
        try {
          await updateItem(COLLECTION, record._key, update);
          toast('✅ Trạng thái: ' + newStatus);
          formWrap.innerHTML = '';
        } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
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
        <h3>${record ? 'Cập nhật phiếu' : 'Thêm phiếu mới'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Khách hàng *</label>
            <input id="f-customerName" type="text" value="${record?.customerName||''}" />
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
            <label>Thiết bị *</label>
            <input id="f-device" type="text" value="${record?.device||''}" placeholder="VD: LAPTOP ASUS X556" />
          </div>
          <div class="form-group">
            <label>Linh kiện giao nhận</label>
            <input id="f-deliveryItems" type="text" value="${deliveryItemsToText(record?.deliveryItems)}" placeholder="Phân cách bằng dấu phẩy" />
          </div>
          <div class="form-group">
            <label>Serial</label>
            <input id="f-serial" type="text" value="${record?.serial||''}" />
          </div>
          <div class="form-group">
            <label>Mật khẩu máy</label>
            <input id="f-password" type="text" value="${record?.password||''}" />
          </div>
          <div class="form-group">
            <label>Phụ kiện đi kèm</label>
            <input id="f-accessories" type="text" value="${record?.accessories||''}" />
          </div>
          <div class="form-group">
            <label>Kỹ thuật viên</label>
            <input id="f-techName" type="text" value="${record?.techName||''}" />
          </div>
          <div class="form-group">
            <label>Ngày nhận</label>
            <input id="f-receivedDate" type="date" value="${record?.receivedDate || today}" />
          </div>
          <div class="form-group">
            <label>Ngày giao</label>
            <input id="f-deliveredDate" type="date" value="${record?.deliveredDate||''}" />
          </div>
          <div class="form-group">
            <label>Chi phí sửa (đ)</label>
            <input id="f-cost" type="number" value="${record?.cost||0}" />
          </div>
          <div class="form-group">
            <label>Vốn linh kiện (đ)</label>
            <input id="f-capital" type="number" value="${record?.capital||0}" />
          </div>
          <div class="form-group">
            <label>Đặt cọc (đ)</label>
            <input id="f-deposit" type="number" value="${record?.deposit||0}" />
          </div>
          <div class="form-group">
            <label>Giảm giá (đ)</label>
            <input id="f-discount" type="number" value="${record?.discount||0}" />
          </div>
          <div class="form-group">
            <label>Hình thức TT</label>
            <select id="f-paymentType">
              ${['Tiền mặt','Chuyển khoản','Công nợ'].map(p =>
                '<option ' + (record?.paymentType===p?'selected':'') + '>' + p + '</option>'
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Bảo hành (tháng)</label>
            <input id="f-warrantyMonths" type="number" value="${record?.warrantyMonths||0}" />
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select id="f-status">
              ${STATUS_LIST.map(s =>
                '<option ' + ((record?.status||'Tiếp nhận')===s?'selected':'') + '>' + s + '</option>'
              ).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:.5rem">
          <label>Vấn đề / Mô tả</label>
          <textarea id="f-issue" rows="2">${record?.issue||''}</textarea>
        </div>
        <div class="form-group" style="margin-top:.5rem">
          <label>Ghi chú xử lý</label>
          <textarea id="f-processNote" rows="2">${record?.processNote||''}</textarea>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu phiếu'}</button>
          <button id="f-cancel" class="btn btn--secondary">Hủy</button>
        </div>
      </div>
    `;

    formWrap.querySelector('#f-cancel').addEventListener('click', () => { formWrap.innerHTML = ''; });

    formWrap.querySelector('#f-save').addEventListener('click', async () => {
      const customerName = formWrap.querySelector('#f-customerName').value.trim();
      const device       = formWrap.querySelector('#f-device').value.trim();
      if (!customerName) { toast('Vui lòng nhập khách hàng', 'error'); return; }
      const data = {
        customerName,
        phone:          formWrap.querySelector('#f-phone').value.trim(),
        address:        formWrap.querySelector('#f-address').value.trim(),
        device,
        deliveryItems:  textToDeliveryItems(formWrap.querySelector('#f-deliveryItems').value),
        serial:         formWrap.querySelector('#f-serial').value.trim(),
        password:       formWrap.querySelector('#f-password').value.trim(),
        accessories:    formWrap.querySelector('#f-accessories').value.trim(),
        techName:       formWrap.querySelector('#f-techName').value.trim(),
        receivedDate:   formWrap.querySelector('#f-receivedDate').value,
        deliveredDate:  formWrap.querySelector('#f-deliveredDate').value,
        cost:           parseFloat(formWrap.querySelector('#f-cost').value) || 0,
        capital:        parseFloat(formWrap.querySelector('#f-capital').value) || 0,
        deposit:        parseFloat(formWrap.querySelector('#f-deposit').value) || 0,
        discount:       parseFloat(formWrap.querySelector('#f-discount').value) || 0,
        paymentType:    formWrap.querySelector('#f-paymentType').value,
        warrantyMonths: parseInt(formWrap.querySelector('#f-warrantyMonths').value) || 0,
        status:         formWrap.querySelector('#f-status').value,
        issue:          formWrap.querySelector('#f-issue').value.trim(),
        processNote:    formWrap.querySelector('#f-processNote').value.trim(),
        ts: record?.ts || Date.now()
      };
      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('Đã cập nhật phiếu sửa');
        } else {
          await addItem(COLLECTION, data);
          toast('Đã thêm phiếu sửa');
        }
        formWrap.innerHTML = '';
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });

    formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa phiếu sửa chữa này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa phiếu');
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }
}
