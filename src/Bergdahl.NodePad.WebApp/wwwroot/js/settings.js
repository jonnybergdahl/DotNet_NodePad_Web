// Settings page (General, Home Assistant, MCP server; the To do lists card is in todo.js) and the
// Change password form on the Account page. Both pages are opened from the account menu.
// Loaded before app.js; uses showToast from app.js and loadSettingsTodoLists from todo.js only when
// the user acts, after all scripts have loaded.

// Called by app.js each time the Settings page is shown
function loadSettingsPage() {
    loadGeneralSettings();
    loadHomeAssistant();
    loadMcpStatus();
    loadSettingsTodoLists();
    document.getElementById('settings-status').textContent = '';
}

// ---------------------------------------------------------------------
// General and Home Assistant, saved together by the form's Save button
// ---------------------------------------------------------------------

const settingsForm = document.getElementById('settings-form');
const settingsStatus = document.getElementById('settings-status');
const inputAllowedHosts = document.getElementById('settings-allowed-hosts');
const inputPagesDir = document.getElementById('settings-pages-dir');
const inputBackupDir = document.getElementById('settings-backup-dir');
let originalSettings = null;

async function loadGeneralSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        originalSettings = data;
        inputAllowedHosts.value = data.allowedHosts ?? data.AllowedHosts ?? '';
        inputPagesDir.value = data.pagesDirectory ?? data.PagesDirectory ?? '';
        inputBackupDir.value = data.backupDirectory ?? data.BackupDirectory ?? '';
    } catch {
        showToast('Failed to load settings', 'error');
    }
}

// Returns true when saved
async function saveGeneralSettings() {
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                allowedHosts: inputAllowedHosts.value,
                pagesDirectory: inputPagesDir.value,
                backupDirectory: inputBackupDir.value,
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const oldPages = originalSettings?.pagesDirectory ?? originalSettings?.PagesDirectory ?? '';
        const newPages = data.pagesDirectory ?? data.PagesDirectory ?? '';
        if (oldPages !== newPages) {
            showToast('PagesDirectory changed. Restart the app to update static file serving.', 'warning');
        }
        originalSettings = data;
        return true;
    } catch {
        showToast('Failed to save settings', 'error');
        return false;
    }
}

const haUrlInput = document.getElementById('settings-ha-url');
const haTokenInput = document.getElementById('settings-ha-token');
const haTokenHint = document.getElementById('settings-ha-token-hint');
const haActiveInput = document.getElementById('settings-ha-active');
const haStatus = document.getElementById('settings-ha-status');

function renderHomeAssistant(data, showInputs) {
    if (showInputs) {
        haUrlInput.value = data.url || '';
        haActiveInput.checked = !!data.active;
        // The token is never sent back; an empty field keeps the saved one
        haTokenInput.value = '';
        haTokenHint.textContent = data.hasToken ? 'Of an administrator. Saved; leave empty to keep it.' : 'Of an administrator.';
    }
    let text;
    if (!data.active) text = 'Syncing is off.';
    else if (data.connectionError) text = `Could not connect: ${data.connectionError}`;
    else if (data.connected) text = 'Connected.';
    else text = data.lastError ? `Not connected: ${data.lastError}. Retrying.` : 'Connecting…';
    if (data.active && data.lastSync) text += ` Last synced ${new Date(data.lastSync).toLocaleString()}.`;
    if (data.active && data.connected && data.lastError) text += ` Last error: ${data.lastError}`;
    haStatus.textContent = text;
}

async function loadHomeAssistant(showInputs = true) {
    try {
        const res = await fetch('/api/settings/home-assistant');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        renderHomeAssistant(await res.json(), showInputs);
    } catch {
        haStatus.textContent = 'Could not load the Home Assistant settings.';
    }
}

// Returns true when saved
async function saveHomeAssistant() {
    try {
        const res = await fetch('/api/settings/home-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: haUrlInput.value,
                token: haTokenInput.value,
                active: haActiveInput.checked,
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || 'Failed to save the Home Assistant settings', 'error');
            return false;
        }
        renderHomeAssistant(data, true);
        if (data.connectionError) showToast('Saved, but Home Assistant could not be reached', 'warning');
        // The sync connects in the background
        setTimeout(() => { if (activePage === 'settings') loadHomeAssistant(false); }, 2000);
        return true;
    } catch {
        showToast('Failed to save the Home Assistant settings', 'error');
        return false;
    }
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsStatus.textContent = '';
    const button = settingsForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const general = await saveGeneralSettings();
        const homeAssistant = await saveHomeAssistant();
        if (general && homeAssistant) settingsStatus.textContent = 'Settings saved.';
    } finally {
        button.disabled = false;
    }
});

// ---------------------------------------------------------------------
// MCP API key
// ---------------------------------------------------------------------

const mcpUrlInput = document.getElementById('settings-mcp-url');
const mcpStatus = document.getElementById('settings-mcp-status');
const mcpKeyRow = document.getElementById('settings-mcp-key-row');
const mcpKeyInput = document.getElementById('settings-mcp-key');
const mcpGenerateBtn = document.getElementById('settings-mcp-generate-btn');
const mcpRevokeBtn = document.getElementById('settings-mcp-revoke-btn');

function renderMcpStatus(exists) {
    mcpStatus.textContent = exists
        ? 'An API key is active. Generating a new key replaces it.'
        : 'No API key yet. MCP access is disabled until you generate one.';
    mcpGenerateBtn.textContent = exists ? 'Generate new API key' : 'Generate API key';
    mcpRevokeBtn.hidden = !exists;
}

async function loadMcpStatus() {
    mcpUrlInput.value = `${location.origin}/mcp`;
    mcpKeyRow.hidden = true;
    mcpKeyInput.value = '';
    try {
        const res = await fetch('/api/auth/api-key');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        renderMcpStatus((await res.json()).exists);
    } catch {
        mcpStatus.textContent = 'Could not load API key status.';
    }
}

mcpGenerateBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/auth/api-key', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        mcpKeyInput.value = data.apiKey;
        mcpKeyRow.hidden = false;
        renderMcpStatus(true);
        mcpKeyInput.select();
    } catch {
        showToast('Failed to generate API key', 'error');
    }
});

mcpRevokeBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/auth/api-key', { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mcpKeyRow.hidden = true;
        mcpKeyInput.value = '';
        renderMcpStatus(false);
        showToast('API key revoked', 'success');
    } catch {
        showToast('Failed to revoke API key', 'error');
    }
});

document.getElementById('settings-mcp-copy-btn').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(mcpKeyInput.value);
        showToast('API key copied', 'success');
    } catch {
        mcpKeyInput.select();
        showToast('Press Ctrl+C / Cmd+C to copy the key', 'info');
    }
});

// ---------------------------------------------------------------------
// Change password (Account page)
// ---------------------------------------------------------------------

const passwordForm = document.getElementById('password-form');
const inputCurrentPassword = document.getElementById('settings-current-password');
const inputNewPassword = document.getElementById('settings-new-password');
const inputConfirmPassword = document.getElementById('settings-confirm-password');

passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = inputCurrentPassword.value;
    const newPassword = inputNewPassword.value;
    if (!currentPassword || !newPassword) {
        showToast('Enter your current and new password', 'warning');
        (currentPassword ? inputNewPassword : inputCurrentPassword).focus();
        return;
    }
    if (newPassword !== inputConfirmPassword.value) {
        showToast('New passwords do not match', 'warning');
        inputConfirmPassword.focus();
        return;
    }
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (!res.ok) {
            let message = 'Failed to change password';
            if (res.status === 429) message = 'Too many attempts. Wait a minute and try again.';
            else { try { message = (await res.json()).error || message; } catch { /* keep the generic message */ } }
            showToast(message, 'error');
            return;
        }
        inputCurrentPassword.value = inputNewPassword.value = inputConfirmPassword.value = '';
        showToast('Password changed', 'success');
    } catch {
        showToast('Failed to change password', 'error');
    }
});
