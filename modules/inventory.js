// modules/inventory.js - Kho hàng + Danh mục
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
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

    <!-- TAB: SẢN PHẨM -->
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

    <!-- TAB: DANH MỤC -->
    <div id="tab-categories" class="hidden" style="display:none">
      <div style="display:flex;gap:1rem;align-items:flex-start">

        <!-- LEFT: folder tree -->
        <div style="flex:0 0 340px;min-width:260px">
          <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
            <button id="cat-add" class="btn btn--primary" style="flex:1">+ Thêm danh mục</button>
          </div>
          <div id="cat-folders"></div>
          <div id="cat-form-wrap" class="hidden"></div>
        </div>

        <!-- RIGHT: product pool -->
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;margin-bottom:.5rem;color:#374151">Tất cả sản phẩm</div>
          <div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center">
            <input id="pool-search" type="text" placeholder="Tìm sản phẩm..." class="search-input" style="flex:1;min-width:140px" />
            <label style="font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:.3rem;white-space:nowrap">
              <input type="checkbox" id="pool-check-all" /> Chọn tất cả
            </label>
            <select id="pool-assign-cat" class="search-input" style="min-width:130px">
              <option value="">Gán vào danh mục...</option>
            </select>
            <button id="pool-assign-btn" class="btn btn--primary btn--sm">Gán đã chọn</button>
          </div>
          <div id="pool-list" style="max-height:calc(100vh - 280px);overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px"></div>
        </div>

      </div>
    </div>
  `;

  // --- Tab switching ---
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showProducts = btn.dataset.tab === 'products';
      const tp = document.getElementById('tab-products');
      const tc = document.getElementById('tab-categories');
      tp.classList.toggle('hidden', !showProducts);
      tc.classList.toggle('hidden', showProducts);
      tc.style.display = showProducts ? 'none' : 'block';
    });
  });

  let allProducts   = [];
  let allCategories = [];
  const openFolders = new Set(); // tracks which folder keys are expanded

  // ==================== CATEGORIES (onSnapshot) ====================
  const unsubCats = onSnapshot(COL_CATEGORIES, items => {
    allCategories = items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    // Refresh category selects
    refreshCatSelects();
    renderFolders();
  });

  function getCatName(catKey) {
    const cat = allCategories.find(c => c._key === catKey);
    return cat ? cat.name : '';
  }

  function refreshCatSelects() {
    // Products tab filter
    const sel = document.getElementById('inv-cat-filter');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Tất cả danh mục</option>' +
        allCategories.map(c => `<option value="${c._key}">${c.name}</option>`).join('');
      sel.value = cur;
    }
    // Pool assign dropdown
    const pa = document.getElementById('pool-assign-cat');
    if (pa) {
      const cur2 = pa.value;
      pa.innerHTML = '<option value="">Gán vào danh mục...</option>' +
        allCategories.map(c => `<option value="${c._key}">${c.name}</option>`).join('');
      pa.value = cur2;
    }
    // Product form select
    const fCat = document.getElementById('f-categoryKey');
    if (fCat) {
      const cur3 = fCat.value;
      fCat.innerHTML = '<option value="">-- Chọn danh mục --</option>' +
        allCategories.map(c => `<option value="${c._key}">${c.name}</option>`).join('');
      fCat.value = cur3;
    }
  }

  // ==================== FOLDER TREE ====================
  function renderFolders() {
    const wrap = document.getElementById('cat-folders');
    if (!wrap) return;
    if (!allCategories.length) {
      wrap.innerHTML = '<p style="color:#888;font-size:.9rem">Chưa có danh mục nào.</p>';
      return;
    }
    wrap.innerHTML = allCategories.map(cat => {
      const prods  = allProducts.filter(p => p.categoryKey === cat._key);
      const isOpen = openFolders.has(cat._key);
      return `
        <div class="cat-folder" style="margin-bottom:.4rem;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div class="folder-hd" data-key="${cat._key}"
               style="display:flex;align-items:center;gap:.5rem;padding:.55rem .75rem;background:#f9fafb;cursor:pointer;user-select:none">
            <span style="font-size:.8rem;color:#6b7280;width:12px">${isOpen ? '▼' : '▶'}</span>
            <span style="font-size:1.1rem">${isOpen ? '📂' : '📁'}</span>
            <strong style="flex:1;font-size:.92rem">${cat.name || ''}</strong>
            <span style="background:#dbeafe;color:#1d4ed8;border-radius:99px;padding:.1rem .5rem;font-size:.78rem;font-weight:600">${prods.length}</span>
            <button class="btn btn--sm btn--secondary cat-edit" data-key="${cat._key}" style="padding:.2rem .55rem;font-size:.78rem" onclick="event.stopPropagation()">Sửa</button>
            ${isAdmin() ? `<button class="btn btn--sm btn--danger cat-del" data-key="${cat._key}" style="padding:.2rem .55rem;font-size:.78rem" onclick="event.stopPropagation()">Xóa</button>` : ''}
          </div>
          ${isOpen ? `
            <div class="folder-body" style="background:#fff;padding:.4rem .75rem .5rem">
              ${prods.length ? prods.map(p => `
                <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid #f3f4f6">
                  <span style="font-size:.82rem;color:#9ca3af;width:52px">${p.id || ''}</span>
                  <span style="flex:1;font-size:.88rem">${p.name || ''}</span>
                  <span style="font-size:.78rem;color:#9ca3af">SL:${p.stock ?? 0}</span>
                  <button class="btn btn--sm btn--danger remove-from-cat" data-key="${p._key}"
                    style="padding:.15rem .45rem;font-size:.75rem">×</button>
                </div>`).join('')
              : '<div style="color:#9ca3af;font-size:.85rem;padding:.25rem 0">Chưa có sản phẩm</div>'}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Folder toggle
    wrap.querySelectorAll('.folder-hd').forEach(hd => {
      hd.addEventListener('click', () => {
        const key = hd.dataset.key;
        openFolders.has(key) ? openFolders.delete(key) : openFolders.add(key);
        renderFolders();
      });
    });
    wrap.querySelectorAll('.cat-edit').forEach(btn =>
      btn.addEventListener('click', () => openCatForm(allCategories.find(c => c._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.cat-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDeleteCat(btn.dataset.key))
    );
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

  document.getElementById('cat-add').addEventListener('click', () => openCatForm(null));

  function openCatForm(record) {
    const wrap = document.getElementById('cat-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-card" style="margin-top:.75rem">
        <h4 style="margin:0 0 .6rem">${record ? 'Cập nhật danh mục' : 'Thêm danh mục'}</h4>
        <div class="form-group" style="margin-bottom:.5rem">
          <label style="font-size:.85rem">Tên danh mục *</label>
          <input id="cf-name" class="form-input" value="${record?.name || ''}" placeholder="VD: Linh kiện" />
        </div>
        <div class="form-group" style="margin-bottom:.75rem">
          <label style="font-size:.85rem">Mô tả</label>
          <input id="cf-desc" class="form-input" value="${record?.desc || ''}" placeholder="Mô tả ngắn..." />
        </div>
        <div style="display:flex;gap:.5rem">
          <button id="cf-save" class="btn btn--primary btn--sm">Lưu</button>
          <button id="cf-cancel" class="btn btn--secondary btn--sm">Huỷ</button>
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
    const msg   = inUse > 0
      ? `Danh mục này có ${inUse} sản phẩm. Xóa sẽ bỏ liên kết, không xóa sản phẩm. Tiếp tục?`
      : 'Xóa danh mục này?';
    const ok = await showModal('Xác nhận', msg, true);
    if (!ok) return;
    try { await deleteItem(COL_CATEGORIES, key); toast('Đã xóa danh mục'); }
    catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  }

  // ==================== PRODUCT POOL (right panel) ====================
  function renderProductPool() {
    const q   = (document.getElementById('pool-search')?.value || '').toLowerCase();
    const wrap = document.getElementById('pool-list');
    if (!wrap) return;
    const filtered = allProducts.filter(p =>
      !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q)
    );
    if (!filtered.length) {
      wrap.innerHTML = '<div style="padding:1rem;color:#888;text-align:center">Không có sản phẩm</div>';
      return;
    }
    wrap.innerHTML = filtered.map(p => {
      const catName = getCatName(p.categoryKey) || p.type || '';
      return `
        <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .75rem;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .1s"
               onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
          <input type="checkbox" class="pool-cb" data-key="${p._key}" />
          <span style="font-size:.8rem;color:#9ca3af;width:52px;flex-shrink:0">${p.id || ''}</span>
          <span style="flex:1;font-size:.88rem">${p.name || ''}</span>
          ${catName
            ? `<span class="badge badge-blue" style="font-size:.75rem;white-space:nowrap">${catName}</span>`
            : `<span style="font-size:.75rem;color:#d1d5db">Chưa có</span>`}
        </label>
      `;
    }).join('');

    // sync check-all state
    const checkAll = document.getElementById('pool-check-all');
    if (checkAll) checkAll.checked = false;
  }

  document.getElementById('pool-search').addEventListener('input', renderProductPool);

  document.getElementById('pool-check-all').addEventListener('change', function() {
    document.querySelectorAll('.pool-cb').forEach(cb => cb.checked = this.checked);
  });

  document.getElementById('pool-assign-btn').addEventListener('click', async () => {
    const catKey = document.getElementById('pool-assign-cat').value;
    if (!catKey) { toast('Chọn danh mục cần gán', 'error'); return; }
    const selected = [...document.querySelectorAll('.pool-cb:checked')].map(cb => cb.dataset.key);
    if (!selected.length) { toast('Chọn ít nhất một sản phẩm', 'error'); return; }
    const catName = allCategories.find(c => c._key === catKey)?.name || '';
    try {
      await Promise.all(selected.map(key => updateItem(COL_PRODUCTS, key, { categoryKey: catKey, type: catName })));
      toast(`Đã gán ${selected.length} sản phẩm vào "${catName}"`);
      document.getElementById('pool-check-all').checked = false;
    } catch(e) { toast('Lỗi: ' + e.message, 'error'); }
  });

  // ==================== PRODUCTS (onSnapshot) ====================
  const unsubProds = onSnapshot(COL_PRODUCTS, items => {
    allProducts = items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    filterProducts();
    renderFolders();
    renderProductPool();
  });

  container.addEventListener('unmount', () => { unsubCats?.(); unsubProds?.(); });

  // ==================== PRODUCTS TAB ====================
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
          <div class="form-group"><label>Đơn vị tính</label><input id="f-unit" class="form-input" value="${record?.unit || 'Cái'}" /></div>
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
}
