// core/router.js - Hash-based routing
// MÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂi module ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂng kÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ route cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ§a mÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¬nh qua registerRoute()

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
    navigate(); // render trang ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ§u tiÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂªn

    // Import tÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¥t cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ£ modules ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂng thÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ»ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂi cÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¹ng kÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ routes
    Promise.all([
        import('../modules/repairs.js?v=45'),
        import('../modules/sales.js?v=31'),
        import('../modules/inventory.js?v=19'),
        import('../modules/customers.js?v=3'),
        import('../modules/debts.js?v=3'),
        import('../modules/stats.js?v=3'),
        import('../modules/users.js?v=3'),
        import('../modules/settings.js?v=3'),
    ]).then(([repairs, sales, inventory, customers, debts, stats, users, settings]) => {
        registerRoute('#repairs',   repairs.mount);
        registerRoute('#sales',     sales.mount);
        registerRoute('#inventory', inventory.mount);
        registerRoute('#customers', customers.mount);
        registerRoute('#debts',     debts.mount);
        registerRoute('#stats',     stats.mount);
        registerRoute('#users',     users.mount);
        registerRoute('#settings',  settings.mount);
        navigate();
    });
}

export function navigateTo(hash) {
    location.hash = hash;
}
