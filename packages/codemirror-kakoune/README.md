# CodeMirror Kakoune

[![npm version](https://img.shields.io/npm/v/codemirror-kakoune)](https://www.npmjs.com/package/codemirror-kakoune)
[![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune)](https://jsr.io/@ykmade/codemirror-kakoune)

A CodeMirror 6 extension that brings Kakoune's selection-first modal editing paradigm into modern browsers.

---

## Installation

```bash
npm install codemirror-kakoune @codemirror/state @codemirror/view
# or
pnpm add codemirror-kakoune @codemirror/state @codemirror/view
```

Or via [JSR](https://jsr.io/@ykmade/codemirror-kakoune):

```bash
npx jsr add @ykmade/codemirror-kakoune
```

---

## Usage

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
        initialMode: "select", // "select" (default) or "insert"
        onWhichKey: (pending, items) => {
          // Optional hook for which-key UI
        }
      })
    ]
  }),
  parent: document.querySelector("#editor")
});
```

---

## Features

- **Selection-First Motions**: `h`, `j`, `k`, `l`, `w`, `b`, `e`, `W`, `B`, `E`, `0`, `$`, `gh`, `gl`, `gk`, `gj`, `gg`, `G`.
- **Multiple Cursors & Block Selection**: Real multiple cursors and visual block rendering.
- **Search & Regex**: `/` (search forward), `?` (search backward), `s` (select matches), `S` (split matches), `*` (search current selection).
- **Line & Buffer Manipulation**: `x` (select line), `%` (select all), `<A-j>` (join lines), `<A-J>` (join lines and select spaces), `_` (trim whitespace).
- **Case Transformations**: `~` (uppercase), `` ` `` (lowercase), `<A-`>` (swap case).
- **Yank & Registers**: `y`, `p`, `P`, `R`, `"`, `q`/`Q` (macros).
- **Undo / Redo History**: `u`, `U`, `<A-u>`, `<A-U>` (selection history).
- **Object Selections**: `<A-i>` / `<A-a>` for parentheses, braces, brackets, quotes, and words.

---

## License

MIT
