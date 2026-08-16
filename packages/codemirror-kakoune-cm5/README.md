# CodeMirror Kakoune CM5

[![npm version](https://img.shields.io/npm/v/codemirror-kakoune-cm5)](https://www.npmjs.com/package/codemirror-kakoune-cm5)
[![JSR](https://jsr.io/badges/@ykmade/codemirror-kakoune-cm5)](https://jsr.io/@ykmade/codemirror-kakoune-cm5)

CodeMirror 5 adapter over the shared [`kakoune-core-js`](../kakoune-core) engine, adhering to CodeMirror 5's native `keyMap` architecture.

---

## Installation

```bash
npm install codemirror-kakoune-cm5 codemirror@^5.65.0
# or
pnpm add codemirror-kakoune-cm5 codemirror@^5.65.0
```

Or via [JSR](https://jsr.io/@ykmade/codemirror-kakoune-cm5):

```bash
npx jsr add @ykmade/codemirror-kakoune-cm5
```

---

## Quick Start

```typescript
import CodeMirror from "codemirror";
import { kakoune } from "codemirror-kakoune-cm5";

const editor = CodeMirror(document.querySelector("#editor"), {
  lineNumbers: true,
  tabSize: 2
});

kakoune(editor, {
  initialMode: "select",
  onWhichKey: (pending, items) => {
    // Optional hook for which-key UI
  },
  onPrompt: prompt => {
    // Optional hook for regex select (s) / split (S) UI
  }
});
```

---

## Key Features

- **Motions**: `h j k l`, `w b e`, `W B E`, `0 $`, `g h/l/k/j/g`, `G h/l/k/j/g/G`, `count+G`
- **Selections & Lines**: `x` (select line), `%` (select all), `<A-j>` (join lines), `<A-J>` (join lines & select spaces), `_` (trim whitespace)
- **Transformations**: `~` (uppercase), `` ` `` (lowercase), `<A-`>` (swap case)
- **Edits**: `d` (delete), `c` (change), `y` (yank), `p` (paste after), `P` (paste before), `o` (open below), `O` (open above), `<A-o>` / `<A-O>` (empty lines)
- **Regex & Search**: `s` (select matches), `S` (split selection)
- **History**: `u` (undo), `U` (redo)

---

## License

MIT
