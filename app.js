// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js?v=11';
import { initUI } from './core/ui.js';

async function main() {
  // 1. Khá»i táº¡o Firebase DB
  await initDB();

  // 2. Khá»i táº¡o Auth - chá» tráº¡ng thÃ¡i ÄÄng nháº­p
  await initAuth();

  // 3. Khá»i táº¡o UI chung (toast, modal...)
  initUI();

  // 4. Khá»i táº¡o router - render module theo hash
  initRouter();
}

main().catch(console.error);
