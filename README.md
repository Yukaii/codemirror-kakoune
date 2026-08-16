# CodeMirror Kakoune

[![npm version](https://img.shields.io/npm/v/codemirror-kakoune)](https://www.npmjs.com/package/codemirror-kakoune)
[![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune)](https://jsr.io/@ykmade/codemirror-kakoune)

A CodeMirror 6 extension, CodeMirror 5 keymap integration, and Obsidian plugin that bring Kakoune's selection-first modal editing paradigm into the browser and desktop markdown editors.

## Packages

This monorepo contains:

- **[`kakoune-core-js`](./packages/kakoune-core)** [![npm](https://img.shields.io/npm/v/kakoune-core-js)](https://www.npmjs.com/package/kakoune-core-js) [![JSR](https://jsr.io/badges/@ykmade/kakoune-core-js)](https://jsr.io/@ykmade/kakoune-core-js): Framework-agnostic Kakoune engine (adapter, processor, portable commands).
- **[`codemirror-kakoune`](./packages/codemirror-kakoune)** [![npm](https://img.shields.io/npm/v/codemirror-kakoune)](https://www.npmjs.com/package/codemirror-kakoune) [![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune)](https://jsr.io/@ykmade/codemirror-kakoune): CodeMirror 6 adapter and prompts/rendering.
- **[`codemirror-kakoune-cm5`](./packages/codemirror-kakoune-cm5)** [![npm](https://img.shields.io/npm/v/codemirror-kakoune-cm5)](https://www.npmjs.com/package/codemirror-kakoune-cm5) [![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune-cm5)](https://jsr.io/@ykmade/codemirror-kakoune-cm5): CodeMirror 5 adapter.
- **[`obsidian-kakoune`](./packages/obsidian-kakoune)**: Obsidian community plugin providing native Kakoune modal editing.
- **[`playground`](./apps/playground)**: CodeMirror 6 interactive playground.
- **[`playground-cm5`](./apps/playground-cm5)**: CodeMirror 5-specific playground.

---

## Core Library Installation

Install the package via `npm`, `pnpm`, or `yarn`:

```bash
npm install codemirror-kakoune
```

Or via [JSR](https://jsr.io/@ykmade/codemirror-kakoune):

```bash
npx jsr add @ykmade/codemirror-kakoune
```

## Quick Start (CodeMirror 6)

Simply import and add the `kakoune` extension to your CodeMirror 6 configuration:

```typescript
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { kakoune } from "codemirror-kakoune";

const view = new EditorView({
  state: EditorState.create({
    doc: "Hello, Kakoune!",
    extensions: [
      basicSetup,
      kakoune() // Enables Kakoune modal editing!
    ]
  }),
  parent: document.querySelector("#editor")
});
```

### Configuration Options

You can customize the initial mode and callbacks using the options object:

```typescript
kakoune({
  initialMode: "select", // "select" (default) or "insert"
  onWhichKey: (pending, items, isWaitingForChar) => {
    // Optional hook for key prompts and which-key UI
  }
})
```

---

## Obsidian Plugin

Looking for Kakoune modal editing inside Obsidian? Check out [`packages/obsidian-kakoune`](./packages/obsidian-kakoune) for full instructions, settings, and features.

## CodeMirror 5

The CM5 package follows CodeMirror 5's native `keyMap` and command model. Install
`codemirror-kakoune-cm5`, then call `kakoune(editor)` after creating a CM5 editor.
The deployed CM5 playground is available at `/cm5/`.

```typescript
import CodeMirror from "codemirror";
import { kakoune } from "codemirror-kakoune-cm5";

const editor = CodeMirror(document.querySelector("#editor"));
kakoune(editor);
```

---

## Features & Supported Keybindings

- **Selection-first editing**: All motions update or extend active selections (`h`, `j`, `k`, `l`, `w`, `e`, `b`, `x`, etc.).
- **Insert modes**: `i`, `a`, `I`, `A`, `o`, `O`.
- **Search & Regex**: `/` (search forward), `?` (search backward), `n`/`N` (next/prev match), `s` (filter selections by regex), `S` (split selections by regex).
- **Goto & View modes**: `g` / `G` (`gh`, `gl`, `gk`, `gj`, `ge`, `gt`, `gb`), `v` / `V` (view centering/locking).
- **Yank, Delete, Paste & Replace**: `y`, `d`, `c`, `p`, `P`, `r`.
- **Delimiters & Matching**: `m`, `M`, `[` / `]` object selections.
- **Undo / Redo**: `u`, `U`.
- **Multiple selections**: Kakoune multiple cursor & selection manipulation.

---

## Development Scripts

- `pnpm dev` - run the interactive playground locally
- `pnpm test` - run unit test suite
- `pnpm build` - build all packages and both playgrounds
- `pnpm build:cm5` - build the CM5 package and playground
- `pnpm typecheck` - typecheck all packages across the workspace

## References

This project builds upon ideas and patterns from:

- [`mawww/kakoune`](https://github.com/mawww/kakoune)
- [`replit/codemirror-vim`](https://github.com/replit/codemirror-vim)
- [`71/dance`](https://github.com/71/dance)
