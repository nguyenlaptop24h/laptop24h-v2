// modules/customers.js - Kh�ch h�ng
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'customers';

registerRoute('#customers', mount);

const TYPE_LIST = ['Th�n thi�t','Th��ng','�i l�','C�ng ty'];

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Kh�ch h�ng</h2>
      <div class="module-actions">
        <input id="cust-search" type="text" placeholder="T�m theo t�n, ST..." class="search-input" />
        <select id="cust-type-filter" class="search-input" style="width:130px">
          <option value="">T�t c� lo�i</option>
          ${TYPE_LIST.map(t => `<option>${t}</option>`).join('')}
        </select>
        <button id="cust-add" class="btn btn--primary">+ Th�m kh�ch</button>
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
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Kh�ng c� d� li�u</p>';
      return;
    }
    const cols = [
      { label: 'M� KH',       key: c => c.id || '' },
      { label: 'T�n kh�ch',   key: c => c.name || '' },
      { label: 'S� i�n tho�i',key: c => c.phone || '' },
      { label: '�a ch�',    key: c => c.address || '' },
      { label: 'Lo�i KH',    key: c => c.type
          ? `<span class="badge ${c.type==='Th�n thi�t'?'badge-green':c.type==='�i l�'?'badge-purple':'badge-blue'}">${c.type}</span>`
          : '' },
      { label: 'Ghi ch�',    key: c => c.note || '' },
      { label: 'Ng�y t�o',   key: c => c.ts ? formatDate(c.ts) : '' },
      { label: '',           key: c => `
        <button class="btn btn--sm btn--secondary cust-edit" data-key="${c._key}">S�a</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger cust-del" data-key="${c._key}">X�a</button>` : ''}
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
        <h3>${record ? 'C�p nh�t kh�ch h�ng' : 'Th�m kh�ch h�ng'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>M� kh�ch h�ng</label>
            <input id="f-id" type="text" value="${record?.id||''}" placeholder="VD: KH001" />
          </div>
          <div class="form-group">
            <label>T�n kh�ch h�ng *</label>
            <input id="f-name" type="text" value="${record?.name||''}" />
          </div>
          <div class="form-group">
            <label>S� i�n tho�i</label>
            <input id="f-phone" type="text" value="${record?.phone||''}" />
          </div>
          <div class="form-group">
            <label>�a ch�</label>
            <input id="f-address" type="text" value="${record?.address||''}" />
          </div>
          <div class="form-group">
            <label>Lo�i kh�ch h�ng</label>
            <select id="f-type">
              <option value="">-- Ch�n lo�i --</option>
              ${TYPE_LIST.map(t => `<option ${record?.type===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Ghi ch�</label>
            <input id="f-note" type="text" value="${record?.note||''}" />
          </div>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'C�p nh�t' : 'L�u'}</button>
          <button id="f-cancel" class="btn btn--secondary">H�y</button>
        </div>
      </div>
    `;

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
    });

    document.getElementById('f-save').addEventListener('click', async () => {
      const name = document.getElementById('f-name').value.trim();
      if (!name) { toast('Vui l�ng nh�p t�n kh�ch h�ng', 'error'); return; }
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
          toast('� c�p nh�t kh�ch h�ng');
        } else {
          await addItem(COLLECTION, data);
          toast('� th�m kh�ch h�ng');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('L�i: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('X�c nh�n', 'X�a kh�ch h�ng n�y?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('� x�a kh�ch h�ng');
    } catch(e) {
      toast('L�i: ' + e.message, 'error');
    }
  }
}
