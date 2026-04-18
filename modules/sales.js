// modules/sales.js - Ban hang v5
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'sales';
registerRoute('#sales', mount);

export async function mount(container) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let unsub = null;
  let invItems = [];
  let currentList = [];
  let editKey = null;

  try {
    const snap = await firebase.database().ref('products').once('value');
    snap.forEach(c => { invItems.push({ _key: c.key, ...c.val() }); });
  } catch(e) {}

  container.innerHTML = `
    <div style="text-align:center;padding:1.25rem 1rem 0.5rem">
      <h2>B\u00e1n h\u00e0ng</h2>
      <button id="sale-add" class="btn btn--primary" style="margin:.5rem auto;display:block">+ B\u00e1n h\u00e0ng</button>
      <label style="font-size:.9rem">Ng\u00e0y: <input id="sale-date-filter" type="date" value="${todayStr}"></label>
      <span id="sale-count" style="margin-left:.5rem;color:#888;font-size:.9rem"></span>
    </div>
    <div id="sale-form-wrap"></div>
    <div id="sale-list-wrap" style="padding:0 1rem 2rem"></div>
  `;

  const addBtn = container.querySelector('#sale-add');
  const dateFilter = container.querySelector('#sale-date-filter');
  const formWrap = container.querySelector('#sale-form-wrap');
  const listWrap = container.querySelector('#sale-list-wrap');
  const countEl = container.querySelector('#sale-count');

  // ===================== GLOBAL PRODUCT DROPDOWN =====================
  let globalDrop = null;
  let dropTarget = null; // the rname input currently bound

  function ensureGlobalDrop() {
    if (globalDrop && document.body.contains(globalDrop)) return;
    globalDrop = document.createElement('div');
    globalDrop.id = 'sf-prod-drop';
    globalDrop.style.cssText = 'display:none;position:fixed;background:#fff;border:1px solid #1a73e8;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:99999;max-height:220px;overflow-y:auto;min-width:220px';
    document.body.appendChild(globalDrop);
  }

  function positionDrop(inputEl) {
    const r = inputEl.getBoundingClientRect();
    globalDrop.style.top  = (r.bottom + 2) + 'px';
    globalDrop.style.left = r.left + 'px';
    globalDrop.style.width = Math.max(r.width, 260) + 'px';
  }

  function hideDrop() {
    if (globalDrop) globalDrop.style.display = 'none';
    dropTarget = null;
  }

  function showDrop(q, inputEl, selectCb) {
    ensureGlobalDrop();
    if (!q) { hideDrop(); return; }
    const ql = q.toLowerCase();
    const hits = invItems.filter(p =>
      (p.name||'').toLowerCase().includes(ql) ||
      String(p.id||'').toLowerCase().includes(ql)
    ).slice(0, 10);
    if (!hits.length) { hideDrop(); return; }
    globalDrop.innerHTML = hits.map(p => `
      <div class="sp-opt" data-key="${p._key}"
        style="padding:.45rem .7rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;gap:.5rem">
        <div style="min-width:0">
          <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name||''}</div>
          <div style="font-size:.72rem;color:#888">${p.id||''} ${p.unit ? '\u00b7 '+p.unit : ''}</div>
        </div>
        <div style="font-size:.8rem;font-weight:700;color:#1a3a6b;white-space:nowrap;flex-shrink:0">${formatVND(p.price||0)}</div>
      </div>`).join('');
    globalDrop.querySelectorAll('.sp-opt').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const p = invItems.find(x => x._key === opt.dataset.key);
        if (p) selectCb(p);
        hideDrop();
      });
      opt.addEventListener('mouseover', () => { opt.style.background = '#f0f6ff'; });
      opt.addEventListener('mouseout',  () => { opt.style.background = ''; });
    });
    dropTarget = inputEl;
    positionDrop(inputEl);
    globalDrop.style.display = 'block';
  }

  // ===================== FORM =====================
  function openForm(existing) {
    editKey = existing ? existing._key : null;
    const d = existing || {};
    const rows = (d.items && d.items.length) ? d.items : [{ sku:'', name:'', qty:1, price:0, disc:0 }];

    const warranties = ['Kh\u00f4ng b\u1ea3o h\u00e0nh','1 th\u00e1ng','3 th\u00e1ng','6 th\u00e1ng','12 th\u00e1ng','18 th\u00e1ng','24 th\u00e1ng'];
    const wOpts = warranties.map(w => `<option value="${w}"${(d.warranty||'3 th\u00e1ng')===w?' selected':''}>${w}</option>`).join('');

    const pays = ['Ti\u1ec1n m\u1eb7t','Chuy\u1ec3n kho\u1ea3n','Qu\u1eb9t th\u1ebb'];
    const pOpts = pays.map(p => `<option value="${p}"${(d.payMethod||'Ti\u1ec1n m\u1eb7t')===p?' selected':''}>${p}</option>`).join('');

    formWrap.innerHTML = `
<div style="padding:0 0 80px">
  <style>
    #sale-form-wrap .fcard{background:#fff;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.09);padding:1rem 1.25rem;margin-bottom:1rem}
    #sale-form-wrap .fcard h3{margin:0 0 .85rem;font-size:.97rem;display:flex;align-items:center;gap:.4rem;color:#1e293b;font-weight:700}
    #sale-form-wrap label.flbl{font-size:.72rem;font-weight:700;color:#64748b;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.3px}
    #sale-form-wrap .finput,#sale-form-wrap .form-control{width:100%;box-sizing:border-box;padding:5px 8px;height:32px;font-size:.85rem;border:1px solid #cbd5e1;border-radius:6px;outline:none}
    #sale-form-wrap .finput:focus,#sale-form-wrap .form-control:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.15)}
    #sale-form-wrap table{width:100%;border-collapse:collapse}
    #sale-form-wrap thead th{font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;padding:6px 6px;text-align:left;background:#f8fafc;border-bottom:2px solid #e2e8f0}
    #sale-form-wrap tbody td{padding:3px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    #sale-form-wrap tbody td .finput,#sale-form-wrap tbody td .form-control{height:28px;font-size:.82rem;padding:3px 5px}
    #sale-form-wrap .rtotal{font-weight:600;font-size:.85rem;color:#1e293b;text-align:right;padding-right:6px;white-space:nowrap;min-width:90px}
    #sale-form-wrap .rdel{background:#fee2e2;color:#dc2626;border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;font-size:.9rem}
    #sale-form-wrap .rdel:hover{background:#fecaca}
  </style>
  <div class="fcard">
    <h3>👤 Thông tin khách hàng</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem">
      <div><label class="flbl">Khách hàng</label><input id="sf-customer" class="finput" placeholder="Tên hoặc tìm KH mới..." value="${d.customer||''}"></div>
      <div><label class="flbl">Số điện thoại</label><input id="sf-phone" class="finput" placeholder="0xxx xxx xxx" value="${d.phone||''}"></div>
      <div><label class="flbl">Ghi chú đơn</label><input id="sf-note" class="finput" placeholder="Bảo hành, giao hàng..." value="${d.note||''}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
      <div><label class="flbl">Bảo hành</label>
        <select id="sf-warranty" class="finput">${['3 tháng','6 tháng','12 tháng','24 tháng','Không BH'].map(v=>`<option${(d.warranty||'3 tháng')===v?' selected':''}>${v}</option>`).join('')}</select></div>
      <div><label class="flbl">Hình thức thanh toán</label>
        <select id="sf-paymethod" class="finput">${['Tiền mặt','Chuyển khoản','Thẻ'].map(v=>`<option${(d.payMethod||'Tiền mặt')===v?' selected':''}>${v}</option>`).join('')}</select></div>
    </div>
  </div>
  <div class="fcard">
    <h3>🛒 Danh sách sản phẩm</h3>
    <table>
      <thead><tr>
        <th style="width:90px">Mã SP</th><th>Tên SP</th>
        <th style="width:52px;text-align:center">SL</th>
        <th style="width:110px;text-align:right">Đơn giá</th>
        <th style="width:68px;text-align:center">G.Giá%</th>
        <th style="width:110px;text-align:right">Thành tiền</th>
        <th style="width:36px"></th>
      </tr></thead>
      <tbody id="sf-rows"></tbody>
    </table>
    <button id="sf-add-row" style="margin-top:.5rem;padding:5px 14px;font-size:.85rem;background:#f8fafc;border:1px dashed #94a3b8;border-radius:6px;cursor:pointer;color:#475569;font-weight:600">+ Thêm dòng</button>
  </div>
  <div class="fcard">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid #f1f5f9">
      <span style="color:#475569">Tổng tiền hàng</span>
      <span id="sf-subtotal" style="font-weight:600;font-size:.95rem">0 đ</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid #f1f5f9">
      <span style="color:#475569">Giảm giá thêm (đ)</span>
      <input id="sf-extra-disc" type="number" class="finput" value="${d.extraDiscount||0}" style="width:120px;text-align:right;font-weight:600">
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:#1a3a6b;border-radius:8px;padding:.7rem 1rem;margin:.5rem 0">
      <span style="color:#fff;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Tổng thanh toán</span>
      <span id="sf-total" style="color:#fff;font-weight:700;font-size:1.1rem">0 đ</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0">
      <span style="color:#475569">Khách trả (đ)</span>
      <input id="sf-paid" type="number" class="finput" value="${d.paid||0}" style="width:120px;text-align:right;font-weight:600">
    </div>
  </div>
</div>
<div style="position:sticky;bottom:0;left:0;right:0;display:flex;gap:.5rem;padding:.65rem 1rem;background:#fff;border-top:2px solid #e2e8f0;box-shadow:0 -2px 12px rgba(0,0,0,.08)">
  <button id="sf-print" style="flex:1;padding:.6rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">🖨 In Bill + BH</button>
  <button id="sf-save" style="flex:1.5;padding:.6rem;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">💾 Lưu Đơn Hàng</button>
  ${existing?`<button id="sf-del" style="padding:.6rem .75rem;background:#fff;color:#dc2626;border:1.5px solid #dc2626;border-radius:8px;font-size:1rem;cursor:pointer" title="Xóa">🗑</button>`:''}
</div>
`;

    rows.forEach(r => addRow(r));
    recalc();

    formWrap.querySelector('#sf-add-row').onclick = () => { addRow({}); recalc(); };
    formWrap.querySelector('#sf-extra-disc').oninput = recalc;
    formWrap.querySelector('#sf-save').onclick = saveForm;
    formWrap.querySelector('#sf-print').onclick = () => {
      var d = {
        customer: formWrap.querySelector('#sf-customer')?.value||'',
        phone: formWrap.querySelector('#sf-phone')?.value||'',
        note: formWrap.querySelector('#sf-note')?.value||'',
        warranty: formWrap.querySelector('#sf-warranty')?.value||'',
        payMethod: formWrap.querySelector('#sf-pay')?.value||'',
        date: formWrap.querySelector('#sf-date')?.value||'',
        items: window._saleItems||[],
        subtotal: Number(formWrap.querySelector('#sf-subtotal')?.textContent?.replace(/[^0-9]/g,'')||0),
        extraDiscount: Number(formWrap.querySelector('#sf-extdisc')?.value||0),
        total: Number(formWrap.querySelector('#sf-total')?.textContent?.replace(/[^0-9]/g,'')||0),
        paid: Number(formWrap.querySelector('#sf-paid')?.value?.replace(/[^0-9]/g,'')||0)
      };
      printSaleBill(d);
    };
    if (existing) {
      formWrap.querySelector('#sf-del').onclick = () => showModal({
        title: 'X\u00f3a \u0111\u01a1n h\u00e0ng',
        body: 'X\u00e1c nh\u1eadn x\u00f3a \u0111\u01a1n n\u00e0y?',
        confirmText: 'X\u00f3a',
        onConfirm: async () => {
          await deleteItem(COLLECTION, existing._key);
          formWrap.innerHTML = '';
          editKey = null;
          toast('X\u00f3a th\u00e0nh c\u00f4ng');
        }
      });
    }
  }

  // ===================== ADD ROW =====================
  function addRow(item) {
    item = item || {};
    const tbody = formWrap.querySelector('#sf-rows');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f5f5f5';
    const nm = String(item.name||'').replace(/"/g,'&quot;');
    tr.innerHTML = `
      <td style="padding:.32rem .4rem">
        <input class="rsku form-control" style="font-size:.8rem;width:70px" placeholder="M\u00e3" value="${item.sku||''}">
      </td>
      <td style="padding:.32rem .4rem">
        <input class="rname form-control" style="font-size:.8rem;width:100%" placeholder="G\u00f5 t\u00ean ho\u1eb7c m\u00e3 SP..." value="${nm}" autocomplete="off">
      </td>
      <td style="padding:.32rem .4rem">
        <input class="rqty form-control" type="number" min="1" value="${item.qty||1}" style="text-align:center;font-size:.8rem;width:48px">
      </td>
      <td style="padding:.32rem .4rem">
        <input class="rprice form-control" type="number" min="0" value="${item.price||0}" style="text-align:right;font-size:.8rem;width:100px">
      </td>
      <td style="padding:.32rem .4rem">
        <input class="rdisc form-control" type="number" min="0" max="100" value="${item.disc||0}" style="text-align:center;font-size:.8rem;width:55px">
      </td>
      <td class="rtotal" style="padding:.32rem .4rem;text-align:right;font-weight:600;font-size:.85rem;white-space:nowrap;color:#1a3a6b">0 \u0111</td>
      <td style="padding:.32rem .4rem">
        <button class="rdel" style="background:#ff4d4f;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:.85rem;line-height:1">\u00d7</button>
      </td>
    `;

    const rname  = tr.querySelector('.rname');
    const rsku   = tr.querySelector('.rsku');
    const rprice = tr.querySelector('.rprice');

    function selectProduct(p) {
      rname.value  = p.name  || '';
      rsku.value   = p.id    || '';
      rprice.value = p.price || 0;
      recalc();
    }

    rname.addEventListener('input',  () => showDrop(rname.value.trim(), rname, selectProduct));
    rname.addEventListener('focus',  () => { if (rname.value.trim()) showDrop(rname.value.trim(), rname, selectProduct); });
    rname.addEventListener('blur',   () => setTimeout(() => { if (dropTarget === rname) hideDrop(); }, 200));
    rname.addEventListener('keydown', e => {
      if (e.key === 'Escape') { hideDrop(); }
      if (e.key === 'Enter') {
        if (globalDrop && globalDrop.style.display !== 'none') {
          const first = globalDrop.querySelector('.sp-opt');
          if (first) {
            e.preventDefault();
            const p = invItems.find(x => x._key === first.dataset.key);
            if (p) selectProduct(p);
            hideDrop();
          }
        }
      }
    });

    tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalc));
    tr.querySelector('.rdel').onclick = () => { tr.remove(); recalc(); };
    tbody.appendChild(tr);
    const q = parseFloat(item.qty)||1, p = parseFloat(item.price)||0, dc = parseFloat(item.disc)||0;
    tr.querySelector('.rtotal').textContent = formatVND(q * p * (1 - dc/100));
  }

  // ===================== RECALC =====================
  function recalc() {
    let sub = 0;
    formWrap.querySelectorAll('#sf-rows tr').forEach(tr => {
      const q = parseFloat(tr.querySelector('.rqty')?.value)||0;
      const p = parseFloat(tr.querySelector('.rprice')?.value)||0;
      const d = parseFloat(tr.querySelector('.rdisc')?.value)||0;
      const t = q * p * (1 - d/100);
      const cell = tr.querySelector('.rtotal');
      if (cell) cell.textContent = formatVND(t);
      sub += t;
    });
    const ex = parseFloat(formWrap.querySelector('#sf-extra-disc')?.value)||0;
    const tot = Math.max(0, sub - ex);
    const sel = s => formWrap.querySelector(s);
    if (sel('#sf-subtotal')) sel('#sf-subtotal').textContent = formatVND(sub);
    if (sel('#sf-total')) sel('#sf-total').textContent = formatVND(tot);
  }

  // ===================== SAVE =====================
  async function saveForm() {
    const rows = Array.from(formWrap.querySelectorAll('#sf-rows tr')).map(tr => {
      const q = parseFloat(tr.querySelector('.rqty')?.value)||1;
      const p = parseFloat(tr.querySelector('.rprice')?.value)||0;
      const d = parseFloat(tr.querySelector('.rdisc')?.value)||0;
      return { sku: tr.querySelector('.rsku')?.value||'', name: tr.querySelector('.rname')?.value||'', qty:q, price:p, disc:d, total: q*p*(1-d/100) };
    });
    const sub = rows.reduce((s,r) => s + r.total, 0);
    const ex = parseFloat(formWrap.querySelector('#sf-extra-disc')?.value)||0;
    const tot = Math.max(0, sub - ex);
    const g = id => formWrap.querySelector(id)?.value||'';
    const data = {
      customer: g('#sf-customer'), phone: g('#sf-phone'), note: g('#sf-note'),
      warranty: g('#sf-warranty'), payMethod: g('#sf-paymethod'),
      date: dateFilter.value, items: rows,
      subtotal: sub, extraDiscount: ex, total: tot,
      paid: parseFloat(formWrap.querySelector('#sf-paid')?.value)||0,
      createdAt: Date.now()
    };
    try {
      if (editKey) { await updateItem(COLLECTION, editKey, data); toast('C\u1eadp nh\u1eadt th\u00e0nh c\u00f4ng'); }
      else { await addItem(COLLECTION, data); toast('L\u01b0u \u0111\u01a1n th\u00e0nh c\u00f4ng'); }
      formWrap.innerHTML = ''; editKey = null;
    } catch(e) { toast('L\u1ed7i: ' + e.message); }
  }

  // ===================== LIST =====================
  function renderList(items) {
    currentList = items;
    countEl.textContent = '(' + items.length + ')';
    if (!items.length) {
      listWrap.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem 0">Ch\u01b0a c\u00f3 \u0111\u01a1n n\u00e0o h\u00f4m nay</p>';
      return;
    }
    listWrap.innerHTML = items.map(s => `
      <div class="card" style="background:#fff;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.07);margin-bottom:.75rem;padding:.85rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1">
            <input type="checkbox" class="sale-cb" data-key="${s._key}" style="cursor:pointer;width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600">${s.customer||'Kh\u00e1ch l\u1ebb'}</div>
              <div style="font-size:.78rem;color:#888;margin-top:.15rem">${[s.phone,s.note].filter(Boolean).join(' \u00b7 ')}</div>
            </div>
          </label>
          <div style="text-align:right;flex-shrink:0;margin-left:.5rem">
            <div style="font-weight:700;color:#1a3a6b">${formatVND(s.total||0)}</div>
            <div style="font-size:.72rem;color:#888">${s.payMethod||''}</div>
          </div>
        </div>
        <div class="sale-acts" style="display:none;margin-top:.6rem;padding-top:.6rem;border-top:1px solid #f0f0f0;gap:.5rem">
          <button class="btn-detail btn btn--sm" data-key="${s._key}">\u1ed4 Chi ti\u1ebft</button>
          <button class="btn-edit btn btn--sm btn--primary" data-key="${s._key}">S\u1eeda</button>
          <button class="btn-del btn btn--sm btn--danger" data-key="${s._key}">X\u00f3a</button>
        </div>
      </div>
    `).join('');

    listWrap.querySelectorAll('.sale-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const acts = cb.closest('.card').querySelector('.sale-acts');
        if (acts) acts.style.display = cb.checked ? 'flex' : 'none';
      });
    });

    listWrap.querySelectorAll('.btn-detail').forEach(b => b.onclick = () => {
      const s = currentList.find(x => x._key === b.dataset.key);
      if (!s) return;
      const rhtml = (s.items||[]).map(r =>
        `<tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:.3rem .4rem">${r.sku||''}</td>
          <td style="padding:.3rem .4rem">${r.name||''}</td>
          <td style="padding:.3rem .4rem;text-align:center">${r.qty}</td>
          <td style="padding:.3rem .4rem;text-align:right">${formatVND(r.price)}</td>
          <td style="padding:.3rem .4rem;text-align:center">${r.disc||0}%</td>
          <td style="padding:.3rem .4rem;text-align:right;font-weight:600">${formatVND(r.total||0)}</td>
        </tr>`
      ).join('');
      showModal({ title: 'Chi ti\u1ebft: ' + (s.customer||'Kh\u00e1ch l\u1ebb'),
        body: `<p style="font-size:.85rem;color:#666;margin-bottom:.5rem">\ud83d\udcc5 ${s.date} | ${s.payMethod||''} | BH: ${s.warranty||''}</p>
          <table style="width:100%;font-size:.82rem;border-collapse:collapse">
            <thead><tr style="background:#f8f9fa;font-size:.7rem;text-transform:uppercase">
              <th style="padding:.3rem .4rem;text-align:left">M\u00e3</th><th style="padding:.3rem .4rem;text-align:left">T\u00ean</th>
              <th style="padding:.3rem .4rem;text-align:center">SL</th><th style="padding:.3rem .4rem;text-align:right">\u0110G</th>
              <th style="padding:.3rem .4rem;text-align:center">Gi\u1ea3m</th><th style="padding:.3rem .4rem;text-align:right">TT</th>
            </tr></thead>
            <tbody>${rhtml}</tbody>
          </table>
          <p style="text-align:right;font-weight:700;margin-top:.5rem">T\u1ed5ng: ${formatVND(s.total||0)}</p>`
      });
    });

    listWrap.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => {
      const s = currentList.find(x => x._key === b.dataset.key);
      if (s) { openForm(s); window.scrollTo(0, formWrap.offsetTop - 60); }
    });

    listWrap.querySelectorAll('.btn-del').forEach(b => b.onclick = () => showModal({
      title: 'X\u00f3a \u0111\u01a1n h\u00e0ng', body: 'X\u00e1c nh\u1eadn x\u00f3a?', confirmText: 'X\u00f3a',
      onConfirm: async () => { await deleteItem(COLLECTION, b.dataset.key); toast('X\u00f3a th\u00e0nh c\u00f4ng'); }
    }));
  }

  function loadDate(d) {
    if (unsub) unsub();
    unsub = onSnapshot(COLLECTION, all => renderList(all.filter(s => (s.date||'').startsWith(d))));
  }

  addBtn.onclick = () => { editKey = null; openForm(null); window.scrollTo(0, formWrap.offsetTop - 60); };
  dateFilter.addEventListener('change', () => loadDate(dateFilter.value));

  function printSaleBill(d) {
    var fmt = n => Number(n||0).toLocaleString('vi-VN');
    var rows = (d.items||[]).map(it =>
      '<tr><td style="padding:3px 6px">' + (it.sku||'') + '</td>' +
      '<td style="padding:3px 6px">' + (it.name||'') + '</td>' +
      '<td style="padding:3px 6px;text-align:center">' + (it.qty||1) + '</td>' +
      '<td style="padding:3px 6px;text-align:right">' + fmt(it.price) + '</td>' +
      '<td style="padding:3px 6px;text-align:center">' + (it.disc||0) + '%</td>' +
      '<td style="padding:3px 6px;text-align:right;font-weight:bold">' + fmt(it.qty*it.price*(1-it.disc/100)) + '</td></tr>'
    ).join('');
    var change = Math.max(0, (d.paid||0) - (d.total||0));
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn bán hàng</title>' +
      '<style>body{font-family:Arial,sans-serif;font-size:13px;padding:16px;color:#222}h2{text-align:center;font-size:17px;margin:0 0 2px}.sub{text-align:center;font-size:13px;font-weight:bold;margin-bottom:10px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#f0f0f0;padding:4px 6px;text-align:left;font-size:12px}td{border-bottom:1px solid #eee}.tot{font-weight:bold;font-size:14px}.sign{display:flex;justify-content:space-between;margin-top:24px}.line{border-top:1px solid #333;margin-top:32px;text-align:center;padding-top:4px;font-size:12px;color:#555}</style></head><body>' +
      '<h2>LAPTOP24H</h2><p class="sub">HÓA ĐƠN BÁN HÀNG</p>' +
      '<table><tr><td style="width:50%;padding:2px 0"><strong>KH:</strong> ' + (d.customer||'') + '</td>' +
      '<td style="padding:2px 0"><strong>SĐT:</strong> ' + (d.phone||'') + '</td></tr>' +
      '<tr><td><strong>Ngày:</strong> ' + (d.date||'') + '</td>' +
      '<td><strong>TT:</strong> ' + (d.payMethod||'') + '</td></tr></table>' +
      '<table><thead><tr><th>Mã</th><th>Tên SP</th><th style="text-align:center">SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:center">CK%</th><th style="text-align:right">Thành tiền</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<table><tr><td>Tạm tính</td><td style="text-align:right">' + fmt(d.subtotal) + ' đ</td></tr>' +
      (d.extraDiscount>0?'<tr><td>Giảm thêm</td><td style="text-align:right">-'+fmt(d.extraDiscount)+' đ</td></tr>':'') +
      '<tr class="tot"><td>TỔNG THANH TOÁN</td><td style="text-align:right">' + fmt(d.total) + ' đ</td></tr>' +
      '<tr><td>Khách trả</td><td style="text-align:right">' + fmt(d.paid) + ' đ</td></tr>' +
      '<tr><td>Tiền thừa</td><td style="text-align:right">' + fmt(change) + ' đ</td></tr></table>' +
      (d.warranty?'<p style="font-size:12px;color:#555">Bảo hành: '+d.warranty+'</p>':'') +
      (d.note?'<p style="font-size:12px;color:#555">Ghi chú: '+d.note+'</p>':'') +
      '<div class="sign"><div style="width:45%"><div class="line">Khách hàng</div></div><div style="width:45%"><div class="line">Người bán</div></div></div>' +
      '<div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:6px 20px;cursor:pointer">🖨 In hóa đơn</button></div>' +
      '</body></html>';
    var w = window.open('','_blank','width=620,height=820');
    w.document.write(html); w.document.close();
  }
  loadDate(todayStr);
}
