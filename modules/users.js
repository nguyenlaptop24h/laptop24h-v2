// modules/users.js - Quản lý người dùng (admin only)
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal } from '../core/ui.js';
import { isAdmin, getCurrentUser } from '../core/auth.js';

const COLLECTION = 'users';

registerRoute('#users', mount);

const ROLE_LABEL = { admin: 'Quản trị', staff: 'Nhân viên' };

export async function mount(container) {
  if (!isAdmin()) {
    container.innerHTML = '<div style="padding:2rem;color:#e53e3e">Bạn không có quyền truy cập trang này.</div>';
    return;
  }

  container.innerHTML = `
    <div class="module-header">
      <h2>Quản lý người dùng</h2>
      <div class="module-actions">
        <button id="user-add" class="btn btn--primary">+ Thêm người dùng</button>
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
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Tên đăng nhập', key: u => u.username || '' },
      { label: 'Họ tên',        key: u => u.name || '' },
      { label: 'Vai trò',       key: u => {
          const role = u.role || 'staff';
          return `<span class="badge ${role==='admin'?'badge-purple':'badge-blue'}">${ROLE_LABEL[role]||role}</span>`;
        }
      },
      { label: '',              key: u => {
          const isSelf = u._key === me?._key;
          return `
            <button class="btn btn--sm btn--secondary user-edit" data-key="${u._key}">Sửa</button>
            ${!isSelf ? `<button class="btn btn--sm btn--danger user-del" data-key="${u._key}">Xóa</button>` : ''}
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
        <h3>${record ? 'Cập nhật người dùng' : 'Thêm người dùng'}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Tên đăng nhập *</label>
            <input id="f-username" type="text" value="${record?.username||''}" ${record?'readonly':''} />
          </div>
          <div class="form-group">
            <label>Mật khẩu ${record?'(để trống = không đổi)':'*'}</label>
            <input id="f-password" type="password" placeholder="${record?'Nhập mật khẩu mới nếu muốn đổi':'Mật khẩu'}" />
          </div>
          <div class="form-group">
            <label>Họ tên</label>
            <input id="f-name" type="text" value="${record?.name||''}" />
          </div>
          <div class="form-group">
            <label>Vai trò</label>
            <select id="f-role">
              <option value="staff" ${record?.role==='staff'||!record?.role?'selected':''}>Nhân viên</option>
              <option value="admin" ${record?.role==='admin'?'selected':''}>Quản trị</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Tạo tài khoản'}</button>
          <button id="f-cancel" class="btn btn--secondary">Hủy</button>
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

      if (!username) { toast('Vui lòng nhập tên đăng nhập', 'error'); return; }
      if (!record && !password) { toast('Vui lòng nhập mật khẩu', 'error'); return; }

      const data = { username, name, role };
      if (password) data.password = password;

      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('Đã cập nhật người dùng');
        } else {
          await addItem(COLLECTION, data);
          toast('Đã tạo tài khoản');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('Lỗi: ' + e.message, 'error');
      }
    });
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa người dùng này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa người dùng');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }
}
