import { Facet, StateEffect, type StateEffectType, StateField, type EditorState } from "@codemirror/state";

/** The active editing mode in Kakoune-style modal editing. */
export type KakouneMode = "select" | "insert";

/** Whether the current selection is character-wise or line-wise. */
export type KakouneSelectionType = "char" | "line";

/** An item describing a pending key sequence for the which-key UI. */
export interface WhichKeyItem {
  /** The keys in the sequence. */
  keys: string[];
  /** Optional human-readable description of what the binding does. */
  description?: string;
}

/** A selection snapshot stored in the Kakoune jump list. */
export interface KakouneJumpSelection {
  anchor: number;
  head: number;
}

/** A full selection snapshot stored in the Kakoune jump list. */
export interface KakouneJumpEntry {
  ranges: KakouneJumpSelection[];
  mainIndex: number;
}

/** The internal jump list state maintained by the Kakoune extension. */
export interface KakouneJumpState {
  entries: KakouneJumpEntry[];
  currentIndex: number;
}

/** Callback invoked when the pending key sequence or which-key items change. */
export type WhichKeyCallback = (
  /** The currently pending key sequence. */
  pending: string[],
  /** Available bindings that extend the pending sequence. */
  items: WhichKeyItem[],
  /** Whether the processor is waiting for a single character argument. */
  isWaitingForChar: boolean
) => void;

/** The internal state maintained by the Kakoune extension for each editor. */
export interface KakouneState {
  /** Current editing mode. */
  mode: KakouneMode;
  /** The yank/paste register. */
  register: string;
  /** Number of times each selection should be duplicated for insertion. */
  selectionRepeatCount: number;
  /** Active search prompt text, or `null` if no prompt is open. */
  searchPrompt: string | null;
  /** Snapshot of selections before opening the search prompt, or `null`. */
  searchSelection: Array<{ anchor: number; head: number }> | null;
  /** Kakoune jump list state. */
  jumpState: KakouneJumpState;
}

/** Options for configuring the {@link kakoune} extension. */
export interface KakouneOptions {
  /** Initial mode when the editor is created. Defaults to `"select"`. */
  initialMode?: KakouneMode;
  /** Callback for displaying pending key sequences and available bindings. */
  onWhichKey?: WhichKeyCallback;
}

/**
 * Facet for registering a which-key callback. The callback receives pending
 * key sequences and available completions so you can build a discovery UI.
 */
export const kakouneWhichKeyFacet: Facet<WhichKeyCallback, WhichKeyCallback | null> = Facet.define<WhichKeyCallback, WhichKeyCallback | null>({
  combine(values) {
    return values.length > 0 ? values[values.length - 1] : null;
  }
});

/** Facet that sets the initial Kakoune mode when the editor state is created. */
export const kakouneInitialModeFacet: Facet<KakouneMode, KakouneMode> = Facet.define<KakouneMode, KakouneMode>({
  combine(values) {
    return values.length > 0 ? values[values.length - 1] : "select";
  }
});

/** State effect that changes the current Kakoune mode. */
export const setKakouneModeEffect: StateEffectType<KakouneMode> = StateEffect.define<KakouneMode>();
/** State effect that updates the yank/paste register. */
export const setKakouneRegisterEffect: StateEffectType<string> = StateEffect.define<string>();
/** State effect that sets or clears the search prompt text. */
export const setKakouneSearchPromptEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
/**
 * State effect that stores a snapshot of selections before opening the search
 * prompt, so they can be restored if the search is cancelled.
 */
export const setKakouneSearchSelectionEffect: StateEffectType<
  Array<{ anchor: number; head: number }> | null
> = StateEffect.define<
  Array<{ anchor: number; head: number }> | null
>();

/** State effect that updates the Kakoune jump list state. */
export const setKakouneJumpStateEffect: StateEffectType<KakouneJumpState> = StateEffect.define<KakouneJumpState>();

/** State effect that updates the Kakoune selection repeat count. */
export const setKakouneSelectionRepeatCountEffect: StateEffectType<number> = StateEffect.define<number>();

/** State effect that sets the selection type (char-wise or line-wise). */
export const setKakouneSelectionTypeEffect = StateEffect.define<KakouneSelectionType>();

/**
 * State field that tracks whether the current selection is character-wise or
 * line-wise. Automatically resets to `"char"` when the selection changes to a
 * non-full-line selection, and preserves `"line"` as long as the selection
 * spans full lines.
 */
export const kakouneSelectionTypeField: StateField<KakouneSelectionType> = StateField.define<KakouneSelectionType>({
  create() { return "char"; },
  update(value, tr) {
    let next = value;
    for (const e of tr.effects) if (e.is(setKakouneSelectionTypeEffect)) next = e.value;
    if (tr.selection && !tr.effects.some(e => e.is(setKakouneSelectionTypeEffect))) {
      const main = tr.selection.ranges[tr.selection.mainIndex];
      const fromLine = tr.newDoc.lineAt(main.from);
      const toLine = tr.newDoc.lineAt(main.to);
      const isFullLine = main.from === fromLine.from && main.to === toLine.to;
      if (!isFullLine) next = "char";
    }
    return next;
  }
});

/** State field that holds the Kakoune editing state for an editor. */
export const kakouneStateField: StateField<KakouneState> = StateField.define<KakouneState>({
  create(state: EditorState) {
    return {
      mode: state.facet(kakouneInitialModeFacet),
      register: "",
      selectionRepeatCount: 1,
      searchPrompt: null,
      searchSelection: null,
      jumpState: { entries: [], currentIndex: 0 }
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
      } else if (effect.is(setKakouneJumpStateEffect)) {
        next = { ...next, jumpState: effect.value };
      } else if (effect.is(setKakouneSelectionRepeatCountEffect)) {
        next = { ...next, selectionRepeatCount: effect.value };
      }
    }

    return next;
  }
});
