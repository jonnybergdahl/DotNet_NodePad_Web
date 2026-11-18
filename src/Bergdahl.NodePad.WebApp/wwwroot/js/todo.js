// To do page (#todo), opened from the To do entry at the top of the menu, and the To do lists card on the
// Settings page. app.js shows the page and calls loadTodos() when it opens.
// Loaded before app.js; uses its helpers (showModal, showToast) only when the user acts, after all scripts
// have loaded, and activePage from shell.js.

const todoView = document.getElementById('todo-view');

let todoLists = [];
let todoShowOld = false;
try { todoShowOld = localStorage.getItem('todoShowOld') === 'true'; } catch { /* storage unavailable */ }

// Lists collapsed to their header, by lower-case name, remembered in this browser
let todoCollapsed = new Set();
try { todoCollapsed = new Set(JSON.parse(localStorage.getItem('todoCollapsed') || '[]')); } catch { /* storage unavailable */ }

function saveTodoCollapsed() {
    try { localStorage.setItem('todoCollapsed', JSON.stringify([...todoCollapsed])); } catch { /* storage unavailable */ }
}

function todoEscape(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[s]));
}

// ---------------------------------------------------------------------
// Server calls
// ---------------------------------------------------------------------

async function todoRequest(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text ? JSON.parse(text) : null;
}

function todoOldParam(prefix) {
    return todoShowOld ? `${prefix}includeOldDone=true` : '';
}

async function loadTodos() {
    try {
        todoLists = await todoRequest('GET', `/api/todos${todoOldParam('?')}`);
    } catch (err) {
        showToast(`Could not load to do lists: ${err.message}`, 'error');
        todoLists = [];
    }
    renderTodos();
}

// Runs a change and puts the returned list in place of the old one
async function todoChange(method, url, body, { focusAdd } = {}) {
    try {
        const list = await todoRequest(method, url, body);
        todoLists = todoLists.filter(l => l.name.toLowerCase() !== String(list?.name).toLowerCase());
        if (list) todoLists.push(list);
        todoLists.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        renderTodos(focusAdd ? list?.name : null);
    } catch (err) {
        showToast(err.message, 'error');
        await loadTodos();
    }
}

const listQuery = name => `list=${encodeURIComponent(name)}`;

// ---------------------------------------------------------------------
// Live updates: the server reports every change to the lists (from this page, another browser,
// the MCP tools or Home Assistant) on /api/todos/events, and the open views reload.
// ---------------------------------------------------------------------

let todoRefreshPending = false;
let todoEvents = null;

function connectTodoEvents() {
    let opened = false;
    todoEvents = new EventSource('/api/todos/events');
    todoEvents.addEventListener('open', () => {
        // Changes may have been missed while the connection was down
        if (opened) refreshTodoViews();
        opened = true;
    });
    todoEvents.addEventListener('message', refreshTodoViews);
    todoEvents.addEventListener('error', () => {
        // EventSource retries by itself after a network error, but gives up on an error response
        // (such as a proxy answering while the app restarts)
        if (todoEvents.readyState === EventSource.CLOSED) setTimeout(connectTodoEvents, 5000);
    });
}

function refreshTodoViews() {
    if (activePage === 'todo') refreshTodoPage();
    if (activePage === 'settings') loadSettingsTodoLists();
}

// Reloads the ToDo page without disturbing the user: an open item dialog holds the refresh back
// until it closes, and the focus is kept.
async function refreshTodoPage() {
    const editing = () => todoItemOverlay.classList.contains('active');
    if (editing()) {
        todoRefreshPending = true;
        return;
    }
    let lists;
    try {
        lists = await todoRequest('GET', `/api/todos${todoOldParam('?')}`);
    } catch {
        return; // The next change or reconnect tries again
    }
    if (activePage !== 'todo') return;
    if (editing()) {
        todoRefreshPending = true;
        return;
    }
    todoRefreshPending = false;

    // Keeps the focus on a list's Add item or collapse button through the re-render
    const active = document.activeElement;
    const focusSelector = ['todo-add', 'todo-collapse'].find(c => active?.classList.contains(c));
    const focusList = focusSelector ? active.closest('.todo-card')?.dataset.list : null;

    todoLists = lists;
    renderTodos(focusList, focusSelector && `.${focusSelector}`);
}

function runPendingTodoRefresh() {
    if (todoRefreshPending) refreshTodoPage();
}

connectTodoEvents();

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function todoDateLabel(isoDate) {
    if (!isoDate) return '';
    const date = new Date(`${isoDate}T00:00:00`);
    const options = { day: 'numeric', month: 'short' };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    return `✓ ${date.toLocaleDateString(undefined, options)}`;
}

function renderTodoItem(item) {
    return `
        <li class="todo-item${item.done ? ' done' : ''}" data-index="${item.index}">
            <input type="checkbox" class="todo-check" ${item.done ? 'checked' : ''} aria-label="Done: ${todoEscape(item.text)}">
            <span class="todo-body">
                <button class="todo-text" type="button" data-action="edit-item" title="Edit item">${todoEscape(item.text)}</button>
                ${item.done && item.doneDate ? `<span class="todo-date" title="Done ${todoEscape(item.doneDate)}">${todoDateLabel(item.doneDate)}</span>` : ''}
            </span>
            <button class="icon-button todo-delete" type="button" data-action="delete-item" title="Delete item" aria-label="Delete item">
                <span class="icon">close</span>
            </button>
        </li>`;
}

function renderTodoCard(list, i) {
    const collapsed = todoCollapsed.has(list.name.toLowerCase());
    const open = list.items.filter(item => !item.done).length;
    const items = list.items.length
        ? `<ul class="todo-items">${list.items.map(renderTodoItem).join('')}</ul>`
        : '<p class="todo-empty muted">No items yet</p>';
    return `
        <section class="card todo-card${collapsed ? ' collapsed' : ''}" data-list="${todoEscape(list.name)}">
            <header class="card-header">
                <h2>
                    <button class="todo-collapse" type="button" data-action="toggle-list" aria-expanded="${!collapsed}" aria-controls="todo-body-${i}">
                        <span class="icon" aria-hidden="true">checklist</span>
                        <span class="todo-list-name">${todoEscape(list.name)}</span>
                        <small class="todo-open-count muted">${open} open</small>
                        <span class="icon todo-chevron" aria-hidden="true">expand_more</span>
                    </button>
                </h2>
            </header>
            <div class="todo-card-body" id="todo-body-${i}" ${collapsed ? 'hidden' : ''}>
                ${items}
                <button class="todo-add" type="button" data-action="add-item" aria-label="Add item to ${todoEscape(list.name)}">
                    <span class="icon" aria-hidden="true">add</span>Add item
                </button>
            </div>
        </section>`;
}

function toggleTodoCard(card) {
    const key = card.dataset.list.toLowerCase();
    const collapse = !todoCollapsed.has(key);
    if (collapse) todoCollapsed.add(key);
    else todoCollapsed.delete(key);
    saveTodoCollapsed();
    card.classList.toggle('collapsed', collapse);
    card.querySelector('.todo-collapse').setAttribute('aria-expanded', String(!collapse));
    card.querySelector('.todo-card-body').hidden = collapse;
}

function renderTodos(focusList, focusSelector = '.todo-add') {
    const hidden = todoLists.reduce((sum, l) => sum + (l.hiddenDoneCount || 0), 0);
    const hiddenNote = !todoShowOld && hidden > 0 ? `<small class="field-hint">${hidden} hidden</small>` : '';
    const body = todoLists.length
        ? `<div class="todo-grid">${todoLists.map((list, i) => renderTodoCard(list, i)).join('')}</div>`
        : `<div class="card">
               <p class="muted">No to do lists yet. Create one in <a href="#settings">Settings</a>.</p>
           </div>`;

    todoView.innerHTML = `
        <header class="page-header todo-header">
            <div>
                <h1>To do</h1>
                <p>Click an item to change it.</p>
            </div>
            <label class="check todo-toggle">
                <input type="checkbox" id="todo-show-old" ${todoShowOld ? 'checked' : ''}>
                <span>Show older done items${hiddenNote}</span>
            </label>
        </header>
        ${body}`;

    if (focusList) {
        const card = [...todoView.querySelectorAll('.todo-card')].find(c => c.dataset.list === focusList);
        card?.querySelector(focusSelector)?.focus();
    }
}

// ---------------------------------------------------------------------
// List management (Settings page, "To do lists" card)
// ---------------------------------------------------------------------

const settingsTodoLists = document.getElementById('settings-todo-lists');
const settingsTodoName = document.getElementById('settings-todo-name');
const settingsTodoAddBtn = document.getElementById('settings-todo-add-btn');

// Called by settings.js when the Settings page is shown
async function loadSettingsTodoLists() {
    let lists = [];
    try {
        lists = await todoRequest('GET', '/api/todos');
    } catch (err) {
        showToast(`Could not load to do lists: ${err.message}`, 'error');
    }
    settingsTodoLists.innerHTML = lists.length
        ? lists.map(list => {
            const open = list.items.filter(i => !i.done).length;
            return `
                <li class="settings-todo-list" data-list="${todoEscape(list.name)}">
                    <span class="icon" aria-hidden="true">checklist</span>
                    <span class="settings-todo-name">${todoEscape(list.name)}<small class="muted">${open} open</small></span>
                    <button class="icon-button" type="button" data-action="rename-list" title="Rename list" aria-label="Rename ${todoEscape(list.name)}">
                        <span class="icon">edit</span>
                    </button>
                    <button class="icon-button danger" type="button" data-action="delete-list" title="Delete list" aria-label="Delete ${todoEscape(list.name)}">
                        <span class="icon">delete</span>
                    </button>
                </li>`;
        }).join('')
        : '<li class="settings-todo-none muted">No to do lists yet.</li>';
}

// Keeps the To do page in step with changes made in Settings
async function afterTodoListChange() {
    await loadSettingsTodoLists();
    if (activePage === 'todo') await loadTodos();
}

async function addTodoList() {
    const name = settingsTodoName.value.trim();
    if (!name) {
        settingsTodoName.focus();
        return;
    }
    try {
        const list = await todoRequest('POST', '/api/todos/lists', { name });
        settingsTodoName.value = '';
        showToast(`List "${list.name}" created`, 'success');
        await afterTodoListChange();
    } catch (err) {
        showToast(err.message, 'error');
    }
    settingsTodoName.focus();
}

async function renameTodoList(name) {
    const newName = await showModal('Rename list', 'New name for the list:', true, name);
    if (!newName || !newName.trim() || newName.trim() === name) return;
    try {
        await todoRequest('POST', `/api/todos/lists/rename?name=${encodeURIComponent(name)}&newName=${encodeURIComponent(newName.trim())}`);
        await afterTodoListChange();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteTodoList(name) {
    const confirmed = await showModal('Delete list', `Delete the list "${name}" and all its items?`, false);
    if (confirmed !== true) return;
    try {
        await todoRequest('DELETE', `/api/todos/lists?name=${encodeURIComponent(name)}`);
        showToast('List deleted', 'success');
        await afterTodoListChange();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

settingsTodoAddBtn.addEventListener('click', addTodoList);
settingsTodoName.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTodoList();
    }
});
settingsTodoLists.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const list = e.target.closest('.settings-todo-list')?.dataset.list;
    if (action === 'rename-list') renameTodoList(list);
    else if (action === 'delete-list') deleteTodoList(list);
});

// ---------------------------------------------------------------------
// Item editing on the ToDo page
// ---------------------------------------------------------------------

const todoItemOverlay = document.getElementById('todo-item-overlay');
const todoItemTitle = document.getElementById('todo-item-title');
const todoItemText = document.getElementById('todo-item-text');
const todoItemSaveBtn = document.getElementById('todo-item-save-btn');
const todoItemCancelBtn = document.getElementById('todo-item-cancel-btn');
const todoItemCloseBtn = document.getElementById('todo-item-close-btn');

// An item is one line of the list file, so line breaks (typed or pasted) become spaces
const todoOneLine = text => text.replace(/\s*[\r\n]+\s*/g, ' ').trim();

// Opens the item dialog and resolves to the trimmed text, or null when cancelled or left empty
function showTodoItemDialog(title, text = '') {
    return new Promise(resolve => {
        const opener = document.activeElement;
        todoItemTitle.textContent = title;
        todoItemText.value = text;
        todoItemOverlay.classList.add('active');
        todoItemText.focus();
        todoItemText.setSelectionRange(text.length, text.length);

        const close = value => {
            todoItemOverlay.classList.remove('active');
            todoItemSaveBtn.removeEventListener('click', save);
            todoItemCancelBtn.removeEventListener('click', cancel);
            todoItemCloseBtn.removeEventListener('click', cancel);
            todoItemText.removeEventListener('input', flatten);
            document.removeEventListener('keydown', onKey);
            if (opener?.isConnected) opener.focus();
            resolve(value);
        };
        const save = () => close(todoOneLine(todoItemText.value) || null);
        const cancel = () => close(null);
        const flatten = () => {
            const value = todoItemText.value;
            if (!/[\r\n]/.test(value)) return;
            const breaks = /\s*[\r\n]+\s*/g;
            const head = value.slice(0, todoItemText.selectionStart).replace(breaks, ' ');
            todoItemText.value = head + value.slice(todoItemText.selectionStart).replace(breaks, ' ');
            todoItemText.setSelectionRange(head.length, head.length);
        };
        const onKey = e => {
            if (e.key === 'Enter' && e.target === todoItemText && !e.isComposing) { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        };

        todoItemSaveBtn.addEventListener('click', save);
        todoItemCancelBtn.addEventListener('click', cancel);
        todoItemCloseBtn.addEventListener('click', cancel);
        todoItemText.addEventListener('input', flatten);
        document.addEventListener('keydown', onKey);
    });
}

async function addTodoItem(list) {
    const text = await showTodoItemDialog(`Add item to ${list}`);
    if (text) {
        await todoChange('POST', `/api/todos/items?${listQuery(list)}${todoOldParam('&')}`, { text }, { focusAdd: true });
    }
    runPendingTodoRefresh();
}

async function editTodoItem(list, index, original) {
    const text = await showTodoItemDialog('Edit item', original);
    if (text && text !== original) {
        await todoChange('PUT', `/api/todos/items?${listQuery(list)}&index=${index}${todoOldParam('&')}`, { text });
    }
    runPendingTodoRefresh();
}

todoView.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const card = e.target.closest('.todo-card');
    const list = card?.dataset.list;

    if (action === 'delete-item') {
        const index = e.target.closest('.todo-item').dataset.index;
        return todoChange('DELETE', `/api/todos/items?${listQuery(list)}&index=${index}${todoOldParam('&')}`);
    }
    if (action === 'toggle-list') return toggleTodoCard(card);
    if (action === 'add-item') return addTodoItem(list);
    if (action === 'edit-item') {
        const textEl = e.target.closest('.todo-text');
        return editTodoItem(list, textEl.closest('.todo-item').dataset.index, textEl.textContent);
    }
});

todoView.addEventListener('change', e => {
    if (e.target.id === 'todo-show-old') {
        todoShowOld = e.target.checked;
        try { localStorage.setItem('todoShowOld', String(todoShowOld)); } catch { /* storage unavailable */ }
        loadTodos();
        return;
    }
    if (e.target.classList.contains('todo-check')) {
        const list = e.target.closest('.todo-card').dataset.list;
        const index = e.target.closest('.todo-item').dataset.index;
        todoChange('PUT', `/api/todos/items?${listQuery(list)}&index=${index}${todoOldParam('&')}`, { done: e.target.checked });
    }
});
