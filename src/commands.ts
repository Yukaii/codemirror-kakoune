import { EditorSelection, type SelectionRange } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  kakouneStateField,
  setKakouneModeEffect,
  setKakouneRegisterEffect,
  type KakouneMode
} from "./state";

export type KakouneFindKind = "f" | "t" | "F" | "T";

export interface KakouneMotionRuntime {
  rememberFind(kind: KakouneFindKind, key: string): void;
  repeatFind(view: EditorView, reverse: boolean): boolean;
}

export function createKakouneMotionRuntime(): KakouneMotionRuntime {
  let lastFind: { kind: KakouneFindKind; key: string } | null = null;

  const moveToFind = (
    view: EditorView,
    kind: KakouneFindKind,
    target: string
  ): boolean => {
    const backwards = kind === "F" || kind === "T";
    const inclusive = kind === "f" || kind === "F";
    const doc = view.state.doc;

    const result = view.state.changeByRange(range => {
      const line = doc.lineAt(range.head);
      const text = doc.sliceString(line.from, line.to);
      const relativeStart = range.head - line.from;
      const relativeIndex = backwards
        ? text.slice(0, relativeStart).lastIndexOf(target)
        : text.indexOf(target, relativeStart + (range.empty ? 1 : 0));

      if (relativeIndex < 0) {
        return { range };
      }

      const offset = inclusive
        ? relativeIndex
        : relativeIndex + (backwards ? 1 : -1);
      const next = line.from + Math.max(0, offset);
      return { range: EditorSelection.cursor(next) };
    });

    view.dispatch(result);
    return true;
  };

  return {
    rememberFind(kind, key) {
      lastFind = { kind, key };
    },
    repeatFind(view, reverse) {
      if (!lastFind) {
        return false;
      }

      const repeatKind = reverse
        ? ({
            f: "F",
            t: "T",
            F: "f",
            T: "t"
          }[lastFind.kind] as KakouneFindKind)
        : lastFind.kind;

      return moveToFind(view, repeatKind, lastFind.key);
    }
  };
}

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

export function buildKakouneCommands(
  runtime: KakouneMotionRuntime = createKakouneMotionRuntime()
): Record<KakouneMode, Array<{ keys: string[]; run(view: EditorView, arg?: string): boolean }>> {
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
      { keys: ["b"], run: view => moveSelections(view, range => moveWordBackward(view, range)) },
      { keys: ["e"], run: view => moveSelections(view, range => moveWordEnd(view, range)) },
      { keys: ["0"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from) },
      { keys: ["$"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to) },
      { keys: ["x"], run: view => selectLine(view) },
      { keys: ["d"], run: view => deleteSelection(view) },
      { keys: ["c"], run: view => deleteSelection(view) && setMode(view, "insert") },
      { keys: ["y"], run: view => yankSelection(view) },
      { keys: ["p"], run: view => pasteRegister(view) },
      { keys: ["u"], run: view => undo(view) },
      { keys: ["f"], run: (view, arg) => {
        if (!arg) return true;
        runtime.rememberFind("f", arg);
        return moveToFind(view, "f", arg);
      } },
      { keys: ["t"], run: (view, arg) => {
        if (!arg) return true;
        runtime.rememberFind("t", arg);
        return moveToFind(view, "t", arg);
      } },
      { keys: ["F"], run: (view, arg) => {
        if (!arg) return true;
        runtime.rememberFind("F", arg);
        return moveToFind(view, "F", arg);
      } },
      { keys: ["T"], run: (view, arg) => {
        if (!arg) return true;
        runtime.rememberFind("T", arg);
        return moveToFind(view, "T", arg);
      } },
      { keys: [";"], run: view => runtime.repeatFind(view, false) },
      { keys: [","], run: view => runtime.repeatFind(view, true) },
      { keys: ["g", "g"], run: view => moveSelections(view, () => 0) },
      { keys: ["G"], run: view => moveSelections(view, () => view.state.doc.length) }
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
