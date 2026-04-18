// core/router.js - Hash-based routing
// MÃ¡Â»Âi module ÃÂÃÂng kÃÂ½ route cÃ¡Â»Â§a mÃÂ¬nh qua registerRoute()

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
    navigate(); // render trang ÃÂÃ¡ÂºÂ§u tiÃÂªn

    // Import tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ modules ÃÂÃ¡Â»Âng thÃ¡Â»Âi cÃÂ¹ng kÃÂ½ routes
    Promise.all([
        import('../modules/repairs.js?v=25'),
        import('../modules/sales.js?v=12'),
        import('../modules/inventory.js?v=15'),
        import('../modules/customers.js'),
        import('../modules/debts.js'),
        import('../modules/stats.js'),
        import('../modules/users.js'),
        import('../modules/settings.js'),
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
