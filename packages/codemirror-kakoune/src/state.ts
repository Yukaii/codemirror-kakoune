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

/**
 * Direction kind for the find-to-character commands.
 * - `"f"` / `"F"` — inclusive forward / extend forward
 * - `"t"` / `"T"` — exclusive forward / extend forward
 * - `"<A-f>"` / `"<A-F>"` — inclusive backward / extend backward
 * - `"<A-t>"` / `"<A-T>"` — exclusive backward / extend backward
 */
export type KakouneFindKind =
  | "f"
  | "t"
  | "F"
  | "T"
  | "<A-f>"
  | "<A-t>"
  | "<A-F>"
  | "<A-T>"
  | "<a-f>"
  | "<a-t>"
  | "<a-F>"
  | "<a-T>";

/** An action stored for repeating with `<a-.>`. */
export type KakouneLastSelect =
  | { type: "find"; kind: KakouneFindKind; key: string; count?: number }
  | { type: "object"; objectKey: string; direction: "start" | "end"; extend: boolean; inner: boolean; count?: number }
  | { type: "surroundingObject"; objectKey: string; inner: boolean; count?: number };

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
  /** Per-selection register contents, when the register came from multiple selections. */
  registerSelections: string[] | null;
  /** Whether the current selection source is linewise. */
  selectionLinewise: boolean;
  /** Whether the active register was populated from a linewise selection. */
  registerLinewise: boolean;
  /** Number of times each selection should be duplicated for insertion. */
  selectionRepeatCount: number;
  /** Pending insert anchors created by replace mode after `c`. */
  replaceInsertAnchors: number[] | null;
  /** Active search prompt text, or `null` if no prompt is open. */
  searchPrompt: string | null;
  /** Snapshot of selections before opening the search prompt, or `null`. */
  searchSelection: Array<{ anchor: number; head: number }> | null;
  /** Active split prompt text, or `null` if no split prompt is open. */
  splitPrompt: string | null;
  /** Snapshot of selections before opening the split prompt, or `null`. */
  splitSelection: Array<{ anchor: number; head: number }> | null;
  /** Active prompt for pipe commands (| or <a-|>), or `null`. */
  pipePrompt: { text: string; mode: "pipe" | "pipe-to"; register?: string } | null;
  /** Last command error message, or `null` if none. */
  commandError: string | null;
  /** Active macro recording register name, or `null` if not recording. */
  recordingMacroRegister: string | null;
  /** Keys recorded during the current macro session. */
  recordedMacroKeys: string[];
  /** Named registers map. */
  namedRegisters: Map<string, string>;
  /** Selection history for selection undo/redo (`<a-u>` / `<a-U>`). */
  selectionHistory: Array<Array<{ anchor: number; head: number }>>;
  selectionHistoryIndex: number;
  /** Last object selection or character find action for `<a-.>` repeat. */
  lastSelect: KakouneLastSelect | null;
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
/** State effect that updates per-selection register contents. */
export const setKakouneRegisterSelectionsEffect: StateEffectType<string[] | null> = StateEffect.define<string[] | null>();
/** State effect that marks the current selection source as linewise or not. */
export const setKakouneSelectionLinewiseEffect: StateEffectType<boolean> = StateEffect.define<boolean>();
/** State effect that marks the active register as linewise or not. */
export const setKakouneRegisterLinewiseEffect: StateEffectType<boolean> = StateEffect.define<boolean>();
/** State effect that sets or clears the search prompt text. */
export const setKakouneSearchPromptEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
/** State effect that sets or clears the split prompt text. */
export const setKakouneSplitPromptEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
/**
 * State effect that stores a snapshot of selections before opening the search
 * prompt, so they can be restored if the search is cancelled.
 */
export const setKakouneSearchSelectionEffect: StateEffectType<
  Array<{ anchor: number; head: number }> | null
> = StateEffect.define<
  Array<{ anchor: number; head: number }> | null
>();
/** State effect that stores a snapshot of selections before opening the split prompt. */
export const setKakouneSplitSelectionEffect: StateEffectType<
  Array<{ anchor: number; head: number }> | null
> = StateEffect.define<
  Array<{ anchor: number; head: number }> | null
>();

/** State effect that updates the Kakoune jump list state. */
export const setKakouneJumpStateEffect: StateEffectType<KakouneJumpState> = StateEffect.define<KakouneJumpState>();

/** State effect that updates the Kakoune selection repeat count. */
export const setKakouneSelectionRepeatCountEffect: StateEffectType<number> = StateEffect.define<number>();
/** State effect that stores replace-mode insert anchors after `c`. */
export const setKakouneReplaceInsertAnchorsEffect: StateEffectType<number[] | null> = StateEffect.define<number[] | null>();
/** State effect that sets or clears the pipe prompt. */
export const setKakounePipePromptEffect: StateEffectType<{ text: string; mode: "pipe" | "pipe-to"; register?: string } | null> = StateEffect.define<{ text: string; mode: "pipe" | "pipe-to"; register?: string } | null>();
/** State effect that sets or clears the last command error. */
export const setKakouneCommandErrorEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
/** State effect that sets the recording macro register or null. */
export const setKakouneRecordingMacroRegisterEffect: StateEffectType<string | null> = StateEffect.define<string | null>();
/** State effect that sets recorded macro keys. */
export const setKakouneRecordedMacroKeysEffect: StateEffectType<string[]> = StateEffect.define<string[]>();
/** State effect that sets named registers. */
export const setKakouneNamedRegistersEffect: StateEffectType<Map<string, string>> = StateEffect.define<Map<string, string>>();
/** State effect that updates selection history and index. */
export const setKakouneSelectionHistoryEffect: StateEffectType<{ history: Array<Array<{ anchor: number; head: number }>>; index: number }> = StateEffect.define<{ history: Array<Array<{ anchor: number; head: number }>>; index: number }>();
/** State effect that updates the last object selection or character find action. */
export const setKakouneLastSelectEffect: StateEffectType<KakouneLastSelect | null> = StateEffect.define<KakouneLastSelect | null>();

/** State effect that sets the selection type (char-wise or line-wise). */
export const setKakouneSelectionTypeEffect: StateEffectType<KakouneSelectionType> = StateEffect.define<KakouneSelectionType>();

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
      const isFullLine = main.from === fromLine.from && (main.to === toLine.to || (toLine.number < tr.newDoc.lines && main.to === toLine.to + 1));
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
      registerSelections: null,
      selectionLinewise: false,
      registerLinewise: false,
      selectionRepeatCount: 1,
      replaceInsertAnchors: null,
      searchPrompt: null,
      searchSelection: null,
      splitPrompt: null,
      splitSelection: null,
      pipePrompt: null,
      commandError: null,
      recordingMacroRegister: null,
      recordedMacroKeys: [],
      namedRegisters: new Map(),
      selectionHistory: [],
      selectionHistoryIndex: 0,
      lastSelect: null,
      jumpState: { entries: [], currentIndex: 0 }
    };
  },
  update(value, transaction) {
    let next = value;

    if (transaction.docChanged && next.selectionHistory.length > 0) {
      // Map existing selection history through document changes
      const mappedHistory = next.selectionHistory.map(entry =>
        entry.map(r => ({
          anchor: transaction.changes.mapPos(r.anchor),
          head: transaction.changes.mapPos(r.head)
        }))
      );
      next = {
        ...next,
        selectionHistory: mappedHistory
      };
    }

    if (transaction.selection && !transaction.effects.some(e => e.is(setKakouneSelectionHistoryEffect))) {
      const curRanges = transaction.selection.ranges.map(r => ({ anchor: r.anchor, head: r.head }));
      const prev = next.selectionHistory[next.selectionHistoryIndex];
      const isSame = prev && prev.length === curRanges.length && prev.every((r, i) => r.anchor === curRanges[i].anchor && r.head === curRanges[i].head);
      if (!isSame) {
        const truncated = next.selectionHistory.slice(0, next.selectionHistoryIndex + 1);
        truncated.push(curRanges);
        next = {
          ...next,
          selectionHistory: truncated,
          selectionHistoryIndex: truncated.length - 1
        };
      }
    }

    for (const effect of transaction.effects) {
      if (effect.is(setKakouneModeEffect)) {
        next = { ...next, mode: effect.value };
      } else if (effect.is(setKakouneRegisterEffect)) {
        next = { ...next, register: effect.value };
      } else if (effect.is(setKakouneRegisterSelectionsEffect)) {
        next = { ...next, registerSelections: effect.value };
      } else if (effect.is(setKakouneSelectionLinewiseEffect)) {
        next = { ...next, selectionLinewise: effect.value };
      } else if (effect.is(setKakouneRegisterLinewiseEffect)) {
        next = { ...next, registerLinewise: effect.value };
      } else if (effect.is(setKakouneSearchPromptEffect)) {
        next = { ...next, searchPrompt: effect.value };
      } else if (effect.is(setKakouneSearchSelectionEffect)) {
        next = { ...next, searchSelection: effect.value };
      } else if (effect.is(setKakouneSplitPromptEffect)) {
        next = { ...next, splitPrompt: effect.value };
      } else if (effect.is(setKakouneSplitSelectionEffect)) {
        next = { ...next, splitSelection: effect.value };
      } else if (effect.is(setKakounePipePromptEffect)) {
        next = { ...next, pipePrompt: effect.value };
      } else if (effect.is(setKakouneJumpStateEffect)) {
        next = { ...next, jumpState: effect.value };
      } else if (effect.is(setKakouneSelectionRepeatCountEffect)) {
        next = { ...next, selectionRepeatCount: effect.value };
      } else if (effect.is(setKakouneReplaceInsertAnchorsEffect)) {
        next = { ...next, replaceInsertAnchors: effect.value };
      } else if (effect.is(setKakouneCommandErrorEffect)) {
        next = { ...next, commandError: effect.value };
      } else if (effect.is(setKakouneNamedRegistersEffect)) {
        next = { ...next, namedRegisters: effect.value };
      } else if (effect.is(setKakouneRecordingMacroRegisterEffect)) {
        next = { ...next, recordingMacroRegister: effect.value };
      } else if (effect.is(setKakouneRecordedMacroKeysEffect)) {
        next = { ...next, recordedMacroKeys: effect.value };
      } else if (effect.is(setKakouneSelectionHistoryEffect)) {
        next = {
          ...next,
          selectionHistory: effect.value.history,
          selectionHistoryIndex: effect.value.index
        };
      } else if (effect.is(setKakouneLastSelectEffect)) {
        next = { ...next, lastSelect: effect.value };
      }
    }

    return next;
  }
});
