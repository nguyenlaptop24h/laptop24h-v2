// modules/customers.js - Quản lý khách hàng
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate } from '../core/ui.js';

const COLLECTION = 'customers';
registerRoute('#customers', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Khách hàng</h2>
      <div class="module-actions">
        <input id="cust-search" type="text" placeholder="Tìm khách hàng..." class="search-input" />
        <button id="cust-add" class="btn btn--primary">+ Thêm khách</button>
      </div>
    </div>
    <div id="cust-table-wrap"></div>
    <div id="cust-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a,b) => (a.name||'').localeCompare(b.name||'','vi'));
    renderTable(allData);
  });
  container._cleanup = unsub;

  function renderTable(data) {
    const wrap = container.querySelector('#cust-table-wrap');
    const q = container.querySelector('#cust-search').value.toLowerCase();
    const filtered = q ? data.filter(r =>
      (r.name||'').toLowerCase().includes(q) || (r.phone||'').includes(q)
    ) : data;
    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'name', label: 'Tên khách hàng' },
        { field: 'phone', label: 'SĐT', width:'120px' },
        { field: 'address', label: 'Địa chỉ' },
        { field: 'note', label: 'Ghi chú' },
        { field: 'createdAt', label: 'Ngày tạo', width:'100px', render: v => formatDate(v) },
      ],
      data: filtered,
      actions: [
        { label: 'Sửa', type:'primary', onClick: row => showForm(row) },
        { label: 'Xoá', type:'danger', onClick: row => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#cust-search').addEventListener('input', () => renderTable(allData));
  container.querySelector('#cust-add').addEventListener('click', () => showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#cust-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit ? 'Cập nhật khách hàng' : 'Thêm khách hàng'}</h3>
        <div class="form-grid">
          <label>Tên <input name="name" value="${row?.name||''}" /></label>
          <label>SĐT <input name="phone" value="${row?.phone||''}" /></label>
          <label class="full-width">Địa chỉ <input name="address" value="${row?.address||''}" /></label>
          <label class="full-width">Ghi chú <textarea name="note">${row?.note||''}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="cust-cancel">Huỷ</button>
          <button class="btn btn--primary" id="cust-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#cust-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML=''; };
    wrap.querySelector('#cust-save').onclick = async () => {
      const data = {};
      wrap.querySelectorAll('[name]').forEach(el=>{ data[el.name]=el.value; });
      try {
        if (isEdit) await updateItem(COLLECTION, row._key, data);
        else await addItem(COLLECTION, data);
        toast(isEdit?'Đã cập nhật':'Đã thêm khách hàng','success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e) { toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title:'Xoá khách hàng', body:`Xác nhận xoá <b>${row.name}</b>?`,
      confirmText:'Xoá', danger:true,
      onConfirm: async () => { await deleteItem(COLLECTION,row._key); toast('Đã xoá','success'); }
    });
  }
}
