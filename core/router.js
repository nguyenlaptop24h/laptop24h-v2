// core/router.js - Hash-based routing
// Mỗi module đăng ký route của mình qua registerRoute()

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
      main.innerHTML = '<p class="empty">Trang không tồn tại.</p>';
      return;
    }
    if (currentRoute === hash) return;
    currentRoute = hash;
    main.innerHTML = '';
    updateNav(hash);
    await mountFn(main);
  }

  window.addEventListener('hashchange', navigate);
  navigate(); // render trang đầu tiên

  // Import tất cả modules để chúng đăng ký routes
  Promise.all([
    import('../modules/repairs.js?v=2'),
    import('../modules/sales.js'),
    import('../modules/inventory.js?v=13'),
    import('../modules/customers.js'),
    import('../modules/debts.js'),
    import('../modules/stats.js'),
    import('../modules/users.js'),
    import('../modules/settings.js'),
  ]).then(([repairs, sales, inventory, customers, debts, stats, users, settings]) => {
    registerRoute('#repairs',    repairs.mount);
    registerRoute('#sales',      sales.mount);
    registerRoute('#inventory',  inventory.mount);
    registerRoute('#customers',  customers.mount);
    registerRoute('#debts',      debts.mount);
    registerRoute('#stats',      stats.mount);
    registerRoute('#users',      users.mount);
    registerRoute('#settings',   settings.mount);
    navigate();
  });
}

export function navigateTo(hash) {
  location.hash = hash;
}
