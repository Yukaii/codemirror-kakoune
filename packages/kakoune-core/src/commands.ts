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

export function extendSelections(
  editor: EditorHost,
  mapper: (range: SelectionRange) => number,
  count = 1
): boolean {
  const ranges = editor.getSelections().map(range => {
    let head = range.head;
    for (let i = 0; i < count; i += 1) {
      head = mapper({ anchor: range.anchor, head });
    }
    return { anchor: range.anchor, head };
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

export function extendLeft(editor: EditorHost, count = 1): boolean {
  return extendSelections(editor, range => clamp(range.head - 1, 0, editor.getDocLength()), count);
}

export function extendRight(editor: EditorHost, count = 1): boolean {
  return extendSelections(editor, range => clamp(range.head + 1, 0, editor.getDocLength()), count);
}

export function extendDown(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return extendSelections(editor, range => lineColumnPos(doc, range.head, 1), count);
}

export function extendUp(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return extendSelections(editor, range => lineColumnPos(doc, range.head, -1), count);
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

export function extendWordForward(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return extendSelections(editor, range => moveWordForwardRange(doc, range).head, count);
}

export function extendWordBackward(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return extendSelections(editor, range => moveWordBackwardRange(doc, range).head, count);
}

export function extendWordEnd(editor: EditorHost, count = 1): boolean {
  const doc = editor.getDoc();
  return extendSelections(editor, range => moveWordEndRange(doc, range).head, count);
}

export function moveLineStart(editor: EditorHost): boolean {
  return moveSelections(editor, range => editor.lineAt(range.head).from);
}

export function moveLineEnd(editor: EditorHost): boolean {
  return moveSelections(editor, range => editor.lineAt(range.head).to);
}

export function extendLineStart(editor: EditorHost): boolean {
  return extendSelections(editor, range => editor.lineAt(range.head).from);
}

export function extendLineEnd(editor: EditorHost): boolean {
  return extendSelections(editor, range => editor.lineAt(range.head).to);
}

export function extendToLine(editor: EditorHost, lineNumber: number): boolean {
  const targetLine = editor.line(clamp(lineNumber, 1, editor.getLineCount()));
  return extendSelections(editor, () => targetLine.from);
}

export function extendDocumentStart(editor: EditorHost): boolean {
  return extendSelections(editor, () => 0);
}

export function extendDocumentEnd(editor: EditorHost): boolean {
  return extendSelections(editor, () => editor.getDocLength());
}

export function jumpDocumentStart(editor: EditorHost): boolean {
  editor.setSelections([{ anchor: 0, head: 0 }], 0);
  return true;
}

export function jumpDocumentEnd(editor: EditorHost): boolean {
  const end = editor.getDocLength();
  editor.setSelections([{ anchor: end, head: end }], 0);
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
    const ranges = editor.getSelections().map(range => {
      const head = isEmptyRange(range)
        ? clamp(range.head + 1, 0, editor.getDocLength())
        : rangeTo(range);
      return { anchor: head, head };
    });
    editor.setSelections(ranges);
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

function openLines(editor: EditorHost, direction: "above" | "below"): boolean {
  const insertions = editor.getSelections().map((range, index) => {
    const line = editor.lineAt(range.head);
    return { at: direction === "above" ? line.from : line.to, index };
  });

  for (const insertion of [...insertions].sort((a, b) => b.at - a.at || b.index - a.index)) {
    editor.replaceRange(insertion.at, insertion.at, "\n");
  }

  const next = insertions.map(insertion => {
    const insertionsBefore = insertions.filter(candidate => candidate.at < insertion.at).length;
    const samePositionBefore = insertions.filter(candidate => (
      candidate.at === insertion.at && candidate.index < insertion.index
    )).length;
    const head = insertion.at
      + insertionsBefore
      + samePositionBefore
      + (direction === "below" ? 1 : 0);
    return { anchor: head, head };
  });
  editor.setSelections(next);
  return setMode(editor, "insert");
}

export function openLineBelow(editor: EditorHost): boolean {
  return openLines(editor, "below");
}

export function openLineAbove(editor: EditorHost): boolean {
  return openLines(editor, "above");
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
  extendLeft,
  extendRight,
  extendDown,
  extendUp,
  selectWordForward,
  selectWordBackward,
  selectWordEnd,
  extendWordForward,
  extendWordBackward,
  extendWordEnd,
  moveLineStart,
  moveLineEnd,
  extendLineStart,
  extendLineEnd,
  extendToLine,
  extendDocumentStart,
  extendDocumentEnd,
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
