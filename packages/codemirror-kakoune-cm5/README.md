# CodeMirror Kakoune CM5

CodeMirror 5 adapter over the shared `kakoune-core` engine.

```ts
import CodeMirror from "codemirror";
import { kakoune } from "codemirror-kakoune-cm5";

const editor = CodeMirror(document.querySelector("#editor"));
kakoune(editor);
```

The installed keymaps are `kakoune` for select mode and `kakouneInsert` for
insert mode. They can be extended with CodeMirror 5's `addKeyMap` API.
