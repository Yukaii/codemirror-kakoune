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
  openLineAbove,
  openLineBelow,
  redoEdit,
  selectAll,
  selectLine,
  joinLines,
  copySelectionsOnNextLines,
  toUpperCaseSelection,
  toLowerCaseSelection,
  swapCaseSelection,
  trimSelections,
  addEmptyLineBelow,
  addEmptyLineAbove,
  reduceToCursor,
  flipSelectionDirection,
  ensureForwardDirection,
  clearOtherSelections,
  clearMainSelection,
  selectWordBackward,
  selectWordEnd,
  selectWordForward,
  setMode,
  undoEdit,
  yankSelection,
  rangeTo,
  rangeFrom,
  type KakouneBinding,
  type KakouneMode,
  type EditorHost
} from "kakoune-core-js";
import type { TextareaAdapter } from "./textarea";

function bind<T extends EditorHost>(
  keys: string[],
  run: KakouneBinding<T>["run"],
  description: string
): KakouneBinding<T> {
  return { keys, run, description };
}

function pasteAfter(editor: EditorHost): boolean {
  const text = editor.getRegister();
  if (!text) return false;
  const selections = editor.getSelections();
  for (let i = selections.length - 1; i >= 0; i--) {
    const range = selections[i];
    const pos = rangeTo(range);
    editor.replaceRange(pos, pos, text);
  }
  return true;
}

function pasteBefore(editor: EditorHost): boolean {
  const text = editor.getRegister();
  if (!text) return false;
  const selections = editor.getSelections();
  for (let i = selections.length - 1; i >= 0; i--) {
    const range = selections[i];
    const pos = rangeFrom(range);
    editor.replaceRange(pos, pos, text);
  }
  return true;
}

export function buildKakouneBindings<T extends EditorHost>(
  prompts: KakounePromptController
): Record<KakouneMode, KakouneBinding<T>[]> {
  return {
    select: [
      // Motions
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

      // Multi-Selection Commands
      bind(["C"], (editor, _arg, count) => copySelectionsOnNextLines(editor, 1, count ?? 1), "Duplicate selections on following lines"),
      bind(["<A-C>"], (editor, _arg, count) => copySelectionsOnNextLines(editor, -1, count ?? 1), "Duplicate selections on preceding lines"),
      bind([","], editor => clearOtherSelections(editor), "Clear other selections"),
      bind(["<A-,>"], editor => clearMainSelection(editor), "Clear main selection"),
      bind(["<Space>"], editor => clearOtherSelections(editor), "Clear other selections"),
      bind(["<A-Space>"], editor => clearMainSelection(editor), "Clear main selection"),
      bind([")"], editor => {
        if ("cycleMainSelection" in editor && typeof (editor as any).cycleMainSelection === "function") {
          (editor as any).cycleMainSelection(1);
          return true;
        }
        return false;
      }, "Cycle main selection forward"),
      bind(["("], editor => {
        if ("cycleMainSelection" in editor && typeof (editor as any).cycleMainSelection === "function") {
          (editor as any).cycleMainSelection(-1);
          return true;
        }
        return false;
      }, "Cycle main selection backward"),
      bind(["<A-)>"], editor => {
        if ("rotateSelectionsContent" in editor && typeof (editor as any).rotateSelectionsContent === "function") {
          (editor as any).rotateSelectionsContent(1);
          return true;
        }
        return false;
      }, "Rotate selections content forward"),
      bind(["<A-(>"], editor => {
        if ("rotateSelectionsContent" in editor && typeof (editor as any).rotateSelectionsContent === "function") {
          (editor as any).rotateSelectionsContent(-1);
          return true;
        }
        return false;
      }, "Rotate selections content backward"),

      // Selections & Prompts
      bind(["x"], editor => selectLine(editor), "Select line"),
      bind(["%"], editor => selectAll(editor), "Select all"),
      bind(["<A-j>"], editor => joinLines(editor, false), "Join lines"),
      bind(["<A-J>"], editor => joinLines(editor, true), "Join lines and select spaces"),
      bind(["~"], editor => toUpperCaseSelection(editor), "Convert to uppercase"),
      bind(["`"], editor => toLowerCaseSelection(editor), "Convert to lowercase"),
      bind(["<A-`>"], editor => swapCaseSelection(editor), "Swap case"),
      bind(["_"], editor => trimSelections(editor), "Trim whitespace from selections"),
      bind(["<A-o>"], editor => addEmptyLineBelow(editor), "Add empty line below"),
      bind(["<A-O>"], editor => addEmptyLineAbove(editor), "Add empty line above"),
      bind([";"], editor => reduceToCursor(editor), "Reduce to cursor"),
      bind(["<A-;>"], editor => flipSelectionDirection(editor), "Flip selection direction"),
      bind(["<A-:>"], editor => ensureForwardDirection(editor), "Ensure selection forward"),
      bind(["s"], editor => prompts.open("select", editor), "Select regex matches"),
      bind(["S"], editor => prompts.open("split", editor), "Split selection on regex matches"),

      // Edit Operations
      bind(["d"], editor => deleteSelection(editor), "Delete selection"),
      bind(["c"], editor => changeSelection(editor), "Change selection"),
      bind(["y"], editor => yankSelection(editor), "Yank selection"),
      bind(["p"], editor => pasteAfter(editor), "Paste after"),
      bind(["P"], editor => pasteBefore(editor), "Paste before"),
      bind(["i"], editor => enterInsert(editor), "Insert"),
      bind(["a"], editor => enterInsert(editor, true), "Append"),
      bind(["I"], editor => enterInsertLineStart(editor), "Insert at line start"),
      bind(["A"], editor => enterInsertLineEnd(editor), "Insert at line end"),
      bind(["o"], editor => openLineBelow(editor), "Open line below"),
      bind(["O"], editor => openLineAbove(editor), "Open line above"),

      // History
      bind(["u"], editor => undoEdit(editor), "Undo"),
      bind(["U"], editor => redoEdit(editor), "Redo"),
      bind(["<A-u>"], editor => {
        if ("undoSelection" in editor && typeof (editor as any).undoSelection === "function") {
          (editor as any).undoSelection();
          return true;
        }
        return false;
      }, "Undo selection"),
      bind(["<A-U>"], editor => {
        if ("redoSelection" in editor && typeof (editor as any).redoSelection === "function") {
          (editor as any).redoSelection();
          return true;
        }
        return false;
      }, "Redo selection"),

      // Line / Document Navigation
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

export { KakouneKeyProcessor, KakounePromptController };
