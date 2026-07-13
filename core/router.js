// core/router.js - Hash-based routing
// MÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂi module tÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ± ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂng kÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ route cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ§a mÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¬nh qua registerRoute()

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
  const _role = (JSON.parse(localStorage.getItem('l24_session')||'{}')).role;
  if (hash === '#stats' && _role === 'staff') { location.hash = '#repairs'; return; }
    const mountFn = routes[hash];
    const main = document.getElementById('main-content');
    if (!mountFn) {
      main.innerHTML = '<p class="empty">Trang khÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ´ng tÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂn tÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡i.</p>';
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

  // Hide stats for staff
  {
    const _s = JSON.parse(localStorage.getItem('l24_session')||'{}');
    if (_s.role === 'staff') {
      ['#stats','#debts'].forEach(function(h){
        var el=document.querySelector('#nav-links a[href="'+h+'"]');
        if(el)el.closest('li').style.display='none';
      });
    }
  }

  // Import tÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¥t cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ£ modules ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂng thÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂi cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¹ng kÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ routes
  Promise.allSettled([
    import('../modules/repairs.js?v=89'),
    import('../modules/sales.js?v=70'),
    import('../modules/inventory.js?v=22'),
    import('../modules/customers.js?v=12'),
    import('../modules/debts.js?v=4'),
    import('../modules/stats.js?v=12'),
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
