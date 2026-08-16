import type CodeMirror from "codemirror";
import {
  KakouneKeyProcessor,
  KakounePromptController,
  changeSelection,
  deleteSelection,
  enterInsert,
  enterInsertLineEnd,
  enterInsertLineStart,
  extendDown,
  extendDocumentEnd,
  extendDocumentStart,
  extendLeft,
  extendLineEnd,
  extendLineStart,
  extendRight,
  extendToLine,
  extendUp,
  extendWordBackward,
  extendWordEnd,
  extendWordForward,
  jumpDocumentEnd,
  jumpDocumentStart,
  moveDown,
  moveLeft,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveUp,
  normalizeKeyStroke,
  openLineAbove,
  openLineBelow,
  redoEdit,
  selectAll,
  selectLine,
  joinLines,
  selectWordBackward,
  selectWordEnd,
  selectWordForward,
  setMode,
  undoEdit,
  yankSelection,
  type KakouneBinding,
  type KakouneMode,
  type KakounePromptState
} from "kakoune-core-js";
import { Cm5Adapter } from "./adapter";

export type { KakouneMode as KakouneCm5Mode };

export interface KakouneCm5Options {
  initialMode?: KakouneMode;
  onWhichKey?: (pending: string[], items: Array<{ keys: string[]; description?: string }>) => void;
  onPrompt?: (prompt: KakounePromptState | null) => void;
  onPromptError?: (message: string | null) => void;
}

type Cm = CodeMirror.Editor;

const directEditOrigins = new Set(["+input", "+delete", "paste", "cut"]);

function bind(keys: string[], run: KakouneBinding<Cm5Adapter>["run"], description: string): KakouneBinding<Cm5Adapter> {
  return { keys, run, description };
}

function buildBindings(prompts: KakounePromptController): Record<KakouneMode, KakouneBinding<Cm5Adapter>[]> {
  return {
    select: [
      bind(["h"], (editor, _arg, count) => moveLeft(editor, count ?? 1), "Move left"),
      bind(["j"], (editor, _arg, count) => moveDown(editor, count ?? 1), "Move down"),
      bind(["k"], (editor, _arg, count) => moveUp(editor, count ?? 1), "Move up"),
      bind(["l"], (editor, _arg, count) => moveRight(editor, count ?? 1), "Move right"),
      bind(["H"], (editor, _arg, count) => extendLeft(editor, count ?? 1), "Extend left"),
      bind(["J"], (editor, _arg, count) => extendDown(editor, count ?? 1), "Extend down"),
      bind(["K"], (editor, _arg, count) => extendUp(editor, count ?? 1), "Extend up"),
      bind(["L"], (editor, _arg, count) => extendRight(editor, count ?? 1), "Extend right"),
      bind(["w"], (editor, _arg, count) => selectWordForward(editor, count ?? 1), "Select word forward"),
      bind(["b"], (editor, _arg, count) => selectWordBackward(editor, count ?? 1), "Select word backward"),
      bind(["e"], (editor, _arg, count) => selectWordEnd(editor, count ?? 1), "Select to word end"),
      bind(["W"], (editor, _arg, count) => extendWordForward(editor, count ?? 1), "Extend word forward"),
      bind(["B"], (editor, _arg, count) => extendWordBackward(editor, count ?? 1), "Extend word backward"),
      bind(["E"], (editor, _arg, count) => extendWordEnd(editor, count ?? 1), "Extend to word end"),
      bind(["x"], editor => selectLine(editor), "Select line"),
      bind(["%"], editor => selectAll(editor), "Select all"),
      bind(["<A-j>"], editor => joinLines(editor, false), "Join lines"),
      bind(["<A-J>"], editor => joinLines(editor, true), "Join lines and select spaces"),
      bind(["s"], editor => prompts.open("select", editor), "Select regex matches"),
      bind(["S"], editor => prompts.open("split", editor), "Split selection on regex matches"),
      bind(["d"], editor => deleteSelection(editor), "Delete selection"),
      bind(["c"], editor => changeSelection(editor), "Change selection"),
      bind(["y"], editor => yankSelection(editor), "Yank selection"),
      bind(["i"], editor => enterInsert(editor), "Insert"),
      bind(["a"], editor => enterInsert(editor, true), "Append"),
      bind(["I"], editor => enterInsertLineStart(editor), "Insert at line start"),
      bind(["A"], editor => enterInsertLineEnd(editor), "Insert at line end"),
      bind(["o"], editor => openLineBelow(editor), "Open line below"),
      bind(["O"], editor => openLineAbove(editor), "Open line above"),
      bind(["u"], editor => undoEdit(editor), "Undo"),
      bind(["U"], editor => redoEdit(editor), "Redo"),
      bind(["0"], editor => moveLineStart(editor), "Line start"),
      bind(["$"], editor => moveLineEnd(editor), "Line end"),
      bind(["g", "h"], editor => moveLineStart(editor), "Go to line start"),
      bind(["g", "l"], editor => moveLineEnd(editor), "Go to line end"),
      bind(["<A-h>"], editor => extendLineStart(editor), "Extend to line start"),
      bind(["<A-l>"], editor => extendLineEnd(editor), "Extend to line end"),
      bind(["g", "k"], editor => jumpDocumentStart(editor), "Go to document start"),
      bind(["g", "j"], editor => jumpDocumentEnd(editor), "Go to document end"),
      bind(["g", "g"], editor => jumpDocumentStart(editor), "Go to document start"),
      bind(["G"], (editor, _arg, count) => count === undefined ? false : extendToLine(editor, count), "Extend to line (with count)"),
      bind(["G", "h"], editor => extendLineStart(editor), "Extend to line start"),
      bind(["G", "H"], editor => extendLineStart(editor), "Extend to line start"),
      bind(["G", "l"], editor => extendLineEnd(editor), "Extend to line end"),
      bind(["G", "L"], editor => extendLineEnd(editor), "Extend to line end"),
      bind(["G", "k"], editor => extendDocumentStart(editor), "Extend to document start"),
      bind(["G", "K"], editor => extendDocumentStart(editor), "Extend to document start"),
      bind(["G", "j"], editor => extendDocumentEnd(editor), "Extend to document end"),
      bind(["G", "J"], editor => extendDocumentEnd(editor), "Extend to document end"),
      bind(["G", "g"], editor => extendDocumentStart(editor), "Extend to document start"),
      bind(["G", "G"], editor => extendDocumentStart(editor), "Extend to document start"),
      bind(["<Esc>"], editor => setMode(editor, "select"), "Normal mode")
    ],
    insert: [
      bind(["<Esc>"], editor => setMode(editor, "select"), "Normal mode")
    ]
  };
}

export function kakoune(cm: Cm, options: KakouneCm5Options = {}): void {
  const adapter = new Cm5Adapter(cm);
  const prompts = new KakounePromptController();
  const processor = new KakouneKeyProcessor(buildBindings(prompts));
  adapter.setMode(options.initialMode ?? "select");

  cm.on("beforeChange", (_instance, change) => {
    if (
      adapter.getMode() === "select" &&
      change.origin !== undefined &&
      directEditOrigins.has(change.origin)
    ) {
      change.cancel();
    }
  });

  cm.on("keydown", (_instance, event) => {
    const key = normalizeKeyStroke(event);
    if (!key) return;

    if (prompts.isActive()) {
      const handled = prompts.handleKey(adapter, key);
      options.onPrompt?.(prompts.getState());
      options.onPromptError?.(prompts.getError());
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    options.onPromptError?.(null);
    const mode = adapter.getMode();
    if (mode === "insert" && key !== "<Esc>") return;

    const handled = processor.handle(mode, key, adapter);
    options.onWhichKey?.(processor.getPending(), processor.getPendingItems(adapter.getMode()));
    if (prompts.isActive()) {
      options.onWhichKey?.([], []);
      options.onPrompt?.(prompts.getState());
      options.onPromptError?.(null);
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // An unhandled key must not fall through to CM5's default keymap while
    // normal mode is active. That keymap includes text insertion, deletion,
    // indentation, and platform-specific editing shortcuts.
    if (mode === "select") {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

export { Cm5Adapter };
export { normalizeKeyStroke, normalizeCm5Key, normalizeCm5Keys, KakouneKeyProcessor } from "kakoune-core-js";
