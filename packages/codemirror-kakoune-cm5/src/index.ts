import type CodeMirror from "codemirror";
import {
  KakouneKeyProcessor,
  changeSelection,
  deleteSelection,
  enterInsert,
  enterInsertLineEnd,
  enterInsertLineStart,
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
  selectLine,
  selectWordBackward,
  selectWordEnd,
  selectWordForward,
  setMode,
  undoEdit,
  yankSelection,
  type KakouneBinding,
  type KakouneMode
} from "kakoune-core";
import { Cm5Adapter } from "./adapter";

export type { KakouneMode as KakouneCm5Mode };

export interface KakouneCm5Options {
  initialMode?: KakouneMode;
  onWhichKey?: (pending: string[], items: Array<{ keys: string[]; description?: string }>) => void;
}

type Cm = CodeMirror.Editor;

function bind(keys: string[], run: KakouneBinding<Cm5Adapter>["run"], description: string): KakouneBinding<Cm5Adapter> {
  return { keys, run, description };
}

function buildBindings(): Record<KakouneMode, KakouneBinding<Cm5Adapter>[]> {
  return {
    select: [
      bind(["h"], (editor, _arg, count) => moveLeft(editor, count ?? 1), "Move left"),
      bind(["j"], (editor, _arg, count) => moveDown(editor, count ?? 1), "Move down"),
      bind(["k"], (editor, _arg, count) => moveUp(editor, count ?? 1), "Move up"),
      bind(["l"], (editor, _arg, count) => moveRight(editor, count ?? 1), "Move right"),
      bind(["w"], (editor, _arg, count) => selectWordForward(editor, count ?? 1), "Select word forward"),
      bind(["b"], (editor, _arg, count) => selectWordBackward(editor, count ?? 1), "Select word backward"),
      bind(["e"], (editor, _arg, count) => selectWordEnd(editor, count ?? 1), "Select to word end"),
      bind(["x"], editor => selectLine(editor), "Select line"),
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
      bind(["g", "k"], editor => jumpDocumentStart(editor), "Go to document start"),
      bind(["g", "j"], editor => jumpDocumentEnd(editor), "Go to document end"),
      bind(["g", "g"], editor => jumpDocumentStart(editor), "Go to document start"),
      bind(["G"], editor => jumpDocumentEnd(editor), "Go to document end"),
      bind(["<Esc>"], editor => setMode(editor, "select"), "Normal mode")
    ],
    insert: [
      bind(["<Esc>"], editor => setMode(editor, "select"), "Normal mode")
    ]
  };
}

export function kakoune(cm: Cm, options: KakouneCm5Options = {}): void {
  const adapter = new Cm5Adapter(cm);
  const processor = new KakouneKeyProcessor(buildBindings());
  adapter.setMode(options.initialMode ?? "select");

  cm.on("keydown", (_instance, event) => {
    const key = normalizeKeyStroke(event);
    if (!key) return;

    const mode = adapter.getMode();
    if (mode === "insert" && key !== "<Esc>") return;

    const handled = processor.handle(mode, key, adapter);
    options.onWhichKey?.(processor.getPending(), processor.getPendingItems(adapter.getMode()));
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

export { Cm5Adapter };
export { normalizeKeyStroke, normalizeCm5Key, normalizeCm5Keys, KakouneKeyProcessor } from "kakoune-core";
