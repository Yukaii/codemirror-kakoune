import type { EditorHost, SelectionRange } from "./types";
import { isEmptyRange, rangeFrom, rangeTo } from "./types";
import {
  clamp,
  lineColumnPos,
  moveWordBackwardRange,
  moveWordEndRange,
  moveWordForwardRange
} from "./document";

export function setMode(editor: EditorHost, mode: "select" | "insert"): boolean {
  editor.setMode(mode);
  return true;
}

export function moveSelections(
  editor: EditorHost,
  mapper: (range: SelectionRange) => number,
  count = 1
): boolean {
  const ranges = editor.getSelections().map(range => {
    let current = range;
    for (let i = 0; i < count; i += 1) {
      const head = mapper(current);
      current = { anchor: head, head };
    }
    return current;
  });
  editor.setSelections(ranges);
  return true;
}

export function selectMapped(
  editor: EditorHost,
  mapper: (range: SelectionRange, doc: string) => SelectionRange,
  count = 1
): boolean {
  const doc = editor.getDoc();
  const ranges = editor.getSelections().map(range => {
    let current = range;
    for (let i = 0; i < count; i += 1) {
      current = mapper(current, doc);
    }
    return current;
  });
  editor.setSelections(ranges);
  return true;
}

export function moveLeft(editor: EditorHost, count = 1): boolean {
  return moveSelections(editor, range => clamp(range.head - 1, 0, editor.getDocLength()), count);
}

export function moveRight(editor: EditorHost, count = 1): boolean {
  return moveSelections(editor, range => clamp(range.head + 1, 0, editor.getDocLength()), count);
}

export function moveDown(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return moveSelections(editor, range => lineColumnPos(doc, range.head, 1), count);
}

export function moveUp(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return moveSelections(editor, range => lineColumnPos(doc, range.head, -1), count);
}

export function selectWordForward(editor: EditorHost, count = 1): boolean {
  return selectMapped(editor, (range, doc) => moveWordForwardRange(doc, range), count);
}

export function selectWordBackward(editor: EditorHost, count = 1): boolean {
  return selectMapped(editor, (range, doc) => moveWordBackwardRange(doc, range), count);
}

export function selectWordEnd(editor: EditorHost, count = 1): boolean {
  return selectMapped(editor, (range, doc) => moveWordEndRange(doc, range), count);
}

export function moveLineStart(editor: EditorHost): boolean {
  return moveSelections(editor, range => editor.lineAt(range.head).from);
}

export function moveLineEnd(editor: EditorHost): boolean {
  return moveSelections(editor, range => editor.lineAt(range.head).to);
}

export function jumpDocumentStart(editor: EditorHost): boolean {
  editor.setSelections([{ anchor: 0, head: 0 }]);
  return true;
}

export function jumpDocumentEnd(editor: EditorHost): boolean {
  const end = editor.getDocLength();
  editor.setSelections([{ anchor: end, head: end }]);
  return true;
}

export function selectLine(editor: EditorHost): boolean {
  const ranges = editor.getSelections().map(range => {
    const line = editor.lineAt(range.head);
    return { anchor: line.from, head: line.to };
  });
  editor.setSelections(ranges);
  return true;
}

export function deleteSelection(editor: EditorHost): boolean {
  const ranges = editor.getSelections()
    .map(range => {
      if (!isEmptyRange(range)) return { from: rangeFrom(range), to: rangeTo(range) };
      const from = range.head;
      return { from, to: Math.min(editor.getDocLength(), from + 1) };
    })
    .sort((a, b) => b.from - a.from);

  for (const range of ranges) {
    editor.replaceRange(range.from, range.to, "");
  }
  return true;
}

export function yankSelection(editor: EditorHost): boolean {
  const doc = editor.getDoc();
  const text = editor.getSelections().map(range => {
    if (!isEmptyRange(range)) return doc.slice(rangeFrom(range), rangeTo(range));
    const line = editor.lineAt(range.head);
    return doc.slice(line.from, line.to);
  }).join("\n");
  editor.setRegister(text);
  return true;
}

export function undoEdit(editor: EditorHost): boolean {
  editor.undo();
  return true;
}

export function redoEdit(editor: EditorHost): boolean {
  editor.redo();
  return true;
}

export function enterInsert(editor: EditorHost, after = false): boolean {
  if (after) {
    moveRight(editor);
  }
  return setMode(editor, "insert");
}

export function enterInsertLineStart(editor: EditorHost): boolean {
  moveLineStart(editor);
  return setMode(editor, "insert");
}

export function enterInsertLineEnd(editor: EditorHost): boolean {
  moveLineEnd(editor);
  return setMode(editor, "insert");
}

export function openLineBelow(editor: EditorHost): boolean {
  const ranges = editor.getSelections();
  for (const range of [...ranges].reverse()) {
    const line = editor.lineAt(range.head);
    editor.replaceRange(line.to, line.to, "\n");
  }
  const next = editor.getSelections().map(range => {
    const line = editor.line(Math.min(editor.getLineCount(), editor.lineAt(range.head).number + 1));
    return { anchor: line.from, head: line.from };
  });
  editor.setSelections(next);
  return setMode(editor, "insert");
}

export function openLineAbove(editor: EditorHost): boolean {
  const ranges = editor.getSelections();
  for (const range of [...ranges].reverse()) {
    const line = editor.lineAt(range.head);
    editor.replaceRange(line.from, line.from, "\n");
  }
  const next = editor.getSelections().map(range => {
    const line = editor.lineAt(range.head);
    return { anchor: line.from, head: line.from };
  });
  editor.setSelections(next);
  return setMode(editor, "insert");
}

export function changeSelection(editor: EditorHost): boolean {
  deleteSelection(editor);
  return setMode(editor, "insert");
}

export const portableCommands = {
  setMode,
  moveLeft,
  moveRight,
  moveDown,
  moveUp,
  selectWordForward,
  selectWordBackward,
  selectWordEnd,
  moveLineStart,
  moveLineEnd,
  jumpDocumentStart,
  jumpDocumentEnd,
  selectLine,
  deleteSelection,
  yankSelection,
  undoEdit,
  redoEdit,
  enterInsert,
  enterInsertLineStart,
  enterInsertLineEnd,
  openLineBelow,
  openLineAbove,
  changeSelection
};
