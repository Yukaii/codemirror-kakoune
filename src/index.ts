import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
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
import { buildKakouneCommands, handleSearchPromptKey } from "./commands";

export type { KakouneMode, KakouneOptions, KakouneState } from "./state";
export { kakouneStateField, kakouneInitialModeFacet, setKakouneModeEffect } from "./state";
export { normalizeKeyStroke, KakouneKeyProcessor } from "./keys";
export { buildKakouneCommands, kakouneCommands } from "./commands";

function createKakouneHandler() {
  const processor = new KakouneKeyProcessor(buildKakouneCommands());

  return EditorView.domEventHandlers({
    keydown(event, view) {
      const key = normalizeKeyStroke(event);
      if (!key) {
        return false;
      }

      const state = view.state.field(kakouneStateField);

      if (state.searchPrompt !== null) {
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

export function kakoune(options: KakouneOptions = {}): Extension {
  const initialMode = options.initialMode ?? "select";
  return [
    kakouneInitialModeFacet.of(initialMode),
    kakouneStateField,
    EditorState.allowMultipleSelections.of(true),
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
