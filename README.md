# CodeMirror Kakoune

A CodeMirror 6 extension that brings Kakoune-style modal editing into the browser.

## Installation

Install the package via `npm`, `pnpm`, or `yarn`:

```bash
npm install codemirror-kakoune
```

## Usage

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

You can customize the initial mode using the options object:

```typescript
kakoune({
  initialMode: "insert" // "select" (default) or "insert"
})
```

## Scripts

- `pnpm dev` - run the playground
- `pnpm test` - run unit tests
- `pnpm build` - build the library and playground
- `pnpm typecheck` - run the TypeScript compiler without emitting files

## Current status

The first cut focuses on the core editing loop:

- mode switching
- motion keys
- line selection
- yank/delete/paste
- a small key sequence processor with pending-prefix support

The keymap will expand from there as the Kakoune behavior is filled in.

## References

This repo starts from three references:

- [`replit/codemirror-vim`](https://github.com/replit/codemirror-vim)
- [`71/dance`](https://github.com/71/dance)
- [`mawww/kakoune`](https://github.com/mawww/kakoune)
