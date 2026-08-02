// modules/inventory.js - Kho hàng (thiết kế lại: 1 màn, KPI, cảnh báo trùng + gộp, lịch sử bán)
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatVND, showContextMenu } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

const COL_PRODUCTS   = 'products';
const COL_CATEGORIES = 'categories';
const COL_SALES      = 'sales';
const LOW_MAX        = 3;   // tồn ≤ 3 = sắp hết; = 0 = hết hàng

registerRoute('#inventory', mount);

const _norm = s => (s || '').toString().toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
const _fmtInt = n => (Number(n) || 0).toLocaleString('vi-VN');
const _ym = d => (d || '').slice(0, 7);

export async function mount(container) {
  container.innerHTML = `
    <div class="module-header"><h2>Kho hàng</h2></div>
    <div id="inv-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px"></div>
    <div id="inv-dup"></div>
    <div style="display:flex;gap:12px;align-items:flex-start;height:calc(100vh - 250px);min-height:360px">
      <div style="flex:0 0 210px;min-width:0;height:100%;display:flex;flex-direction:column">
        <div id="inv-tree" style="flex:1;overflow-y:auto;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem"></div>
        <button id="cat-add" class="btn btn--secondary btn--sm" style="width:100%;margin-top:.5rem;flex:none">+ Thêm danh mục gốc</button>
        <div id="cat-form-wrap" style="flex:none"></div>
      </div>
      <div style="flex:1;min-width:0;height:100%;display:flex;flex-direction:column">
        <div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center;flex:none">
          <input id="inv-search" type="text" placeholder="🔍 Tìm sản phẩm theo tên hoặc mã..." class="search-input" style="flex:1;min-width:180px" />
          <button id="inv-add" class="btn btn--primary btn--sm">+ Thêm sản phẩm</button>
        </div>
        <div id="inv-chips" style="display:flex;gap:.4rem;margin-bottom:.5rem;font-size:.8rem;flex:none"></div>
        <div id="inv-table-wrap" style="flex:1;overflow-y:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff"></div>
        <div style="font-size:.75rem;color:#94a3b8;margin-top:.4rem;flex:none">Bấm 1 dòng để xem lịch sử bán · chuột phải để Sửa / Chuyển danh mục / Gộp / Xóa</div>
      </div>
    </div>
  `;

  let allProducts = [];
  let allCategories = [];
  let allSales = [];
  let salesStats = {};        // invkey -> {total, month:{ym:qty}, last}
  const openFolders = new Set();
  let selectedCatKey = null;  // null = tất cả
  let stockFilter = 'all';    // all | low | out
  let expandedKey = null;
  let searchQ = '';

  // ─────────────── HELPERS DANH MỤC ───────────────
  function getCatFullName(cat) {
    const parts = [cat.name]; let cur = cat;
    while (cur && cur.parentKey) {
      const parent = allCategories.find(c => c._key === cur.parentKey);
      if (!parent) break; parts.unshift(parent.name); cur = parent;
    }
    return parts.join(' › ');
  }
  function buildCatOptions(parentKey, depth) {
    const indent = '　'.repeat(depth);
    return allCategories.filter(c => (c.parentKey || null) === (parentKey || null))
      .map(c => `<option value="${c._key}">${indent}${c.name}</option>` + buildCatOptions(c._key, depth + 1)).join('');
  }
  function getDescendantKeys(key) {
    const out = [], q = [key];
    while (q.length) { const cur = q.shift(); allCategories.filter(c => c.parentKey === cur).forEach(c => { out.push(c._key); q.push(c._key); }); }
    return out;
  }
  function getAllKeysUnder(key) { return new Set([key, ...getDescendantKeys(key)]); }
  function countUnder(key) {
    const keys = getAllKeysUnder(key);
    return allProducts.filter(p => keys.has(p.categoryKey)).length;
  }

  // ─────────────── SALES STATS ───────────────
  function computeSalesStats() {
    salesStats = {};
    for (const s of allSales) {
      if (s.deletedAt) continue;
      const d = s.date || (s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '');
      const ym = _ym(d);
      for (const it of (s.items || [])) {
        const k = it.invkey; if (!k) continue;
        const q = Number(it.qty) || 0;
        const st = salesStats[k] || (salesStats[k] = { total: 0, month: {}, last: '' });
        st.total += q;
        if (ym) st.month[ym] = (st.month[ym] || 0) + q;
        if (d > st.last) st.last = d;
      }
    }
  }
  function last6Months() {
    const arr = [], now = new Date();
    for (let i = 5; i >= 0; i--) { const dt = new Date(now.getFullYear(), now.getMonth() - i, 1); arr.push(dt.toISOString().slice(0, 7)); }
    return arr;
  }
  function trendOf(st) {
    if (!st) return 0;
    const ms = last6Months();
    const recent = ms.slice(3).reduce((s, m) => s + (st.month[m] || 0), 0);
    const older = ms.slice(0, 3).reduce((s, m) => s + (st.month[m] || 0), 0);
    if (recent > older) return 1; if (recent < older) return -1; return 0;
  }

  // ─────────────── KPI ───────────────
  function renderKPIs() {
    const scoped = selectedCatKey ? (() => { const keys = getAllKeysUnder(selectedCatKey); return allProducts.filter(p => keys.has(p.categoryKey)); })() : allProducts;
    const totalProd = scoped.length;
    const totalStock = scoped.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const value = scoped.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0);
    const low = scoped.filter(p => { const n = Number(p.stock) || 0; return n > 0 && n <= LOW_MAX; }).length;
    const out = scoped.filter(p => (Number(p.stock) || 0) <= 0).length;
    const scopeName = selectedCatKey ? (allCategories.find(c => c._key === selectedCatKey)?.name || '') : '';
    const card = (label, val, bg, fg) => `<div style="background:${bg || '#f1f5f9'};border-radius:10px;padding:.6rem .75rem">
      <div style="font-size:12px;color:${fg ? fg : '#64748b'}">${label}</div>
      <div style="font-size:21px;font-weight:600;color:${fg || '#0f172a'}">${val}</div></div>`;
    container.querySelector('#inv-kpis').innerHTML =
      card(scopeName ? 'SP · ' + scopeName : 'Tổng sản phẩm', _fmtInt(totalProd)) +
      card('Tổng tồn kho', _fmtInt(totalStock)) +
      card('Giá trị tồn (vốn)', formatVND(value)) +
      card('Sắp hết', _fmtInt(low), '#fef3c7', '#b45309') +
      card('Hết hàng', _fmtInt(out), '#fee2e2', '#b91c1c');
  }

  // ─────────────── CẢNH BÁO TRÙNG ───────────────
  function dupGroups() {
    const byName = {}, byId = {};
    allProducts.forEach(p => {
      const nk = _norm(p.name); if (nk) (byName[nk] = byName[nk] || []).push(p);
      const idk = (p.id || '').trim().toLowerCase(); if (idk) (byId[idk] = byId[idk] || []).push(p);
    });
    const uniq = {};
    [...Object.values(byName), ...Object.values(byId)].forEach(g => {
      if (g.length > 1) { const k = g.map(p => p._key).sort().join('|'); uniq[k] = g; }
    });
    return Object.values(uniq);
  }
  function renderDupBanner() {
    const wrap = container.querySelector('#inv-dup');
    const groups = dupGroups();
    if (!groups.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:.55rem .8rem;margin-bottom:12px">
      <span style="font-size:18px">📋</span>
      <span style="font-size:13px;color:#b45309;flex:1">Phát hiện <b>${groups.length}</b> nhóm sản phẩm có thể trùng lặp</span>
      <button id="inv-dup-btn" class="btn btn--sm" style="background:#f59e0b;color:#fff;border-color:#d97706">Xem &amp; gộp</button></div>`;
    wrap.querySelector('#inv-dup-btn').addEventListener('click', openMergeModal);
  }

  function openMergeModal() {
    const groups = dupGroups();
    if (!groups.length) { toast('Không còn nhóm trùng', 'success'); return; }
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
    const groupHtml = groups.map((g, gi) => {
      const rows = g.map((p, pi) => {
        const st = salesStats[p._key];
        return `<label style="display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:.85rem">
          <input type="radio" name="keep${gi}" value="${p._key}" ${pi === 0 ? 'checked' : ''} />
          <span style="flex:1"><b>${p.name || '?'}</b> <span style="color:#94a3b8">${p.id || ''}</span></span>
          <span style="color:#334155">Tồn: <b>${_fmtInt(p.stock || 0)}</b></span>
          <span style="color:#16a34a">Đã bán: ${_fmtInt(st ? st.total : 0)}</span>
        </label>`;
      }).join('');
      return `<div class="dup-group" data-gi="${gi}" style="border:1px solid #e2e8f0;border-radius:8px;padding:.6rem;margin-bottom:.7rem">
        <div style="font-size:.8rem;color:#64748b;margin-bottom:.4rem">Nhóm ${gi + 1} — chọn sản phẩm GIỮ LẠI (tồn kho sẽ cộng dồn, lịch sử bán chuyển về SP giữ lại)</div>
        ${rows}
        <div style="text-align:right"><button class="dup-merge-btn btn btn--sm btn--primary" data-gi="${gi}">Gộp nhóm này</button></div>
      </div>`;
    }).join('');
    ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.2rem;width:min(620px,95vw);max-height:88vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem">
        <h3 style="margin:0">Gộp sản phẩm trùng lặp</h3>
        <button id="dup-close" style="background:#f1f5f9;border:none;width:30px;height:30px;border-radius:8px;cursor:pointer">✕</button>
      </div>
      ${groupHtml}
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#dup-close').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelectorAll('.dup-merge-btn').forEach(btn => btn.addEventListener('click', async () => {
      const gi = Number(btn.dataset.gi);
      const g = groups[gi];
      const keepKey = ov.querySelector(`input[name="keep${gi}"]:checked`)?.value;
      if (!keepKey) return;
      const dropKeys = g.map(p => p._key).filter(k => k !== keepKey);
      if (!dropKeys.length) return;
      btn.disabled = true; btn.textContent = 'Đang gộp...';
      try { await mergeProducts(keepKey, dropKeys); toast('Đã gộp ' + (dropKeys.length + 1) + ' sản phẩm', 'success'); close(); setTimeout(openMergeModal, 400); }
      catch (e) { toast('Lỗi: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'Gộp nhóm này'; }
    }));
  }

  async function mergeProducts(keepKey, dropKeys) {
    const keep = allProducts.find(p => p._key === keepKey); if (!keep) return;
    const dropSet = new Set(dropKeys);
    let addStock = 0;
    dropKeys.forEach(k => { const p = allProducts.find(x => x._key === k); if (p) addStock += Number(p.stock) || 0; });
    // Chuyển lịch sử bán (invkey) về sản phẩm giữ lại
    const salesToFix = allSales.filter(s => !s.deletedAt && (s.items || []).some(it => dropSet.has(it.invkey)));
    for (const s of salesToFix) {
      const items = (s.items || []).map(it => dropSet.has(it.invkey) ? { ...it, invkey: keepKey } : it);
      await updateItem(COL_SALES, s._key, { items });
    }
    await updateItem(COL_PRODUCTS, keepKey, { stock: (Number(keep.stock) || 0) + addStock });
    for (const k of dropKeys) await updateItem(COL_PRODUCTS, k, { deletedAt: Date.now() });
  }

  // ─────────────── CÂY DANH MỤC ───────────────
  function renderTree() {
    const el = container.querySelector('#inv-tree');
    const totalAll = allProducts.length;
    const rowAll = `<div class="cat-all" style="display:flex;justify-content:space-between;padding:.35rem .5rem;border-radius:6px;cursor:pointer;font-size:.86rem;font-weight:600;${selectedCatKey === null ? 'background:#dbeafe;color:#1d4ed8' : ''}"><span>📦 Tất cả</span><span style="color:#94a3b8">${totalAll}</span></div>`;
    const roots = allCategories.filter(c => !c.parentKey);
    const treeHtml = roots.length ? roots.map(c => renderNode(c, 0)).join('')
      : '<div style="color:#94a3b8;font-size:.8rem;padding:.4rem .5rem">Chưa có danh mục</div>';
    el.innerHTML = rowAll + treeHtml;

    el.querySelector('.cat-all')?.addEventListener('click', () => { selectedCatKey = null; renderTree(); renderTable(); renderKPIs(); });
    el.querySelectorAll('.cat-row').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('button,.cat-arrow')) return;
      selectedCatKey = row.dataset.key; renderTree(); renderTable(); renderKPIs();
    }));
    el.querySelectorAll('.cat-arrow').forEach(a => a.addEventListener('click', e => {
      e.stopPropagation(); const k = a.dataset.key;
      if (openFolders.has(k)) openFolders.delete(k); else openFolders.add(k); renderTree();
    }));
  }
  function renderNode(cat, depth) {
    const children = allCategories.filter(c => c.parentKey === cat._key);
    const isOpen = openFolders.has(cat._key);
    const pl = depth * 14 + 6;
    const arrow = children.length ? `<span class="cat-arrow" data-key="${cat._key}" style="width:14px;display:inline-block;color:#64748b;cursor:pointer">${isOpen ? '▾' : '▸'}</span>` : '<span style="width:14px;display:inline-block"></span>';
    const sel = selectedCatKey === cat._key ? 'background:#dbeafe;color:#1d4ed8;' : '';
    let body = '';
    if (isOpen) children.forEach(c => { body += renderNode(c, depth + 1); });
    return `<div class="cat-row" data-key="${cat._key}" style="display:flex;align-items:center;gap:.2rem;padding:.32rem .4rem .32rem ${pl}px;border-radius:6px;cursor:pointer;font-size:.84rem;${sel}">
      ${arrow}
      <span style="flex:1;font-weight:${depth === 0 ? 600 : 400}">${cat.name}</span>
      <span style="font-size:.72rem;color:#94a3b8;background:#e2e8f0;border-radius:9px;padding:0 6px">${countUnder(cat._key)}</span>
    </div>${body}`;
  }

  function openCatForm(key, defaultParentKey) {
    if (!isAdmin()) { toast('Chỉ quản trị viên', 'error'); return; }
    const cat = key ? (allCategories.find(c => c._key === key) || {}) : {};
    const excluded = key ? [...getDescendantKeys(key), key] : [];
    const parentOpts = '<option value="">— Danh mục gốc —</option>' +
      allCategories.filter(c => !excluded.includes(c._key)).map(c => `<option value="${c._key}">${getCatFullName(c)}</option>`).join('');
    const setParent = defaultParentKey || (key ? cat.parentKey : null);
    const parentSel = setParent ? parentOpts.replace(`value="${setParent}"`, `value="${setParent}" selected`) : parentOpts;
    const wrap = container.querySelector('#cat-form-wrap');
    wrap.innerHTML = `<div style="border:1px solid #bfdbfe;border-radius:8px;padding:.7rem;margin-top:.5rem;background:#eff6ff">
      <strong style="font-size:.88rem">${key ? 'Sửa' : 'Thêm'} danh mục</strong>
      <label style="font-size:.83rem;display:block;margin-top:.5rem">Tên danh mục
        <input id="cf-name" class="search-input" value="${cat.name || ''}" style="width:100%;margin-top:.2rem" placeholder="VD: Laptop, Dell, Linh kiện..." /></label>
      <label style="font-size:.83rem;display:block;margin-top:.5rem">Thuộc về
        <select id="cf-parent" class="search-input" style="width:100%;margin-top:.2rem">${parentSel}</select></label>
      <div style="display:flex;gap:.4rem;justify-content:space-between;margin-top:.6rem">
        <span>${key ? '<button id="cf-del" class="btn btn--danger btn--sm">🗑 Xóa</button>' : ''}</span>
        <span><button id="cf-cancel" class="btn btn--secondary btn--sm">Hủy</button>
        <button id="cf-save" class="btn btn--primary btn--sm">Lưu</button></span>
      </div></div>`;
    wrap.querySelector('#cf-cancel').addEventListener('click', () => wrap.innerHTML = '');
    wrap.querySelector('#cf-save').addEventListener('click', async () => {
      const name = wrap.querySelector('#cf-name').value.trim();
      if (!name) { toast('Nhập tên danh mục!', 'warning'); return; }
      const parentKey = wrap.querySelector('#cf-parent').value || null;
      key ? await updateItem(COL_CATEGORIES, key, { name, parentKey }) : await addItem(COL_CATEGORIES, { name, parentKey });
      toast(key ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục', 'success');
      if (parentKey) openFolders.add(parentKey);
      wrap.innerHTML = '';
    });
    wrap.querySelector('#cf-del')?.addEventListener('click', () => {
      const childCount = allCategories.filter(c => c.parentKey === key).length;
      const prodCount = allProducts.filter(p => p.categoryKey === key).length;
      showModal({
        title: 'Xóa danh mục', danger: true, confirmText: 'Xóa',
        body: `Xóa danh mục <b>${cat.name}</b>?${childCount ? '<br>⚠ Có ' + childCount + ' danh mục con.' : ''}${prodCount ? '<br>⚠ ' + prodCount + ' sản phẩm sẽ về "Chưa phân loại".' : ''}`,
        onConfirm: async () => {
          const prods = allProducts.filter(p => p.categoryKey === key);
          await Promise.all(prods.map(p => updateItem(COL_PRODUCTS, p._key, { categoryKey: null })));
          await deleteItem(COL_CATEGORIES, key);
          if (selectedCatKey === key) selectedCatKey = null;
          toast('Đã xóa danh mục', 'success'); wrap.innerHTML = '';
        }
      });
    });
  }

  // ─────────────── BỘ LỌC NHANH ───────────────
  function renderChips() {
    const chips = [['all', 'Tất cả'], ['low', 'Sắp hết'], ['out', 'Hết hàng']];
    container.querySelector('#inv-chips').innerHTML = chips.map(([v, l]) =>
      `<span class="inv-chip" data-v="${v}" style="padding:.22rem .7rem;border-radius:20px;cursor:pointer;${stockFilter === v ? 'background:#dbeafe;color:#1d4ed8' : 'border:1px solid #e5e7eb;color:#64748b'}">${l}</span>`).join('');
    container.querySelectorAll('.inv-chip').forEach(c => c.addEventListener('click', () => { stockFilter = c.dataset.v; renderChips(); renderTable(); }));
  }

  // ─────────────── BẢNG SẢN PHẨM ───────────────
  function filtered() {
    const q = _norm(searchQ);
    const catKeys = selectedCatKey ? getAllKeysUnder(selectedCatKey) : null;
    return allProducts.filter(p => {
      const n = Number(p.stock) || 0;
      if (stockFilter === 'low' && !(n > 0 && n <= LOW_MAX)) return false;
      if (stockFilter === 'out' && n > 0) return false;
      if (catKeys && !catKeys.has(p.categoryKey)) return false;
      if (q && !(_norm(p.name).includes(q) || _norm(p.id).includes(q))) return false;
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }
  function stockColor(n) { return n <= 0 ? '#ef4444' : n <= LOW_MAX ? '#f59e0b' : '#22c55e'; }
  function trendHtml(t) {
    if (t > 0) return '<span style="color:#16a34a">▲</span>';
    if (t < 0) return '<span style="color:#ef4444">▼</span>';
    return '<span style="color:#94a3b8">–</span>';
  }
  function renderTable() {
    const wrap = container.querySelector('#inv-table-wrap');
    const data = filtered();
    if (!data.length) { wrap.innerHTML = '<p style="padding:1rem;color:#94a3b8;font-size:.85rem">Không có sản phẩm.</p>'; return; }
    const th = (t, w, al) => `<th style="padding:.5rem .6rem;text-align:${al || 'left'};font-size:.75rem;color:#64748b;font-weight:600;position:sticky;top:0;background:#f1f5f9;z-index:2;border-bottom:1px solid #e5e7eb;${w ? 'width:' + w : ''}">${t}</th>`;
    let rows = '';
    data.forEach(p => {
      const n = Number(p.stock) || 0;
      const st = salesStats[p._key];
      const cat = p.categoryKey ? allCategories.find(c => c._key === p.categoryKey) : null;
      const ym = last6Months()[5];
      rows += `<tr class="prod-row" data-key="${p._key}" style="border-top:1px solid #f1f5f9;cursor:pointer;${expandedKey === p._key ? 'background:#eff6ff' : ''}">
        <td style="padding:.5rem .6rem"><div style="font-weight:500">${p.name || '?'}</div>
          <div style="font-size:.72rem;color:#94a3b8">${p.id || '—'}${cat ? ' · ' + cat.name : ' · Chưa phân loại'}</div></td>
        <td style="text-align:center;font-weight:700;color:${stockColor(n)}">${_fmtInt(n)}</td>
        <td style="text-align:right">${formatVND(p.price || 0)}</td>
        <td style="text-align:right">${_fmtInt(st ? st.total : 0)}</td>
        <td style="text-align:right">${_fmtInt(st ? (st.month[ym] || 0) : 0)}</td>
        <td style="text-align:center">${trendHtml(trendOf(st))}</td></tr>`;
      if (expandedKey === p._key) rows += detailRow(p, st);
    });
    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:.83rem;background:#fff">
        <thead><tr>${th('Sản phẩm')}${th('Tồn', '52px', 'center')}${th('Giá bán', '90px', 'right')}${th('Đã bán', '62px', 'right')}${th('Tháng này', '70px', 'right')}${th('Xu hướng', '64px', 'center')}</tr></thead>
        <tbody>${rows}</tbody></table>`;
    wrap.querySelectorAll('.prod-row').forEach(r => r.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      expandedKey = expandedKey === r.dataset.key ? null : r.dataset.key; renderTable();
    }));
  }
  function detailRow(p, st) {
    const ms = last6Months();
    const vals = ms.map(m => (st && st.month[m]) || 0);
    const max = Math.max(1, ...vals);
    const bars = ms.map((m, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:20px;height:46px;display:flex;align-items:flex-end"><div style="width:100%;height:${Math.round(vals[i] / max * 100)}%;background:#3b82f6;border-radius:3px 3px 0 0;min-height:2px"></div></div>
      <div style="font-size:.65rem;color:#94a3b8">${m.slice(5)}</div>
      <div style="font-size:.68rem;color:#475569;font-weight:600">${vals[i]}</div></div>`).join('');
    const value = (Number(p.stock) || 0) * (Number(p.cost) || 0);
    const profit = (Number(p.stock) || 0) * ((Number(p.price) || 0) - (Number(p.cost) || 0));
    return `<tr style="background:#f8fafc"><td colspan="6" style="padding:.7rem .9rem">
      <div style="display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap">
        <div><div style="font-size:.72rem;color:#64748b;margin-bottom:.3rem">Bán theo tháng (6 tháng)</div>
          <div style="display:flex;gap:8px;align-items:flex-end">${bars}</div></div>
        <div style="font-size:.8rem;color:#475569;line-height:1.9">
          Tổng đã bán: <b>${_fmtInt(st ? st.total : 0)}</b> · Xu hướng: ${trendHtml(trendOf(st))}<br>
          Giá vốn: <b>${formatVND(p.cost || 0)}</b> · Giá bán: <b>${formatVND(p.price || 0)}</b> · Bảo hành: ${p.warranty || '—'}<br>
          Vốn đọng (tồn×vốn): <b>${formatVND(value)}</b> · Lãi dự kiến: <b style="color:#16a34a">${formatVND(profit)}</b><br>
          Lần bán gần nhất: ${st && st.last ? st.last.split('-').reverse().join('/') : '—'}
        </div></div></td></tr>`;
  }

  // ─────────────── FORM SẢN PHẨM ───────────────
  function openProductForm(key, presetCat) {
    if (!isAdmin()) { toast('Chỉ quản trị viên', 'error'); return; }
    const p = key ? (allProducts.find(x => x._key === key) || {}) : {};
    const catOpts = '<option value="">— Không có —</option>' + buildCatOptions(null, 0);
    const effCat = p.categoryKey || presetCat || null;
    const catSel = effCat ? catOpts.replace(`value="${effCat}"`, `value="${effCat}" selected`) : catOpts;
    const dot = v => v ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
    showModal({
      title: `${key ? 'Sửa' : 'Thêm'} sản phẩm`,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <label>Mã SP<br><input id="f-id" class="search-input" value="${p.id || ''}" style="width:100%" /></label>
        <label>Tên sản phẩm<br><input id="f-name" class="search-input" value="${p.name || ''}" style="width:100%" /></label>
        <label>Danh mục<br><select id="f-cat" class="search-input" style="width:100%">${catSel}</select></label>
        <label>ĐVT<br><input id="f-unit" class="search-input" value="${p.unit || ''}" style="width:100%" /></label>
        <label>Tồn kho<br><input id="f-stock" type="number" class="search-input" value="${p.stock || 0}" style="width:100%" /></label>
        <label>Giá vốn <span style="color:#e74c3c">*</span><br><input id="f-cost" type="text" class="search-input" data-fmt="number" placeholder="Bắt buộc nhập" value="${dot(p.cost)}" style="width:100%" /></label>
        <label>Giá bán<br><input id="f-sell" type="text" class="search-input" data-fmt="number" value="${dot(p.price)}" style="width:100%" /></label>
        <label>Bảo hành<br><input id="f-warranty" class="search-input" value="${p.warranty || ''}" style="width:100%" /></label>
      </div>`,
      confirmText: 'Lưu',
      onConfirm: async () => {
        const name = document.querySelector('#f-name')?.value.trim() || '';
        if (!name) { toast('Nhập tên sản phẩm!', 'warning'); return false; }
        const cost = Number((document.querySelector('#f-cost')?.value || '').replace(/\./g, '')) || 0;
        if (!(cost > 0)) { toast('Chưa nhập giá vốn — không thể lưu!', 'warning'); document.querySelector('#f-cost')?.focus(); return false; }
        const data = {
          id: document.querySelector('#f-id')?.value.trim() || '',
          name,
          categoryKey: document.querySelector('#f-cat')?.value || null,
          unit: document.querySelector('#f-unit')?.value.trim() || '',
          stock: Number(document.querySelector('#f-stock')?.value) || 0,
          cost,
          price: Number((document.querySelector('#f-sell')?.value || '').replace(/\./g, '')) || 0,
          warranty: document.querySelector('#f-warranty')?.value.trim() || '',
        };
        key ? await updateItem(COL_PRODUCTS, key, data) : await addItem(COL_PRODUCTS, data);
        toast(key ? 'Đã cập nhật' : 'Đã thêm sản phẩm', 'success');
      }
    });
  }

  function moveCategory(key) {
    const p = allProducts.find(x => x._key === key) || {};
    const catOpts = '<option value="">— Không phân loại —</option>' + buildCatOptions(null, 0);
    const sel = p.categoryKey ? catOpts.replace(`value="${p.categoryKey}"`, `value="${p.categoryKey}" selected`) : catOpts;
    showModal({
      title: 'Chuyển danh mục', confirmText: 'Lưu',
      body: `<label>Danh mục<br><select id="mv-cat" class="search-input" style="width:100%">${sel}</select></label>`,
      onConfirm: async () => { await updateItem(COL_PRODUCTS, key, { categoryKey: document.querySelector('#mv-cat')?.value || null }); toast('Đã chuyển danh mục', 'success'); }
    });
  }

  // ─────────────── CONTEXT MENU ───────────────
  const _invCtx = e => {
    const catRow = e.target.closest('.cat-row');
    if (catRow && container.contains(catRow)) {
      e.preventDefault();
      const k = catRow.dataset.key;
      showContextMenu(e.clientX, e.clientY, [
        { label: '✎ Sửa danh mục', onClick: () => openCatForm(k) },
        { label: '＋ Thêm mục con', onClick: () => { openFolders.add(k); openCatForm(null, k); } },
        { sep: true },
        { label: '🗑 Xóa danh mục', danger: true, onClick: () => { openCatForm(k); setTimeout(() => container.querySelector('#cf-del')?.click(), 50); } }
      ]);
      return;
    }
    const row = e.target.closest('.prod-row');
    if (!row || !container.contains(row)) return;
    e.preventDefault();
    const key = row.dataset.key;
    const isDup = dupGroups().some(g => g.some(p => p._key === key));
    const items = [
      { label: '✏ Sửa sản phẩm', onClick: () => openProductForm(key) },
      { label: '🗂 Chuyển danh mục', onClick: () => moveCategory(key) }
    ];
    if (isDup) items.push({ label: '📋 Gộp trùng lặp', onClick: openMergeModal });
    items.push({ sep: true }, {
      label: '🗑 Xóa khỏi kho', danger: true, onClick: () => showModal({
        title: 'Xóa sản phẩm', danger: true, confirmText: 'Xóa', body: 'Xóa sản phẩm này khỏi kho?',
        onConfirm: async () => { try { await updateItem(COL_PRODUCTS, key, { deletedAt: Date.now() }); toast('Đã xóa', 'success'); } catch (err) { toast('Lỗi: ' + err.message, 'error'); return false; } }
      })
    });
    showContextMenu(e.clientX, e.clientY, items);
  };
  if (container.__ctxH) container.removeEventListener('contextmenu', container.__ctxH);
  container.__ctxH = _invCtx;
  container.addEventListener('contextmenu', _invCtx);

  // ─────────────── EVENTS ───────────────
  container.querySelector('#inv-search').addEventListener('input', e => { searchQ = e.target.value; renderTable(); });
  container.querySelector('#inv-add').addEventListener('click', () => openProductForm(null, selectedCatKey));
  container.querySelector('#cat-add').addEventListener('click', () => openCatForm(null, null));
  renderChips();

  // ─────────────── FIREBASE ───────────────
  onSnapshot(COL_CATEGORIES, items => {
    allCategories = items.filter(c => !c.deletedAt);
    renderTree(); renderTable();
  });
  onSnapshot(COL_PRODUCTS, items => {
    allProducts = items.filter(p => !p.deletedAt);
    renderKPIs(); renderDupBanner(); renderTree(); renderTable();
  });
  onSnapshot(COL_SALES, items => {
    allSales = items || [];
    computeSalesStats(); renderTable();
  });
}
