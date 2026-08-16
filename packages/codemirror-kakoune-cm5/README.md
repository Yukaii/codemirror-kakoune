# CodeMirror Kakoune CM5

CodeMirror 5 adapter over the shared [`kakoune-core-js`](https://github.com/Yukaii/codemirror-kakoune/tree/main/packages/kakoune-core) engine.

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
- Select/split: `%` selects the buffer, `s` selects regex matches, `S` splits on regex matches
- Insert: `i a I A`; use `Esc` to return to normal mode

Numeric counts work with character, line, and word motions. Unbound keys are
consumed in normal mode so they cannot fall through to CodeMirror's default
editing commands.

Use `onPrompt` to render the active prompt and `onPromptError` to display
invalid-pattern or empty-result errors. Prompt input supports text, space,
backspace, `Enter` to commit, and `Esc` to cancel.
