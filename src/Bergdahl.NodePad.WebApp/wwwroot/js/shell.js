// App shell from the Bergdahl web app template: page switching, the mobile menu drawer, dropdown menus,
// the signed-in user's name, logout, and the app name and year in the top bar and footer.
//
// NodePad's pages are <section class="page" data-page="..."> in <main>: "notes" (the open note, the default),
// "todo", "settings" and "account". app.js decides which one to show from the address (#/Folder/Note, #todo,
// #settings, #account), since a note address is not a page name; it calls showAppPage() for that.
// Loaded first, as a classic script at the end of <body>.

const appShell = document.querySelector('.app');
const appMain = document.getElementById('main');
const appBaseTitle = document.title;
let activePage = 'notes';

for (const el of document.querySelectorAll('[data-app-name]')) el.textContent = appBaseTitle;
for (const el of document.querySelectorAll('[data-year]')) el.textContent = new Date().getFullYear();

// Shows one page and updates the menu, the tab title and the drawer
function showAppPage(name) {
    const changed = activePage !== name;
    activePage = name;
    for (const page of document.querySelectorAll('.page[data-page]')) page.hidden = page.dataset.page !== name;
    // The notes page fills the main area, so the editor can use the full height
    appMain.classList.toggle('main-fill', name === 'notes');
    for (const link of document.querySelectorAll('.sidebar .nav-link[href^="#"]')) {
        if (link.getAttribute('href') === `#${name}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    if (name !== 'notes') {
        const page = document.querySelector(`.page[data-page="${name}"]`);
        setAppTitle(page.dataset.title || page.querySelector('h1')?.textContent || '');
    }
    if (changed) appMain.scrollTop = 0;
    setNavOpen(false);
}

// "<what is shown> · NodePad" in the browser tab
function setAppTitle(text) {
    document.title = text ? `${text} · ${appBaseTitle}` : appBaseTitle;
}

function setNavOpen(open) {
    appShell.classList.toggle('nav-open', open);
    document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', String(open));
}

(function () {
    const menuToggle = document.querySelector('[data-menu-toggle]');
    const scrim = document.querySelector('.scrim');

    menuToggle?.addEventListener('click', () => setNavOpen(!appShell.classList.contains('nav-open')));
    scrim?.addEventListener('click', () => setNavOpen(false));

    // ---------- Dropdown menus ----------
    // Markup: <div data-dropdown><button data-dropdown-toggle>…</button><div class="dropdown-menu" hidden>…</div></div>

    function closeDropdowns(except) {
        for (const dropdown of document.querySelectorAll('[data-dropdown]')) {
            if (dropdown === except) continue;
            dropdown.querySelector('.dropdown-menu').hidden = true;
            dropdown.querySelector('[data-dropdown-toggle]').setAttribute('aria-expanded', 'false');
        }
    }

    function menuItems(dropdown) {
        return [...dropdown.querySelectorAll("[role='menuitem']")];
    }

    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-dropdown-toggle]');
        if (toggle) {
            const dropdown = toggle.closest('[data-dropdown]');
            const menu = dropdown.querySelector('.dropdown-menu');
            const open = menu.hidden;
            closeDropdowns(dropdown);
            menu.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open && e.detail === 0) menuItems(dropdown)[0]?.focus(); // opened from the keyboard
            return;
        }
        // Clicking outside, or on an item, closes the menu.
        closeDropdowns(e.target.closest('.dropdown-menu') && !e.target.closest("[role='menuitem']")
            ? e.target.closest('[data-dropdown]')
            : null);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const open = document.querySelector('[data-dropdown] .dropdown-menu:not([hidden])');
            if (open) {
                closeDropdowns();
                open.closest('[data-dropdown]').querySelector('[data-dropdown-toggle]').focus();
            } else {
                setNavOpen(false);
            }
            return;
        }

        // Arrow keys move between items in an open menu.
        const dropdown = e.target.closest?.('[data-dropdown]');
        if (!dropdown || dropdown.querySelector('.dropdown-menu').hidden) return;
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = menuItems(dropdown);
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const index = items.indexOf(document.activeElement);
        items[(index + step + items.length) % items.length]?.focus();
    });

    // ---------- Signed-in user ----------
    // Signing in happens on login.html; the server sends anyone without a session there.

    fetch('/api/auth/status')
        .then(res => res.ok ? res.json() : null)
        .then(status => {
            const name = status?.username || '';
            for (const el of document.querySelectorAll('[data-user-name]')) el.textContent = name;
            for (const el of document.querySelectorAll('[data-user-name-value]')) el.value = name;
        })
        .catch(() => { /* the name is only shown in the account menu and on the Account page */ });

    document.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-logout]')) return;
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* signed out on the server or not, go to the login page */ }
        location.href = '/login.html';
    });
})();
