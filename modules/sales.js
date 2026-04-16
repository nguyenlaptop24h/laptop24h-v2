// modules/sales.js - Bán hàng
import { registerRoute } from '../core/router.js';
import { getAll, addItem, updateItem, deleteItem, onSnapshot, getDB } from '../core/db.js';
import { buildTable, toast, showModal, formatDate, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COLLECTION = 'sales';

registerRoute('#sales', mount);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header">
      <h2>Bán hàng</h2>
      <div class="module-actions">
        <input id="sale-search" type="text" placeholder="Tìm theo khách/bill..." class="search-input" />
        <button id="sale-add" class="btn btn--primary">+ Thêm đơn</button>
      </div>
    </div>
    <div id="sale-table-wrap"></div>
    <div id="sale-form-wrap" class="hidden"></div>
    <div id="sale-detail-wrap" class="hidden"></div>
  `;

  let allData = [];
  let allProducts = [];

  // Load products for autocomplete
  try {
    const db = getDB();
    const snap = await db.ref('products').once('value');
    const val = snap.val() || {};
    allProducts = Object.entries(val).map(([k,v]) => ({ _key: k, ...v }));
  } catch(e) {}

  const unsub = onSnapshot(COLLECTION, items => {
    allData = items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    renderTable(allData);
  });

  container.addEventListener('unmount', () => unsub && unsub());

  document.getElementById('sale-search').addEventListener('input', () => {
    const q = document.getElementById('sale-search').value.toLowerCase();
    const filtered = allData.filter(s =>
      (s.customer||'').toLowerCase().includes(q) ||
      (s.billNo||'').toLowerCase().includes(q) ||
      (s.phone||'').toLowerCase().includes(q)
    );
    renderTable(filtered);
  });

  function renderTable(data) {
    const wrap = document.getElementById('sale-table-wrap');
    if (!data.length) {
      wrap.innerHTML = '<p style="padding:1rem;color:#888">Không có dữ liệu</p>';
      return;
    }
    const cols = [
      { label: 'Số bill',      key: s => s.billNo || '' },
      { label: 'Ngày',         key: s => s.date || formatDate(s.ts) },
      { label: 'Khách hàng',   key: s => s.customer || '' },
      { label: 'SĐT',          key: s => s.phone || '' },
      { label: 'Mặt hàng',     key: s => {
          const items = s.items || [];
          if (!items.length) return '';
          if (items.length === 1) return items[0].name || '';
          return items[0].name + ` (+${items.length-1})`;
        }
      },
      { label: 'Tổng tiền',    key: s => formatVND(s.total || 0) },
      { label: 'Đã trả',       key: s => formatVND(s.paid || 0) },
      { label: 'Còn lại',      key: s => {
          const rem = (s.total||0) - (s.paid||0);
          return rem > 0
            ? `<span style="color:#e53e3e">${formatVND(rem)}</span>`
            : `<span style="color:#38a169">${formatVND(0)}</span>`;
        }
      },
      { label: 'TT',           key: s => s.paymethod || '' },
      { label: '',             key: s => `
        <button class="btn btn--sm btn--secondary sale-view" data-key="${s._key}">Chi tiết</button>
        <button class="btn btn--sm btn--secondary sale-edit" data-key="${s._key}">Sửa</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger sale-del" data-key="${s._key}">Xóa</button>` : ''}
      `}
    ];
    wrap.innerHTML = buildTable(cols, data);
    wrap.querySelectorAll('.sale-view').forEach(btn =>
      btn.addEventListener('click', () => showDetail(data.find(s => s._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.sale-edit').forEach(btn =>
      btn.addEventListener('click', () => openForm(data.find(s => s._key === btn.dataset.key)))
    );
    wrap.querySelectorAll('.sale-del').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.key))
    );
  }

  function showDetail(sale) {
    const detailWrap = document.getElementById('sale-detail-wrap');
    detailWrap.classList.remove('hidden');
    const items = sale.items || [];
    const rowsHtml = items.map(it => `
      <tr>
        <td>${it.code||''}</td>
        <td>${it.name||''}</td>
        <td style="text-align:right">${it.qty||1}</td>
        <td>${it.unit||''}</td>
        <td style="text-align:right">${formatVND(it.price||0)}</td>
        <td style="text-align:right">${formatVND(it.disc||0)}</td>
        <td style="text-align:right">${formatVND((it.price||0)*(it.qty||1)-(it.disc||0))}</td>
        <td>${it.prodWarranty||0} tháng</td>
      </tr>
    `).join('');
    detailWrap.innerHTML = `
      <div class="form-card">
        <h3>Chi tiết đơn hàng - ${sale.billNo||''}</h3>
        <div class="form-grid" style="margin-bottom:1rem">
          <div><strong>Khách:</strong> ${sale.customer||''}</div>
          <div><strong>SĐT:</strong> ${sale.phone||''}</div>
          <div><strong>Ngày:</strong> ${sale.date||''}</div>
          <div><strong>TT:</strong> ${sale.paymethod||''}</div>
          <div><strong>BH máy:</strong> ${sale.warranty||0} tháng</div>
          <div><strong>Ghi chú:</strong> ${sale.note||''}</div>
        </div>
        <table class="data-table" style="margin-bottom:1rem">
          <thead><tr>
            <th>Mã</th><th>Tên SP</th><th>SL</th><th>ĐVT</th>
            <th>Đơn giá</th><th>CK</th><th>Thành tiền</th><th>BH</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="text-align:right">
          <div>Tạm tính: <strong>${formatVND(sale.subtotal||sale.total||0)}</strong></div>
          ${sale.extraDiscount ? `<div>Giảm thêm: <strong>-${formatVND(sale.extraDiscount)}</strong></div>` : ''}
          <div>Tổng: <strong style="color:#2b6cb0">${formatVND(sale.total||0)}</strong></div>
          <div>Khách trả: <strong>${formatVND(sale.paid||0)}</strong></div>
          <div>Tiền thừa: <strong>${formatVND(sale.change||0)}</strong></div>
        </div>
        <div class="form-actions">
          <button id="detail-close" class="btn btn--secondary">Đóng</button>
        </div>
      </div>
    `;
    document.getElementById('detail-close').addEventListener('click', () => {
      detailWrap.classList.add('hidden');
      detailWrap.innerHTML = '';
    });
  }

  document.getElementById('sale-add').addEventListener('click', () => openForm(null));

  function openForm(record) {
    const wrap = document.getElementById('sale-form-wrap');
    wrap.classList.remove('hidden');
    const items = record?.items ? [...record.items] : [{ id: Date.now(), code:'', name:'', qty:1, unit:'Cái', price:0, disc:0, prodWarranty:0 }];

    function renderForm() {
      const itemRows = items.map((it, i) => `
        <tr data-idx="${i}">
          <td><input class="item-code" type="text" value="${it.code||''}" placeholder="Mã SP" style="width:80px" /></td>
          <td><input class="item-name" type="text" value="${it.name||''}" placeholder="Tên sản phẩm" style="width:180px" /></td>
          <td><input class="item-qty"  type="number" value="${it.qty||1}" min="1" style="width:55px" /></td>
          <td><input class="item-unit" type="text" value="${it.unit||'Cái'}" style="width:50px" /></td>
          <td><input class="item-price" type="number" value="${it.price||0}" style="width:100px" /></td>
          <td><input class="item-disc"  type="number" value="${it.disc||0}" style="width:80px" /></td>
          <td><input class="item-pw"   type="number" value="${it.prodWarranty||0}" style="width:55px" /></td>
          <td><button class="btn btn--sm btn--danger item-remove" data-i="${i}">✕</button></td>
        </tr>
      `).join('');

      wrap.innerHTML = `
        <div class="form-card">
          <h3>${record ? 'Cập nhật đơn hàng' : 'Thêm đơn hàng'}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Số bill</label>
              <input id="f-billNo" type="text" value="${record?.billNo||''}" placeholder="Tự động nếu để trống" />
            </div>
            <div class="form-group">
              <label>Ngày bán</label>
              <input id="f-date" type="date" value="${record?.date ? record.date.split('/').reverse().join('-') : new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="form-group">
              <label>Khách hàng *</label>
              <input id="f-customer" type="text" value="${record?.customer||''}" />
            </div>
            <div class="form-group">
              <label>SĐT</label>
              <input id="f-phone" type="text" value="${record?.phone||''}" />
            </div>
            <div class="form-group">
              <label>Hình thức TT</label>
              <select id="f-paymethod">
                ${['Tiền mặt','Chuyển khoản','Công nợ'].map(p =>
                  `<option ${record?.paymethod===p?'selected':''}>${p}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>BH máy (tháng)</label>
              <input id="f-warranty" type="number" value="${record?.warranty||0}" />
            </div>
            <div class="form-group">
              <label>Giảm thêm (đ)</label>
              <input id="f-extraDiscount" type="number" value="${record?.extraDiscount||0}" />
            </div>
            <div class="form-group">
              <label>Khách trả (đ)</label>
              <input id="f-paid" type="number" value="${record?.paid||0}" />
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Ghi chú</label>
              <input id="f-note" type="text" value="${record?.note||''}" />
            </div>
          </div>
          <h4 style="margin:.75rem 0 .25rem">Sản phẩm</h4>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr>
                <th>Mã</th><th>Tên SP</th><th>SL</th><th>ĐVT</th>
                <th>Giá (đ)</th><th>CK (đ)</th><th>BH(th)</th><th></th>
              </tr></thead>
              <tbody id="item-tbody">${itemRows}</tbody>
            </table>
          </div>
          <button id="item-add-row" class="btn btn--secondary" style="margin-top:.5rem">+ Thêm dòng</button>
          <div id="f-total-display" style="text-align:right;margin-top:.5rem;font-weight:600"></div>
          <div class="form-actions">
            <button id="f-save" class="btn btn--primary">${record ? 'Cập nhật' : 'Lưu đơn'}</button>
            <button id="f-cancel" class="btn btn--secondary">Hủy</button>
          </div>
        </div>
      `;

      updateTotal();

      wrap.querySelectorAll('.item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          items.splice(parseInt(btn.dataset.i), 1);
          if (!items.length) items.push({ id: Date.now(), code:'', name:'', qty:1, unit:'Cái', price:0, disc:0, prodWarranty:0 });
          renderForm();
        });
      });

      wrap.querySelector('#item-add-row').addEventListener('click', () => {
        items.push({ id: Date.now(), code:'', name:'', qty:1, unit:'Cái', price:0, disc:0, prodWarranty:0 });
        renderForm();
      });

      wrap.querySelectorAll('#item-tbody input').forEach(inp => {
        inp.addEventListener('input', () => syncItemsFromDOM());
      });

      document.getElementById('f-extraDiscount')?.addEventListener('input', updateTotal);
      document.getElementById('f-paid')?.addEventListener('input', updateTotal);

      document.getElementById('f-cancel').addEventListener('click', () => {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      });

      document.getElementById('f-save').addEventListener('click', () => saveForm());
    }

    function syncItemsFromDOM() {
      wrap.querySelectorAll('#item-tbody tr').forEach((row, i) => {
        if (!items[i]) return;
        items[i].code    = row.querySelector('.item-code').value.trim();
        items[i].name    = row.querySelector('.item-name').value.trim();
        items[i].qty     = parseFloat(row.querySelector('.item-qty').value) || 1;
        items[i].unit    = row.querySelector('.item-unit').value.trim();
        items[i].price   = parseFloat(row.querySelector('.item-price').value) || 0;
        items[i].disc    = parseFloat(row.querySelector('.item-disc').value) || 0;
        items[i].prodWarranty = parseInt(row.querySelector('.item-pw').value) || 0;
      });
      updateTotal();
    }

    function updateTotal() {
      syncItemsFromDOM();
      const subtotal = items.reduce((sum, it) => sum + (it.price||0)*(it.qty||1) - (it.disc||0), 0);
      const extraDiscount = parseFloat(document.getElementById('f-extraDiscount')?.value) || 0;
      const total = subtotal - extraDiscount;
      const paid  = parseFloat(document.getElementById('f-paid')?.value) || 0;
      const change = paid - total;
      const el = document.getElementById('f-total-display');
      if (el) el.innerHTML = `Tạm tính: ${formatVND(subtotal)} | Tổng: ${formatVND(total)} | Tiền thừa: ${formatVND(change)}`;
    }

    async function saveForm() {
      syncItemsFromDOM();
      const customer = document.getElementById('f-customer').value.trim();
      if (!customer) { toast('Vui lòng nhập khách hàng', 'error'); return; }
      const validItems = items.filter(it => it.name);
      if (!validItems.length) { toast('Vui lòng nhập ít nhất 1 sản phẩm', 'error'); return; }

      const dateVal = document.getElementById('f-date').value;
      const dateStr = dateVal ? dateVal.split('-').reverse().join('/') : '';
      const extraDiscount = parseFloat(document.getElementById('f-extraDiscount').value) || 0;
      const subtotal = validItems.reduce((s, it) => s + (it.price||0)*(it.qty||1) - (it.disc||0), 0);
      const total = subtotal - extraDiscount;
      const paid  = parseFloat(document.getElementById('f-paid').value) || 0;

      const data = {
        billNo:       document.getElementById('f-billNo').value.trim() || (dateStr.replace(/\//g,'') + '-' + Math.floor(Math.random()*90+10)),
        date:         dateStr,
        customer,
        phone:        document.getElementById('f-phone').value.trim(),
        items:        validItems,
        subtotal,
        extraDiscount,
        total,
        paid,
        change:       paid - total,
        paymethod:    document.getElementById('f-paymethod').value,
        warranty:     parseInt(document.getElementById('f-warranty').value) || 0,
        note:         document.getElementById('f-note').value.trim(),
        ts:           record?.ts || Date.now()
      };
      try {
        if (record) {
          await updateItem(COLLECTION, record._key, data);
          toast('Đã cập nhật đơn hàng');
        } else {
          await addItem(COLLECTION, data);
          toast('Đã thêm đơn hàng');
        }
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      } catch(e) {
        toast('Lỗi: ' + e.message, 'error');
      }
    }

    renderForm();
  }

  async function confirmDelete(key) {
    const ok = await showModal('Xác nhận', 'Xóa đơn hàng này?', true);
    if (!ok) return;
    try {
      await deleteItem(COLLECTION, key);
      toast('Đã xóa đơn hàng');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  }
}
