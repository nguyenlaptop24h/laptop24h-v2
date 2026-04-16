// modules/repairs.js - Phiếu sửa chữa
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'repairs';

registerRoute('#repairs', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Phiếu sửa chữa</h2>
      <div class="module-actions">
        <input id="rep-search" type="text" placeholder="Tìm kiếm..." class="search-input" />
        <button id="rep-add" class="btn btn--primary">+ Thêm phiếu</button>
      </div>
    </div>
    <div id="rep-table-wrap"></div>
    <div id="rep-form-wrap" class="hidden"></div>
  `;

  let allData = [];

  // Realtime listener
  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderTable(allData);
  });

  // Cleanup khi rời trang
  container._cleanup = unsub;

  function renderTable(data) {
    const wrap = container.querySelector('#rep-table-wrap');
    const q = container.querySelector('#rep-search').value.toLowerCase();
    const filtered = q ? data.filter(r =>
      (r.id||'').toLowerCase().includes(q) ||
      (r.customerName||'').toLowerCase().includes(q) ||
      (r.phone||'').toLowerCase().includes(q)
    ) : data;

    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'id', label: 'Mã phiếu', width: '100px' },
        { field: 'customerName', label: 'Khách hàng' },
        { field: 'phone', label: 'SĐT', width: '110px' },
        { field: 'device', label: 'Máy' },
        { field: 'status', label: 'Trạng thái', width: '110px',
          render: (v) => `<span class="badge badge--${v}">${v||''}</span>` },
        { field: 'total', label: 'Tổng tiền', money: true, width: '110px' },
        { field: 'createdAt', label: 'Ngày', width: '100px',
          render: (v) => formatDate(v) },
      ],
      data: filtered,
      actions: [
        { label: 'Sửa', type: 'primary', onClick: (row) => showForm(row) },
        { label: 'Xoá', type: 'danger', onClick: (row) => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#rep-search').addEventListener('input', () => renderTable(allData));
  container.querySelector('#rep-add').addEventListener('click', () => showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#rep-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit ? 'Cập nhật phiếu' : 'Thêm phiếu mới'}</h3>
        <div class="form-grid">
          <label>Mã phiếu <input name="id" value="${row?.id||''}" ${isEdit?'readonly':''} /></label>
          <label>Khách hàng <input name="customerName" value="${row?.customerName||''}" /></label>
          <label>SĐT <input name="phone" value="${row?.phone||''}" /></label>
          <label>Máy <input name="device" value="${row?.device||''}" /></label>
          <label>Lỗi <input name="issue" value="${row?.issue||''}" /></label>
          <label>Trạng thái
            <select name="status">
              ${['Tiếp nhận','Đang sửa','Xong','Đã giao','Huỷ'].map(s =>
                `<option ${row?.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </label>
          <label>Tổng tiền <input name="total" type="number" value="${row?.total||0}" /></label>
          <label>Cọc <input name="deposit" type="number" value="${row?.deposit||0}" /></label>
          ${isAdmin() ? `<label>Vốn linh kiện <input name="capital" type="number" value="${row?.capital||0}" /></label>` : ''}
          <label>Giảm giá <input name="discount" type="number" value="${row?.discount||0}" /></label>
          <label class="full-width">Ghi chú <textarea name="note">${row?.note||''}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="rep-cancel">Huỷ</button>
          <button class="btn btn--primary" id="rep-save">Lưu</button>
        </div>
      </div>`;

    wrap.querySelector('#rep-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML = ''; };
    wrap.querySelector('#rep-save').onclick = async () => {
      const data = {};
      wrap.querySelectorAll('[name]').forEach(el => { data[el.name] = el.value; });
      data.total = Number(data.total) || 0;
      data.deposit = Number(data.deposit) || 0;
      data.capital = Number(data.capital) || 0;
      data.discount = Number(data.discount) || 0;
      try {
        if (isEdit) await updateItem(COLLECTION, row._key, data);
        else await addItem(COLLECTION, data);
        toast(isEdit ? 'Đã cập nhật phiếu' : 'Đã thêm phiếu mới', 'success');
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title: 'Xoá phiếu',
      body: `Xác nhận xoá phiếu <b>${row.id}</b>?`,
      confirmText: 'Xoá',
      danger: true,
      onConfirm: async () => {
        await deleteItem(COLLECTION, row._key);
        toast('Đã xoá phiếu', 'success');
      }
    });
  }
}
