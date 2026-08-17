# browser-kakoune

> Selection-first Kakoune modal editing for `<textarea>`, CodeMirror 5, and CodeMirror 6 across the web.

`browser-kakoune` is a cross-browser extension (Manifest V3 for Chromium and Mozilla Firefox) that brings the authentic Kakoune modal editing experience to web pages.

---

## Features

- **In-Place CodeMirror 6 Editor Swap**: Seamlessly upgrades any HTML `<textarea>` into a live CodeMirror 6 instance powered by [`codemirror-kakoune`](../../packages/codemirror-kakoune).
- **True Multi-Cursor & Block Selection Rendering**: Full visual rendering of multiple cursors, secondary selections, fat block cursors, and regex match highlights.
- **Two-Way Data Synchronization**: Real-time value synchronization and synthetic `input`/`change` event dispatching ensures complete compatibility with React, Vue, Svelte, Angular, and form submit handlers.
- **CodeMirror 5 & 6 Native Support**: Auto-detects existing CodeMirror instances on web pages (such as GitHub, LeetCode, REPLs) and attaches modal editing.
- **Shadow DOM Overlays**: Floating mode indicator badge, which-key suggestions popup, and regex search/split prompt (`s` / `S`) isolated from host page styles.
- **Custom `kakrc` Support**: Write your own remappings (`map global normal ...`, `map global insert ...`, `declare-user-mode`) directly in the options dashboard.
- **Domain Whitelist & Blacklist**: Control per-domain rules and toggle with <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>.

---

## Supported Browsers

- **Chromium Browsers**: Google Chrome, Microsoft Edge, Brave, Arc, Opera, Vivaldi
- **Mozilla Firefox**: Firefox 109+ / 121+ (Manifest V3)

---

## Installation & Development

### 1. Build the Extension

From the repository root:

```bash
pnpm install
pnpm --filter browser-kakoune build
```

The output extension bundle will be generated in `apps/browser-extension/dist`.

### 2. Load into Chrome / Chromium

1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `apps/browser-extension/dist` directory.

### 3. Load into Firefox

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on...**.
3. Select `apps/browser-extension/dist/manifest.json`.

---

## Keyboard Shortcuts

- <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>: Toggle `browser-kakoune` on/off for the focused element (reverting to native `<textarea>` or re-enabling CodeMirror 6).
- <kbd>Esc</kbd>: Return to `select` (normal) modal mode.
- <kbd>s</kbd> / <kbd>S</kbd>: Open regex select / split prompt.
- <kbd>C</kbd> / <kbd>Alt</kbd> + <kbd>C</kbd>: Duplicate cursor on line below / above.
- <kbd>Alt</kbd> + <kbd>j</kbd> / <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd>: Join selected lines.
- <kbd>~</kbd> / <kbd>`</kbd> / <kbd>Alt</kbd> + <kbd>`</kbd>: Convert uppercase / lowercase / swap case.

---

## Settings & Configuration

Click the extension icon in the toolbar or open the options page to configure:
- **Default Focus Mode**: `select` (normal) or `insert`
- **Visual Themes**: Kakoune Rose Pine, Dark Charcoal, Nord Arctic Blue, Gruvbox Warm, Light Crisp
- **Badge Position**: Bottom-Right, Top-Right, Bottom-Left, Top-Left
- **Which-Key Popup**: Toggle hints display
- **Domain Blacklist & Whitelist**: Wildcard patterns (e.g. `*.banking.com`, `github.com`)
- **Custom `kakrc` Editor**: Custom keymaps and macros

---

## License

MIT
