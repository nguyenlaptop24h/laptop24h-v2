// modules/customers.js - Khách hàng
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
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
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.cust-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(c => c._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.cust-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
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
}
