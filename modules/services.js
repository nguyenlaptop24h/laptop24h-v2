// modules/services.js - Danh mục Dịch vụ sửa chữa v1
import { registerRoute } from '../core/router.js';
import { onSnapshot, addItem, updateItem } from '../core/db.js';
import { toast, formatVND, showModal } from '../core/ui.js';

const COL = 'services';
registerRoute('#services', mount);

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function dot(n){ const s=String(Math.round(Number(n)||0)); return s.replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function num(v){ return parseFloat(String(v==null?'':v).replace(/[^0-9]/g,'')) || 0; }

export function mount(container){
  container.innerHTML = `
<style>
.sv-tbl{width:100%;border-collapse:collapse;font-size:14px;background:#fff}
.sv-tbl th{background:#eef2ff;padding:9px 12px;text-align:left;font-weight:700;color:#3730a3;border-bottom:2px solid #e0e7ff}
.sv-tbl td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}
.sv-tbl tr:hover td{background:#f8fafc}
.sv-btn{padding:4px 10px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:13px;margin-left:4px}
.sv-btn:hover{background:#f1f5f9}
.sv-btn.del:hover{background:#fee2e2;border-color:#fca5a5;color:#dc2626}
.sv-add{padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px}
.sv-search{padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;width:260px}
.sv-empty{padding:18px;text-align:center;color:#94a3b8}
.sv-fld{margin-bottom:10px}
.sv-fld label{display:block;font-size:13px;color:#475569;margin-bottom:4px;font-weight:600}
.sv-fld input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #cbd5e1;border-radius:7px;font-size:14px}
</style>
    <div class="module-header">
      <h2>🧰 Dịch vụ sửa chữa</h2>
      <div class="module-actions" style="gap:8px">
        <input id="sv-search" class="sv-search" placeholder="🔍 Tìm dịch vụ...">
        <button id="sv-add" class="sv-add">＋ Thêm dịch vụ</button>
      </div>
    </div>
    <div id="sv-list"><p class="sv-empty">Đang tải...</p></div>
  `;

  let items = [];
  onSnapshot(COL, list => { items = (list||[]).filter(x=>!x.deletedAt); render(); });

  const listEl = container.querySelector('#sv-list');
  const searchEl = container.querySelector('#sv-search');
  searchEl.oninput = render;
  container.querySelector('#sv-add').onclick = () => openForm(null);

  function render(){
    const q = (searchEl.value||'').trim().toLowerCase();
    let list = q ? items.filter(s => (s.name||'').toLowerCase().includes(q)) : items.slice();
    list.sort((a,b)=> (a.name||'').localeCompare(b.name||'','vi'));
    if(!list.length){ listEl.innerHTML = '<p class="sv-empty">Chưa có dịch vụ nào. Bấm "＋ Thêm dịch vụ".</p>'; return; }
    const rows = list.map(s => `<tr>
      <td><b>${esc(s.name)}</b></td>
      <td style="text-align:right">${formatVND(s.price||0)}</td>
      <td style="text-align:center">${Number(s.warrantyMonths)||0} tháng</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="sv-btn" data-edit="${s._key}">✏ Sửa</button>
        <button class="sv-btn del" data-del="${s._key}">🗑 Xoá</button>
      </td>
    </tr>`).join('');
    listEl.innerHTML = `<div style="font-size:13px;color:#64748b;margin-bottom:8px">${list.length} dịch vụ</div>
      <table class="sv-tbl"><thead><tr>
        <th>Tên dịch vụ</th><th style="text-align:right">Giá</th><th style="text-align:center">Bảo hành</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    listEl.querySelectorAll('[data-edit]').forEach(b=> b.onclick = ()=> openForm(items.find(x=>x._key===b.dataset.edit)));
    listEl.querySelectorAll('[data-del]').forEach(b=> b.onclick = ()=> delItem(items.find(x=>x._key===b.dataset.del)));
  }

  function openForm(ex){
    const key = ex ? ex._key : null;
    showModal({
      title: key ? 'Sửa dịch vụ' : 'Thêm dịch vụ',
      confirmText: 'Lưu',
      body: `
        <div class="sv-fld"><label>Tên dịch vụ <span style="color:#e11d48">*</span></label>
          <input id="svf-name" value="${esc(ex?.name)}" placeholder="VD: Sửa main, Thay màn hình, Thay pin..."></div>
        <div class="sv-fld"><label>Giá (đ)</label>
          <input id="svf-price" data-fmt="number" inputmode="numeric" value="${ex?dot(ex.price||0):''}" placeholder="0"></div>
        <div class="sv-fld"><label>Thời hạn bảo hành (tháng)</label>
          <input id="svf-wm" type="number" min="0" max="60" value="${ex?(Number(ex.warrantyMonths)||0):3}" placeholder="3"></div>
      `,
      onConfirm: async () => {
        const name = (document.querySelector('#svf-name')?.value||'').trim();
        if(!name){ toast('Nhập tên dịch vụ!','warning'); return false; }
        const data = {
          name,
          price: num(document.querySelector('#svf-price')?.value),
          warrantyMonths: parseInt(document.querySelector('#svf-wm')?.value,10) || 0
        };
        try {
          key ? await updateItem(COL, key, data) : await addItem(COL, data);
          toast(key ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ','success');
        } catch(e){ toast('Lỗi: '+e.message,'error'); return false; }
      }
    });
  }

  function delItem(s){
    if(!s) return;
    showModal({
      title: 'Xoá dịch vụ', danger: true, confirmText: 'Xoá',
      body: `<p>Xoá dịch vụ <b>${esc(s.name)}</b>?</p>`,
      onConfirm: async () => {
        try { await updateItem(COL, s._key, { deletedAt: Date.now() }); toast('Đã xoá','success'); }
        catch(e){ toast('Lỗi: '+e.message,'error'); return false; }
      }
    });
  }
}
