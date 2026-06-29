// modules/debts.js - Công nợ (gom theo khách hàng)
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatDate, formatVND } from '../core/ui.js';

const COLLECTION = 'debts';
registerRoute('#debts', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Công nợ</h2>
      <div class="module-actions">
        <select id="debt-filter">
          <option value="">Tất cả</option>
          <option value="unpaid">Còn nợ</option>
          <option value="paid">Đã trả</option>
        </select>
        <input id="debt-search" type="text" placeholder="Tìm tên / SĐT..." class="search-input" />
        <button id="debt-add" class="btn btn--primary">+ Thêm nợ</button>
      </div>
    </div>
    <div id="debt-summary"></div>
    <div id="debt-table-wrap"></div>
    <div id="debt-form-wrap" class="hidden"></div>
  `;

  let allData = [];
  let _groups = [];
  const rem1 = d => Math.max(0, (Number(d.amount)||0) - (Number(d.paid)||0));

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
    renderSummary(allData);
    renderTable(allData);
  });
  container._cleanup = unsub;

  function findEntry(key){ return allData.find(d => d._key === key); }

  function renderSummary(data) {
    const unpaid = data.filter(d => rem1(d) > 0);
    const totalDebt = unpaid.reduce((s,d) => s + rem1(d), 0);
    const custSet = new Set(unpaid.map(d => (d.name||'?').trim().toLowerCase()+'|'+(d.phone||'').trim()));
    container.querySelector('#debt-summary').innerHTML =
      `<div class="summary-bar">Tổng còn nợ: <strong class="text--red">${formatVND(totalDebt)}</strong>
        &nbsp;·&nbsp; <strong>${custSet.size}</strong> khách &nbsp;·&nbsp; <strong>${unpaid.length}</strong> phiếu</div>`;
  }

  function custBlock(g, i) {
    const detail = g.entries.map(e => {
      const r = rem1(e);
      const dt = e.dueDate ? formatDate(e.dueDate) : (e.createdAt ? formatDate(new Date(e.createdAt).toISOString().slice(0,10)) : '');
      return `<tr>
        <td style="padding:4px 8px;font-size:13px">${e.note || e.source || '—'}</td>
        <td style="text-align:right;font-size:13px;white-space:nowrap">${formatVND(Number(e.amount)||0)}</td>
        <td style="text-align:right;font-size:13px;white-space:nowrap"><span class="${r>0?'text--red':'text--green'}">${formatVND(r)}</span></td>
        <td style="font-size:12px;color:#777;white-space:nowrap">${dt}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="dbt-edit" data-key="${e._key}" style="padding:2px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;font-size:12px">Sửa</button>
          <button class="dbt-del" data-key="${e._key}" style="padding:2px 8px;border:none;background:#ef4444;color:#fff;border-radius:4px;cursor:pointer;font-size:12px">Xóa</button>
        </td>
      </tr>`;
    }).join('');
    return `
      <tr class="cust-row" style="border-bottom:1px solid #eef2f7">
        <td style="padding:9px 8px"><b>${g.name}</b></td>
        <td style="white-space:nowrap">${g.phone || '—'}</td>
        <td style="text-align:center">${g.unpaid} phiếu</td>
        <td style="text-align:right"><b class="${g.remaining>0?'text--red':'text--green'}">${formatVND(g.remaining)}</b></td>
        <td style="text-align:center;white-space:nowrap">
          <button class="dbt-toggle" data-i="${i}" style="padding:4px 10px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;cursor:pointer;font-size:12.5px">Chi tiết (${g.count})</button>
          <button class="dbt-payall" data-i="${i}" style="padding:4px 10px;border:none;background:#16a34a;color:#fff;border-radius:5px;cursor:pointer;font-size:12.5px;font-weight:600">✓ Đã trả hết</button>
        </td>
      </tr>
      <tr class="cust-detail" data-i="${i}" style="display:none;background:#fafbfc">
        <td colspan="5" style="padding:6px 14px">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="color:#94a3b8;font-size:12px;text-align:left">
              <th style="padding:2px 8px">Nội dung phiếu</th>
              <th style="text-align:right">Số tiền</th>
              <th style="text-align:right">Còn lại</th>
              <th>Ngày</th><th style="text-align:center">Thao tác</th>
            </tr></thead>
            <tbody>${detail}</tbody>
          </table>
        </td>
      </tr>`;
  }

  function renderTable(data) {
    const wrap = container.querySelector('#debt-table-wrap');
    const q = container.querySelector('#debt-search').value.toLowerCase();
    const filter = container.querySelector('#debt-filter').value;
    let filtered = data;
    if (filter === 'paid')   filtered = filtered.filter(d => rem1(d) <= 0);
    if (filter === 'unpaid') filtered = filtered.filter(d => rem1(d) > 0);
    if (q) filtered = filtered.filter(d =>
      (d.name||'').toLowerCase().includes(q) || (d.phone||'').toLowerCase().includes(q));

    const gmap = {};
    filtered.forEach(d => {
      const key = (d.name||'?').trim().toLowerCase() + '|' + (d.phone||'').trim();
      if (!gmap[key]) gmap[key] = { name:(d.name||'?'), phone:(d.phone||''), entries:[] };
      gmap[key].entries.push(d);
    });
    _groups = Object.values(gmap).map(g => {
      g.remaining = g.entries.reduce((s,e)=>s+rem1(e), 0);
      g.count   = g.entries.length;
      g.unpaid  = g.entries.filter(e => rem1(e) > 0).length;
      return g;
    }).sort((a,b)=> b.remaining - a.remaining);

    if (!_groups.length) { wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có công nợ.</p>'; return; }

    wrap.innerHTML = `
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px">
        <thead><tr style="background:#f9fafb;text-align:left;border-bottom:2px solid #e5e7eb">
          <th style="padding:9px 8px">Khách hàng</th>
          <th>SĐT</th>
          <th style="text-align:center">Số phiếu nợ</th>
          <th style="text-align:right">Tổng còn nợ</th>
          <th style="text-align:center">Thao tác</th>
        </tr></thead>
        <tbody>${_groups.map((g,i)=>custBlock(g,i)).join('')}</tbody>
      </table></div>`;

    wrap.querySelectorAll('.dbt-toggle').forEach(b => b.onclick = () => {
      const d = wrap.querySelector('.cust-detail[data-i="'+b.dataset.i+'"]');
      if (d) d.style.display = (d.style.display === 'none') ? 'table-row' : 'none';
    });
    wrap.querySelectorAll('.dbt-payall').forEach(b => b.onclick = () => payAllCustomer(_groups[b.dataset.i]));
    wrap.querySelectorAll('.dbt-edit').forEach(b => b.onclick = () => showForm(findEntry(b.dataset.key)));
    wrap.querySelectorAll('.dbt-del').forEach(b => b.onclick = () => confirmDelete(findEntry(b.dataset.key)));
  }

  function payAllCustomer(g) {
    if (!g) return;
    showModal({
      title: 'Khách đã trả hết công nợ',
      body: `Xác nhận <b>${g.name}</b> đã trả hết <b class="text--red">${formatVND(g.remaining)}</b> (${g.count} phiếu)?<br>
             <span style="color:#64748b;font-size:13px">Toàn bộ công nợ của khách sẽ được xoá khỏi danh sách.</span>`,
      confirmText: '✓ Đã trả & Xoá nợ',
      onConfirm: async () => {
        try {
          for (const e of g.entries) {
            if (e.source === 'repair' && e.repairKey) {
              try { await updateItem('repairs', e.repairKey, { paymentStatus: 'paid' }); } catch(_) {}
            }
            await deleteItem(COLLECTION, e._key);
          }
          toast('Đã xoá công nợ của ' + g.name, 'success');
        } catch(err) { toast('Lỗi: ' + err.message, 'error'); }
      }
    });
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
      data.status = (data.amount - data.paid) > 0 ? 'unpaid' : 'paid';
      try {
        if(isEdit) await updateItem(COLLECTION,row._key,data);
        else await addItem(COLLECTION,data);
        toast(isEdit?'Đã cập nhật':'Đã thêm công nợ','success');
        wrap.classList.add('hidden'); wrap.innerHTML='';
      } catch(e){ toast('Lỗi: '+e.message,'error'); }
    };
  }

  function confirmDelete(row) {
    if (!row) return;
    showModal({
      title:'Xoá phiếu nợ', body:`Xác nhận xoá phiếu nợ này của <b>${row.name}</b>?`,
      confirmText:'Xoá', danger:true,
      onConfirm: async ()=>{
        if (row.source === 'repair' && row.repairKey) {
          try { await updateItem('repairs', row.repairKey, { paymentStatus: 'paid' }); } catch(_) {}
        }
        await deleteItem(COLLECTION,row._key); toast('Đã xoá','success');
      }
    });
  }
}
