// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js?v=21';

async function main() {
    // 1. Khởi tạo Firebase / Firestore
    await initDB();

    // 2. Xác thực người dùng (chờ login nếu cần)
    await initAuth();

    // 3. Khởi tạo router - render module theo hash
    initRouter();
}
main().catch(console.error);
