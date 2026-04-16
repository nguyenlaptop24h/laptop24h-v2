// modules/inventory.js - Kho hàng
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'products';

registerRoute('#inventory', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Kho hàng</h2>
      <div class="module-actions">
        <input id="inv-search" type="text" placeholder="Tìm kiếm..." class="search-input" />
        <select id="inv-type-filter" class="search-input" style="width:140px">
          <option value="">Tất cả loại</option>
        </select>
        <button id="inv-add" class="btn btn--primary">+ Thêm hàng</button>
      </div>
    </div>
    <div id="inv-table-wrap"></div>
    <div id="inv-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  let typeList = [];

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'vi'));
    // Collect unique types
    typeList = [...new Set(allData.map(p => p.type).filter(Boolean))].sort();
    const sel = document.getElementById('inv-type-filter');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Tất cả loại</option>' +
        typeList.map(t => `<option ${t===cur?'selected':''}>${t}</option>`).join('');
    }
    filterData();
  });

  container.addEventListener('unmount', () => unsub && unsub());

  document.getElementById('inv-search').addEventListener('input', filterData);
  document.getElementById('inv-type-filter').addEventListener('change', filterData);

  function filterData() {
    const q = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const t = document.getElementById('inv-type-filter')?.value || '';
    const filtered = allData.filter(p => {
      const matchQ = !q ||
        (p.id||'').toLowerCase().includes(q) ||
        (p.name||'').toLowerCase().includes(q) ||
        (p.note||'').toLowerCase().includes(q);
      const matchT = !t || p.type === t;
      return matchQ && matchT;
    });
    renderTable(filtered);
  }

  function renderTable(data) {
    const wrap = document.getElementById('inv-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Mã SP',       key: p => p.id || '' },
      { label: 'Tên sản phẩm',key: p => p.name || '' },
      { label: 'Loại',        key: p => p.type || '' },
      { label: 'ĐVT',         key: p => p.unit || '' },
      { label: 'Tồn kho',     key: p => {
          const s = p.stock ?? 0;
          return s <= 0
            ? `<span style="color:#e53e3e;font-weight:600">${s}</span>`
            : s <= 3
              ? `<span style="color:#dd6b20;font-weight:600">${s}</span>`
              : s;
        }
      },
      { label: 'Giá vốn',     key: p => formatVND(p.cost || 0) },
      { label: 'Giá bán',     key: p => formatVND(p.price || 0) },
      { label: 'Bảo hành',    key: p => p.note || '' },
      { label: '',            key: p => `
        <button class="btn btn--sm btn--secondary inv-edit" data-key="${p._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger inv-del" data-key="${p._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.inv-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(p => p._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.inv-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
  }

  document.getElementById('inv-add').addEventListener('click', () => openForm(null));

  function openForm(record) {
    const wrap = document.getElementById('inv-form-wrap');
    wrap.classList.remove('hidden');
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
            <label>Loại</label>
            <input id="f-type" type="text" value="${record?.type||''}" list="type-list" />
            <datalist id="type-list">
              ${typeList.map(t => `<option value="${t}">`).join('')}
            </datalist>
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

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
    });

    document.getElementById('f-save').addEventListener('click', async () => {
      const id   = document.getElementById('f-id').value.trim();
      const name = document.getElementById('f-name').value.trim();
      if (!id || !name) { toast('Vui lòng nhập mã và tên sản phẩm', 'error'); return; }
      const data = {
        id,
        name,
        type:  document.getElementById('f-type').value.trim(),
        unit:  document.getElementById('f-unit').value.trim(),
        stock: parseFloat(document.getElementById('f-stock').value) || 0,
        cost:  parseFloat(document.getElementById('f-cost').value) || 0,
        price: parseFloat(document.getElementById('f-price').value) || 0,
        note:  document.getElementById('f-note').value.trim()
      };
      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('Đã cập nhật sản phẩm');
        } else {
          await addItem(COLLECTION, data);
          toast('Đã thêm sản phẩm');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('Lỗi: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa sản phẩm này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa sản phẩm');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }
}
