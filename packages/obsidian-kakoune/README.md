# Obsidian Kakoune

Kakoune modal editing keybindings for [Obsidian](https://obsidian.md).

Powered by [`codemirror-kakoune`](https://github.com/Yukaii/codemirror-kakoune).

## Features

- **Modal editing:** Kakoune selection-first editing paradigm (`select` and `insert` modes).
- **Status bar:** Real-time mode indicator and pending key sequence prompt.
- **Commands:** Quickly toggle Kakoune editing or switch between select/insert modes.
- **Settings:** Customizable default initial mode and status bar visibility.

## Building from source

```bash
pnpm install
pnpm --filter obsidian-kakoune build
```

To install into your Obsidian vault:
1. Copy `main.js`, `manifest.json`, and `styles.css` to `<your-vault>/.obsidian/plugins/obsidian-kakoune/`
2. Enable community plugins in Obsidian settings and toggle on **Kakoune**.
