// modules/sales.js - Ban hang
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'sales';
registerRoute('#sales', mount);

export async function mount(container) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let selectedKey = null;
  let unsub = null;

  container.innerHTML = `
    <div style="text-align:center;padding:1.25rem 1rem 0.5rem">
      <h2 style="margin:0 0 0.75rem">B\u00e1n h\u00e0ng</h2>
      <button id="sale-add" class="btn btn--primary" style="margin-bottom:0.75rem">+ B\u00e1n h\u00e0ng</button><br>
      <label>Ng\u00e0y: <input id="sale-date-filter" type="date" value="${todayStr}" style="margin-left:4px"></label>
      <span id="sale-count" style="margin-left:8px;color:#666"></span>
    </div>
    <div id="sale-form-wrap"></div>
    <div id="sale-list-wrap" style="padding:0 0.75rem 2rem"></div>
  `;

  function renderList(items) {
    const wrap = container.querySelector('#sale-list-wrap');
    const count = container.querySelector('#sale-count');
    if (!items.length) {
      wrap.innerHTML = '<p style="text-align:center;color:#888">Kh\u00f4ng c\u00f3 phi\u1ebfu n\u00e0o</p>';
      count.textContent = '(0)';
      return;
    }
    count.textContent = '(' + items.length + ')';
    wrap.innerHTML = items.map(s => {
      const paid = s.paid || 0;
      const total = (s.items || []).reduce((a, it) => a + ((it.price || 0) * (it.qty || 1) - (it.disc || 0)), 0);
      const remain = total - paid;
      const isSelected = selectedKey === s._key;
      return `<div class="card" data-key="${s._key}" style="margin-bottom:0.5rem;padding:0.75rem;border:1px solid #ddd;border-radius:8px;background:${isSelected ? '#f0f4ff' : '#fff'}">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" class="sale-chk" data-key="${s._key}" ${isSelected ? 'checked' : ''}>
          <div style="flex:1">
            <div style="font-weight:bold">${s.customer || 'Kh\u00e1ch l\u1ebb'} - ${s.phone || ''}</div>
            <div style="font-size:0.85rem;color:#555">${s.date || ''} | T\u1ed5ng: ${formatVND(total)} | C\u00f2n: ${formatVND(remain)}</div>
          </div>
        </label>
        ${isSelected ? `<div style="margin-top:0.5rem;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--sm sale-detail" data-key="${s._key}">Chi ti\u1ebft</button>
          <button class="btn btn--sm btn--secondary sale-edit" data-key="${s._key}">S\u1eeda</button>
          ${isAdmin() ? `<button class="btn btn--sm btn--danger sale-del" data-key="${s._key}">X\u00f3a</button>` : ''}
        </div>` : ''}
      </div>`;
    }).join('');

    wrap.querySelectorAll('.sale-chk').forEach(chk => {
      chk.addEventListener('change', e => {
        const k = e.target.dataset.key;
        selectedKey = e.target.checked ? k : null;
        const dateVal = container.querySelector('#sale-date-filter').value;
        loadDate(dateVal);
      });
    });
    wrap.querySelectorAll('.sale-detail').forEach(btn => {
      btn.addEventListener('click', e => showDetail(e.target.dataset.key, items));
    });
    wrap.querySelectorAll('.sale-edit').forEach(btn => {
      btn.addEventListener('click', e => openForm(items.find(s => s._key === e.target.dataset.key)));
    });
    wrap.querySelectorAll('.sale-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        if (!confirm('X\u00f3a phi\u1ebfu n\u00e0y?')) return;
        await deleteItem(COLLECTION, e.target.dataset.key);
        toast('\u0110\u00e3 x\u00f3a');
      });
    });
  }

  function loadDate(dateStr) {
    if (unsub) unsub();
    unsub = onSnapshot(COLLECTION, items => {
      const filtered = items.filter(s => (s.date || '').startsWith(dateStr));
      renderList(filtered);
    });
  }

  container.querySelector('#sale-add').addEventListener('click', () => openForm(null));
  container.querySelector('#sale-date-filter').addEventListener('change', e => {
    selectedKey = null;
    loadDate(e.target.value);
  });

  function openForm(existing) {
    const wrap = container.querySelector('#sale-form-wrap');
    const isEdit = !!existing;
    const s = existing || { customer: '', phone: '', date: todayStr, paymethod: 'Tien mat', warranty: 0, note: '', paid: 0, items: [] };
    wrap.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="background:#fff;border-radius:12px;padding:1.5rem;width:100%;max-width:520px;max-height:90vh;overflow-y:auto">
        <h3 style="margin:0 0 1rem">${isEdit ? 'S\u1eeda phi\u1ebfu' : 'T\u1ea1o phi\u1ebfu b\u00e1n'}</h3>
        <label>Kh\u00e1ch h\u00e0ng<input id="sf-customer" class="input" value="${s.customer || ''}" placeholder="T\u00ean kh\u00e1ch"></label>
        <label>S\u1ed1 \u0111i\u1ec7n tho\u1ea1i<input id="sf-phone" class="input" value="${s.phone || ''}"></label>
        <label>Ng\u00e0y<input id="sf-date" class="input" type="date" value="${s.date || todayStr}"></label>
        <label>Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n<input id="sf-paymethod" class="input" value="${s.paymethod || 'Tien mat'}"></label>
        <label>B\u1ea3o h\u00e0nh (th\u00e1ng)<input id="sf-warranty" class="input" type="number" value="${s.warranty || 0}"></label>
        <label>\u0110\u00e3 thu (VND)<input id="sf-paid" class="input" type="number" value="${s.paid || 0}"></label>
        <label>Ghi ch\u00fa<input id="sf-note" class="input" value="${s.note || ''}"></label>
        <div style="margin-top:1rem;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" id="sf-cancel">H\u1ee7y</button>
          <button class="btn btn--primary" id="sf-save">L\u01b0u</button>
        </div>
      </div>
    </div>`;
    wrap.querySelector('#sf-cancel').onclick = () => { wrap.innerHTML = ''; };
    wrap.querySelector('#sf-save').onclick = async () => {
      const data = {
        customer: wrap.querySelector('#sf-customer').value.trim(),
        phone: wrap.querySelector('#sf-phone').value.trim(),
        date: wrap.querySelector('#sf-date').value,
        paymethod: wrap.querySelector('#sf-paymethod').value.trim(),
        warranty: Number(wrap.querySelector('#sf-warranty').value) || 0,
        paid: Number(wrap.querySelector('#sf-paid').value) || 0,
        note: wrap.querySelector('#sf-note').value.trim(),
        items: s.items || []
      };
      if (isEdit) await updateItem(COLLECTION, existing._key, data);
      else await addItem(COLLECTION, data);
      wrap.innerHTML = '';
      toast(isEdit ? '\u0110\u00e3 c\u1eadp nh\u1eadt' : '\u0110\u00e3 t\u1ea1o phi\u1ebfu');
    };
  }

  function showDetail(key, items) {
    const s = items.find(x => x._key === key);
    if (!s) return;
    const total = (s.items || []).reduce((a, it) => a + ((it.price || 0) * (it.qty || 1) - (it.disc || 0)), 0);
    const remain = total - (s.paid || 0);
    const wrap = container.querySelector('#sale-form-wrap');
    wrap.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="background:#fff;border-radius:12px;padding:1.5rem;width:100%;max-width:520px;max-height:90vh;overflow-y:auto">
        <h3>Chi ti\u1ebft phi\u1ebfu b\u00e1n</h3>
        <p><b>Kh\u00e1ch:</b> ${s.customer || ''}</p>
        <p><b>\u0110i\u1ec7n tho\u1ea1i:</b> ${s.phone || ''}</p>
        <p><b>Ng\u00e0y:</b> ${s.date || ''}</p>
        <p><b>Thanh to\u00e1n:</b> ${s.paymethod || ''}</p>
        <p><b>B\u1ea3o h\u00e0nh:</b> ${s.warranty || 0} th\u00e1ng</p>
        <p><b>Ghi ch\u00fa:</b> ${s.note || ''}</p>
        <p><b>T\u1ed5ng:</b> ${formatVND(total)}</p>
        <p><b>\u0110\u00e3 thu:</b> ${formatVND(s.paid || 0)}</p>
        <p><b>C\u00f2n n\u1ee3:</b> ${formatVND(remain)}</p>
        <button class="btn" id="sd-close">\u0110\u00f3ng</button>
      </div>
    </div>`;
    wrap.querySelector('#sd-close').onclick = () => { wrap.innerHTML = ''; };
  }

  loadDate(todayStr);
}
