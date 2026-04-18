// modules/users.js - Qu�n l� ng��i d�ng (admin only)
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal } from '../core/ui.js';
import { isAdmin, getCurrentUser } from '../core/auth.js';

const COLLECTION = 'users';

registerRoute('#users', mount);

const ROLE_LABEL = { admin: 'Qu�n tr�', staff: 'Nh�n vi�n' };

export async function mount(container) {
  if (!isAdmin()) {
    container.innerHTML = '<div style="padding:2rem;color:#e53e3e">B�n kh�ng c� quy�n truy c�p trang n�y.</div>';
    return;
  }

  container.innerHTML = `
    <div class="module-header">
      <h2>Qu�n l� ng��i d�ng</h2>
      <div class="module-actions">
        <button id="user-add" class="btn btn--primary">+ Th�m ng��i d�ng</button>
      </div>
    </div>
    <div id="user-table-wrap"></div>
    <div id="user-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  const me = getCurrentUser();

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'vi'));
    renderTable(allData);
  });

  container.addEventListener('unmount', () => unsub && unsub());

  function renderTable(data) {
    const wrap = document.getElementById('user-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Kh�ng c� d� li�u</p>';
      return;
    }
    const cols = [
      { label: 'T�n ng nh�p', key: u => u.username || '' },
      { label: 'H� t�n',        key: u => u.name || '' },
      { label: 'Vai tr�',       key: u => {
          const role = u.role || 'staff';
          return `<span class="badge ${role==='admin'?'badge-purple':'badge-blue'}">${ROLE_LABEL[role]||role}</span>`;
        }
      },
      { label: '',              key: u => {
          const isSelf = u._key === me?._key;
          return `
            <button class="btn btn--sm btn--secondary user-edit" data-key="${u._key}">S�a</button>
            ${!isSelf ? `<button class="btn btn--sm btn--danger user-del" data-key="${u._key}">X�a</button>` : ''}
          `;
        }
      }
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.user-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(u => u._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.user-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
  }

  document.getElementById('user-add').addEventListener('click', () => openForm(null));

  function openForm(record) {
    const wrap = document.getElementById('user-form-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-card">
        <h3>${record ? 'C�p nh�t ng��i d�ng' : 'Th�m ng��i d�ng'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>T�n ng nh�p *</label>
            <input id="f-username" type="text" value="${record?.username||''}" ${record?'readonly':''} />
          </div>
          <div class="form-group">
            <label>M�t kh�u ${record?'(� tr�ng = kh�ng �i)':'*'}</label>
            <input id="f-password" type="password" placeholder="${record?'Nh�p m�t kh�u m�i n�u mu�n �i':'M�t kh�u'}" />
          </div>
          <div class="form-group">
            <label>H� t�n</label>
            <input id="f-name" type="text" value="${record?.name||''}" />
          </div>
          <div class="form-group">
            <label>Vai tr�</label>
            <select id="f-role">
              <option value="staff" ${record?.role==='staff'||!record?.role?'selected':''}>Nh�n vi�n</option>
              <option value="admin" ${record?.role==='admin'?'selected':''}>Qu�n tr�</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'C�p nh�t' : 'T�o t�i kho�n'}</button>
          <button id="f-cancel" class="btn btn--secondary">H�y</button>
        </div>
      </div>
    `;

    document.getElementById('f-cancel').addEventListener('click', () => {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
    });

    document.getElementById('f-save').addEventListener('click', async () => {
      const username = document.getElementById('f-username').value.trim();
      const password = document.getElementById('f-password').value;
      const name     = document.getElementById('f-name').value.trim();
      const role     = document.getElementById('f-role').value;

      if (!username) { toast('Vui l�ng nh�p t�n ng nh�p', 'error'); return; }
      if (!record && !password) { toast('Vui l�ng nh�p m�t kh�u', 'error'); return; }

      const data = { username, name, role };
      if (password) data.password = password;

      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('� c�p nh�t ng��i d�ng');
        } else {
          await addItem(COLLECTION, data);
          toast('� t�o t�i kho�n');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('L�i: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('X�c nh�n', 'X�a ng��i d�ng n�y?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('� x�a ng��i d�ng');
    } catch(e) {
      toast('L�i: ' + e.message, 'error');
    }
  }
}
