// modules/inventory.js - Kho hàng + Danh mục
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot, getDB } from '../core/db.js';
import { buildTable, toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COL_PRODUCTS   = 'products';
const COL_CATEGORIES = 'categories';

registerRoute('#inventory', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Kho hàng</h2>
      <div class="module-actions">
        <div class="tab-group">
          <button class="tab-btn active" data-tab="products">📦 Sản phẩm</button>
          <button class="tab-btn" data-tab="categories">🗂️ Danh mục</button>
        </div>
      </div>
    </div>
    <div id="tab-products">
      <div class="sub-actions" style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">
        <input id="inv-search" type="text" placeholder="Tìm kiếm..." class="search-input" style="flex:1;min-width:160px" />
        <select id="inv-cat-filter" class="search-input" style="width:160px">
          <option value="">Tất cả danh mục</option>
        </select>
        <button id="inv-add" class="btn btn--primary">+ Thêm sản phẩm</button>
      </div>
      <div id="inv-table-wrap"></div>
      <div id="inv-form-wrap" class="hidden"></div>
    </div>
    <div id="tab-categories" class="hidden">
      <div class="sub-actions" style="display:flex;gap:.5rem;margin-bottom:.75rem">
        <button id="cat-add" class="btn btn--primary">+ Thêm danh mục</button>
      </div>
      <div id="cat-table-wrap"></div>
      <div id="cat-form-wrap" class="hidden"></div>
    </div>
  `;

  // --- Tab switching ---
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-products').classList.toggle('hidden', btn.dataset.tab !== 'products');
      document.getElementById('tab-categories').classList.toggle('hidden', btn.dataset.tab !== 'categories');
    });
  });

  let allProducts = [];
  let allCategories = [];

  // ===================== CATEGORIES =====================
  const unsubCats = onSnapshot(COL_CATEGORIES, items => {
    allCategories = items.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'vi'));
    renderCatFilter();
    renderCatTable(allCategories);
  });

  function renderCatFilter() {
    const sel = document.getElementById('inv-cat-filter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả danh mục</option>' +
      allCategories.map(c => `<option value="${c._key}" ${c._key===cur?'selected':''}>${c.name||''}</option>`).join('');
  }

  function renderCatTable(data) {
    const wrap = document.getElementById('cat-table-wrap');
    if (!wrap) return;
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Chưa có danh mục nào. Nhấn "+ Thêm danh mục" để tạo.</p>';
      return;
    }
    const productCount = (catKey) => allProducts.filter(p => p.categoryKey === catKey).length;
    const cols = [
      { label: 'Tên danh mục', key: c => c.name || '' },
      { label: 'Mô tả',        key: c => c.desc || '' },
      { label: 'Số sản phẩm',  key: c => productCount(c._key) },
      { label: '',             key: c => `
        <button class="btn btn--sm btn--secondary cat-edit" data-key="${c._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger cat-del" data-key="${c._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.cat-edit').forEach(btn =>
      btn.addEventListener('click', () => openCatForm(data.find(c => c._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.cat-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDeleteCat(btn.dataset.key))
    );
  }

  document.getElementById('cat-add').addEventListener('click', () => openCatForm(null));

  function openCatForm(record) {
    const wrap = document.getElementById('cat-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-card" style="max-width:500px">
        <h3>${record ? 'Cập nhật danh mục' : 'Thêm danh mục'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Tên danh mục *</label>
            <input id="cf-name" type="text" value="${record?.name||''}" placeholder="VD: Linh kiện, Laptop, Phụ kiện..." />
          </div>
          <div class="form-group">
            <label>Mô tả</label>
            <input id="cf-desc" type="text" value="${record?.desc||''}" />
          </div>
        </div>
        <div class="form-actions">
          <button id="cf-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu'}</button>
          <button id="cf-cancel" class="btn btn--secondary">Hủy</button>
        </div>
      </div>
    `;
    document.getElementById('cf-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden'); wrap.innerHTML = '';
    });
    document.getElementById('cf-save').addEventListener('click', async () => {
      const name = document.getElementById('cf-name').value.trim();
      if (!name) { toast('Vui lòng nhập tên danh mục', 'error'); return; }
      const data = { name, desc: document.getElementById('cf-desc').value.trim() };
      try {
        if (record) { await updateItem(COL_CATEGORIES, record._key, data); toast('Đã cập nhật danh mục'); }
        else        { await addItem(COL_CATEGORIES, data); toast('Đã thêm danh mục'); }
        wrap.classList.add('hidden'); wrap.innerHTML = '';
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
  }

  async function confirmDeleteCat(key) {
    const inUse = allProducts.filter(p => p.categoryKey === key).length;
    const msg = inUse > 0
      ? `Danh mục này có ${inUse} sản phẩm. Xóa danh mục sẽ không xóa sản phẩm, chỉ bỏ liên kết. Tiếp tục?`
      : 'Xóa danh mục này?';
    const ok = await showModal('Xác nhận', msg, true);
    if (!ok) return;
    try { await deleteItem(COL_CATEGORIES, key); toast('Đã xóa danh mục'); }
    catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }

  // ===================== PRODUCTS =====================
  const unsubProds = onSnapshot(COL_PRODUCTS, items => {
    allProducts = items.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'vi'));
    renderCatTable(allCategories); // refresh product counts
    filterProducts();
  });

  container.addEventListener('unmount', () => { unsubCats?.(); unsubProds?.(); });

  document.getElementById('inv-search').addEventListener('input', filterProducts);
  document.getElementById('inv-cat-filter').addEventListener('change', filterProducts);

  function getCatName(catKey) {
    if (!catKey) return '';
    const cat = allCategories.find(c => c._key === catKey);
    return cat ? cat.name : '';
  }

  function filterProducts() {
    const q   = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const cat = document.getElementById('inv-cat-filter')?.value || '';
    const filtered = allProducts.filter(p => {
      const matchQ = !q ||
        (p.id||'').toLowerCase().includes(q) ||
        (p.name||'').toLowerCase().includes(q) ||
        (p.note||'').toLowerCase().includes(q) ||
        getCatName(p.categoryKey).toLowerCase().includes(q);
      const matchCat = !cat || p.categoryKey === cat;
      return matchQ && matchCat;
    });
    renderProductTable(filtered);
  }

  function renderProductTable(data) {
    const wrap = document.getElementById('inv-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Mã SP',        key: p => p.id || '' },
      { label: 'Tên sản phẩm', key: p => p.name || '' },
      { label: 'Danh mục',     key: p => {
          const n = getCatName(p.categoryKey) || p.type || '';
          return n ? `<span class="badge badge-blue">${n}</span>` : '';
        }
      },
      { label: 'ĐVT',          key: p => p.unit || '' },
      { label: 'Tồn kho',      key: p => {
          const s = p.stock ?? 0;
          return s <= 0 ? `<span style="color:#e53e3e;font-weight:600">${s}</span>`
               : s <= 3 ? `<span style="color:#dd6b20;font-weight:600">${s}</span>`
               : s;
        }
      },
      { label: 'Giá vốn',      key: p => formatVND(p.cost || 0) },
      { label: 'Giá bán',      key: p => formatVND(p.price || 0) },
      { label: 'Bảo hành',     key: p => p.note || '' },
      { label: '',             key: p => `
        <button class="btn btn--sm btn--secondary inv-edit" data-key="${p._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger inv-del" data-key="${p._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.inv-edit').forEach(btn =>
      btn.addEventListener('click', () => openProductForm(data.find(p => p._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.inv-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.key))
    );
  }

  document.getElementById('inv-add').addEventListener('click', () => openProductForm(null));

  function openProductForm(record) {
    const wrap = document.getElementById('inv-form-wrap');
    wrap.classList.remove('hidden');
    const catOptions = allCategories.map(c =>
      `<option value="${c._key}" ${record?.categoryKey===c._key?'selected':''}>${c.name}</option>`
    ).join('');
    wrap.innerHTML = `
      <div class="form-card">
        <h3>${record ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Mã sản phẩm *</label>
            <input id="f-id" type="text" value="${record?.id||''}" />
          </div>
          <div class="form-group">
            <label>Tên sản phẩm *</label>
            <input id="f-name" type="text" value="${record?.name||''}" />
          </div>
          <div class="form-group">
            <label>Danh mục</label>
            <select id="f-categoryKey">
              <option value="">-- Chọn danh mục --</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Loại (tự nhập nếu không có danh mục)</label>
            <input id="f-type" type="text" value="${record?.type||''}" placeholder="VD: Linh kiện" />
          </div>
          <div class="form-group">
            <label>Đơn vị tính</label>
            <input id="f-unit" type="text" value="${record?.unit||'Cái'}" />
          </div>
          <div class="form-group">
            <label>Tồn kho</label>
            <input id="f-stock" type="number" value="${record?.stock??0}" />
          </div>
          <div class="form-group">
            <label>Giá vốn (đ)</label>
            <input id="f-cost" type="number" value="${record?.cost||0}" />
          </div>
          <div class="form-group">
            <label>Giá bán (đ)</label>
            <input id="f-price" type="number" value="${record?.price||0}" />
          </div>
          <div class="form-group">
            <label>Bảo hành / Ghi chú</label>
            <input id="f-note" type="text" value="${record?.note||''}" />
          </div>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu'}</button>
          <button id="f-cancel" class="btn btn--secondary">Hủy</button>
        </div>
      </div>
    `;

    // Auto-fill type from selected category
    document.getElementById('f-categoryKey').addEventListener('change', function() {
      const catKey = this.value;
      if (catKey) {
        const cat = allCategories.find(c => c._key === catKey);
        if (cat) document.getElementById('f-type').value = cat.name;
      }
    });

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden'); wrap.innerHTML = '';
    });

    document.getElementById('f-save').addEventListener('click', async () => {
      const id   = document.getElementById('f-id').value.trim();
      const name = document.getElementById('f-name').value.trim();
      if (!id || !name) { toast('Vui lòng nhập mã và tên sản phẩm', 'error'); return; }
      const catKey = document.getElementById('f-categoryKey').value;
      const catName = catKey ? (allCategories.find(c => c._key === catKey)?.name || '') : '';
      const data = {
        id, name,
        categoryKey: catKey || '',
        type:  catName || document.getElementById('f-type').value.trim(),
        unit:  document.getElementById('f-unit').value.trim(),
        stock: parseFloat(document.getElementById('f-stock').value) || 0,
        cost:  parseFloat(document.getElementById('f-cost').value) || 0,
        price: parseFloat(document.getElementById('f-price').value) || 0,
        note:  document.getElementById('f-note').value.trim()
      };
      try {
        if (record) { await updateItem(COL_PRODUCTS, record._key, data); toast('Đã cập nhật sản phẩm'); }
        else        { await addItem(COL_PRODUCTS, data); toast('Đã thêm sản phẩm'); }
        wrap.classList.add('hidden'); wrap.innerHTML = '';
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });
  }

  async function confirmDeleteProduct(key) {
    const ok = await showModal('Xác nhận', 'Xóa sản phẩm này?', true);
    if (!ok) return;
    try { await deleteItem(COL_PRODUCTS, key); toast('Đã xóa sản phẩm'); }
    catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }
}
