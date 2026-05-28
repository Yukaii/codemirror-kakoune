import { EditorView } from "@codemirror/view";
import { type EditorState, type Extension } from "@codemirror/state";
import {
  kakouneInitialModeFacet,
  kakouneStateField,
  setKakouneModeEffect,
  type KakouneMode,
  type KakouneOptions,
  type KakouneState
} from "./state";
import { KakouneKeyProcessor, normalizeKeyStroke } from "./keys";
import { buildKakouneCommands } from "./commands";

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

      const mode = view.state.field(kakouneStateField).mode;

      if (mode === "insert" && key !== "<Esc>") {
        return false;
      }

      const handled = processor.handle(mode, key, view);

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      if (mode === "normal") {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      return false;
    }
  });
}

export function kakoune(options: KakouneOptions = {}): Extension {
  const initialMode = options.initialMode ?? "normal";
  return [
    kakouneInitialModeFacet.of(initialMode),
    kakouneStateField,
    createKakouneHandler()
  ];
}

export function getKakouneState(state: EditorState): KakouneState {
  return state.field(kakouneStateField);
}

export function isKakouneMode(state: EditorState, mode: KakouneMode): boolean {
  return state.field(kakouneStateField).mode === mode;
}
