import type { SelectionRange } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isWordChar(char: string | undefined): boolean {
  return typeof char === "string" && /[\p{L}\p{N}_]/u.test(char);
}

export function getCharClass(char: string | undefined): "word" | "punctuation" | "whitespace" {
  if (char === undefined) return "whitespace";
  if (/[\s\n\r]/.test(char)) return "whitespace";
  if (isWordChar(char)) return "word";
  return "punctuation";
}

export function isAtWordEnd(doc: string, pos: number): boolean {
  if (pos < 0 || pos >= doc.length) return false;
  const cls = getCharClass(doc[pos]);
  if (cls === "whitespace") return false;
  const nextCls = pos + 1 < doc.length ? getCharClass(doc[pos + 1]) : "whitespace";
  return cls !== nextCls;
}

export function isAtWordStart(doc: string, pos: number): boolean {
  if (pos < 0 || pos >= doc.length) return false;
  const cls = getCharClass(doc[pos]);
  if (cls === "whitespace") return false;
  const prevCls = pos > 0 ? getCharClass(doc[pos - 1]) : "whitespace";
  return cls !== prevCls;
}

export function moveWordForwardRange(doc: string, range: SelectionRange): SelectionRange {
  const len = doc.length;
  const empty = range.anchor === range.head;
  const startPos = empty && isAtWordEnd(doc, range.head) ? range.head + 1 : range.head;
  let pos = clamp(startPos, 0, len);

  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }

  const anchor = pos;
  if (pos < len) {
    const cls = getCharClass(doc[pos]);
    while (pos < len && getCharClass(doc[pos]) === cls) {
      pos += 1;
    }
  }
  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }

  return { anchor, head: pos };
}

export function moveWordBackwardRange(doc: string, range: SelectionRange): SelectionRange {
  let pos = range.head;

  while (pos > 0 && getCharClass(doc[pos - 1]) === "whitespace") {
    pos -= 1;
  }
  if (pos > 0) {
    const cls = getCharClass(doc[pos - 1]);
    while (pos > 0 && getCharClass(doc[pos - 1]) === cls) {
      pos -= 1;
    }
  }

  let anchor = range.head;
  if (range.anchor === range.head) {
    const isWhitespace = getCharClass(doc[range.head]) === "whitespace";
    const isStartOfMultiChar = isAtWordStart(doc, range.head) && !isAtWordEnd(doc, range.head);
    anchor = isWhitespace || isStartOfMultiChar ? range.head : range.head + 1;
  }

  return { anchor: clamp(anchor, 0, doc.length), head: pos };
}

export function moveWordEndRange(doc: string, range: SelectionRange): SelectionRange {
  const len = doc.length;
  const empty = range.anchor === range.head;
  const startPos = empty && isAtWordEnd(doc, range.head) ? range.head + 1 : range.head;
  let pos = clamp(startPos, 0, len);

  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }
  if (pos < len) {
    const cls = getCharClass(doc[pos]);
    while (pos < len && getCharClass(doc[pos]) === cls) {
      pos += 1;
    }
  }

  return { anchor: range.head, head: pos };
}

export function lineColumnPos(doc: string, pos: number, delta: number): number {
  const lines = splitLines(doc);
  let remaining = pos;
  let lineIndex = 0;
  while (lineIndex < lines.length - 1 && remaining > lines[lineIndex].length) {
    remaining -= lines[lineIndex].length + 1;
    lineIndex += 1;
  }
  const column = remaining;
  const nextIndex = clamp(lineIndex + delta, 0, lines.length - 1);
  const nextFrom = lineStart(lines, nextIndex);
  return clamp(nextFrom + column, nextFrom, nextFrom + lines[nextIndex].length);
}

function splitLines(doc: string): string[] {
  return doc.split("\n");
}

function lineStart(lines: string[], index: number): number {
  let from = 0;
  for (let i = 0; i < index; i += 1) {
    from += lines[i].length + 1;
  }
  return from;
}
