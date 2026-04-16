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
          <button class="tab-btn" data-tab="products">📦 Sản phẩm</button>
          <button class="tab-btn active" data-tab="categories">🗂 Danh mục</button>
        </div>
      </div>
    </div>

    <div id="tab-products">
      <div class="sub-actions" style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center">
        <input id="inv-search" type="text" placeholder="Tìm kiếm..." class="search-input" style="flex:1;min-width:160px" />
        <select id="inv-cat-filter" class="search-input" style="width:220px">
          <option value="">Tất cả danh mục</option>
        </select>
        <button id="inv-add" class="btn btn--primary">+ Thêm sản phẩm</button>
        <button id="inv-del-selected" class="btn btn--danger" style="display:none">🗑 Xóa đã chọn (<span id="inv-del-count">0</span>)</button>
      </div>
      <div id="inv-table-wrap"></div>
    </div>

    <div id="tab-categories" style="display:none">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        <div style="flex:0 0 380px;min-width:0">
          <div style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center">
            <button id="cat-add" class="btn btn--primary btn--sm">+ Thêm danh mục gốc</button>
            <button id="cat-del-selected" class="btn btn--danger btn--sm" style="display:none">🗑 Xóa (<span id="cat-del-count">0</span>)</button>
          </div>
          <div id="cat-folders"></div>
          <div id="cat-form-wrap"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center">
            <input id="pool-search" type="text" placeholder="Tìm sản phẩm..." class="search-input" style="flex:1;min-width:140px" />
            <label style="display:flex;align-items:center;gap:.25rem;cursor:pointer;white-space:nowrap">
              <input type="checkbox" id="pool-check-all" /> Chọn tất cả
            </label>
            <select id="pool-assign-cat" class="search-input" style="width:200px">
              <option value="">Gán vào danh mục...</option>
            </select>
            <button id="pool-assign-btn" class="btn btn--secondary btn--sm">Gán đã chọn</button>
          </div>
          <div id="pool-list"></div>
        </div>
      </div>
    </div>
  `;

  let allProducts   = [];
  let allCategories = [];
  const openFolders = new Set();

  // ─── TAB SWITCH ────────────────────────────────────────────────
  const tp = container.querySelector('#tab-products');
  const tc = container.querySelector('#tab-categories');
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showProducts = btn.dataset.tab === 'products';
      tp.style.display = showProducts ? '' : 'none';
      tc.style.display = showProducts ? 'none' : 'block';
    });
  });

  // Mac dinh: mo tab Danh muc khi vao Kho hang
  tp.style.display = 'none';
  tc.style.display = 'block';
  container.querySelector('[data-tab="categories"]').classList.add('active');

  // ─── HELPERS ────────────────────────────────────────────────────
  function getCatFullName(cat) {
    const parts = [cat.name];
    let cur = cat;
    while (cur.parentKey) {
      const parent = allCategories.find(c => c._key === cur.parentKey);
      if (!parent) break;
      parts.unshift(parent.name);
      cur = parent;
    }
    return parts.join(' > ');
  }

  function buildCatOptions(parentKey, depth) {
    const indent = '\u3000'.repeat(depth);
    return allCategories
      .filter(c => (c.parentKey || null) === (parentKey || null))
      .map(c => {
        const subs = buildCatOptions(c._key, depth + 1);
        return `<option value="${c._key}">${indent}${c.name}</option>` + subs;
      }).join('');
  }

  function getDescendantKeys(key) {
    const result = [];
    const queue  = [key];
    while (queue.length) {
      const cur = queue.shift();
      allCategories.filter(c => c.parentKey === cur)
        .forEach(c => { result.push(c._key); queue.push(c._key); });
    }
    return result;
  }

  function refreshCatSelects() {
    const filter    = container.querySelector('#inv-cat-filter');
    const filterVal = filter.value;
    filter.innerHTML = '<option value="">Tất cả danh mục</option>' + buildCatOptions(null, 0);
    filter.value = filterVal;

    const assign    = container.querySelector('#pool-assign-cat');
    const assignVal = assign.value;
    assign.innerHTML = '<option value="">Gán vào danh mục...</option>' + buildCatOptions(null, 0);
    assign.value = assignVal;
  }

  // ─── PRODUCT TABLE ───────────────────────────────────────────────
  function updateInvDelBtn() {
    const n = container.querySelectorAll('.inv-cb:checked').length;
    container.querySelector('#inv-del-selected').style.display = n ? '' : 'none';
    container.querySelector('#inv-del-count').textContent = n;
  }

  function filterProducts() {
    const q   = (container.querySelector('#inv-search')?.value || '').toLowerCase();
    const cat = container.querySelector('#inv-cat-filter')?.value || '';
    return allProducts.filter(p => {
      const mQ = !q || (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q);
      const mC = !cat || p.categoryKey === cat;
      return mQ && mC;
    });
  }

  function renderProductTable() {
    const wrap = container.querySelector('#inv-table-wrap');
    const data = filterProducts();
    const cols = [
      { label: '<input type="checkbox" id="inv-check-all" />',
        key: p => `<input type="checkbox" class="inv-cb" data-key="${p._key}" />` },
      { label: 'Mã SP',        key: p => p.id || '' },
      { label: 'Tên sản phẩm', key: p => p.name || '' },
      { label: 'Danh mục', key: p => {
          if (!p.categoryKey) return '<span style="color:#9ca3af">—</span>';
          const cat = allCategories.find(c => c._key === p.categoryKey);
          return cat
            ? `<span style="color:#2563eb">${getCatFullName(cat)}</span>`
            : '<span style="color:#9ca3af">—</span>';
        }},
      { label: 'ĐVT',      key: p => p.unit || '' },
      { label: 'Tồn kho',  key: p => {
          const n = Number(p.stock||0);
          const c = n<=0?'#ef4444':n<=3?'#f59e0b':'#22c55e';
          return `<span style="color:${c};font-weight:600">${n}</span>`;
        }},
      { label: 'Giá vốn',  key: p => formatVND(p.cost||0) },
      { label: 'Giá bán',  key: p => formatVND(p.price||0) },
      { label: 'Bảo hành', key: p => p.warranty || '' },
      { label: '', key: p => `<button class="btn btn--sm btn--secondary inv-edit" data-key="${p._key}">Sửa</button>` }
    ];
    // FIX: buildTable(cols, data) - cols first!
    wrap.innerHTML = buildTable(cols, data);

    const ca = wrap.querySelector('#inv-check-all');
    if (ca) ca.addEventListener('change', () => {
      wrap.querySelectorAll('.inv-cb').forEach(cb => cb.checked = ca.checked);
      updateInvDelBtn();
    });
    wrap.querySelectorAll('.inv-cb').forEach(cb => cb.addEventListener('change', updateInvDelBtn));
    wrap.querySelectorAll('.inv-edit').forEach(btn =>
      btn.addEventListener('click', () => openProductForm(btn.dataset.key)));
  }

  // ─── PRODUCT FORM ────────────────────────────────────────────────
  function openProductForm(key) {
    const p       = key ? (allProducts.find(x => x._key === key) || {}) : {};
    const catOpts = '<option value="">— Không có —</option>' + buildCatOptions(null, 0);
    const catSel  = p.categoryKey
      ? catOpts.replace(`value="${p.categoryKey}"`, `value="${p.categoryKey}" selected`)
      : catOpts;

    showModal({
      title: `${key ? 'Sửa' : 'Thêm'} sản phẩm`,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <label>Mã SP<br><input id="f-id" class="search-input" value="${p.id||''}" style="width:100%" /></label>
        <label>Tên sản phẩm<br><input id="f-name" class="search-input" value="${p.name||''}" style="width:100%" /></label>
        <label>Danh mục<br><select id="f-cat" class="search-input" style="width:100%">${catSel}</select></label>
        <label>ĐVT<br><input id="f-unit" class="search-input" value="${p.unit||''}" style="width:100%" /></label>
        <label>Tồn kho<br><input id="f-stock" type="number" class="search-input" value="${p.stock||0}" style="width:100%" /></label>
        <label>Giá vốn<br><input id="f-cost" type="number" class="search-input" value="${p.cost||0}" style="width:100%" /></label>
        <label>Giá bán<br><input id="f-sell" type="number" class="search-input" value="${p.price||0}" style="width:100%" /></label>
        <label>Bảo hành<br><input id="f-warranty" class="search-input" value="${p.warranty||''}" style="width:100%" /></label>
      </div>`,
      confirmText: 'Lưu',
      onConfirm: async () => {
        const name = document.querySelector('#f-name')?.value.trim() || '';
        if (!name) { toast('Nhập tên sản phẩm!','warning'); return; }
        const data = {
          id:          document.querySelector('#f-id')?.value.trim() || '',
          name,
          categoryKey: document.querySelector('#f-cat')?.value || null,
          unit:        document.querySelector('#f-unit')?.value.trim() || '',
          stock:       Number(document.querySelector('#f-stock')?.value) || 0,
          cost: Number(document.querySelector('#f-cost')?.value) || 0,
          price: Number(document.querySelector('#f-sell')?.value) || 0,
          warranty:    document.querySelector('#f-warranty')?.value.trim() || '',
        };
        key ? await updateItem(COL_PRODUCTS, key, data) : await addItem(COL_PRODUCTS, data);
        toast(key ? 'Đã cập nhật!' : 'Đã thêm sản phẩm!','success');
      }
    });
  }

  // ─── CATEGORY FOLDER TREE ────────────────────────────────────────
  function updateCatDelBtn() {
    const n = container.querySelectorAll('.cat-cb:checked').length;
    container.querySelector('#cat-del-selected').style.display = n ? '' : 'none';
    container.querySelector('#cat-del-count').textContent = n;
  }

  function countAll(key) {
    const direct   = allProducts.filter(p => p.categoryKey === key).length;
    const children = allCategories.filter(c => c.parentKey === key);
    return direct + children.reduce((s, c) => s + countAll(c._key), 0);
  }

  function renderFolderNode(cat, depth) {
    const children = allCategories.filter(c => c.parentKey === cat._key);
    const prods    = allProducts.filter(p => p.categoryKey === cat._key);
    const isOpen   = openFolders.has(cat._key);
    const total    = countAll(cat._key);
    const pl       = depth * 18;

    let body = '';
    if (isOpen) {
      const treeItems = [
        ...children.map(c => ({ type: 'cat', data: c })),
        ...prods.map(p => ({ type: 'prod', data: p }))
      ];
      treeItems.forEach((item, ti) => {
        const isLast = ti === treeItems.length - 1;
        const sym = isLast ? '└─' : '├─';
        const indent = (depth + 1) * 18 + 6;
        if (item.type === 'cat') {
          body += renderFolderNode(item.data, depth + 1);
        } else {
          const p = item.data;
          body += `<div class="folder-product" style="display:flex;align-items:center;gap:.4rem;padding:.28rem .6rem .28rem ${indent}px;border-top:1px solid #f0f1f3;font-size:.83rem;background:#f9fafb">
            <span style="color:#94a3b8;font-family:monospace;font-size:.85rem;flex-shrink:0">${sym}</span>
            <span style="flex:1;color:#1f2937;font-weight:400">${p.name}</span>
            <span style="color:#9ca3af;font-size:.73rem;margin-right:.25rem">${p.id||''}</span>
            <button class="remove-from-cat btn btn--xs btn--ghost" data-key="${p._key}" style="color:#ef4444;font-size:1rem;line-height:1;padding:0 3px" title="Bo khoi danh muc">x</button>
          </div>`;
        }
      });
    }
  const arrow = isOpen ? '▾' : '▸';
  return `<div class="folder-item" data-key="${cat._key}">
    <div class="folder-header" data-key="${cat._key}" style="display:flex;align-items:center;gap:.45rem;padding:.42rem .6rem .42rem ${pl+4}px;cursor:pointer;background:${depth===0?'#f1f5f9':'#f8fafc'};border-bottom:1px solid #e5e7eb;user-select:none">
      <input type="checkbox" class="cat-cb" data-key="${cat._key}" onclick="event.stopPropagation()" style="flex-shrink:0">
      <span style="color:#64748b;font-size:.82rem;width:12px">${arrow}</span>
      <span style="flex:1;font-weight:${depth===0?600:500};font-size:${depth===0?'.9rem':'.85rem'};color:#1e293b">${cat.name}</span>
      <span style="font-size:.72rem;color:#94a3b8;background:#e2e8f0;border-radius:9px;padding:1px 7px">${total}</span>
      <button class="cat-edit btn btn--xs btn--ghost" data-key="${cat._key}" onclick="event.stopPropagation()" title="Sửa">✎</button>
      <button class="cat-add-child btn btn--xs btn--ghost" data-key="${cat._key}" onclick="event.stopPropagation()" style="font-size:18px;font-weight:700;padding:1px 8px;line-height:1" title="Thêm mục con">＋</button>
    </div>
    ${body}
  </div>`;
  }


  // ### RENDER ALL FOLDERS ###############################################
  function renderFolders() {
    const fc = container.querySelector('#cat-folders');
    if (!fc) return;
    const roots = allCategories.filter(c => !c.parentKey);
    fc.innerHTML = roots.length
      ? roots.map(c => renderFolderNode(c, 0)).join('')
      : '<p style="color:#aaa;padding:1rem;font-size:.85rem">Đầy chưa có danh mục nào. Hãy thêm danh mục gốc.</p>';
    fc.querySelectorAll('.folder-header').forEach(hdr =>
      hdr.addEventListener('click', e => {
        if (e.target.closest('button,input')) return;
        const key = hdr.dataset.key;
        if (openFolders.has(key)) openFolders.delete(key); else openFolders.add(key);
        renderFolders();
      }));
    fc.querySelectorAll('.cat-cb').forEach(cb =>
      cb.addEventListener('change', updateCatDelBtn));
    fc.querySelectorAll('.cat-add-child').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openFolders.add(btn.dataset.key);
        openCatForm(null, btn.dataset.key);
      }));
    fc.querySelectorAll('.cat-edit').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openCatForm(btn.dataset.key);
      }));
    fc.querySelectorAll('.remove-from-cat').forEach(btn =>
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await updateItem(COL_PRODUCTS, btn.dataset.key, { categoryKey: null });
        toast('Đã bỏ khỏi danh mục', 'success');
      }));
  }
  // ─── CATEGORY FORM ───────────────────────────────────────────────
  function openCatForm(key, defaultParentKey) {
    const cat      = key ? (allCategories.find(c => c._key === key) || {}) : {};
    const excluded = key ? [...getDescendantKeys(key), key] : [];
    const parentOpts = '<option value="">— Danh mục gốc —</option>' +
      allCategories
        .filter(c => !excluded.includes(c._key))
        .map(c => `<option value="${c._key}">${getCatFullName(c)}</option>`).join('');

    const setParent = defaultParentKey || (key ? cat.parentKey : null);
    const parentSel = parentOpts.replace(
      setParent ? `value="${setParent}"` : '___NOMATCH___',
      setParent ? `value="${setParent}" selected` : ''
    );

    const wrap = container.querySelector('#cat-form-wrap');
    wrap.innerHTML = `
      <div style="border:1px solid #bfdbfe;border-radius:8px;padding:.75rem;margin-top:.5rem;background:#eff6ff">
        <strong style="font-size:.9rem">${key ? 'Sửa' : 'Thêm'} danh mục</strong>
        <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem">
          <label style="font-size:.85rem">Tên danh mục
            <input id="cf-name" class="search-input" value="${cat.name||''}" style="width:100%;margin-top:.2rem" placeholder="VD: Laptop, Dell, Linh kiện..." />
          </label>
          <label style="font-size:.85rem">Thuộc về danh mục
            <select id="cf-parent" class="search-input" style="width:100%;margin-top:.2rem">${parentSel}</select>
          </label>
          <div style="display:flex;gap:.5rem;justify-content:flex-end">
            <button id="cf-cancel" class="btn btn--secondary btn--sm">Hủy</button>
            <button id="cf-save" class="btn btn--primary btn--sm">Lưu</button>
          </div>
        </div>
      </div>`;

    wrap.querySelector('#cf-cancel').addEventListener('click', () => { wrap.innerHTML = ''; });
    wrap.querySelector('#cf-save').addEventListener('click', async () => {
      const name      = wrap.querySelector('#cf-name').value.trim();
      if (!name) { toast('Nhập tên danh mục!','warning'); return; }
      const parentKey = wrap.querySelector('#cf-parent').value || null;
      key
        ? await updateItem(COL_CATEGORIES, key, { name, parentKey })
        : await addItem(COL_CATEGORIES, { name, parentKey });
      toast(key ? 'Đã cập nhật danh mục!' : 'Đã thêm danh mục!','success');
      wrap.innerHTML = '';
      if (parentKey) openFolders.add(parentKey);
    });
  }

  // ─── PRODUCT POOL ────────────────────────────────────────────────
  function renderProductPool() {
    const q      = (container.querySelector('#pool-search')?.value || '').toLowerCase();
    const list   = container.querySelector('#pool-list');
    const filtered = allProducts.filter(p =>
      !q || (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q));
    list.innerHTML = filtered.length === 0
      ? '<div style="color:#9ca3af;font-size:.85rem;padding:.5rem">Không có sản phẩm.</div>'
      : filtered.map(p => {
          const cat = p.categoryKey ? allCategories.find(c => c._key === p.categoryKey) : null;
          return `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border-bottom:1px solid #f3f4f6;font-size:.84rem">
            <input type="checkbox" class="pool-cb" data-key="${p._key}" />
            <span style="flex:1">${p.name}</span>
            <span style="color:#6b7280;font-size:.75rem">${p.id||''}</span>
            ${cat
              ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:.1rem .35rem;font-size:.73rem">${getCatFullName(cat)}</span>`
              : '<span style="color:#d1d5db;font-size:.73rem">Chưa phân loại</span>'}
          </div>`;
        }).join('');
    const pca = container.querySelector('#pool-check-all');
    if (pca) pca.checked = false;
  }

  // ─── EVENT LISTENERS ────────────────────────────────────────────
  container.querySelector('#inv-search').addEventListener('input', renderProductTable);
  container.querySelector('#inv-cat-filter').addEventListener('change', renderProductTable);
  container.querySelector('#inv-add').addEventListener('click', () => openProductForm(null));
  container.querySelector('#inv-del-selected').addEventListener('click', async () => {
    const keys = [...container.querySelectorAll('.inv-cb:checked')].map(cb => cb.dataset.key);
    if (!keys.length) return;
    if (!confirm(`Xóa ${keys.length} sản phẩm?`)) return;
    await Promise.all(keys.map(k => deleteItem(COL_PRODUCTS, k)));
    toast(`Đã xóa ${keys.length} sản phẩm`,'success');
  });

  container.querySelector('#cat-add').addEventListener('click', () => openCatForm(null, null));
  container.querySelector('#cat-del-selected').addEventListener('click', async () => {
    const keys = [...container.querySelectorAll('.cat-cb:checked')].map(cb => cb.dataset.key);
    if (!keys.length) return;
    if (!confirm(`Xóa ${keys.length} danh mục?`)) return;
    await Promise.all(keys.map(k => deleteItem(COL_CATEGORIES, k)));
    toast(`Đã xóa ${keys.length} danh mục`,'success');
    updateCatDelBtn();
  });

  container.querySelector('#pool-check-all').addEventListener('change', e => {
    container.querySelectorAll('.pool-cb').forEach(cb => cb.checked = e.target.checked);
  });
  container.querySelector('#pool-search').addEventListener('input', renderProductPool);
  container.querySelector('#pool-assign-btn').addEventListener('click', async () => {
    const catKey = container.querySelector('#pool-assign-cat').value;
    if (!catKey) { toast('Chọn danh mục trước!','warning'); return; }
    const keys = [...container.querySelectorAll('.pool-cb:checked')].map(cb => cb.dataset.key);
    if (!keys.length) { toast('Chọn sản phẩm trước!','warning'); return; }
    await Promise.all(keys.map(k => updateItem(COL_PRODUCTS, k, { categoryKey: catKey })));
    toast(`Đã gán ${keys.length} sản phẩm!`,'success');
    container.querySelector('#pool-check-all').checked = false;
    renderProductPool();
  });

  // ─── FIREBASE LISTENERS ─────────────────────────────────────────
  onSnapshot(COL_CATEGORIES, items => {
    allCategories = items;
    renderFolders();
    refreshCatSelects();
    renderProductPool();
  });

  onSnapshot(COL_PRODUCTS, items => {
    allProducts = [...items].sort((a,b) => (a.name||'').localeCompare(b.name||'','vi'));
    renderProductTable();
    renderFolders();
    renderProductPool();
    updateInvDelBtn();
  });
}
