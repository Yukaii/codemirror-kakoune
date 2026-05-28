import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap, ViewPlugin } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { search } from "@codemirror/search";
import {
  kakouneInitialModeFacet,
  kakouneStateField,
  setKakouneModeEffect,
  type KakouneMode,
  type KakouneOptions,
  type KakouneState
} from "./state";
import { KakouneKeyProcessor, normalizeKeyStroke } from "./keys";
import {
  buildKakouneCommands,
  commitSearchPrompt,
  deleteSearchPromptChar,
  cancelSearchPrompt,
  handleSearchPromptKey
} from "./commands";

export type { KakouneMode, KakouneOptions, KakouneState } from "./state";
export { kakouneStateField, kakouneInitialModeFacet, setKakouneModeEffect } from "./state";
export { normalizeKeyStroke, KakouneKeyProcessor } from "./keys";
export { buildKakouneCommands, commitSearchPrompt, kakouneCommands } from "./commands";

function createKakouneHandler() {
  const processor = new KakouneKeyProcessor(buildKakouneCommands());

  return EditorView.domEventHandlers({
    beforeinput(event, view) {
      const state = view.state.field(kakouneStateField);
      if (state.searchPrompt !== null) {
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

      const mode = state.mode;

      if (mode === "insert" && key !== "<Esc>") {
        return false;
      }

      const handled = processor.handle(mode, key, view);

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      if (mode !== "insert") {
        event.preventDefault();
        event.stopPropagation();
        return true;
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

export function kakoune(options: KakouneOptions = {}): Extension {
  const initialMode = options.initialMode ?? "select";
  return [
    kakouneInitialModeFacet.of(initialMode),
    kakouneStateField,
    EditorState.allowMultipleSelections.of(true),
    history(),
    kakouneModeAttributes,
    Prec.highest(
      keymap.of([
        {
          key: "Enter",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt === null) {
              return false;
            }

            return commitSearchPrompt(view);
          }
        },
        {
          key: "Backspace",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt === null) {
              return false;
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
}

export function getKakouneState(state: EditorState): KakouneState {
  return state.field(kakouneStateField);
}

export function isKakouneMode(state: EditorState, mode: KakouneMode): boolean {
  return state.field(kakouneStateField).mode === mode;
}
