// modules/inventory.js - Quản lý kho hàng
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatVND } from '../core/ui.js';

const COLLECTION = 'products';
const CAT_COLLECTION = 'categories';

// Danh mục mặc định
const DEFAULT_CATEGORIES = ['Laptop', 'Linh kiện', 'Phụ kiện'];

registerRoute('#inventory', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Kho hàng</h2>
      <div class="module-actions">
        <select id="inv-cat-filter"><option value="">Tất cả danh mục</option></select>
        <input id="inv-search" type="text" placeholder="Tìm sản phẩm..." class="search-input" />
        <button id="inv-add-cat" class="btn btn--secondary">+ Danh mục</button>
        <button id="inv-add" class="btn btn--primary">+ Thêm sản phẩm</button>
      </div>
    </div>
    <div id="inv-table-wrap"></div>
    <div id="inv-form-wrap" class="hidden"></div>
  `;

  let allProducts = [];
  let categories = [...DEFAULT_CATEGORIES];

  // Load categories
  const unsubCat = onSnapshot(CAT_COLLECTION, items => {
    const extra = items.map(i => i.name).filter(n => n && !DEFAULT_CATEGORIES.includes(n));
    categories = [...DEFAULT_CATEGORIES, ...extra];
    rebuildCatFilter();
  });

  // Load products
  const unsubProd = onSnapshot(COLLECTION, items => {
    allProducts = items.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'vi'));
    renderTable();
  });

  container._cleanup = () => { unsubCat(); unsubProd(); };

  function rebuildCatFilter() {
    const sel = container.querySelector('#inv-cat-filter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả danh mục</option>' +
      categories.map(c => `<option ${c===cur?'selected':''}>${c}</option>`).join('');
  }

  function renderTable() {
    const wrap = container.querySelector('#inv-table-wrap');
    const q = container.querySelector('#inv-search').value.toLowerCase();
    const cat = container.querySelector('#inv-cat-filter').value;
    let data = allProducts;
    if (cat) data = data.filter(p => p.category === cat);
    if (q) data = data.filter(p => (p.name||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'sku', label: 'Mã SP', width:'100px' },
        { field: 'name', label: 'Tên sản phẩm' },
        { field: 'category', label: 'Danh mục', width:'120px' },
        { field: 'qty', label: 'Tồn kho', width:'90px',
          render: (v) => `<span class="${Number(v)<5?'text--red':''}"> ${v||0}</span>` },
        { field: 'price', label: 'Giá bán', money:true, width:'110px' },
        { field: 'cost', label: 'Vốn', money:true, width:'110px' },
      ],
      data,
      actions: [
        { label: 'Sửa', type:'primary', onClick: row => showForm(row) },
        { label: 'Xoá', type:'danger', onClick: row => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#inv-search').addEventListener('input', renderTable);
  container.querySelector('#inv-cat-filter').addEventListener('change', renderTable);

  container.querySelector('#inv-add-cat').addEventListener('click', () => {
    showModal({
      title: 'Thêm danh mục',
      body: `<input id="new-cat-input" class="modal-input" placeholder="Tên danh mục..." />`,
      confirmText: 'Thêm',
      onConfirm: async () => {
        const name = document.getElementById('new-cat-input')?.value?.trim();
        if (!name) return;
        if (categories.includes(name)) { toast('Danh mục đã tồn tại','warning'); return; }
        await addItem(CAT_COLLECTION, { name });
        toast('Đã thêm danh mục: ' + name, 'success');
      }
    });
  });

  container.querySelector('#inv-add').addEventListener('click', () => showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#inv-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</h3>
        <div class="form-grid">
          <label>Mã SP <input name="sku" value="${row?.sku||''}" /></label>
          <label>Tên sản phẩm <input name="name" value="${row?.name||''}" /></label>
          <label>Danh mục
            <select name="category">
              ${categories.map(c=>`<option ${row?.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </label>
          <label>Tồn kho <input name="qty" type="number" value="${row?.qty||0}" /></label>
          <label>Giá bán <input name="price" type="number" value="${row?.price||0}" /></label>
          <label>Vốn <input name="cost" type="number" value="${row?.cost||0}" /></label>
          <label class="full-width">Mô tả <textarea name="desc">${row?.desc||''}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="inv-cancel">Huỷ</button>
          <button class="btn btn--primary" id="inv-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#inv-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML=''; };
    wrap.querySelector('#inv-save').onclick = async () => {
      const data = {};
      wrap.querySelectorAll('[name]').forEach(el=>{ data[el.name]=el.value; });
      data.qty = Number(data.qty)||0;
      data.price = Number(data.price)||0;
      data.cost = Number(data.cost)||0;
      try {
        if (isEdit) await updateItem(COLLECTION, row._key, data);
        else await addItem(COLLECTION, data);
        toast(isEdit?'Đã cập nhật':'Đã thêm sản phẩm','success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e) { toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title: 'Xoá sản phẩm', body:`Xác nhận xoá <b>${row.name}</b>?`,
      confirmText:'Xoá', danger:true,
      onConfirm: async () => { await deleteItem(COLLECTION, row._key); toast('Đã xoá','success'); }
    });
  }
}
