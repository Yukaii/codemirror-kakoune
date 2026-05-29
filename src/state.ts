import { Facet, StateEffect, type StateEffectType, StateField, type EditorState } from "@codemirror/state";

export type KakouneMode = "select" | "insert";

export interface WhichKeyItem {
  keys: string[];
  description?: string;
}

export type WhichKeyCallback = (
  pending: string[],
  items: WhichKeyItem[],
  isWaitingForChar: boolean
) => void;

export interface KakouneState {
  mode: KakouneMode;
  register: string;
  searchPrompt: string | null;
  searchSelection: Array<{ anchor: number; head: number }> | null;
}

export interface KakouneOptions {
  initialMode?: KakouneMode;
  onWhichKey?: WhichKeyCallback;
}

export const kakouneWhichKeyFacet: Facet<WhichKeyCallback, WhichKeyCallback | null> = Facet.define<WhichKeyCallback, WhichKeyCallback | null>({
  combine(values) {
    return values.length > 0 ? values[values.length - 1] : null;
  }
});

export const kakouneInitialModeFacet: Facet<KakouneMode, KakouneMode> = Facet.define<KakouneMode, KakouneMode>({
  combine(values) {
    return values.length > 0 ? values[values.length - 1] : "select";
  }
});

export const setKakouneModeEffect: StateEffectType<KakouneMode> = StateEffect.define<KakouneMode>();
export const setKakouneRegisterEffect: StateEffectType<string> = StateEffect.define<string>();
export const setKakouneSearchPromptEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
export const setKakouneSearchSelectionEffect: StateEffectType<
  Array<{ anchor: number; head: number }> | null
> = StateEffect.define<
  Array<{ anchor: number; head: number }> | null
>();

export const kakouneStateField: StateField<KakouneState> = StateField.define<KakouneState>({
  create(state: EditorState) {
    return {
      mode: state.facet(kakouneInitialModeFacet),
      register: "",
      searchPrompt: null,
      searchSelection: null
    };
  },
  update(value, transaction) {
    let next = value;

    for (const effect of transaction.effects) {
      if (effect.is(setKakouneModeEffect)) {
        next = { ...next, mode: effect.value };
      } else if (effect.is(setKakouneRegisterEffect)) {
        next = { ...next, register: effect.value };
      } else if (effect.is(setKakouneSearchPromptEffect)) {
        next = { ...next, searchPrompt: effect.value };
      } else if (effect.is(setKakouneSearchSelectionEffect)) {
        next = { ...next, searchSelection: effect.value };
      }
    }

    return next;
  }
});
