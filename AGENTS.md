# Agent instructions

NodePad is a Markdown notes web app: an ASP.NET Core (.NET 8) backend in `src/Bergdahl.NodePad.WebApp` serving a plain HTML, CSS and JavaScript frontend from `wwwroot`. The frontend follows the Bergdahl web app template ([Web_Bergdahl_Template](https://github.com/jonnybergdahl/Web_Bergdahl_Template)). Keep the template's shell, look and conventions below, and put NodePad's features inside them. Where NodePad differs from the template, it says so under "NodePad's differences from the template".

## Frontend files (`src/Bergdahl.NodePad.WebApp/wwwroot`)

| Path | Purpose |
| --- | --- |
| `index.html` | The shell and all pages (notes, To do, Settings, Account), plus the link and confirm dialogs. |
| `login.html` | Sign-in and first-run account creation. Served without signing in. |
| `css/theme.css` | Design tokens (colours, spacing, sizes) for light and dark. Copied unchanged from the template. |
| `css/app.css` | Layout and base components (`.card`, `.card-header`, `.grid`, `.table`, `.list`, `.button`, `.icon-button`, `.dropdown`, form controls, `.muted`). Copied unchanged from the template. |
| `css/styles.css` | NodePad's own styles on top of the template: notes tree, note toolbar, Toast UI editor, To do cards, dialogs, toasts, and NodePad's extra tokens. |
| `js/theme.js` | Theme switching. Copied unchanged from the template. Loaded in `<head>` without `defer` to avoid a flash of the wrong theme. |
| `js/shell.js` | Page switching (`showAppPage`, `activePage`), the mobile menu drawer, dropdown menus, the signed-in user's name, logout, app name and year. Adapted from the template's `app.js`. |
| `js/search.js` | The top-bar search, from the template, calling `/api/pages/search`. |
| `js/todo.js` | The To do page and the To do lists card on the Settings page, with live updates from `/api/todos/events`. |
| `js/links.js` | The editor's Insert link dialog (URL or a note picked from the tree). |
| `js/settings.js` | The Settings page (General, Home Assistant, MCP server) and the Change password form on the Account page. |
| `js/app.js` | Notes: tree, tags and tag filter, viewer and editor (Toast UI), toolbar actions, drag and drop, addresses and the confirm dialog and toasts. |
| `assets/app-icon.svg` | NodePad's icon, shown with the app name in the top bar and on the login card. |
| `assets/favicon.svg` | Favicon, the blue "e" from the Bergdahl logo. `favicon.ico` is the fallback. |

All scripts are classic scripts sharing one global scope, loaded at the end of `<body>` in the order `shell.js`, `todo.js`, `links.js`, `settings.js`, `app.js`, `search.js`. Don't use ES modules. A script may call functions from a later one only from event handlers, after all scripts have loaded. Top-level names must be unique across the files.

Files that `login.html` uses must be listed in `publicFiles` in `Program.cs` (and in `Login_Page_Assets_Are_Public` in `AuthTests.cs`). Everything else requires a signed-in user.

## Running it

```bash
dotnet run --project src/Bergdahl.NodePad.WebApp
dotnet test
```

The app keeps its settings in `nodepad.json` and the account in `nodepad.auth.json` in the folder it runs from. Don't create an account in, or overwrite, the developer's own files to try something out: run from a scratch folder with `--contentRoot` instead.

## Layout rules

The shell is a CSS grid in `.app`:

```
┌────────────────────────────────────────┐
│ topbar: icon + name . search . actions │
├──────────┬─────────────────────────────┤
│ sidebar  │ main (pages)                │
│ (menu)   │                             │
├──────────┴─────────────────────────────┤
│ footer: copyright line                 │
└────────────────────────────────────────┘
```

- **Top bar**: a three-column grid. Left: the app icon and app name in `.app-title`, linking to the home page (`index.md`); the name comes from `<title>` and is hidden below 720px wide. Centre: the search field, exactly centred and at most 520px wide. Right: action icons in `.topbar-actions`, as `<button class="icon-button">` elements placed before the theme toggle. The order at the right end is always: app icons, theme toggle, account menu. Every icon button needs an `aria-label` and a `title`. Don't put anything else in the centre column.
- **Search**: results show as you type (from 2 characters). Ctrl/⌘ K or `/` focuses it, arrow keys and Enter pick a result, Escape closes. Below 560px wide the field collapses to a search icon in the actions, and opening it covers the whole top bar.
- **Left menu**: the To do entry as a `.nav-link` in `.nav`, then the "Pages" section heading with the tag filter button, then the notes tree (`#menu`, rendered by `app.js`). The tree scrolls on its own below the heading. Keep labels short.
- **Main**: one `<section class="page" data-page="name">` per page: `notes` (the default), `todo`, `settings` and `account`. Pages other than notes start with a `<header class="page-header">` holding an `<h1>` and an optional one-line `<p>`.
- **Account menu**: the `account_circle` button at the far right opens a dropdown with the signed-in user's name, **Account**, **Settings** and **Logout**. Add further items as `.dropdown-item` elements with `role="menuitem"`, keeping Logout last.
- **Footer**: one centred, muted line in the form `NodePad, Copyright© <year>, Jonny Bergdahl, GitHub`, where GitHub links to the repo. The year is filled in from the current date. Don't add navigation or other content.
- Below 800px wide the menu becomes a drawer opened with the menu button that appears left of the app icon. Don't remove that button. Opening a note closes the drawer.

### Addresses and pages

- A note's address is `#/Folder/Note` (the path without `.md`); the bare address is `index.md`. The other pages are `#todo`, `#settings` and `#account` (`APP_PAGE_HASHES` in `app.js`).
- `app.js` decides what to show from the address (`navigateToUrl`) and calls `openAppPage(name)` or `loadFile(path)`. Both check for unsaved edits first. `shell.js`'s `showAppPage(name)` only switches the sections, the menu highlight, the tab title and the drawer.
- To add a page: add its section in `<main>`, its address to `APP_PAGE_HASHES`, and a way to reach it (a `.nav-link` in the menu or a `.dropdown-item` in the account menu). If it needs loading, call its loader from `openAppPage`.
- The browser tab shows `<what is shown> · NodePad` (`setAppTitle`).

## NodePad's differences from the template

- **The notes page fills the main area** (`.main.main-fill`, `.page-notes`) instead of being a 960px page, so the viewer and editor scroll on their own and the editor gets the full height. It has no page header: the breadcrumbs and the toolbar take its place. The To do page is full width (`.page-wide`).
- **No template router**: the template's `app.js` maps the hash to a page name, which doesn't fit note addresses, so `shell.js` and `app.js` handle pages as described above.
- **Settings and Account are in the account menu**, not the left menu, which holds the To do page and the notes tree.
- **Sign-in is real**: `login.html` posts to `/api/auth/login` (or `/api/auth/setup` on first run), and the server sends anyone without a session there. The app has no `.login` section and doesn't use `data-auth` or the template's `auth.js`. The user name comes from `/api/auth/status`.
- **Wider menu**: `styles.css` sets `--sidebar-width: 280px` for the notes tree.
- **Extra tokens** in `styles.css`: `--color-success` and `--color-warning`, used by toasts, defined in all three theme blocks like the template's tokens.
- **Dialogs and toasts** (`.modal-overlay`, `.modal`, `.toast`) are NodePad components; the template has none. They use the template's tokens, and the overlay shadow is the drawer shadow.
- **Toast UI Editor** renders the notes. It takes its theme as an option, so `app.js` recreates the viewer and editor when the effective theme changes. `styles.css` puts it on the app's surface, font and accent colours.

## Forms

Copy the markup on the Settings and Account pages:

- **Text, URL, password, select, textarea**: `<label class="field"><span>Label</span><input …></label>`. Add `<small class="field-hint">…</small>` after the control for help text.
- **Select**: wrap the `<select>` in `<span class="select">` to get the Material Symbols chevron.
- **Checkbox**: `<label class="check"><input type="checkbox"><span>Label<small class="field-hint">…</small></span></label>`.
- **Layout**: `.form-grid` puts fields in responsive columns, `.form-stack` stacks them. `.inline-form` (NodePad) puts a field and its button on one line. Group related settings in cards with a `.card-header`.
- **Actions**: a `.form-actions` row with at most one primary `.button`, `.button.secondary` for the rest, and a `.form-status` element with `role="status"` for messages like "Settings saved."
- Every control needs a visible label. Don't use placeholders as labels (the To do page's "Add item" field, with an `aria-label`, is the one exception).

## Dropdown menus

Use the same pattern as the account menu:

```html
<div class="dropdown" data-dropdown>
  <button class="icon-button" type="button" data-dropdown-toggle aria-haspopup="menu" aria-expanded="false" aria-label="…" title="…">
    <span class="icon">more_vert</span>
  </button>
  <div class="dropdown-menu" role="menu" hidden>
    <a class="dropdown-item" href="#page" role="menuitem"><span class="icon">…</span>Label</a>
    <button class="dropdown-item" type="button" role="menuitem"><span class="icon">…</span>Label</button>
  </div>
</div>
```

`shell.js` handles opening, closing on outside click or Escape, and arrow-key navigation.

## Theme rules

- Use only the CSS variables from `css/theme.css` (and NodePad's extra tokens in `styles.css`) for colour. Never hard-code colours in components or inline styles.
- Don't edit `theme.css`, `app.css` or `theme.js`: they are copies of the template, so template updates can be taken over as they are. Put overrides and additions in `styles.css`.
- When you add a token, define it in all three places: `:root` (light), the `prefers-color-scheme: dark` block, and `:root[data-theme="dark"]`. The two dark blocks must stay identical.
- The theme is stored in `localStorage` under the key `theme` with the values `system`, `light` or `dark`. The toggle cycles through them in that order.
- Check every change in both light and dark, including the editor, before you call it done.

## Icons

- Use [Material Symbols Outlined](https://fonts.google.com/icons), loaded from Google Fonts.
- Write an icon as `<span class="icon">icon_name</span>`, using the icon's ligature name in lower snake case.
- Icons are outlined by default. Filled icons are used only for the active menu entry and the selected note in the tree.
- Don't mix in other icon sets, emoji or image icons.
- When an icon stands alone (no visible text), the surrounding button must have an `aria-label`.

## Logo and brand colours

- The UI identifies the app by its own icon (`assets/app-icon.svg`) and name. `assets/nodepad_logo.png` is for the README; `nodepad_icon.png` is the older icon, kept for anything that still links to it.
- Brand colours: grey `#838281`, blue `#0093dd`. The blue is the accent colour of the UI. Text-coloured uses (links, active menu item, icons) use `--color-accent`. Primary buttons use the exact logo blue (`--color-primary`), with white text in light mode and dark text in dark mode; keep their labels short.

## Design principles

The look is clean and quiet. Before adding something, ask whether it's needed.

- Lots of whitespace, few borders, no gradients, no heavy shadows. Shadows are only for overlays: the drawer, dropdowns, popovers, dialogs and toasts.
- One accent colour (brand blue), for the active state, primary buttons and links, not for decoration.
- One primary button per view at most (Edit or Save on the notes page). Other actions use `.button.secondary` or an `.icon-button`. Destructive secondary buttons add `.danger`.
- Group content in `.card` elements. A card may start with a `.card-header` (icon + title on a tinted strip); give every card in the same group a header, or none of them.
- Text is the system font stack, code the mono stack. Headings are semi-bold, body text is regular. Use `.muted` for secondary text.
- Use the spacing tokens (`--space-1` to `--space-6`) and radius tokens instead of arbitrary values.
- No banners, splash screens, badges or animations that don't help the user. Transitions are short (`--transition`) and respect `prefers-reduced-motion`.

## Accessibility

- Use real `<button>` and `<a>` elements, never clickable `<div>`s, for anything new.
- Keep visible focus outlines.
- Text must meet WCAG AA contrast in both themes.
- Keep the layout usable at 375px wide with no horizontal scrolling.

## Documentation

The user documentation exists twice and the copies must stay identical: `README.md` and `API.md` in the repo root, and the notes in `src/Bergdahl.NodePad.WebApp/Pages/` (`index.md` and `Documentation/`). Each note is `# <Title>` plus the matching README section. When a change alters what the docs describe, update both copies in the same change.
