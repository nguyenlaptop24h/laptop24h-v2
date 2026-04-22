// app.js - Bootstrap entry point
import { initDB } from './core/db.js';
import { initAuth } from './core/auth.js';
import { initRouter } from './core/router.js?v=68';

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


// Number format: auto-add dots every 3 digits for inputs with data-fmt="number"
document.addEventListener('input', function(e) {
  if (e.target.dataset && e.target.dataset.fmt === 'number') {
    const pos = e.target.selectionStart;
    const before = e.target.value.length;
    const v = e.target.value.replace(/[^0-9]/g, '');
    const fmt = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    e.target.value = fmt;
    // Restore cursor roughly
    const diff = fmt.length - before;
    e.target.setSelectionRange(pos + diff, pos + diff);
  }
});
