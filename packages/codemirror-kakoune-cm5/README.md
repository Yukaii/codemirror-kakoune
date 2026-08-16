# CodeMirror Kakoune CM5

CodeMirror 5 adapter over the shared `kakoune-core` engine.

```ts
import CodeMirror from "codemirror";
import { kakoune } from "codemirror-kakoune-cm5";

const editor = CodeMirror(document.querySelector("#editor"));
kakoune(editor);
```

## Available keys

- Move/select: `h j k l`, `w b e`, `0 $`, `g h`, `g l`, `g k`, `g j`, `g g`
- Extend: `H J K L`, `W B E`, `Alt-h`, `Alt-l`, `G h/l/k/j/g/G`, and `count+G`
- Edit: `x d c y`, `u U`, `o O`
- Insert: `i a I A`; use `Esc` to return to normal mode

Numeric counts work with character, line, and word motions. Unbound keys are
consumed in normal mode so they cannot fall through to CodeMirror's default
editing commands.
