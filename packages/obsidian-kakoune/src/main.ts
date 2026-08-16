import { App, MarkdownView, Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { Compartment, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kakoune, kakouneStateField, getKakouneState } from "codemirror-kakoune";

interface KakounePluginSettings {
  enabled: boolean;
  showStatusBar: boolean;
  defaultMode: "select" | "insert";
}

const DEFAULT_SETTINGS: KakounePluginSettings = {
  enabled: true,
  showStatusBar: true,
  defaultMode: "select"
};

function formatModeLabel(mode: string): string {
  if (mode === "select") return "NORMAL";
  return mode.toUpperCase();
}

export default class KakounePlugin extends Plugin {
  settings: KakounePluginSettings = DEFAULT_SETTINGS;
  private statusBarItemEl: HTMLElement | null = null;
  private kakouneCompartment = new Compartment();
  private pendingKeys: string[] = [];
  private isWaitingForChar = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register dynamic CodeMirror extension compartment
    this.registerEditorExtension([
      this.kakouneCompartment.of(this.buildKakouneExtension()),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet || update.transactions.length > 0) {
          this.updateStatusBar(update.view);
        }
      })
    ]);

    // Setup status bar
    if (this.settings.showStatusBar) {
      this.statusBarItemEl = this.addStatusBarItem();
      this.statusBarItemEl.addClass("kakoune-status-bar");
      this.statusBarItemEl.addEventListener("click", () => {
        void this.toggleEnabled();
      });
      this.renderStatusBar("select", []);
    }

    // Register Commands
    this.addCommand({
      id: "toggle",
      name: "Toggle modal editing",
      callback: () => {
        void this.toggleEnabled();
      }
    });

    this.addCommand({
      id: "switch-to-normal-mode",
      name: "Switch to normal mode",
      editorCallback: (editor) => {
        // @ts-expect-error Obsidian Editor provides cm EditorView internally
        const cm = editor.cm as EditorView | undefined;
        if (cm) {
          const state = getKakouneState(cm.state);
          if (state && state.mode !== "select") {
            cm.contentDOM.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
            );
          }
        }
      }
    });

    this.addCommand({
      id: "switch-to-insert-mode",
      name: "Switch to insert mode",
      editorCallback: (editor) => {
        // @ts-expect-error Obsidian Editor provides cm EditorView internally
        const cm = editor.cm as EditorView | undefined;
        if (cm) {
          const state = getKakouneState(cm.state);
          if (state && state.mode !== "insert") {
            cm.contentDOM.dispatchEvent(
              new KeyboardEvent("keydown", { key: "i", bubbles: true, cancelable: true })
            );
          }
        }
      }
    });

    // Add Settings Tab
    this.addSettingTab(new KakouneSettingTab(this.app, this));

    // Listen to active leaf changes to refresh status bar
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const view = this.getActiveEditorView();
        if (view) {
          this.updateStatusBar(view);
        }
      })
    );
  }

  onunload(): void {
    if (this.statusBarItemEl) {
      this.statusBarItemEl.remove();
      this.statusBarItemEl = null;
    }
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<KakounePluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshExtension();
    this.updateStatusBarVisibility();
  }

  private buildKakouneExtension(): Extension {
    if (!this.settings.enabled) {
      return [];
    }

    return kakoune({
      initialMode: this.settings.defaultMode,
      onWhichKey: (pending, _items, isWaitingForChar) => {
        this.pendingKeys = pending;
        this.isWaitingForChar = isWaitingForChar;
        const view = this.getActiveEditorView();
        if (view) {
          this.updateStatusBar(view);
        }
      }
    });
  }

  private refreshExtension(): void {
    const extension = this.buildKakouneExtension();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        // @ts-expect-error Obsidian markdown view editor has cm EditorView
        const cm = leaf.view.editor?.cm as EditorView | undefined;
        if (cm) {
          cm.dispatch({
            effects: this.kakouneCompartment.reconfigure(extension)
          });
        }
      }
    });
  }

  private getActiveEditorView(): EditorView | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    // @ts-expect-error Obsidian markdown view editor has cm EditorView
    return (view.editor?.cm as EditorView) ?? null;
  }

  private updateStatusBar(view: EditorView): void {
    if (!this.settings.showStatusBar || !this.statusBarItemEl) return;

    if (!this.settings.enabled) {
      this.statusBarItemEl.setText("Kak: off");
      this.statusBarItemEl.removeAttribute("data-mode");
      return;
    }

    try {
      const state = view.state.field(kakouneStateField, false);
      const mode = state ? state.mode : this.settings.defaultMode;
      const prompt = state
        ? state.searchPrompt !== null
          ? `search: ${state.searchPrompt}`
          : state.selectPrompt !== null
            ? `select: ${state.selectPrompt}`
            : state.splitPrompt !== null
              ? `split: ${state.splitPrompt}`
              : null
        : null;
      this.renderStatusBar(mode, this.pendingKeys, prompt);
    } catch {
      this.renderStatusBar(this.settings.defaultMode, this.pendingKeys);
    }
  }

  private renderStatusBar(mode: string, pendingKeys: string[], prompt: string | null = null): void {
    if (!this.statusBarItemEl) return;

    this.statusBarItemEl.empty();
    this.statusBarItemEl.setAttribute("data-mode", mode);

    const badge = this.statusBarItemEl.createSpan({ cls: "kakoune-mode-badge" });
    badge.setText(formatModeLabel(mode));

    if (prompt !== null) {
      const promptEl = this.statusBarItemEl.createSpan({ cls: "kakoune-prompt" });
      promptEl.setText(` ${prompt}`);
    } else if (pendingKeys.length > 0 || this.isWaitingForChar) {
      const pendingEl = this.statusBarItemEl.createSpan({ cls: "kakoune-pending-keys" });
      const prompt = this.isWaitingForChar ? " (char?)" : "";
      pendingEl.setText(` ${pendingKeys.join(" ")}${prompt}`);
    }
  }

  private updateStatusBarVisibility(): void {
    if (this.settings.showStatusBar) {
      if (!this.statusBarItemEl) {
        this.statusBarItemEl = this.addStatusBarItem();
        this.statusBarItemEl.addClass("kakoune-status-bar");
        this.statusBarItemEl.addEventListener("click", () => {
          void this.toggleEnabled();
        });
      }
      const view = this.getActiveEditorView();
      if (view) {
        this.updateStatusBar(view);
      } else {
        this.renderStatusBar("select", []);
      }
    } else if (this.statusBarItemEl) {
      this.statusBarItemEl.remove();
      this.statusBarItemEl = null;
    }
  }

  async toggleEnabled(): Promise<void> {
    this.settings.enabled = !this.settings.enabled;
    await this.saveSettings();
  }
}

class KakouneSettingTab extends PluginSettingTab {
  plugin: KakounePlugin;

  constructor(app: App, plugin: KakounePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Enable modal editing",
        desc: "Toggle modal keybindings and motions in Obsidian editor.",
        control: {
          type: "toggle",
          key: "enabled",
          defaultValue: DEFAULT_SETTINGS.enabled
        }
      },
      {
        name: "Show status bar item",
        desc: "Display the active mode (normal / insert) in the status bar.",
        control: {
          type: "toggle",
          key: "showStatusBar",
          defaultValue: DEFAULT_SETTINGS.showStatusBar
        }
      },
      {
        name: "Default initial mode",
        desc: "Initial mode when opening a document.",
        control: {
          type: "dropdown",
          key: "defaultMode",
          defaultValue: DEFAULT_SETTINGS.defaultMode,
          options: {
            select: "Normal",
            insert: "Insert"
          }
        }
      }
    ];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "enabled" && typeof value === "boolean") {
      this.plugin.settings.enabled = value;
    } else if (key === "showStatusBar" && typeof value === "boolean") {
      this.plugin.settings.showStatusBar = value;
    } else if (key === "defaultMode" && (value === "select" || value === "insert")) {
      this.plugin.settings.defaultMode = value;
    }
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable modal editing")
      .setDesc("Toggle modal keybindings and motions in Obsidian editor.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Show status bar item")
      .setDesc("Display the active mode (normal / insert) in the status bar.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Default initial mode")
      .setDesc("Initial mode when opening a document.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("select", "Normal")
          .addOption("insert", "Insert")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value as "select" | "insert";
            await this.plugin.saveSettings();
          })
      );
  }
}
