// modules/settings.js - C�i �t h� th�ng (admin only)
import { registerRoute } from '../core/router.js';
import { getDB } from '../core/db.js';
import { toast } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

registerRoute('#settings', mount);

export async function mount(container) {
  if (!isAdmin()) {
    container.innerHTML = '<p class="error">B�n kh�ng c� quy�n truy c�p trang n�y.</p>';
    return;
  }

  // Load current settings from DB
  const db = getDB();
  const snap = await db.ref('settings').once('value');
  const settings = snap.val() || {};

  container.innerHTML = `
    <div class="module-header">
      <h2>C�i �t</h2>
    </div>
    <div class="form-panel settings-panel">

      <section class="settings-section">
        <h3>Th�ng tin c�a h�ng</h3>
        <div class="form-grid">
          <label class="full-width">T�n c�a h�ng
            <input name="shopName" value="${settings.shopName||'Laptop 24h'}" />
          </label>
          <label class="full-width">�a ch�
            <input name="shopAddress" value="${settings.shopAddress||''}" />
          </label>
          <label>ST
            <input name="shopPhone" value="${settings.shopPhone||''}" />
          </label>
          <label>Email
            <input name="shopEmail" type="email" value="${settings.shopEmail||''}" />
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>C�u h�nh Firebase</h3>
        <p class="form-note">Ch�nh s�a tr�c ti�p trong file <code>core/db.js</code>  FIREBASE_CONFIG.</p>
      </section>

      <section class="settings-section">
        <h3>In �n</h3>
        <div class="form-grid">
          <label class="full-width">Ch�n trang phi�u s�a
            <textarea name="repairFooter" rows="2">${settings.repairFooter||'C�m �n qu� kh�ch!'}</textarea>
          </label>
          <label class="full-width">Ch�n trang phi�u giao
            <textarea name="deliveryFooter" rows="2">${settings.deliveryFooter||'C�m �n qu� kh�ch!'}</textarea>
          </label>
        </div>
      </section>

      <div class="form-actions">
        <button class="btn btn--primary" id="settings-save">= L�u c�i �t</button>
      </div>
    </div>
  `;

  container.querySelector('#settings-save').addEventListener('click', async () => {
    const data = {};
    container.querySelectorAll('[name]').forEach(el => { data[el.name] = el.value; });
    try {
      await db.ref('settings').set({ ...settings, ...data, updatedAt: Date.now() });
      toast('� l�u c�i �t', 'success');
    } catch(e) {
      toast('L�i: ' + e.message, 'error');
    }
  });
}
