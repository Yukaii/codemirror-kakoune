import { EditorSelection, type SelectionRange } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { getSearchQuery, SearchQuery, findNext, findPrevious, selectMatches, setSearchQuery } from "@codemirror/search";
import {
  kakouneStateField,
  setKakouneModeEffect,
  setKakouneRegisterEffect,
  type KakouneMode
} from "./state";

export type KakouneFindKind = "f" | "t" | "F" | "T";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isWordChar(char: string | undefined): boolean {
  return typeof char === "string" && /[\p{L}\p{N}_]/u.test(char);
}

function moveLineColumn(view: EditorView, range: SelectionRange, delta: number): number {
  const state = view.state;
  const doc = state.doc;
  const pos = range.head;
  const line = doc.lineAt(pos);
  const column = pos - line.from;
  const nextLineNumber = clamp(line.number + delta, 1, doc.lines);
  const nextLine = doc.line(nextLineNumber);
  return clamp(nextLine.from + column, nextLine.from, nextLine.to);
}

function moveWordForward(view: EditorView, range: SelectionRange): number {
  const doc = view.state.doc.toString();
  const len = doc.length;
  let pos = range.head;

  while (pos < len && isWordChar(doc[pos])) {
    pos += 1;
  }

  while (pos < len && !isWordChar(doc[pos])) {
    pos += 1;
  }

  return pos;
}

function moveWordBackward(view: EditorView, range: SelectionRange): number {
  const doc = view.state.doc.toString();
  let pos = Math.max(0, range.head - 1);

  while (pos > 0 && !isWordChar(doc[pos])) {
    pos -= 1;
  }

  while (pos > 0 && isWordChar(doc[pos - 1])) {
    pos -= 1;
  }

  return pos;
}

function moveWordEnd(view: EditorView, range: SelectionRange): number {
  const doc = view.state.doc.toString();
  const len = doc.length;
  let pos = range.head;

  while (pos < len && !isWordChar(doc[pos])) {
    pos += 1;
  }

  while (pos < len && isWordChar(doc[pos])) {
    pos += 1;
  }

  return pos;
}

function setMode(view: EditorView, mode: KakouneMode): boolean {
  view.dispatch({ effects: setKakouneModeEffect.of(mode) });
  return true;
}

function moveSelections(view: EditorView, mapper: (range: SelectionRange) => number): boolean {
  const state = view.state;
  const result = state.changeByRange(range => ({
    range: EditorSelection.cursor(mapper(range))
  }));

  view.dispatch(result);
  return true;
}

function extendSelections(view: EditorView, mapper: (range: SelectionRange) => number): boolean {
  const ranges = view.state.selection.ranges.map(range => EditorSelection.range(range.anchor, mapper(range)));
  view.dispatch({
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex)
  });
  return true;
}

function moveToFind(view: EditorView, kind: KakouneFindKind, key: string): boolean {
  const backwards = kind === "F" || kind === "T";
  const inclusive = kind === "f" || kind === "F";
  const result = view.state.changeByRange(range => {
    const line = view.state.doc.lineAt(range.head);
    const text = view.state.doc.sliceString(line.from, line.to);
    const relativeStart = range.head - line.from;
    const found = backwards
      ? text.slice(0, relativeStart).lastIndexOf(key)
      : text.indexOf(key, relativeStart + (range.empty ? 1 : 0));

    if (found < 0) {
      return { range };
    }

    const offset = inclusive ? found : found + (backwards ? 1 : -1);
    const next = line.from + Math.max(0, offset);
    return {
      range: EditorSelection.cursor(next)
    };
  });

  view.dispatch(result);
  return true;
}

function rotateSelections(view: EditorView, reverse: boolean): boolean {
  const ranges = view.state.selection.ranges;
  if (ranges.length <= 1) {
    return true;
  }

  const current = view.state.selection.mainIndex;
  const next = reverse
    ? (current - 1 + ranges.length) % ranges.length
    : (current + 1) % ranges.length;

  view.dispatch({
    selection: EditorSelection.create(ranges, next)
  });
  return true;
}

function reduceSelectionsToCursor(view: EditorView): boolean {
  const ranges = view.state.selection.ranges.map(range => EditorSelection.cursor(range.head));
  view.dispatch({
    selection: EditorSelection.create(ranges, ranges.length - 1)
  });
  return true;
}

function getSelectionText(view: EditorView): string {
  const { state } = view;
  const range = state.selection.main;

  if (!range.empty) {
    return state.sliceDoc(range.from, range.to);
  }

  const line = state.doc.lineAt(range.head);
  const relative = range.head - line.from;
  const text = line.text;
  let start = relative;
  let end = relative;

  while (start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1])) {
    start -= 1;
  }

  while (end < text.length && /[\p{L}\p{N}_]/u.test(text[end])) {
    end += 1;
  }

  return text.slice(start, end);
}

function setSearchFromSelection(view: EditorView): boolean {
  const text = getSelectionText(view);
  if (!text) {
    return false;
  }

  view.dispatch({
    effects: setSearchQuery.of(
      new SearchQuery({
        search: text,
        literal: true
      })
    )
  });
  return true;
}

function getSearchText(view: EditorView): string {
  const query = getSearchQuery(view.state);
  if (query.valid && query.search) {
    return query.search;
  }

  return getSelectionText(view);
}

function findNextRange(view: EditorView, text: string): { from: number; to: number } | null {
  if (!text) {
    return null;
  }

  const doc = view.state.doc.toString();
  const ranges = view.state.selection.ranges;
  const start = ranges[ranges.length - 1].to;
  const wrap = doc.indexOf(text, start);

  if (wrap >= 0) {
    return { from: wrap, to: wrap + text.length };
  }

  const before = doc.indexOf(text, 0);
  if (before >= 0) {
    return { from: before, to: before + text.length };
  }

  return null;
}

function selectNextText(view: EditorView): boolean {
  const text = getSearchText(view);
  const next = findNextRange(view, text);
  if (!next) {
    return false;
  }

  view.dispatch({
    selection: EditorSelection.range(next.from, next.to)
  });
  return true;
}

function addNextTextSelection(view: EditorView): boolean {
  const text = getSearchText(view);
  const next = findNextRange(view, text);
  if (!next) {
    return false;
  }

  view.dispatch({
    selection: view.state.selection.addRange(EditorSelection.range(next.from, next.to), false)
  });
  return true;
}

function selectAllBuffer(view: EditorView): boolean {
  view.dispatch({
    selection: EditorSelection.range(0, view.state.doc.length)
  });
  return true;
}

function clearSelections(view: EditorView): boolean {
  view.dispatch({
    selection: EditorSelection.cursor(view.state.selection.main.head)
  });
  return true;
}

function selectLine(view: EditorView): boolean {
  const state = view.state;
  const result = state.changeByRange(range => {
    const fromLine = state.doc.lineAt(Math.min(range.from, range.to));
    const toLine = state.doc.lineAt(Math.max(range.from, range.to));
    const end = toLine.to < state.doc.length ? toLine.to + 1 : toLine.to;
    return {
      range: EditorSelection.range(fromLine.from, end)
    };
  });

  view.dispatch(result);
  return true;
}

function deleteSelection(view: EditorView): boolean {
  const state = view.state;
  const deleted: string[] = [];

  const result = state.changeByRange(range => {
    const from = Math.min(range.from, range.to);
    const to = range.empty ? Math.min(state.doc.length, from + 1) : Math.max(range.from, range.to);

    if (to <= from) {
      return {
        range: EditorSelection.cursor(from)
      };
    }

    deleted.push(state.doc.sliceString(from, to));
    return {
      changes: { from, to, insert: "" },
      range: EditorSelection.cursor(from)
    };
  });

  view.dispatch({
    ...result,
    effects: setKakouneRegisterEffect.of(deleted.join("\n"))
  });

  return true;
}

function yankSelection(view: EditorView): boolean {
  const state = view.state;
  const selected = state.selection.ranges
    .map(range => {
      const from = Math.min(range.from, range.to);
      const to = range.empty ? Math.min(state.doc.length, from + 1) : Math.max(range.from, range.to);
      return state.doc.sliceString(from, to);
    })
    .join("\n");

  view.dispatch({ effects: setKakouneRegisterEffect.of(selected) });
  return true;
}

function pasteRegister(view: EditorView): boolean {
  const state = view.state;
  const register = state.field(kakouneStateField).register;

  if (!register) {
    return false;
  }

  const result = state.changeByRange(range => {
    const insertAt = range.empty ? range.head : range.to;
    return {
      changes: { from: insertAt, insert: register },
      range: EditorSelection.cursor(insertAt + register.length)
    };
  });

  view.dispatch(result);
  return true;
}

export function buildKakouneCommands(): Record<KakouneMode, Array<{ keys: string[]; run(view: EditorView, arg?: string): boolean }>> {
  return {
    normal: [
      { keys: ["<Esc>"], run: view => (view.state.field(kakouneStateField).mode === "normal" ? true : setMode(view, "normal")) },
      { keys: ["i"], run: view => setMode(view, "insert") },
      { keys: ["a"], run: view => moveSelections(view, range => clamp(range.to + 1, 0, view.state.doc.length)) && setMode(view, "insert") },
      { keys: ["A"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to) && setMode(view, "insert") },
      { keys: ["I"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from) && setMode(view, "insert") },
      { keys: ["h"], run: view => moveSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)) },
      { keys: ["l"], run: view => moveSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)) },
      { keys: ["j"], run: view => moveSelections(view, range => moveLineColumn(view, range, 1)) },
      { keys: ["k"], run: view => moveSelections(view, range => moveLineColumn(view, range, -1)) },
      { keys: ["w"], run: view => moveSelections(view, range => moveWordForward(view, range)) },
      { keys: ["W"], run: view => extendSelections(view, range => moveWordForward(view, range)) },
      { keys: ["b"], run: view => moveSelections(view, range => moveWordBackward(view, range)) },
      { keys: ["B"], run: view => extendSelections(view, range => moveWordBackward(view, range)) },
      { keys: ["e"], run: view => moveSelections(view, range => moveWordEnd(view, range)) },
      { keys: ["E"], run: view => extendSelections(view, range => moveWordEnd(view, range)) },
      { keys: ["x"], run: view => selectLine(view) },
      { keys: ["%"], run: view => selectAllBuffer(view) },
      { keys: [","], run: view => clearSelections(view) },
      { keys: [";"], run: view => reduceSelectionsToCursor(view) },
      { keys: [")"], run: view => rotateSelections(view, false) },
      { keys: ["("], run: view => rotateSelections(view, true) },
      { keys: ["g", "h"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from) },
      { keys: ["g", "l"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to) },
      { keys: ["<A-h>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).from) },
      { keys: ["<A-l>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).to) },
      { keys: ["H"], run: view => extendSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)) },
      { keys: ["J"], run: view => extendSelections(view, range => moveLineColumn(view, range, 1)) },
      { keys: ["K"], run: view => extendSelections(view, range => moveLineColumn(view, range, -1)) },
      { keys: ["L"], run: view => extendSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)) },
      { keys: ["G", "h"], run: view => extendSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)) },
      { keys: ["G", "j"], run: view => extendSelections(view, range => moveLineColumn(view, range, 1)) },
      { keys: ["G", "k"], run: view => extendSelections(view, range => moveLineColumn(view, range, -1)) },
      { keys: ["G", "l"], run: view => extendSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)) },
      { keys: ["G", "G"], run: view => extendSelections(view, () => view.state.doc.length) },
      { keys: ["g", "k"], run: view => moveSelections(view, () => 0) },
      { keys: ["g", "j"], run: view => moveSelections(view, () => view.state.doc.length) },
      { keys: ["d"], run: view => deleteSelection(view) },
      { keys: ["c"], run: view => deleteSelection(view) && setMode(view, "insert") },
      { keys: ["y"], run: view => yankSelection(view) },
      { keys: ["p"], run: view => pasteRegister(view) },
      { keys: ["u"], run: view => undo(view) },
      { keys: ["*"], run: view => setSearchFromSelection(view) },
      { keys: ["n"], run: view => selectNextText(view) },
      { keys: ["N"], run: view => addNextTextSelection(view) },
      { keys: ["/"], run: view => findNext(view) },
      { keys: ["?"], run: view => findPrevious(view) },
      { keys: ["s"], run: view => selectMatches(view) },
      { keys: ["f"], run: (view, arg) => {
        if (!arg) return true;
        return moveToFind(view, "f", arg);
      } },
      { keys: ["t"], run: (view, arg) => {
        if (!arg) return true;
        return moveToFind(view, "t", arg);
      } },
      { keys: ["F"], run: (view, arg) => {
        if (!arg) return true;
        return moveToFind(view, "F", arg);
      } },
      { keys: ["T"], run: (view, arg) => {
        if (!arg) return true;
        return moveToFind(view, "T", arg);
      } },
      { keys: ["g", "g"], run: view => moveSelections(view, () => 0) }
    ],
    insert: [
      { keys: ["<Esc>"], run: view => setMode(view, "normal") }
    ]
  };
}

export const kakouneCommands = {
  deleteSelection,
  yankSelection,
  pasteRegister,
  selectLine,
  moveSelections,
  setMode
};
