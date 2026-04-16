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
      <div id="cat-products-wrap" class="hidden"></div>
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

  let allProducts   = [];
  let allCategories = [];
  let currentCatKey  = null;
  let currentCatName = '';

  // ==================== CATEGORIES ====================
  const unsubCats = onSnapshot(COL_CATEGORIES, items => {
    allCategories = items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    renderCatTable(allCategories);
    // Refresh category filter in products tab
    const sel = document.getElementById('inv-cat-filter');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Tất cả danh mục</option>' +
        allCategories.map(c => `<option value="${c._key}">${c.name}</option>`).join('');
      sel.value = cur;
    }
    // Refresh select in open product form
    const fCat = document.getElementById('f-categoryKey');
    if (fCat) {
      const cur2 = fCat.value;
      fCat.innerHTML = '<option value="">-- Chọn danh mục --</option>' +
        allCategories.map(c => `<option value="${c._key}">${c.name}</option>`).join('');
      fCat.value = cur2;
    }
  });

  function getCatName(catKey) {
    if (!catKey) return '';
    const cat = allCategories.find(c => c._key === catKey);
    return cat ? cat.name : '';
  }

  function renderCatTable(data) {
    const wrap = document.getElementById('cat-table-wrap');
    if (!wrap) return;
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Chưa có danh mục. Nhấn "+ Thêm danh mục" để tạo.</p>';
      return;
    }
    const productCount = catKey => allProducts.filter(p => p.categoryKey === catKey).length;
    const cols = [
      { label: 'Tên danh mục', key: c => c.name || '' },
      { label: 'Mô tả',        key: c => c.desc || '' },
      { label: 'Số sản phẩm',  key: c => productCount(c._key) },
      { label: '',             key: c => `
        <button class="btn btn--sm btn--secondary cat-prods" data-key="${c._key}" data-name="${c.name}">📦 Sản phẩm</button>
        <button class="btn btn--sm btn--secondary cat-edit" data-key="${c._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger cat-del" data-key="${c._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.cat-prods').forEach(btn =>
      btn.addEventListener('click', () => openCatProducts(btn.dataset.key, btn.dataset.name))
    );
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
      <div class="form-card" style="max-width:500px;margin-top:.75rem">
        <h3>${record ? 'Cập nhật danh mục' : 'Thêm danh mục'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Tên danh mục *</label>
            <input id="cf-name" class="form-input" value="${record ? record.name || '' : ''}" />
          </div>
          <div class="form-group">
            <label>Mô tả</label>
            <input id="cf-desc" class="form-input" value="${record ? record.desc || '' : ''}" />
          </div>
        </div>
        <div class="form-actions">
          <button id="cf-save" class="btn btn--primary">Lưu</button>
          <button id="cf-cancel" class="btn btn--secondary">Huỷ</button>
        </div>
      </div>
    `;
    document.getElementById('cf-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML = ''; };
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

  // ==================== PRODUCTS ====================
  const unsubProds = onSnapshot(COL_PRODUCTS, items => {
    allProducts = items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    renderCatTable(allCategories); // refresh product counts
    filterProducts();
    // Live-refresh open cat-products panel
    if (currentCatKey) renderCatProductsPanel(currentCatKey, currentCatName);
  });

  container.addEventListener('unmount', () => { unsubCats?.(); unsubProds?.(); });

  document.getElementById('inv-search').addEventListener('input', filterProducts);
  document.getElementById('inv-cat-filter').addEventListener('change', filterProducts);

  function filterProducts() {
    const q      = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const catKey = document.getElementById('inv-cat-filter')?.value || '';
    const filtered = allProducts.filter(p => {
      const matchQ   = !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
      const matchCat = !catKey || p.categoryKey === catKey;
      return matchQ && matchCat;
    });
    renderProductTable(filtered);
  }

  function renderProductTable(data) {
    const wrap = document.getElementById('inv-table-wrap');
    if (!wrap) return;
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
      { label: 'ĐVT',         key: p => p.unit || '' },
      { label: 'Tồn kho',     key: p => {
          const s = p.stock ?? 0;
          return s <= 0 ? `<span style="color:#e53e3e;font-weight:600">${s}</span>`
               : s <= 3 ? `<span style="color:#ddbb20;font-weight:600">${s}</span>`
               : s;
        }
      },
      { label: 'Giá vốn',     key: p => formatVND(p.cost  || 0) },
      { label: 'Giá bán',     key: p => formatVND(p.price || 0) },
      { label: 'Bảo hành',    key: p => p.note || '' },
      { label: '',            key: p => `
        <button class="btn btn--sm btn--secondary inv-edit" data-key="${p._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger inv-del" data-key="${p._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.inv-edit').forEach(btn =>
      btn.addEventListener('click', () => openProductForm(allProducts.find(p => p._key === btn.dataset.key)))
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
      `<option value="${c._key}" ${record?.categoryKey === c._key ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    wrap.innerHTML = `
      <div class="form-card" style="margin-top:.75rem">
        <h3>${record ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</h3>
        <div class="form-grid">
          <div class="form-group"><label>Mã SP</label><input id="f-id" class="form-input" value="${record?.id || ''}" /></div>
          <div class="form-group"><label>Tên sản phẩm *</label><input id="f-name" class="form-input" value="${record?.name || ''}" /></div>
          <div class="form-group">
            <label>Danh mục</label>
            <select id="f-categoryKey" class="form-input">
              <option value="">-- Chọn danh mục --</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group"><label>Loại (tự nhập nếu không có danh mục)</label><input id="f-type" class="form-input" value="${record?.type || ''}" placeholder="VD: Linh kiện" /></div>
          <div class="form-group"><label>Đơn vị tính</label><input id="f-unit" type="text" class="form-input" value="${record?.unit || 'Cái'}" /></div>
          <div class="form-group"><label>Tồn kho</label><input id="f-stock" type="number" class="form-input" value="${record?.stock ?? 0}" /></div>
          <div class="form-group"><label>Giá vốn</label><input id="f-cost" type="number" class="form-input" value="${record?.cost || 0}" /></div>
          <div class="form-group"><label>Giá bán</label><input id="f-price" type="number" class="form-input" value="${record?.price || 0}" /></div>
          <div class="form-group"><label>Bảo hành (ghi chú)</label><input id="f-note" class="form-input" value="${record?.note || ''}" /></div>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">Lưu</button>
          <button id="f-cancel" class="btn btn--secondary">Huỷ</button>
        </div>
      </div>
    `;
    document.getElementById('f-categoryKey').addEventListener('change', function() {
      if (this.value) {
        const cat = allCategories.find(c => c._key === this.value);
        if (cat) document.getElementById('f-type').value = cat.name;
      }
    });
    document.getElementById('f-cancel').onclick = () => { wrap.classList.add('hidden'); wrap.innerHTML = ''; };
    document.getElementById('f-save').addEventListener('click', async () => {
      const name = document.getElementById('f-name').value.trim();
      if (!name) { toast('Vui lòng nhập tên sản phẩm', 'error'); return; }
      const catKey  = document.getElementById('f-categoryKey').value;
      const catName = catKey ? (allCategories.find(c => c._key === catKey)?.name || '') : '';
      const data = {
        id:          document.getElementById('f-id').value.trim(),
        name,
        categoryKey: catKey || '',
        type:        catName || document.getElementById('f-type').value.trim(),
        unit:        document.getElementById('f-unit').value.trim(),
        stock:       Number(document.getElementById('f-stock').value) || 0,
        cost:        Number(document.getElementById('f-cost').value) || 0,
        price:       Number(document.getElementById('f-price').value) || 0,
        note:        document.getElementById('f-note').value.trim(),
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

  // ==================== CAT-PRODUCTS PANEL ====================
  function openCatProducts(catKey, catName) {
    currentCatKey  = catKey;
    currentCatName = catName;
    renderCatProductsPanel(catKey, catName);
  }

  function renderCatProductsPanel(catKey, catName) {
    const wrap = document.getElementById('cat-products-wrap');
    if (!wrap) return;
    wrap.classList.remove('hidden');

    const inCat    = allProducts.filter(p => p.categoryKey === catKey);
    const notInCat = allProducts.filter(p => p.categoryKey !== catKey);

    wrap.innerHTML = `
      <div class="form-card" style="margin-top:.75rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <h4 style="margin:0">📦 Sản phẩm trong danh mục: <strong>${catName}</strong>
            <span style="margin-left:.5rem;font-size:.85rem;color:#666;font-weight:normal">(${inCat.length} sản phẩm)</span>
          </h4>
          <button id="close-cat-prods" class="btn btn--sm btn--secondary">✕ Đóng</button>
        </div>

        <!-- ADD SECTION: multi-checkbox list -->
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:.75rem;margin-bottom:.75rem">
          <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;flex-wrap:wrap">
            <strong style="font-size:.9rem">Thêm sản phẩm vào danh mục</strong>
            <input id="add-prod-search" type="text" placeholder="Tìm nhanh..." class="search-input" style="flex:1;min-width:140px;max-width:260px" />
            <label style="font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:.3rem">
              <input type="checkbox" id="check-all-prods" /> Chọn tất cả
            </label>
            <button id="add-prod-btn" class="btn btn--primary btn--sm">+ Thêm đã chọn</button>
          </div>
          <div id="add-prod-list" style="max-height:200px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:.3rem .75rem;padding:.25rem 0">
            ${notInCat.length
              ? notInCat.map(p => `
                <label class="prod-check-item" style="display:flex;align-items:center;gap:.3rem;font-size:.85rem;cursor:pointer;min-width:200px">
                  <input type="checkbox" class="prod-cb" data-key="${p._key}" />
                  <span class="prod-cb-label">${p.name || ''}  ${p.id ? '<span style=\"color:#888\">(' + p.id + ')</span>' : ''}</span>
                </label>`).join('')
              : '<span style="color:#888;font-size:.85rem">Tất cả sản phẩm đã thuộc danh mục này</span>'
            }
          </div>
        </div>

        <!-- CURRENT PRODUCTS TABLE -->
        <table class="data-table">
          <thead><tr><th>Mã SP</th><th>Tên sản phẩm</th><th>Tồn kho</th><th></th></tr></thead>
          <tbody>
            ${inCat.length
              ? inCat.map(p => `
                <tr>
                  <td>${p.id || p._key}</td>
                  <td>${p.name || ''}</td>
                  <td>${p.stock ?? 0}</td>
                  <td><button class="btn btn--sm btn--danger remove-from-cat" data-key="${p._key}">Bỏ khỏi DM</button></td>
                </tr>`).join('')
              : '<tr><td colspan="4" style="text-align:center;color:#888;padding:.75rem">Chưa có sản phẩm trong danh mục này</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `;

    // Close
    document.getElementById('close-cat-prods').onclick = () => {
      currentCatKey = null; currentCatName = '';
      wrap.classList.add('hidden'); wrap.innerHTML = '';
    };

    // Live search filter in checkbox list
    document.getElementById('add-prod-search').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      wrap.querySelectorAll('.prod-check-item').forEach(item => {
        const txt = item.querySelector('.prod-cb-label')?.textContent.toLowerCase() || '';
        item.style.display = txt.includes(q) ? '' : 'none';
      });
    });

    // Check-all
    document.getElementById('check-all-prods').addEventListener('change', function() {
      wrap.querySelectorAll('.prod-cb').forEach(cb => {
        if (cb.closest('.prod-check-item').style.display !== 'none') cb.checked = this.checked;
      });
    });

    // Add selected
    document.getElementById('add-prod-btn').addEventListener('click', async () => {
      const selected = [...wrap.querySelectorAll('.prod-cb:checked')].map(cb => cb.dataset.key);
      if (!selected.length) { toast('Chọn ít nhất một sản phẩm', 'error'); return; }
      try {
        await Promise.all(selected.map(key => updateItem(COL_PRODUCTS, key, { categoryKey: catKey, type: catName })));
        toast(`Đã thêm ${selected.length} sản phẩm vào danh mục`);
      } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
    });

    // Remove single product
    wrap.querySelectorAll('.remove-from-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showModal('Xác nhận', 'Bỏ sản phẩm này khỏi danh mục?', true);
        if (!ok) return;
        try {
          await updateItem(COL_PRODUCTS, btn.dataset.key, { categoryKey: '', type: '' });
          toast('Đã bỏ khỏi danh mục');
        } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
      });
    });
  }
}
