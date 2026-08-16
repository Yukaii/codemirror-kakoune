# kakoune-core-js

Framework-agnostic Kakoune modal editing engine in JavaScript/TypeScript.

[![npm version](https://img.shields.io/npm/v/kakoune-core-js)](https://www.npmjs.com/package/kakoune-core-js)

`kakoune-core-js` provides the foundational modal editing logic, selection mathematics, key sequence processing, and prompt controllers for Kakoune-style editing. It decouples core modal behavior from specific editor implementations, powering both [`codemirror-kakoune`](https://github.com/Yukaii/codemirror-kakoune/tree/main/packages/codemirror-kakoune) (CodeMirror 6) and [`codemirror-kakoune-cm5`](https://github.com/Yukaii/codemirror-kakoune/tree/main/packages/codemirror-kakoune-cm5) (CodeMirror 5).

---

## Features

- **Framework-Agnostic Architecture**: Pure TypeScript logic with zero editor or DOM dependencies.
- **`EditorHost` Interface**: A standardized adapter interface that defines selection, text inspection, line navigation, and mutation operations.
- **`KakouneKeyProcessor`**: State machine supporting multi-key sequences (e.g. `g h`, `g j`), which-key introspection, count prefixes (e.g., `3w`, `5G`), and mode routing.
- **`KakounePromptController`**: State controller managing regex selection (`s`) and regex splitting (`S`) prompts with syntax validation and error reporting.
- **Portable Kakoune Commands**: Word-wise motions (`w`, `b`, `e`, `W`, `B`, `E`), line selections (`x`), buffer selections (`%`), clipboard operations, and insert/append actions.

---

## Installation

```bash
npm install kakoune-core-js
# or
pnpm add kakoune-core-js
# or
yarn add kakoune-core-js
```

---

## Architecture & Usage

### 1. Implementing an `EditorHost`

To adapt `kakoune-core-js` to any editor (Monaco, CodeMirror, Ace, custom text areas), implement the `EditorHost` interface:

```ts
import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core-js";

export class CustomEditorAdapter implements EditorHost {
  getMode(): KakouneMode { /* ... */ }
  setMode(mode: KakouneMode): void { /* ... */ }
  getSelection(): SelectionRange { /* ... */ }
  setSelection(range: SelectionRange): void { /* ... */ }
  getText(from?: number, to?: number): string { /* ... */ }
  getLineInfo(offset: number): LineInfo { /* ... */ }
  getLineCount(): number { /* ... */ }
  replaceRange(from: number, to: number, text: string): void { /* ... */ }
  setRegister(name: string, value: string): void { /* ... */ }
  getRegister(name: string): string | undefined { /* ... */ }
  undo(): void { /* ... */ }
  redo(): void { /* ... */ }
}
```

### 2. Processing Key Events

Use `KakouneKeyProcessor` and `normalizeKeyStroke` to route keys according to Kakoune mode bindings:

```ts
import {
  KakouneKeyProcessor,
  normalizeKeyStroke,
  moveLeft,
  moveRight,
  type KakouneBinding
} from "kakoune-core-js";

const bindings: Record<"select" | "insert", KakouneBinding<CustomEditorAdapter>[]> = {
  select: [
    { keys: ["h"], run: (adapter, _arg, count) => moveLeft(adapter, count ?? 1), description: "Move left" },
    { keys: ["l"], run: (adapter, _arg, count) => moveRight(adapter, count ?? 1), description: "Move right" },
  ],
  insert: [
    { keys: ["<Esc>"], run: (adapter) => { adapter.setMode("select"); return true; }, description: "Normal mode" }
  ]
};

const processor = new KakouneKeyProcessor(bindings);

function handleKeyDown(event: KeyboardEvent, adapter: CustomEditorAdapter) {
  const key = normalizeKeyStroke(event);
  if (!key) return;

  const handled = processor.handle(adapter.getMode(), key, adapter);
  if (handled) {
    event.preventDefault();
  }
}
```

---

## Exported API

- **Key Processing & Normalization**: `KakouneKeyProcessor`, `normalizeKeyStroke`, `normalizeCm5Key`, `normalizeCm5Keys`
- **Prompts**: `KakounePromptController`, `type KakounePromptState`, `type PromptType`
- **Commands & Motions**:
  - Word motions: `selectWordForward`, `selectWordBackward`, `selectWordEnd`, `extendWordForward`, `extendWordBackward`, `extendWordEnd`
  - Directional movements: `moveLeft`, `moveRight`, `moveUp`, `moveDown`, `extendLeft`, `extendRight`, `extendUp`, `extendDown`
  - Line & Document: `selectLine`, `selectAll`, `moveLineStart`, `moveLineEnd`, `extendLineStart`, `extendLineEnd`, `jumpDocumentStart`, `jumpDocumentEnd`
  - Edits: `deleteSelection`, `changeSelection`, `yankSelection`, `openLineBelow`, `openLineAbove`, `undoEdit`, `redoEdit`
  - Mode switches: `setMode`, `enterInsert`, `enterInsertLineStart`, `enterInsertLineEnd`
- **Types**: `EditorHost`, `SelectionRange`, `LineInfo`, `KakouneMode`, `KakouneBinding`

---

## License

MIT
