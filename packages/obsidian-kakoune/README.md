# Obsidian Kakoune

Kakoune modal editing keybindings for [Obsidian](https://obsidian.md).

Powered by [`codemirror-kakoune`](https://github.com/Yukaii/codemirror-kakoune).

Bring Kakoune's fast, selection-first modal editing paradigm into Obsidian's Markdown editor.

---

## Features

- 🎯 **Selection-First Modal Editing:** Native Kakoune workflow (`NORMAL` / `select` mode and `INSERT` mode). All motions immediately create and adjust selections before acting on them.
- 📊 **Status Bar Integration:** Real-time display of the active editing mode (`NORMAL` / `INSERT`), pending key sequences, and interactive search/select/split prompts. Click the status bar item to toggle the plugin on and off.
- ⌨️ **Rich Motion & Action Support:**
  - Standard motions: `h`, `j`, `k`, `l`, `w`, `e`, `b`, `W`, `E`, `B`, `x`, `X`, `%`
  - Extend selection motions: `H`, `J`, `K`, `L`
  - Insert modes: `i` (before selection), `a` (after selection), `I` (line start), `A` (line end), `o` (open line below), `O` (open line above)
  - Goto commands: `gh` (line start), `gl` (line end), `gk` (buffer top), `gj` (buffer bottom), `ge` (buffer end), `gt` (window top), `gb` (window bottom)
  - Object & delimiter selections: `m` / `M` (matching brackets/delimiters), `[` / `]` object bounds
  - Search & regex filters: `/` (forward search), `?` (backward search), `n` / `N` (next/previous match), `s` (select matches within current selections), `S` (split selections on regex)
  - Edit & manipulation: `d` (delete), `c` (change), `y` (yank), `p` / `P` (paste after/before), `r` (replace char), `u` / `U` (undo/redo), `<` / `>` (indent/dedent)
  - Selection refinement: `;` (reduce to cursor), `<Alt-;>` (flip cursor/anchor)
- ⚙️ **Configurable Settings:** Customize status bar display and choose your default initial mode (`NORMAL` vs `INSERT`).
- ⚡ **Command Palette Support:**
  - `Toggle Kakoune modal editing`
  - `Switch to normal mode`
  - `Switch to insert mode`

---

## Installation

### Method 1: Obsidian Community Plugins (Recommended once listed)

1. In Obsidian, open **Settings** > **Community plugins**.
2. Make sure **Restricted mode** is turned off.
3. Click **Browse** and search for `Kakoune`.
4. Click **Install**, then click **Enable**.

### Method 2: Via Obsidian42 - BRAT (Beta Tester)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins.
2. In Obsidian settings, open **BRAT**.
3. Under **Add Beta plugin**, enter repository: `https://github.com/Yukaii/codemirror-kakoune`.
4. BRAT will automatically fetch the latest release assets and keep the plugin updated.

### Method 3: Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/Yukaii/codemirror-kakoune/releases).
2. Inside your Obsidian vault, navigate to the plugins folder:
   ```
   <your-vault>/.obsidian/plugins/obsidian-kakoune/
   ```
   *(Create the directory if it does not exist)*.
3. Place `main.js`, `manifest.json`, and `styles.css` inside that folder.
4. Reload Obsidian, open **Settings** > **Community plugins**, and enable **Kakoune**.

---

## Configuration

In Obsidian **Settings** > **Kakoune**:

| Setting | Description | Default |
|---|---|---|
| **Enable Kakoune modal editing** | Toggle Kakoune keybindings and modal editing on or off. | `true` |
| **Show status bar item** | Display active mode and pending key prompts in the bottom status bar. | `true` |
| **Default initial mode** | Choose the initial mode when opening a note (`Normal` or `Insert`). | `Normal` |

---

## Building from Source

```bash
# Clone the repository
git clone https://github.com/Yukaii/codemirror-kakoune.git
cd codemirror-kakoune

# Install dependencies
pnpm install

# Build the Obsidian plugin
pnpm --filter obsidian-kakoune build
```

The compiled output `main.js`, along with `manifest.json` and `styles.css`, is in `packages/obsidian-kakoune/`.

---

## License

MIT © [YUKAI](https://github.com/Yukaii)

