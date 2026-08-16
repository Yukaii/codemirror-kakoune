# CodeMirror Kakoune

[![npm version](https://img.shields.io/npm/v/codemirror-kakoune)](https://www.npmjs.com/package/codemirror-kakoune)
[![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune)](https://jsr.io/@ykmade/codemirror-kakoune)

A modular suite bringing Kakoune's selection-first modal editing paradigm to CodeMirror 6, CodeMirror 5, Obsidian, and web browsers.

---

## Ecosystem & Packages

| Package / App | Version / Target | Description | Links |
| :--- | :--- | :--- | :--- |
| **[`kakoune-core-js`](./packages/kakoune-core)** | [![npm](https://img.shields.io/npm/v/kakoune-core-js)](https://www.npmjs.com/package/kakoune-core-js) | Framework-agnostic Kakoune engine (`EditorHost`, `KakouneKeyProcessor`, `parseKakrc`, portable commands) | [npm](https://www.npmjs.com/package/kakoune-core-js) · [JSR](https://jsr.io/@ykmade/kakoune-core-js) |
| **[`codemirror-kakoune`](./packages/codemirror-kakoune)** | [![npm](https://img.shields.io/npm/v/codemirror-kakoune)](https://www.npmjs.com/package/codemirror-kakoune) | CodeMirror 6 extension with modal editing, prompt controllers, and multiple selection rendering | [npm](https://www.npmjs.com/package/codemirror-kakoune) · [JSR](https://jsr.io/@ykmade/codemirror-kakoune) |
| **[`codemirror-kakoune-cm5`](./packages/codemirror-kakoune-cm5)** | [![npm](https://img.shields.io/npm/v/codemirror-kakoune-cm5)](https://www.npmjs.com/package/codemirror-kakoune-cm5) | CodeMirror 5 adapter adhering to CM5's native `keyMap` architecture | [npm](https://www.npmjs.com/package/codemirror-kakoune-cm5) · [JSR](https://jsr.io/@ykmade/codemirror-kakoune-cm5) |
| **[`obsidian-kakoune`](./packages/obsidian-kakoune)** | Obsidian Plugin | Desktop Obsidian plugin providing native modal editing for markdown notes | [README](./packages/obsidian-kakoune) |
| **[`browser-kakoune`](./apps/browser-extension)** | Browser Extension (MV3) | WebExtension (Chrome, Firefox, Edge, Brave) bringing Kakoune modal editing to `<textarea>`, CM5, and CM6 | [README](./apps/browser-extension) |
| **[`playground`](./apps/playground)** | Vite App (CM6) | Interactive web playground testing CodeMirror 6 with Kakoune bindings | [Live Demo](https://yukaii.github.io/codemirror-kakoune/) |
| **[`playground-cm5`](./apps/playground-cm5)** | Vite App (CM5) | Interactive web playground testing CodeMirror 5 with Kakoune bindings | [Live Demo](https://yukaii.github.io/codemirror-kakoune/cm5/) |

---

## Quick Start

### CodeMirror 6

```bash
npm install codemirror-kakoune @codemirror/state @codemirror/view
```

```typescript
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { kakoune } from "codemirror-kakoune";

const view = new EditorView({
  state: EditorState.create({
    doc: "Hello, Kakoune!",
    extensions: [
      basicSetup,
      kakoune({
        initialMode: "select", // "select" (normal) or "insert"
        onWhichKey: (pending, items) => {
          // Optional hook for which-key UI
        }
      })
    ]
  }),
  parent: document.querySelector("#editor")
});
```

### CodeMirror 5

```bash
npm install codemirror-kakoune-cm5 codemirror@^5.65.0
```

```typescript
import CodeMirror from "codemirror";
import { kakoune } from "codemirror-kakoune-cm5";

const editor = CodeMirror(document.querySelector("#editor"));
kakoune(editor);
```

### Browser Extension (`browser-kakoune`)

Build and load the extension into any Chromium or Firefox browser:

```bash
pnpm --filter browser-kakoune build
# Load unpacked from apps/browser-extension/dist
```

---

## Keybindings Specification Reference

| Category | Keys | Action Description |
| :--- | :--- | :--- |
| **Motions** | `h` / `j` / `k` / `l` | Move cursor left / down / up / right |
| | `H` / `J` / `K` / `L` | Extend selection left / down / up / right |
| | `w` / `b` / `e` | Select word forward / backward / to word end |
| | `W` / `B` / `E` | Extend word forward / backward / to word end |
| | `0` / `$` | Move to line start / line end |
| | `g h` / `g l` | Move to line start / line end |
| | `<A-h>` / `<A-l>` | Extend selection to line start / line end |
| | `g k` / `g j` / `g g` | Jump to document start / document end |
| | `G` / `G h` / `G l` ... | Extend to line (with count) / document bounds |
| **Multi-Selection** | `C` / `<A-C>` | Duplicate selection on line below / above (multi-cursor) |
| | `<A-s>` | Split active selections on newlines |
| | `<Space>` | Keep only primary selection (clear secondary) |
| | `<A-Space>` | Remove primary selection, keep secondary |
| | `)` / `(` | Cycle primary selection forward / backward |
| | `<A-)>` / `<A-(>` | Rotate selections text content forward / backward |
| **Lines & Selections** | `x` | Select whole line (including newline) |
| | `%` | Select entire buffer |
| | `<A-j>` | Join selected lines (replaces newline/indent with space) |
| | `<A-J>` | Join selected lines and select inserted spaces |
| | `_` | Trim whitespace from selection boundaries |
| | `;` | Reduce selections to cursor (anchor = head) |
| | `<A-;>` | Flip selection direction (swap anchor and head) |
| | `<A-:>` | Ensure selection is forward direction (`anchor <= head`) |
| **Editing** | `i` / `a` | Enter insert mode before / after selections |
| | `I` / `A` | Enter insert mode at line start / line end |
| | `o` / `O` | Open line below / above and enter insert mode |
| | `<A-o>` / `<A-O>` | Insert empty line below / above without entering insert |
| | `d` / `c` | Delete selection / Change selection |
| | `~` / ``` ` ``` / `<A-`>` | Convert uppercase / lowercase / swap case |
| | `r` | Replace character under selections with next keystroke |
| **Registers & History** | `y` | Yank selections into register |
| | `p` / `P` | Paste register after / before selections |
| | `u` / `U` | Undo / Redo last edit change |
| | `<A-u>` / `<A-U>` | Undo / Redo selection history change |
| | `"` | Select named register for next command |
| | `q` / `Q` | Play macro / Record macro |
| **Search & Regex** | `/` / `?` | Search forward / backward |
| | `n` / `N` | Next / previous search match |
| | `*` | Set search pattern from current selection |
| | `s` | Open prompt to select regex matches within selection |
| | `S` | Open prompt to split selections on regex matches |

---

## Custom `kakrc` Scripting Support

`kakoune-core-js` includes a built-in `kakrc` parser (`parseKakrc`) and key processor remapping engine supporting:

```kak
# Custom key mappings
map global normal <space> ,
map global insert jk <esc>

# User-defined modes
declare-user-mode mytools
map global normal <a-m> ':enter-user-mode mytools<ret>'
map global mytools d 'xyd'

# Registers & options
set-register a 'custom macro'
set-option global tabstop 4
```

---

## Development & Monorepo Workflows

```bash
# Install all dependencies
pnpm install

# Run tests across all packages
pnpm test

# Typecheck workspace
pnpm typecheck

# Build all libraries and apps
pnpm build

# Run interactive CM6 playground dev server
pnpm dev

# Build browser extension
pnpm build:extension
```

---

## References & Credits

This project builds upon ideas and patterns from:

- [`mawww/kakoune`](https://github.com/mawww/kakoune) - The Kakoune editor by Maxime Coste
- [`replit/codemirror-vim`](https://github.com/replit/codemirror-vim) - CodeMirror Vim keymap
- [`71/dance`](https://github.com/71/dance) - Kakoune-inspired modal editing for VS Code
