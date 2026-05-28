# CodeMirror Kakoune

A CodeMirror 6 extension that brings Kakoune-style modal editing into the browser.

This repo starts from three references:

- [`replit/codemirror-vim`](https://github.com/replit/codemirror-vim)
- [`71/dance`](https://github.com/71/dance)
- [`mawww/kakoune`](https://github.com/mawww/kakoune)

## Goals

- Kakoune-style normal/insert mode handling for CodeMirror 6
- A playground/demo for trying the keymap live
- Unit tests for the key processor and editing commands
- TypeScript development with `pnpm`, `jest`, and `vite`

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
