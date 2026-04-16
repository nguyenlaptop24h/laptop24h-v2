// modules/sales.js - Bán hàng
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';

const COLLECTION = 'sales';

registerRoute('#sales', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Bán hàng</h2>
      <div class="module-actions">
        <input id="sale-search" type="text" placeholder="Tìm kiếm..." class="search-input" />
        <button id="sale-add" class="btn btn--primary">+ Thêm đơn</button>
      </div>
    </div>
    <div id="sale-table-wrap"></div>
    <div id="sale-form-wrap" class="hidden"></div>
  `;

  let allData = [];

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    renderTable(allData);
  });
  container._cleanup = unsub;

  function renderTable(data) {
    const wrap = container.querySelector('#sale-table-wrap');
    const q = container.querySelector('#sale-search').value.toLowerCase();
    const filtered = q ? data.filter(r =>
      (r.productName||'').toLowerCase().includes(q) ||
      (r.customerName||'').toLowerCase().includes(q)
    ) : data;
    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'createdAt', label: 'Ngày', width:'100px', render: v => formatDate(v) },
        { field: 'productName', label: 'Sản phẩm' },
        { field: 'customerName', label: 'Khách hàng' },
        { field: 'qty', label: 'SL', width:'60px' },
        { field: 'price', label: 'Giá bán', money: true, width:'110px' },
        { field: 'cost', label: 'Vốn', money: true, width:'110px' },
        { field: 'profit', label: 'Lợi nhuận', width:'110px',
          render: (v, row) => {
            const p = (Number(row.price)||0) - (Number(row.cost)||0);
            const cls = p >= 0 ? 'text--green' : 'text--red';
            return `<span class="${cls}">${formatVND(p)}</span>`;
          }},
      ],
      data: filtered,
      actions: [
        { label: 'Sửa', type: 'primary', onClick: row => showForm(row) },
        { label: 'Xoá', type: 'danger', onClick: row => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#sale-search').addEventListener('input', () => renderTable(allData));
  container.querySelector('#sale-add').addEventListener('click', () => showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#sale-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit ? 'Cập nhật đơn' : 'Thêm đơn bán'}</h3>
        <div class="form-grid">
          <label>Sản phẩm <input name="productName" value="${row?.productName||''}" /></label>
          <label>Khách hàng <input name="customerName" value="${row?.customerName||''}" /></label>
          <label>Số lượng <input name="qty" type="number" value="${row?.qty||1}" /></label>
          <label>Giá bán <input name="price" type="number" value="${row?.price||0}" /></label>
          <label>Vốn <input name="cost" type="number" value="${row?.cost||0}" /></label>
          <label class="full-width">Ghi chú <textarea name="note">${row?.note||''}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="sale-cancel">Huỷ</button>
          <button class="btn btn--primary" id="sale-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#sale-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML=''; };
    wrap.querySelector('#sale-save').onclick = async () => {
      const data = {};
      wrap.querySelectorAll('[name]').forEach(el => { data[el.name] = el.value; });
      data.qty = Number(data.qty)||1;
      data.price = Number(data.price)||0;
      data.cost = Number(data.cost)||0;
      try {
        if (isEdit) await updateItem(COLLECTION, row._key, data);
        else await addItem(COLLECTION, data);
        toast(isEdit ? 'Đã cập nhật' : 'Đã thêm đơn', 'success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e) { toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title: 'Xoá đơn', body: `Xác nhận xoá đơn <b>${row.productName}</b>?`,
      confirmText: 'Xoá', danger: true,
      onConfirm: async () => { await deleteItem(COLLECTION, row._key); toast('Đã xoá','success'); }
    });
  }
}
