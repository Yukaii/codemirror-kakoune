import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { search } from "@codemirror/search";
import {
  kakouneInitialModeFacet,
  kakouneStateField,
  setKakouneModeEffect,
  kakouneWhichKeyFacet,
  kakouneSelectionTypeField,
  setKakouneSelectionTypeEffect,
  type KakouneMode,
  type KakouneOptions,
  type KakouneState,
  type WhichKeyCallback,
  type WhichKeyItem
} from "./state";
import { KakouneKeyProcessor, normalizeKeyStroke } from "./keys";
import {
  buildKakouneCommands,
  commitSearchPrompt,
  deleteSearchPromptChar,
  cancelSearchPrompt,
  handleSearchPromptKey,
  handleSplitPromptKey
} from "./commands";

export type { KakouneMode, KakouneOptions, KakouneState, WhichKeyCallback, WhichKeyItem } from "./state";
export { kakouneStateField, kakouneInitialModeFacet, setKakouneModeEffect, kakouneWhichKeyFacet, kakouneSelectionTypeField, setKakouneSelectionTypeEffect } from "./state";
export { normalizeKeyStroke, KakouneKeyProcessor } from "./keys";
export { buildKakouneCommands, commitSearchPrompt, kakouneCommands } from "./commands";

function createKakouneHandler() {
  const processor = new KakouneKeyProcessor(buildKakouneCommands());

  return EditorView.domEventHandlers({
    beforeinput(event, view) {
      const state = view.state.field(kakouneStateField);
      // Block all direct text input in select mode and during search prompt
      if (state.mode !== "insert" || state.searchPrompt !== null) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      return false;
    },
    keydown(event, view) {
      const key = normalizeKeyStroke(event);
      if (!key) {
        return false;
      }

      const state = view.state.field(kakouneStateField);

      if (state.searchPrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handleSearchPromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      if (state.splitPrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handleSplitPromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      const mode = state.mode;

      if (mode === "insert" && key !== "<Esc>") {
        return false;
      }

      const handled = processor.handle(mode, key, view);

      const whichKeyCallback = view.state.facet(kakouneWhichKeyFacet);
      if (whichKeyCallback) {
        whichKeyCallback(
          processor.getPending(),
          processor.getPendingItems(mode),
          processor.isWaitingForChar()
        );
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      if (mode !== "insert") {
        // Swallow single printable character keys and special keys like Enter/Backspace
        // to prevent text insertion or deletion in select mode.
        if (key.length === 1 || key === "<Enter>" || key === "<Backspace>") {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      return false;
    }
  });
}

const kakouneModeAttributes = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.updateView(view);
    }

    update(update: { view: EditorView }): void {
      this.updateView(update.view);
    }

    destroy(): void {
      this.view?.dom.removeAttribute("data-kakoune-mode");
      this.view = undefined;
    }

    private view?: EditorView;

    private updateView(view: EditorView): void {
      this.view = view;
      view.dom.dataset.kakouneMode = view.state.field(kakouneStateField).mode;
    }
  }
);

const kakouneLineCursor = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.updateCursor(view);
    }

    update(update: ViewUpdate): void {
      if (update.selectionSet || update.docChanged) {
        this.updateCursor(update.view);
      }
    }

    destroy(): void {
      this.view?.dom.classList.remove("cm-line-selection");
    }

    private view?: EditorView;

    private updateCursor(view: EditorView): void {
      this.view = view;
      const isLine = view.state.field(kakouneSelectionTypeField) === "line";
      view.dom.classList.toggle("cm-line-selection", isLine);
    }
  }
);

/**
 * Creates a CodeMirror extension that enables Kakoune-style modal editing.
 *
 * @param options - Configuration options for initial mode and which-key callback.
 * @returns A CodeMirror {@link Extension} array to include in your editor state.
 *
 * @example
 * ```ts
 * import { EditorView } from "@codemirror/view";
 * import { EditorState } from "@codemirror/state";
 * import { kakoune } from "codemirror-kakoune";
 *
 * const view = new EditorView({
 *   state: EditorState.create({
 *     doc: "Hello, world!",
 *     extensions: [kakoune()]
 *   })
 * });
 * ```
 */
export function kakoune(options: KakouneOptions = {}): Extension {
  const initialMode = options.initialMode ?? "select";
  const extensions: Extension[] = [
    kakouneInitialModeFacet.of(initialMode),
    kakouneStateField,
    kakouneSelectionTypeField,
    EditorState.allowMultipleSelections.of(true),
    history(),
    kakouneModeAttributes,
    kakouneLineCursor,
    Prec.highest(
      keymap.of([
        {
          key: "Enter",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt === null) {
              // Swallow Enter in select mode so the default keymap doesn't insert a newline
              return state.mode !== "insert";
            }

            return commitSearchPrompt(view);
          }
        },
        {
          key: "Backspace",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt === null) {
              // Swallow Backspace in select mode so the default keymap doesn't delete
              return state.mode !== "insert";
            }

            return deleteSearchPromptChar(view);
          }
        },
        {
          key: "Escape",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt === null) {
              return false;
            }

            return cancelSearchPrompt(view);
          }
        }
      ])
    ),
    search(),
    createKakouneHandler()
  ];

  if (options.onWhichKey) {
    extensions.push(kakouneWhichKeyFacet.of(options.onWhichKey));
  }

  return extensions;
}

/** Retrieves the current Kakoune state from an editor state. */
export function getKakouneState(state: EditorState): KakouneState {
  return state.field(kakouneStateField);
}

/** Checks whether the editor is currently in the given Kakoune mode. */
export function isKakouneMode(state: EditorState, mode: KakouneMode): boolean {
  return state.field(kakouneStateField).mode === mode;
}
