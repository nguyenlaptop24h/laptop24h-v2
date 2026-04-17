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

  // ===================== FORM =====================
  function openForm(existing) {
    editKey = existing ? existing._key : null;
    const d = existing || {};
    const rows = (d.items && d.items.length) ? d.items : [{ sku:'', name:'', qty:1, price:0, disc:0 }];

    const warranties = ['Kh\u00f4ng b\u1ea3o h\u00e0nh','1 th\u00e1ng','3 th\u00e1ng','6 th\u00e1ng','12 th\u00e1ng','18 th\u00e1ng','24 th\u00e1ng'];
    const wOpts = warranties.map(w => `<option value="${w}"${(d.warranty||'3 th\u00e1ng')===w?' selected':''}>${w}</option>`).join('');

    const pays = ['Ti\u1ec1n m\u1eb7t','Chuy\u1ec3n kho\u1ea3n','Qu\u1eb9t th\u1ebc'];
    const pOpts = pays.map(p => `<option value="${p}"${(d.payMethod||'Ti\u1ec1n m\u1eb7t')===p?' selected':''}>${p}</option>`).join('');

    formWrap.innerHTML = `
      <div style="padding:0 1rem">
      <div style="background:#fff;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.09);margin-bottom:1rem;overflow:hidden">

        <div style="padding:1rem 1.25rem;border-bottom:1px solid #eee">
          <div style="font-weight:700;color:#1a73e8;margin-bottom:.85rem;font-size:.95rem">\ud83d\udc64 Th\u00f4ng tin kh\u00e1ch h\u00e0ng</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem">
            <div>
              <div style="font-size:.7rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:.3rem">Kh\u00e1ch h\u00e0ng</div>
              <input id="sf-customer" class="form-control" placeholder="T\u00ean ho\u1eb7c t\u00ecm KH m\u1edbi..." value="${d.customer||''}">
            </div>
            <div>
              <div style="font-size:.7rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:.3rem">S\u1ed1 \u0111i\u1ec7n tho\u1ea1i</div>
              <input id="sf-phone" class="form-control" placeholder="0xxx xxx xxx" value="${d.phone||''}">
            </div>
            <div>
              <div style="font-size:.7rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:.3rem">Ghi ch\u00fa \u0111\u01a1n</div>
              <input id="sf-note" class="form-control" placeholder="B\u1ea3o h\u00e0nh, giao h\u00e0ng..." value="${d.note||''}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem">
            <div>
              <div style="font-size:.7rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:.3rem">B\u1ea3o h\u00e0nh</div>
              <select id="sf-warranty" class="form-control">${wOpts}</select>
            </div>
            <div>
              <div style="font-size:.7rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:.3rem">H\u00ecnh th\u1ee9c thanh to\u00e1n</div>
              <select id="sf-paymethod" class="form-control">${pOpts}</select>
            </div>
          </div>
        </div>

        <div style="padding:1rem 1.25rem;border-bottom:1px solid #eee">
          <div style="font-weight:700;color:#1a73e8;margin-bottom:.85rem;font-size:.95rem">\ud83d\uded2 Danh s\u00e1ch s\u1ea3n ph\u1ea9m</div>
          <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.85rem;min-width:580px">
            <thead>
              <tr style="background:#f8f9fa">
                <th style="padding:.45rem .4rem;text-align:left;width:80px;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase;white-space:nowrap">M\u00e3 SP</th>
                <th style="padding:.45rem .4rem;text-align:left;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase">T\u00ean SP</th>
                <th style="padding:.45rem .4rem;text-align:center;width:55px;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase">SL</th>
                <th style="padding:.45rem .4rem;text-align:right;width:110px;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase;white-space:nowrap">\u0110\u01a1n gi\u00e1</th>
                <th style="padding:.45rem .4rem;text-align:center;width:65px;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase;white-space:nowrap">G.Gi\u00e1%</th>
                <th style="padding:.45rem .4rem;text-align:right;width:110px;font-size:.7rem;color:#666;font-weight:700;text-transform:uppercase;white-space:nowrap">Th\u00e0nh ti\u1ec1n</th>
                <th style="width:32px"></th>
              </tr>
            </thead>
            <tbody id="sf-rows"></tbody>
          </table>
          </div>
          <button id="sf-add-row" style="margin-top:.6rem;background:none;border:1px dashed #bbb;color:#555;padding:.32rem .75rem;border-radius:6px;cursor:pointer;font-size:.82rem">+ Th\u00eam d\u00f2ng</button>
        </div>

        <div style="padding:1rem 1.25rem;border-bottom:1px solid #eee">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0">
            <span style="color:#555;font-size:.9rem">T\u1ed5ng ti\u1ec1n h\u00e0ng</span>
            <span id="sf-subtotal" style="font-weight:600;font-size:.9rem">0 \u0111</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0">
            <span style="color:#555;font-size:.9rem">Gi\u1ea3m gi\u00e1 th\u00eam (\u0111)</span>
            <input id="sf-extra-disc" type="number" min="0" value="${d.extraDiscount||0}" style="width:130px;text-align:right;border:1px solid #ddd;border-radius:6px;padding:.3rem .5rem;font-size:.9rem">
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#1a3a6b;color:#fff;padding:.8rem 1rem;border-radius:8px;margin:.5rem 0">
            <span style="font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:.88rem">T\u1ed4NG THANH TO\u00c1N</span>
            <span id="sf-total" style="font-weight:700;font-size:1.1rem">0 \u0111</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0">
            <span style="color:#555;font-size:.9rem">Kh\u00e1ch tr\u1ea3 (\u0111)</span>
            <input id="sf-paid" type="number" min="0" value="${d.paid||0}" style="width:130px;text-align:right;border:1px solid #ddd;border-radius:6px;padding:.3rem .5rem;font-size:.9rem">
          </div>
        </div>

        <div style="padding:1rem 1.25rem;display:flex;gap:.75rem;align-items:center">
          <button id="sf-print" style="flex:1;background:#2ecc71;color:#fff;border:none;padding:.78rem;border-radius:8px;font-weight:600;cursor:pointer;font-size:.92rem">\ud83d\udda8 In Bill + BH</button>
          <button id="sf-save" style="flex:1;background:#1a3a6b;color:#fff;border:none;padding:.78rem;border-radius:8px;font-weight:600;cursor:pointer;font-size:.92rem">\ud83d\udcbe L\u01b0u \u0110\u01a1n H\u00e0ng</button>
          ${existing ? '<button id="sf-del" style="background:none;border:1px solid #ddd;border-radius:8px;padding:.78rem .95rem;cursor:pointer;font-size:1.1rem;color:#999">\ud83d\uddd1</button>' : ''}
        </div>
      </div>
      </div>
    `;

    rows.forEach(r => addRow(r));
    recalc();

    formWrap.querySelector('#sf-add-row').onclick = () => { addRow({}); recalc(); };
    formWrap.querySelector('#sf-extra-disc').oninput = recalc;
    formWrap.querySelector('#sf-save').onclick = saveForm;
    formWrap.querySelector('#sf-print').onclick = () => toast('Ch\u1ee9c n\u0103ng in \u0111ang ph\u00e1t tri\u1ec3n');
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
    if (\!tbody) return;
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f5f5f5';
    const nm = String(item.name||'').replace(/"/g,'&quot;');
    tr.innerHTML = `
      <td style="padding:.32rem .4rem">
        <input class="rsku form-control" style="font-size:.8rem;width:70px" placeholder="M\u00e3" value="${item.sku||''}">
      </td>
      <td style="padding:.32rem .4rem;position:relative">
        <input class="rname form-control" style="font-size:.8rem;width:100%" placeholder="G\u00f5 t\u00ean ho\u1eb7c m\u00e3 SP..." value="${nm}" autocomplete="off">
        <div class="sp-drop" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #1a73e8;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9999;max-height:220px;overflow-y:auto"></div>
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
    const drop   = tr.querySelector('.sp-drop');

    function selectProduct(p) {
      rname.value  = p.name  || '';
      rsku.value   = p.id    || '';
      rprice.value = p.price || 0;
      drop.style.display = 'none';
      recalc();
    }

    function showDrop(q) {
      if (\!q) { drop.style.display = 'none'; return; }
      const ql = q.toLowerCase();
      const hits = invItems.filter(p =>
        (p.name||'').toLowerCase().includes(ql) ||
        String(p.id||'').toLowerCase().includes(ql)
      ).slice(0, 10);
      if (\!hits.length) { drop.style.display = 'none'; return; }
      drop.innerHTML = hits.map(p => `
        <div class="sp-opt" data-key="${p._key}"
          style="padding:.45rem .7rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;gap:.5rem">
          <div style="min-width:0">
            <div style="font-size:.82rem;font-weight:600;white-space:nowraw;overflow:hidden;text-overflow:ellipsis">${p.name||''}</div>
            <div style="font-size:.72rem;color:#888">${p.id||''} ${p.unit ? '· '+p.unit : ''}</div>
          </div>
          <div style="font-size:.8rem;font-weight:700;color:#1a3a6b;white-space:nowrap;flex-shrink:0">${formatVND(p.price||0)}</div>
        </div>`).join('');
      drop.querySelectorAll('.sp-opt').forEach(opt => {
        opt.addEventListener('mousedown', e => {
          e.preventDefault();
          const p = invItems.find(x => x._key === opt.dataset.key);
          if (p) selectProduct(p);
        });
        opt.addEventListener('mouseover', () => { opt.style.background = '#f0f6ff'; });
        opt.addEventListener('mouseout',  () => { opt.style.background = ''; });
      });
      drop.style.display = 'block';
    }

    rname.addEventListener('input',  () => showDrop(rname.value.trim()));
    rname.addEventListener('focus',  () => { if (rname.value.trim()) showDrop(rname.value.trim()); });
    rname.addEventListener('blur',   () => setTimeout(() => { drop.style.display = 'none'; }, 200));
    rname.addEventListener('keydown', e => {
      if (e.key === 'Escape') { drop.style.display = 'none'; }
      if (e.key === 'Enter') {
        const first = drop.querySelector('.sp-opt');
        if (first && drop.style.display \!== 'none') {
          e.preventDefault();
          const p = invItems.find(x => x._key === first.dataset.key);
          if (p) selectProduct(p);
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
    if (\!items.length) {
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
      if (\!s) return;
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
  loadDate(todayStr);
}
