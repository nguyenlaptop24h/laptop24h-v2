// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js';
import { initUI } from './core/ui.js';

async function main() {
  // 1. Khởi tạo Firebase DB
  await initDB();

  // 2. Khởi tạo Auth - chờ trạng thái đăng nhập
  await initAuth();

  // 3. Khởi tạo UI chung (toast, modal...)
  initUI();

  // 4. Khởi tạo router - render module theo hash
  initRouter();
}

main().catch(console.error);
