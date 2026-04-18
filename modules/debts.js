// modules/debts.js - Công nợ
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';

const COLLECTION = 'debts';
registerRoute('#debts', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Công nợ</h2>
      <div class="module-actions">
        <select id="debt-filter">
          <option value="">Tất cả</option>
          <option value="unpaid">Chưa trả</option>
          <option value="paid">Đã trả</option>
        </select>
        <input id="debt-search" type="text" placeholder="Tìm kiếm..." class="search-input" />
        <button id="debt-add" class="btn btn--primary">+ Thêm nợ</button>
      </div>
    </div>
    <div id="debt-summary"></div>
    <div id="debt-table-wrap"></div>
    <div id="debt-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
    renderSummary(allData);
    renderTable(allData);
  });
  container._cleanup = unsub;

  function renderSummary(data) {
    const totalDebt = data.filter(d=>d.status!=='paid').reduce((s,d)=>s+(Number(d.amount)||0),0);
    container.querySelector('#debt-summary').innerHTML =
      `<div class="summary-bar">Tổng còn nợ: <strong class="text--red">${formatVND(totalDebt)}</strong></div>`;
  }

  function renderTable(data) {
    const wrap = container.querySelector('#debt-table-wrap');
    const q = container.querySelector('#debt-search').value.toLowerCase();
    const filter = container.querySelector('#debt-filter').value;
    let filtered = data;
    if (filter) filtered = filtered.filter(d => d.status === filter);
    if (q) filtered = filtered.filter(d =>
      (d.name||'').toLowerCase().includes(q) || (d.phone||'').toLowerCase().includes(q)
    );
    wrap.innerHTML = '';
    wrap.appendChild(buildTable({
      columns: [
        { field: 'name', label: 'Tên' },
        { field: 'phone', label: 'SĐT', width:'110px' },
        { field: 'amount', label: 'Số tiền nợ', money:true, width:'120px' },
        { field: 'paid', label: 'Đã trả', money:true, width:'110px' },
        { field: 'remaining', label: 'Còn lại', width:'110px',
          render:(v,row)=>{
            const rem=(Number(row.amount)||0)-(Number(row.paid)||0);
            return `<span class="${rem>0?'text--red':'text--green'}">${formatVND(rem)}</span>`;
          }},
        { field: 'status', label: 'Trạng thái', width:'100px',
          render: v => `<span class="badge badge--${v==='paid'?'green':'red'}">${v==='paid'?'Đã trả':'Chưa trả'}</span>` },
        { field: 'dueDate', label: 'Hạn trả', width:'100px', render: v => formatDate(v) },
      ],
      data: filtered,
      actions: [
        { label: 'Sửa', type:'primary', onClick: row => showForm(row) },
        { label: 'Xoá', type:'danger', onClick: row => confirmDelete(row) },
      ]
    }));
  }

  container.querySelector('#debt-search').addEventListener('input', ()=>renderTable(allData));
  container.querySelector('#debt-filter').addEventListener('change', ()=>renderTable(allData));
  container.querySelector('#debt-add').addEventListener('click', ()=>showForm(null));

  function showForm(row) {
    const wrap = container.querySelector('#debt-form-wrap');
    const isEdit = !!row;
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="form-panel">
        <h3>${isEdit?'Cập nhật nợ':'Thêm công nợ'}</h3>
        <div class="form-grid">
          <label>Tên <input name="name" value="${row?.name||''}" /></label>
          <label>SĐT <input name="phone" value="${row?.phone||''}" /></label>
          <label>Số tiền nợ <input name="amount" type="number" value="${row?.amount||0}" /></label>
          <label>Đã trả <input name="paid" type="number" value="${row?.paid||0}" /></label>
          <label>Trạng thái
            <select name="status">
              <option value="unpaid" ${row?.status!=='paid'?'selected':''}>Chưa trả</option>
              <option value="paid" ${row?.status==='paid'?'selected':''}>Đã trả</option>
            </select>
          </label>
          <label>Hạn trả <input name="dueDate" type="date" value="${row?.dueDate||''}" /></label>
          <label class="full-width">Ghi chú <textarea name="note">${row?.note||''}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="btn btn--secondary" id="debt-cancel">Huỷ</button>
          <button class="btn btn--primary" id="debt-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#debt-cancel').onclick = ()=>{ wrap.classList.add('hidden'); wrap.innerHTML=''; };
    wrap.querySelector('#debt-save').onclick = async ()=>{
      const data={};
      wrap.querySelectorAll('[name]').forEach(el=>{ data[el.name]=el.value; });
      data.amount=Number(data.amount)||0;
      data.paid=Number(data.paid)||0;
      try {
        if(isEdit) await updateItem(COLLECTION,row._key,data);
        else await addItem(COLLECTION,data);
        toast(isEdit?'Đã cập nhật':'Đã thêm công nợ','success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e){ toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    showModal({
      title:'Xoá công nợ', body:`Xác nhận xoá nợ của <b>${row.name}</b>?`,
      confirmText:'Xoá', danger:true,
      onConfirm: async ()=>{ await deleteItem(COLLECTION,row._key); toast('Đã xoá','success'); }
    });
  }
}
