import { EditorView } from "@codemirror/view";
import { EditorState, EditorSelection } from "@codemirror/state";
import {
  kakoune,
  kakouneStateField,
  setKakouneModeEffect,
  type KakouneMode,
  type WhichKeyItem
} from "codemirror-kakoune";

export interface CM6OverlayOptions {
  initialMode?: KakouneMode;
  onWhichKey?: (pending: string[], items: WhichKeyItem[]) => void;
  onModeChange?: (mode: KakouneMode) => void;
}

export class CM6OverlayEditor {
  private container: HTMLDivElement;
  private view: EditorView;
  private isDestroyed = false;
  private originalDisplay = "";
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly textarea: HTMLTextAreaElement,
    options: CM6OverlayOptions = {}
  ) {
    const computed = window.getComputedStyle(textarea);

    // Create container matching textarea position and dimensions
    this.container = document.createElement("div");
    this.container.className = "kakoune-cm6-overlay-wrapper";
    this.container.style.width = `${textarea.offsetWidth || textarea.clientWidth || 300}px`;
    this.container.style.height = `${textarea.offsetHeight || textarea.clientHeight || 150}px`;
    this.container.style.minHeight = `${Math.max(50, textarea.clientHeight)}px`;
    this.container.style.boxSizing = computed.boxSizing;
    this.container.style.display = computed.display === "inline" ? "inline-block" : computed.display;
    this.container.style.margin = computed.margin;

    // Build custom theme inheriting host textarea typography and colors
    const customTheme = EditorView.theme({
      "&": {
        height: "100%",
        width: "100%",
        fontFamily: computed.fontFamily || "monospace",
        fontSize: computed.fontSize || "13px",
        lineHeight: computed.lineHeight || "1.4",
        backgroundColor: computed.backgroundColor !== "rgba(0, 0, 0, 0)" && computed.backgroundColor !== "transparent"
          ? computed.backgroundColor
          : "inherit",
        color: computed.color || "inherit",
        border: computed.border || "1px solid #393552",
        borderRadius: computed.borderRadius || "4px",
        padding: "0"
      },
      "&.cm-focused": {
        outline: computed.outline || "none"
      },
      ".cm-content": {
        padding: computed.padding || "8px",
        fontFamily: "inherit",
        caretColor: "auto"
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "inherit"
      }
    });

    const initialMode = options.initialMode ?? "select";

    // Create CodeMirror 6 EditorView
    this.view = new EditorView({
      state: EditorState.create({
        doc: textarea.value,
        extensions: [
          customTheme,
          kakoune({
            initialMode,
            onWhichKey: options.onWhichKey
          }),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              this.syncToTextarea();
            }
            if (options.onModeChange) {
              try {
                const mode = update.state.field(kakouneStateField).mode;
                options.onModeChange(mode);
              } catch {
                // Ignore
              }
            }
          })
        ]
      }),
      parent: this.container
    });

    // Set cursor position corresponding to textarea's selectionStart / selectionEnd
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const isBackward = textarea.selectionDirection === "backward";
    try {
      this.view.dispatch({
        selection: EditorSelection.create([
          EditorSelection.range(isBackward ? end : start, isBackward ? start : end)
        ], 0)
      });
    } catch {
      // Ignore
    }

    // Hide original textarea and insert overlay in DOM
    this.originalDisplay = textarea.style.display;
    textarea.style.display = "none";
    textarea.parentNode?.insertBefore(this.container, textarea);

    // Watch for size adjustments
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.view.requestMeasure();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  getTextarea(): HTMLTextAreaElement {
    return this.textarea;
  }

  getView(): EditorView {
    return this.view;
  }

  getMode(): KakouneMode {
    try {
      return this.view.state.field(kakouneStateField).mode;
    } catch {
      return "select";
    }
  }

  setMode(mode: KakouneMode): void {
    this.view.dispatch({
      effects: setKakouneModeEffect.of(mode)
    });
  }

  focus(): void {
    this.view.focus();
  }

  private syncToTextarea(): void {
    if (this.isDestroyed) return;
    const nextVal = this.view.state.doc.toString();
    if (this.textarea.value !== nextVal) {
      this.textarea.value = nextVal;
      try {
        this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
        this.textarea.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {
        // Ignore in detached environments
      }
    }
  }

  destroy(focusTextarea = true): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.syncToTextarea();

    // Sync cursor position back to textarea
    const mainSel = this.view.state.selection.main;
    const from = Math.min(mainSel.anchor, mainSel.head);
    const to = Math.max(mainSel.anchor, mainSel.head);
    const dir = mainSel.anchor > mainSel.head ? "backward" : "forward";

    this.resizeObserver?.disconnect();
    this.view.destroy();

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.textarea.style.display = this.originalDisplay;

    try {
      this.textarea.setSelectionRange(from, to, dir);
      if (focusTextarea) {
        this.textarea.focus();
      }
    } catch {
      // Ignore
    }
  }
}
