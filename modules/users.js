// modules/users.js - Quản lý nhân viên (admin only)
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'users';
registerRoute('#users', mount);

export async function mount(container) {
  if (!isAdmin()) {
    container.innerHTML = '<p class="error">Bạn không có quyền truy cập trang này.</p>';
    return;
  }

  container.innerHTML = `
    <div class="module-header">
      <h2>Quản lý nhân viên</h2>
      <div class="module-actions">
        <input id="usr-search" type="text" placeholder="Tìm nhân viên..." class="search-input" />
        <button id="usr-add" class="btn btn--primary">+ Thêm nhân viên</button>
      </div>
    </div>
    <div id="usr-table-wrap"></div>
    <div id="usr-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a,b)=>(a.name||'').localeCompare(b.name||'','vi'));
    renderTable(allData);
  });
  container._cleanup = unsub;

  function renderTable(data) {
    const wrap = container.querySelector('#usr-table-wrap');
    const q = container.querySelector('#usr-search').value.toLowerCase();
    const filtered = q ? data.filter(r =>
      (r.name||'').toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q)
    ) : data;
    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'name', label: 'Tên nhân viên' },
        { field: 'email', label: 'Email' },
        { field: 'phone', label: 'SĐT', width:'120px' },
        { field: 'role', label: 'Vai trò', width:'100px',
          render: v => `<span class="badge badge--${v==='admin'?'blue':'gray'}">${v==='admin'?'Admin':'Nhân viên'}</span>` },
        { field: 'createdAt', label: 'Ngày tạo', width:'100px', render: v => formatDate(v) },
      ],
      data: filtered,
      actions: [
        { label: 'Sửa', type:'primary', onClick: row => showForm(row) },
        { label: 'Xoá', type:'danger', onClick: row => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#usr-search').addEventListener('input', ()=>renderTable(allData));
  container.querySelector('#usr-add').addEventListener('click', ()=>showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#usr-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit?'Cập nhật nhân viên':'Thêm nhân viên'}</h3>
        <p class="form-note">⚠️ Tài khoản Firebase Auth cần tạo thủ công. Ở đây chỉ lưu thông tin & phân quyền.</p>
        <div class="form-grid">
          <label>Tên <input name="name" value="${row?.name||''}" /></label>
          <label>Email <input name="email" type="email" value="${row?.email||''}" ${isEdit?'readonly':''} /></label>
          <label>SĐT <input name="phone" value="${row?.phone||''}" /></label>
          <label>Vai trò
            <select name="role">
              <option value="employee" ${row?.role!=='admin'?'selected':''}>Nhân viên</option>
              <option value="admin" ${row?.role==='admin'?'selected':''}>Admin</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="usr-cancel">Huỷ</button>
          <button class="btn btn--primary" id="usr-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#usr-cancel').onclick = ()=>{ wrap.classList.add('hidden'); wrap.innerHTML=''; };
    wrap.querySelector('#usr-save').onclick = async ()=>{
      const data={};
      wrap.querySelectorAll('[name]').forEach(el=>{ data[el.name]=el.value; });
      try {
        if(isEdit) await updateItem(COLLECTION,row._key,data);
        else await addItem(COLLECTION,data);
        toast(isEdit?'Đã cập nhật':'Đã thêm nhân viên','success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e){ toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title:'Xoá nhân viên', body:`Xác nhận xoá <b>${row.name}</b>?<br><small>Tài khoản Firebase Auth cần xoá thủ công.</small>`,
      confirmText:'Xoá', danger:true,
      onConfirm: async ()=>{ await deleteItem(COLLECTION,row._key); toast('Đã xoá','success'); }
    });
  }
}
