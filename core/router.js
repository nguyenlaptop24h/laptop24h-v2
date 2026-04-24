// core/router.js - Hash-based routing
// MÃ¡Â»Âi module tÃ¡Â»Â± ÃÂÃÂng kÃÂ½ route cÃ¡Â»Â§a mÃÂ¬nh qua registerRoute()

const routes = {};
let currentRoute = null;

export function registerRoute(hash, mountFn) {
  routes[hash] = mountFn;
}

export function initRouter() {
  // Highlight active nav link
  function updateNav(hash) {
    document.querySelectorAll('#nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  }

  async function navigate() {
    const hash = location.hash || '#repairs';
    const mountFn = routes[hash];
    const main = document.getElementById('main-content');
    if (!mountFn) {
      main.innerHTML = '<p class="empty">Trang khÃÂ´ng tÃ¡Â»Ân tÃ¡ÂºÂ¡i.</p>';
      return;
    }
    if (currentRoute === hash) return;
    currentRoute = hash;
    main.innerHTML = '';
    updateNav(hash);
    await mountFn(main);
  }

  window.addEventListener('hashchange', navigate);
  navigate();

  // Import tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ modules ÃÂÃ¡Â»Âng thÃ¡Â»Âi cÃÂ¹ng kÃÂ½ routes
  Promise.allSettled([
    import('../modules/repairs.js?v=58'),
    import('../modules/sales.js?v=43'),
    import('../modules/inventory.js?v=19'),
    import('../modules/customers.js?v=3'),
    import('../modules/debts.js?v=3'),
    import('../modules/stats.js?v=3'),
    import('../modules/users.js?v=3'),
    import('../modules/settings.js?v=3'),
  ]).then(([repairs, sales, inventory, customers, debts, stats, users, settings]) => {
    if (repairs.status === 'fulfilled') registerRoute('#repairs', repairs.value.mount);
    if (sales.status === 'fulfilled') registerRoute('#sales', sales.value.mount);
    if (inventory.status === 'fulfilled') registerRoute('#inventory', inventory.value.mount);
    if (customers.status === 'fulfilled') registerRoute('#customers', customers.value.mount);
    if (debts.status === 'fulfilled') registerRoute('#debts', debts.value.mount);
    if (stats.status === 'fulfilled') registerRoute('#stats', stats.value.mount);
    if (users.status === 'fulfilled') registerRoute('#users', users.value.mount);
    if (settings.status === 'fulfilled') registerRoute('#settings', settings.value.mount);
    navigate();
  });
}

export function navigateTo(hash) {
  location.hash = hash;
}
