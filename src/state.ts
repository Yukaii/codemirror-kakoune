import { Facet, StateEffect, StateField, type EditorState } from "@codemirror/state";

export type KakouneMode = "normal" | "insert";

export interface KakouneState {
  mode: KakouneMode;
  register: string;
}

export interface KakouneOptions {
  initialMode?: KakouneMode;
}

export const kakouneInitialModeFacet = Facet.define<KakouneMode, KakouneMode>({
  combine(values) {
    return values.length > 0 ? values[values.length - 1] : "normal";
  }
});

export const setKakouneModeEffect = StateEffect.define<KakouneMode>();
export const setKakouneRegisterEffect = StateEffect.define<string>();

export const kakouneStateField = StateField.define<KakouneState>({
  create(state: EditorState) {
    return {
      mode: state.facet(kakouneInitialModeFacet),
      register: ""
    };
  },
  update(value, transaction) {
    let next = value;

    for (const effect of transaction.effects) {
      if (effect.is(setKakouneModeEffect)) {
        next = { ...next, mode: effect.value };
      } else if (effect.is(setKakouneRegisterEffect)) {
        next = { ...next, register: effect.value };
      }
    }

    return next;
  }
});
