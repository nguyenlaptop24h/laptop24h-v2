// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js?v=22';

// Runtime fix: repair garbled UTF-8 text nodes in DOM (caused by CM6 encoding issue)
const _fu = s => { try { return decodeURIComponent(escape(s)); } catch(e) { return s; } };
const _fn = n => {
  if (n.nodeType === 3 && n.textContent && /[\x80-\xFF]/.test(n.textContent))
    n.textContent = _fu(n.textContent);
  if (n.childNodes) [...n.childNodes].forEach(_fn);
};
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(_fn)))
  .observe(document.body, {childList: true, subtree: true});

async function main() {
    await initDB();
    await initAuth();
    initRouter();
}
main().catch(console.error);
