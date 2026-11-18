// Search in the top bar, from the Bergdahl web app template, searching the notes on the server.
//
// Results show as you type (from 2 characters). Keys: Ctrl/⌘ K or "/" focuses the field, arrow keys move
// through results, Enter opens the selected one, Escape closes.
// On phones the field is hidden behind a search icon and covers the top bar when opened.
// Loaded last; uses escapeHtml, expandAncestorsForPath, loadMenu and loadFile from app.js.

(function () {
    const root = document.querySelector('[data-search]');
    if (!root) return;

    const topbar = root.closest('.topbar');
    const input = root.querySelector('[data-search-input]');
    const results = root.querySelector('[data-search-results]');
    const shortcut = root.querySelector('[data-search-shortcut]');
    const openButton = document.querySelector('[data-search-open]');
    const closeButton = root.querySelector('[data-search-close]');
    const MIN_LENGTH = 2;
    const DELAY_MS = 200;

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (shortcut) shortcut.textContent = isMac ? '⌘ K' : 'Ctrl K';

    let items = [];
    let selected = -1;
    let timer = null;
    let requestSeq = 0;

    async function search(query) {
        const res = await fetch(`/api/pages/search?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data.filter(it => it && it.path) : [];
    }

    function scheduleSearch() {
        clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < MIN_LENGTH) {
            requestSeq++;
            items = [];
            results.replaceChildren();
            setOpen(false);
            return;
        }
        timer = setTimeout(() => run(query), DELAY_MS);
    }

    async function run(query) {
        const seq = ++requestSeq;
        let found;
        try {
            found = await search(query);
        } catch (err) {
            if (seq !== requestSeq) return;
            render(query, [], err.message);
            return;
        }
        // Ignore answers to older queries, and answers that arrive after the field was closed
        if (seq !== requestSeq || input.value.trim() !== query) return;
        render(query, found);
    }

    function render(query, found, error) {
        items = found;
        selected = items.length ? 0 : -1;
        results.replaceChildren();

        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'search-empty';
            empty.textContent = error || `No results for “${query}”`;
            results.append(empty);
        }

        items.forEach((item, i) => {
            const li = document.createElement('li');
            li.className = 'search-result';
            li.id = `search-result-${i}`;
            li.setAttribute('role', 'option');
            const title = (item.title || item.path).toString();
            const path = item.path.toString().replace(/\.md$/i, '');
            const snippet = (item.snippet || '').toString();
            li.innerHTML = '<span class="icon">description</span><span>' +
                `<span>${escapeHtml(title)}</span><small>${escapeHtml(path)}</small>` +
                (snippet ? `<small class="search-snippet">${escapeHtml(snippet)}</small>` : '') +
                '</span>';
            li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field
            li.addEventListener('click', () => go(item));
            results.append(li);
        });

        setOpen(true);
        highlight();
    }

    function highlight() {
        [...results.querySelectorAll('.search-result')].forEach((li, i) => {
            li.setAttribute('aria-selected', String(i === selected));
            if (i === selected) li.scrollIntoView({ block: 'nearest' });
        });
        if (selected >= 0) input.setAttribute('aria-activedescendant', `search-result-${selected}`);
        else input.removeAttribute('aria-activedescendant');
    }

    function setOpen(open) {
        results.hidden = !open;
        input.setAttribute('aria-expanded', String(open));
    }

    function go(item) {
        close();
        expandAncestorsForPath(item.path, false);
        loadFile(item.path);
    }

    function close() {
        clearTimeout(timer);
        requestSeq++;
        input.value = '';
        items = [];
        results.replaceChildren();
        setOpen(false);
        topbar.classList.remove('search-active');
        input.blur();
    }

    input.addEventListener('input', scheduleSearch);
    input.addEventListener('focus', () => { if (input.value.trim().length >= MIN_LENGTH) scheduleSearch(); });
    input.addEventListener('blur', () => setOpen(false));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!items.length) return;
            e.preventDefault();
            selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            highlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[selected] && !results.hidden) go(items[selected]);
            else if (input.value.trim().length >= MIN_LENGTH) run(input.value.trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    });

    function openSearch() {
        topbar.classList.add('search-active');
        input.focus();
        input.select();
    }

    openButton?.addEventListener('click', openSearch);
    closeButton?.addEventListener('click', close);

    // Ctrl/⌘ K anywhere, or "/" when not typing in another field (the editor included)
    document.addEventListener('keydown', (e) => {
        const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
        if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
            e.preventDefault();
            openSearch();
        }
    });
})();
