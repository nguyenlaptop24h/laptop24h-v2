// modules/repairs.js - Phiếu sửa chữa
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';

registerRoute('#repairs', mount);

const STATUS_LIST = ['Tiếp nhận','Đang sửa','Hoàn thành','Đã giao','Huỷ'];
const STATUS_CLASS = {
  'Tiếp nhận': 'badge-blue',
  'Đang sửa':  'badge-orange',
  'Hoàn thành':'badge-green',
  'Đã giao':   'badge-purple',
  'Huỷ':       'badge-red'
};

// deliveryItems is array of {desc, price, qty}
function formatDeliveryItems(items) {
  if (!items || !items.length) return '';
  if (typeof items === 'string') return items;
  return items.map(i => (i.desc || '') + (i.qty > 1 ? ' x' + i.qty : '')).filter(Boolean).join(', ');
}

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Phiếu sửa chữa</h2>
      <div class="module-actions">
        <input id="rep-search" type="text" placeholder="Tìm kiếm..." class="search-input" />
        <select id="rep-status-filter" class="search-input" style="width:140px">
          <option value="">Tất cả trạng thái</option>
          ${STATUS_LIST.map(s => `<option>${s}</option>`).join('')}
        </select>
        <button id="rep-add" class="btn btn--primary">+ Thêm phiếu</button>
      </div>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap" class="hidden"></div>
  `;

  let allData = [];

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    renderTable(allData);
  });

  container.addEventListener('unmount', () => unsub && unsub());

  document.getElementById('rep-search').addEventListener('input', () => filterData());
  document.getElementById('rep-status-filter').addEventListener('change', () => filterData());

  function filterData() {
    const q = document.getElementById('rep-search').value.toLowerCase();
    const st = document.getElementById('rep-status-filter').value;
    const filtered = allData.filter(r => {
      const matchQ = !q ||
        (r.customerName||'').toLowerCase().includes(q) ||
        (r.phone||'').toLowerCase().includes(q) ||
        (r.device||'').toLowerCase().includes(q) ||
        (r.serial||'').toLowerCase().includes(q) ||
        formatDeliveryItems(r.deliveryItems).toLowerCase().includes(q);
      const matchSt = !st || r.status === st;
      return matchQ && matchSt;
    });
    renderTable(filtered);
  }

  function renderTable(data) {
    const wrap = document.getElementById('rep-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Ngày nhận',   key: r => formatDate(r.receivedDate || r.ts) },
      { label: 'Khách hàng',  key: r => r.customerName || '' },
      { label: 'SĐT',         key: r => r.phone || '' },
      { label: 'Thiết bị',    key: r => r.device || formatDeliveryItems(r.deliveryItems) || '' },
      { label: 'Serial',      key: r => r.serial || '' },
      { label: 'KTV',         key: r => r.techName || '' },
      { label: 'Chi phí',     key: r => formatVND(r.cost || 0) },
      { label: 'Trạng thái',  key: r => `<span class="badge ${STATUS_CLASS[r.status]||'badge-gray'}">${r.status||''}</span>` },
      { label: '',            key: r => `
        <button class="btn btn--sm btn--secondary rep-edit" data-key="${r._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger rep-del" data-key="${r._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.rep-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(r => r._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.rep-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
  }

  document.getElementById('rep-add').addEventListener('click', () => openForm(null));

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
    const wrap = document.getElementById('rep-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
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
            <input id="f-receivedDate" type="date" value="${record?.receivedDate||''}" />
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
                `<option ${record?.paymentType===p?'selected':''}>${p}</option>`
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
                `<option ${(record?.status||'Tiếp nhận')===s?'selected':''}>${s}</option>`
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

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
    });

    document.getElementById('f-save').addEventListener('click', async () => {
      const customerName = document.getElementById('f-customerName').value.trim();
      const device = document.getElementById('f-device').value.trim();
      if (!customerName) { toast('Vui lòng nhập khách hàng', 'error'); return; }
      const data = {
        customerName,
        phone:          document.getElementById('f-phone').value.trim(),
        address:        document.getElementById('f-address').value.trim(),
        device,
        deliveryItems:  textToDeliveryItems(document.getElementById('f-deliveryItems').value),
        serial:         document.getElementById('f-serial').value.trim(),
        password:       document.getElementById('f-password').value.trim(),
        accessories:    document.getElementById('f-accessories').value.trim(),
        techName:       document.getElementById('f-techName').value.trim(),
        receivedDate:   document.getElementById('f-receivedDate').value,
        deliveredDate:  document.getElementById('f-deliveredDate').value,
        cost:           parseFloat(document.getElementById('f-cost').value) || 0,
        capital:        parseFloat(document.getElementById('f-capital').value) || 0,
        deposit:        parseFloat(document.getElementById('f-deposit').value) || 0,
        discount:       parseFloat(document.getElementById('f-discount').value) || 0,
        paymentType:    document.getElementById('f-paymentType').value,
        warrantyMonths: parseInt(document.getElementById('f-warrantyMonths').value) || 0,
        status:         document.getElementById('f-status').value,
        issue:          document.getElementById('f-issue').value.trim(),
        processNote:    document.getElementById('f-processNote').value.trim(),
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
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('Lỗi: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa phiếu sửa chữa này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa phiếu');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }
}
