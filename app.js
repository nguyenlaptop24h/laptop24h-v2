// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js?v=22';

async function main() {
    // 1. Khá»i táº¡o Firebase / Firestore
    await initDB();

    // 2. XÃ¡c thá»±c ngÆ°á»i dÃ¹ng (chá» login náº¿u cáº§n)
    await initAuth();

    // 3. Khá»i táº¡o router - render module theo hash
    initRouter();
}
main().catch(console.error);
