// modules/settings.js - Cài đặt hệ thống (admin only)
import { registerRoute } from '../core/router.js';
import { getDB } from '../core/db.js';
import { toast } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';

registerRoute('#settings', mount);

export async function mount(container) {
  if (!isAdmin()) {
    container.innerHTML = '<p class="error">Bạn không có quyền truy cập trang này.</p>';
    return;
  }

  // Load current settings from DB
  const db = getDB();
  const snap = await db.ref('settings').once('value');
  const settings = snap.val() || {};

  container.innerHTML = `
    <div class="module-header">
      <h2>Cài đặt</h2>
    </div>
    <div class="form-panel settings-panel">

      <section class="settings-section">
        <h3>Thông tin cửa hàng</h3>
        <div class="form-grid">
          <label class="full-width">Tên cửa hàng
            <input name="shopName" value="${settings.shopName||'Laptop 24h'}" />
          </label>
          <label class="full-width">Địa chỉ
            <input name="shopAddress" value="${settings.shopAddress||''}" />
          </label>
          <label>SĐT
            <input name="shopPhone" value="${settings.shopPhone||''}" />
          </label>
          <label>Email
            <input name="shopEmail" type="email" value="${settings.shopEmail||''}" />
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>Cấu hình Firebase</h3>
        <p class="form-note">Chỉnh sửa trực tiếp trong file <code>core/db.js</code> — FIREBASE_CONFIG.</p>
      </section>

      <section class="settings-section">
        <h3>In ấn</h3>
        <div class="form-grid">
          <label class="full-width">Chân trang phiếu sửa
            <textarea name="repairFooter" rows="2">${settings.repairFooter||'Cảm ơn quý khách!'}</textarea>
          </label>
          <label class="full-width">Chân trang phiếu giao
            <textarea name="deliveryFooter" rows="2">${settings.deliveryFooter||'Cảm ơn quý khách!'}</textarea>
          </label>
        </div>
      </section>

      <div class="form-actions">
        <button class="btn btn--primary" id="settings-save">💾 Lưu cài đặt</button>
      </div>
    </div>
  `;

  container.querySelector('#settings-save').addEventListener('click', async () => {
    const data = {};
    container.querySelectorAll('[name]').forEach(el => { data[el.name] = el.value; });
    try {
      await db.ref('settings').set({ ...settings, ...data, updatedAt: Date.now() });
      toast('Đã lưu cài đặt', 'success');
    } catch(e) {
      toast('Lỗi: ' + e.message, 'error');
    }
  });
}
