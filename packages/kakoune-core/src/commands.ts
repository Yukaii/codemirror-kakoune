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

export function selectAll(editor: EditorHost): boolean {
  editor.setSelections([{ anchor: 0, head: editor.getDocLength() }], 0);
  return true;
}

export function selectLine(editor: EditorHost): boolean {
  const ranges = editor.getSelections().map(range => {
    const isForward = range.anchor <= range.head;
    const fromLine = editor.lineAt(rangeFrom(range));
    const toPosition = rangeTo(range);
    const toLine = editor.lineAt(toPosition);
    const isAlreadyFullLine = rangeFrom(range) === fromLine.from && (
      (toLine.number < editor.getLineCount() && toPosition === toLine.to + 1) ||
      (toLine.number === editor.getLineCount() && toPosition === toLine.to)
    );
    const endLine = isAlreadyFullLine && toLine.number < editor.getLineCount()
      ? editor.line(toLine.number + 1)
      : toLine;
    const end = endLine.number < editor.getLineCount() ? endLine.to + 1 : endLine.to;
    return isForward
      ? { anchor: fromLine.from, head: end, linewise: true }
      : { anchor: end, head: fromLine.from, linewise: true };
  });
  editor.setSelections(ranges);
  return true;
}

export function deleteSelection(editor: EditorHost): boolean {
  const doc = editor.getDoc();
  const docLength = doc.length;
  const ranges = editor.getSelections()
    .map(range => {
      let from = rangeFrom(range);
      const to = isEmptyRange(range) ? Math.min(docLength, from + 1) : rangeTo(range);

      // A final line has no following newline for `x` to include. Its linewise
      // marker lets deletion consume the preceding separator instead.
      if (range.linewise && to >= docLength && from > 0 && doc[from - 1] === "\n") {
        from -= 1;
      }
      return { from, to };
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

export function joinLines(editor: EditorHost, selectSpaces = false): boolean {
  const doc = editor.getDoc();
  const lineCount = editor.getLineCount();
  const selections = editor.getSelections();
  if (lineCount <= 1) return false;

  const joinSpans: Array<{ from: number; to: number }> = [];

  for (const sel of selections) {
    const minPos = Math.min(sel.anchor, sel.head);
    const maxPos = Math.max(sel.anchor, sel.head);
    const minLine = editor.lineAt(minPos).number;
    const maxLine = editor.lineAt(maxPos).number;
    const endLine = Math.min(lineCount, maxLine + (minLine === maxLine ? 1 : 0));

    for (let l = minLine; l < endLine; l++) {
      const lineInfo = editor.line(l);
      const newlinePos = lineInfo.to;
      if (newlinePos >= doc.length || doc[newlinePos] !== "\n") continue;

      let endPos = newlinePos + 1;
      while (endPos < doc.length && (doc[endPos] === " " || doc[endPos] === "\t")) {
        endPos++;
      }

      joinSpans.push({ from: newlinePos, to: endPos });
    }
  }

  if (joinSpans.length === 0) return false;

  const unique = Array.from(new Map(joinSpans.map(s => [`${s.from}:${s.to}`, s])).values())
    .sort((a, b) => b.from - a.from);

  for (const span of unique) {
    editor.replaceRange(span.from, span.to, " ");
  }

  if (selectSpaces) {
    const spaceSelections: SelectionRange[] = [];
    const ascending = [...unique].reverse();
    let delta = 0;
    for (const span of ascending) {
      const pos = span.from + delta;
      spaceSelections.push({ anchor: pos, head: pos + 1 });
      delta += 1 - (span.to - span.from);
    }
    if (spaceSelections.length > 0) {
      editor.setSelections(spaceSelections, 0);
    }
  }

  return true;
}

export function transformCase(editor: EditorHost, transform: (text: string) => string): boolean {
  const doc = editor.getDoc();
  const selections = editor.getSelections();
  if (selections.length === 0) return false;

  const spans = selections.map(range => {
    const from = rangeFrom(range);
    const to = isEmptyRange(range) ? Math.min(doc.length, from + 1) : rangeTo(range);
    return { from, to, text: transform(doc.slice(from, to)) };
  }).sort((a, b) => b.from - a.from);

  for (const span of spans) {
    editor.replaceRange(span.from, span.to, span.text);
  }
  editor.setSelections(selections);
  return true;
}

export function toUpperCaseSelection(editor: EditorHost): boolean {
  return transformCase(editor, text => text.toUpperCase());
}

export function toLowerCaseSelection(editor: EditorHost): boolean {
  return transformCase(editor, text => text.toLowerCase());
}

export function swapCaseSelection(editor: EditorHost): boolean {
  return transformCase(editor, text => {
    let res = "";
    for (const ch of text) {
      const up = ch.toUpperCase();
      res += ch === up ? ch.toLowerCase() : up;
    }
    return res;
  });
}

export function trimSelections(editor: EditorHost): boolean {
  const doc = editor.getDoc();
  const nextSelections: SelectionRange[] = [];

  for (const range of editor.getSelections()) {
    const from = rangeFrom(range);
    const to = rangeTo(range);
    const text = doc.slice(from, to);

    const leadingWs = text.match(/^\s*/)?.[0].length ?? 0;
    const trailingWs = text.match(/\s*$/)?.[0].length ?? 0;

    const nextFrom = from + leadingWs;
    const nextTo = Math.max(nextFrom, to - trailingWs);

    if (nextFrom < nextTo) {
      nextSelections.push(
        range.anchor <= range.head
          ? { anchor: nextFrom, head: nextTo }
          : { anchor: nextTo, head: nextFrom }
      );
    }
  }

  if (nextSelections.length > 0) {
    editor.setSelections(nextSelections);
    return true;
  }
  return false;
}

export function copySelectionsOnNextLines(editor: EditorHost, direction: 1 | -1 = 1, count = 1): boolean {
  const doc = editor.getDoc();
  const lineCount = editor.getLineCount();
  const currentSelections = editor.getSelections();
  const additions: SelectionRange[] = [];

  for (const sel of currentSelections) {
    const fromLine = editor.lineAt(sel.anchor).number;
    const toLine = editor.lineAt(sel.head).number;
    const height = Math.abs(toLine - fromLine) + 1;

    for (let i = 1; i <= count; i++) {
      const lineOffset = direction * i * height;
      const targetAnchorLine = fromLine + lineOffset;
      const targetHeadLine = toLine + lineOffset;

      if (targetAnchorLine < 1 || targetAnchorLine > lineCount ||
          targetHeadLine < 1 || targetHeadLine > lineCount) {
        break;
      }

      const nextAnchor = lineColumnPos(doc, sel.anchor, lineOffset);
      const nextHead = lineColumnPos(doc, sel.head, lineOffset);
      additions.push({ anchor: nextAnchor, head: nextHead, linewise: sel.linewise });
    }
  }

  if (additions.length > 0) {
    editor.setSelections([...currentSelections, ...additions]);
    return true;
  }
  return false;
}

export function addEmptyLineBelow(editor: EditorHost): boolean {
  const insertions = editor.getSelections().map((range, index) => {
    const line = editor.lineAt(range.head);
    return { at: line.to, index };
  }).sort((a, b) => b.at - a.at);

  for (const ins of insertions) {
    editor.replaceRange(ins.at, ins.at, "\n");
  }
  return true;
}

export function addEmptyLineAbove(editor: EditorHost): boolean {
  const insertions = editor.getSelections().map((range, index) => {
    const line = editor.lineAt(range.head);
    return { at: line.from, index };
  }).sort((a, b) => b.at - a.at);

  for (const ins of insertions) {
    editor.replaceRange(ins.at, ins.at, "\n");
  }
  return true;
}

export function reduceToCursor(editor: EditorHost): boolean {
  const next = editor.getSelections().map(range => ({
    anchor: range.head,
    head: range.head
  }));
  editor.setSelections(next);
  return true;
}

export function flipSelectionDirection(editor: EditorHost): boolean {
  const next = editor.getSelections().map(range => ({
    anchor: range.head,
    head: range.anchor,
    linewise: range.linewise
  }));
  editor.setSelections(next);
  return true;
}

export function ensureForwardDirection(editor: EditorHost): boolean {
  const next = editor.getSelections().map(range => ({
    anchor: Math.min(range.anchor, range.head),
    head: Math.max(range.anchor, range.head),
    linewise: range.linewise
  }));
  editor.setSelections(next);
  return true;
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
