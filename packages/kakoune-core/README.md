# kakoune-core-js

> Framework-agnostic Kakoune modal editing engine in JavaScript/TypeScript.

[![npm version](https://img.shields.io/npm/v/kakoune-core-js)](https://www.npmjs.com/package/kakoune-core-js)
[![JSR](https://jsr.io/badges/@ykmade/kakoune-core-js)](https://jsr.io/@ykmade/kakoune-core-js)

`kakoune-core-js` provides the foundational modal editing logic, selection mathematics, key sequence processing, `kakrc` parser, and prompt controllers for Kakoune-style editing. It decouples core modal behavior from specific editor implementations, powering [`codemirror-kakoune`](../codemirror-kakoune), [`codemirror-kakoune-cm5`](../codemirror-kakoune-cm5), [`browser-kakoune`](../../apps/browser-extension), and [`obsidian-kakoune`](../obsidian-kakoune).

---

## Features

- **Framework-Agnostic Architecture**: Pure TypeScript logic with zero editor or DOM dependencies.
- **`EditorHost` Interface**: A standardized adapter interface that defines selection, text inspection, line navigation, and mutation operations.
- **`KakouneKeyProcessor`**: State machine supporting multi-key sequences (e.g. `g h`, `g j`), which-key introspection, count prefixes (e.g., `3w`, `5G`), user modes, and mode routing.
- **`parseKakrc` & Custom Scripting**: Full parser for `kakrc` configuration files (`map global normal ...`, `map global insert ...`, `declare-user-mode`, `set-register`).
- **`KakounePromptController`**: State controller managing regex selection (`s`) and regex splitting (`S`) prompts with syntax validation and error reporting.
- **Portable Kakoune Commands**:
  - **Motions**: `moveLeft`, `moveRight`, `moveUp`, `moveDown`, `selectWordForward`, `selectWordBackward`, `selectWordEnd`, `moveLineStart`, `moveLineEnd`, `jumpDocumentStart`, `jumpDocumentEnd`.
  - **Extensions**: `extendLeft`, `extendRight`, `extendUp`, `extendDown`, `extendWordForward`, `extendWordBackward`, `extendWordEnd`, `extendLineStart`, `extendLineEnd`, `extendToLine`, `extendDocumentStart`, `extendDocumentEnd`.
  - **Selections & Lines**: `selectLine`, `selectAll`, `joinLines` (`<A-j>` / `<A-J>`), `trimSelections` (`_`), `reduceToCursor` (`;`), `flipSelectionDirection` (`<A-;>`), `ensureForwardDirection` (`<A-:>`).
  - **Transformations**: `toUpperCaseSelection` (`~`), `toLowerCaseSelection` (`` ` ``), `swapCaseSelection` (`<A-`>`).
  - **Editing**: `deleteSelection` (`d`), `changeSelection` (`c`), `yankSelection` (`y`), `openLineBelow` (`o`), `openLineAbove` (`O`), `addEmptyLineBelow` (`<A-o>`), `addEmptyLineAbove` (`<A-O>`), `undoEdit` (`u`), `redoEdit` (`U`).

---

## Installation

```bash
npm install kakoune-core-js
# or
pnpm add kakoune-core-js
```

Or via [JSR](https://jsr.io/@ykmade/kakoune-core-js):

```bash
npx jsr add @ykmade/kakoune-core-js
```

---

## Usage Example

### 1. Implementing an `EditorHost`

```typescript
import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core-js";

export class CustomEditorAdapter implements EditorHost {
  private mode: KakouneMode = "select";
  private register = "";

  getMode(): KakouneMode { return this.mode; }
  setMode(mode: KakouneMode): void { this.mode = mode; }
  getDoc(): string { return "/* buffer text */"; }
  getDocLength(): number { return this.getDoc().length; }
  getLineCount(): number { return 1; }
  lineAt(pos: number): LineInfo { return { from: 0, to: 0, number: 1, text: "" }; }
  line(number: number): LineInfo { return { from: 0, to: 0, number: 1, text: "" }; }
  getSelections(): SelectionRange[] { return [{ anchor: 0, head: 0 }]; }
  setSelections(ranges: SelectionRange[], mainIndex?: number): void { /* ... */ }
  replaceRange(from: number, to: number, text: string): void { /* ... */ }
  undo(): void { /* ... */ }
  redo(): void { /* ... */ }
  getRegister(): string { return this.register; }
  setRegister(text: string): void { this.register = text; }
}
```

### 2. Loading `kakrc` and Key Processing

```typescript
import {
  KakouneKeyProcessor,
  normalizeKeyStroke,
  parseKakrc,
  moveLeft,
  moveRight,
  type KakouneBinding
} from "kakoune-core-js";

const bindings: Record<"select" | "insert", KakouneBinding<CustomEditorAdapter>[]> = {
  select: [
    { keys: ["h"], run: (editor, _arg, count) => moveLeft(editor, count ?? 1), description: "Move left" },
    { keys: ["l"], run: (editor, _arg, count) => moveRight(editor, count ?? 1), description: "Move right" },
    { keys: ["<Esc>"], run: (editor) => { editor.setMode("select"); return true; } }
  ],
  insert: [
    { keys: ["<Esc>"], run: (editor) => { editor.setMode("select"); return true; } }
  ]
};

const processor = new KakouneKeyProcessor(bindings);

// Load user's custom kakrc
processor.loadKakrc(`
  map global normal <space> ,
  map global insert jk <esc>
`);
```

---

## License

MIT
