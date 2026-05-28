import { EditorSelection, type SelectionRange } from "@codemirror/state";
import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import type { KakouneBinding } from "./keys";
import { getSearchQuery, SearchQuery, findNext, findPrevious, selectMatches, setSearchQuery } from "@codemirror/search";
import {
  kakouneStateField,
  setKakouneSearchPromptEffect,
  setKakouneSearchSelectionEffect,
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

function getCharClass(char: string | undefined): "word" | "punctuation" | "whitespace" {
  if (char === undefined) return "whitespace";
  if (/[\s\n\r]/.test(char)) return "whitespace";
  if (isWordChar(char)) return "word";
  return "punctuation";
}

function isAtWordEnd(doc: string, pos: number): boolean {
  if (pos < 0 || pos >= doc.length) return false;
  const cls = getCharClass(doc[pos]);
  if (cls === "whitespace") return false;

  const nextCls = pos + 1 < doc.length ? getCharClass(doc[pos + 1]) : "whitespace";
  return cls !== nextCls;
}

function isAtWordStart(doc: string, pos: number): boolean {
  if (pos < 0 || pos >= doc.length) return false;
  const cls = getCharClass(doc[pos]);
  if (cls === "whitespace") return false;

  const prevCls = pos > 0 ? getCharClass(doc[pos - 1]) : "whitespace";
  return cls !== prevCls;
}

function moveWordForwardRange(view: EditorView, range: SelectionRange): { anchor: number, head: number } {
  const doc = view.state.doc.toString();
  const len = doc.length;
  const startPos = range.empty && isAtWordEnd(doc, range.head) ? range.head + 1 : range.head;
  let pos = clamp(startPos, 0, len);

  // Step 1: Skip initial whitespaces
  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }

  const anchor = pos;

  if (pos < len) {
    const cls = getCharClass(doc[pos]);
    // Step 2: Skip characters of the same class (word or punctuation)
    while (pos < len && getCharClass(doc[pos]) === cls) {
      pos += 1;
    }
  }

  // Step 3: Skip following whitespaces
  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }

  return { anchor, head: pos };
}

function moveWordBackwardRange(view: EditorView, range: SelectionRange): { anchor: number, head: number } {
  const doc = view.state.doc.toString();
  let pos = range.head;

  // Step 1: Skip initial whitespaces to the left
  while (pos > 0 && getCharClass(doc[pos - 1]) === "whitespace") {
    pos -= 1;
  }

  if (pos > 0) {
    const cls = getCharClass(doc[pos - 1]);
    // Step 2: Skip characters of the same class to the left
    while (pos > 0 && getCharClass(doc[pos - 1]) === cls) {
      pos -= 1;
    }
  }

  let anchor = range.head;
  if (range.empty) {
    const isWhitespace = getCharClass(doc[range.head]) === "whitespace";
    const isStartOfMultiChar = isAtWordStart(doc, range.head) && !isAtWordEnd(doc, range.head);
    anchor = (isWhitespace || isStartOfMultiChar) ? range.head : range.head + 1;
  }

  return { anchor: clamp(anchor, 0, doc.length), head: pos };
}

function moveWordEndRange(view: EditorView, range: SelectionRange): { anchor: number, head: number } {
  const doc = view.state.doc.toString();
  const len = doc.length;
  const startPos = range.empty && isAtWordEnd(doc, range.head) ? range.head + 1 : range.head;
  let pos = clamp(startPos, 0, len);

  // Step 1: Skip initial whitespaces
  while (pos < len && getCharClass(doc[pos]) === "whitespace") {
    pos += 1;
  }

  if (pos < len) {
    const cls = getCharClass(doc[pos]);
    // Step 2: Skip characters of the same class (word or punctuation)
    while (pos < len && getCharClass(doc[pos]) === cls) {
      pos += 1;
    }
  }

  return { anchor: range.head, head: pos };
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

function moveWordSelections(view: EditorView, mapper: (range: SelectionRange) => { anchor: number, head: number }): boolean {
  const state = view.state;
  const result = state.changeByRange(range => {
    const { anchor, head } = mapper(range);
    return {
      range: EditorSelection.range(anchor, head)
    };
  });

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

function flipSelections(view: EditorView): boolean {
  const state = view.state;
  const ranges = state.selection.ranges.map(range =>
    EditorSelection.range(range.head, range.anchor)
  );
  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex)
  });
  return true;
}

const bracketPairs: Record<string, { open: string; close: string }> = {
  "b": { open: "(", close: ")" },
  "(": { open: "(", close: ")" },
  ")": { open: "(", close: ")" },
  "B": { open: "{", close: "}" },
  "{": { open: "{", close: "}" },
  "}": { open: "{", close: "}" },
  "r": { open: "[", close: "]" },
  "[": { open: "[", close: "]" },
  "]": { open: "[", close: "]" },
  "a": { open: "<", close: ">" },
  "<": { open: "<", close: ">" },
  ">": { open: "<", close: ">" }
};

function findEnclosingObject(doc: string, pos: number, openChar: string, closeChar: string): { start: number; end: number } | null {
  let nestedCount = 0;
  let startIdx = -1;

  // Scan backwards to find the unmatched openChar
  for (let i = pos - 1; i >= 0; i--) {
    const char = doc[i];
    if (char === closeChar) {
      nestedCount++;
    } else if (char === openChar) {
      if (nestedCount === 0) {
        startIdx = i;
        break;
      }
      nestedCount--;
    }
  }

  if (startIdx === -1) {
    return null;
  }

  // Scan forwards from startIdx + 1 to find the matching closeChar
  nestedCount = 0;
  let endIdx = -1;
  for (let i = startIdx + 1; i < doc.length; i++) {
    const char = doc[i];
    if (char === openChar) {
      nestedCount++;
    } else if (char === closeChar) {
      if (nestedCount === 0) {
        endIdx = i;
        break;
      }
      nestedCount--;
    }
  }

  if (endIdx === -1) {
    return null;
  }

  return { start: startIdx, end: endIdx };
}

function findEnclosingQuote(doc: string, pos: number, quoteChar: string): { start: number; end: number } | null {
  const quotes: number[] = [];
  for (let i = 0; i < doc.length; i++) {
    if (doc[i] === quoteChar) {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && doc[j] === "\\") {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        quotes.push(i);
      }
    }
  }

  for (let k = 0; k < quotes.length - 1; k += 2) {
    const start = quotes[k];
    const end = quotes[k + 1];
    if (start < pos && end >= pos) {
      return { start, end };
    }
  }

  return null;
}

function findEnclosingWhitespace(doc: string, pos: number): { start: number; end: number } | null {
  let start = pos;
  while (start > 0 && /\s/.test(doc[start - 1])) {
    start--;
  }
  let end = pos;
  while (end < doc.length && /\s/.test(doc[end])) {
    end++;
  }
  if (start === end) {
    return null;
  }
  return { start, end: end - 1 };
}

function findEnclosingWord(doc: string, pos: number, isWORD: boolean): { start: number; end: number } | null {
  const isWordChar = (char: string) => isWORD ? /\S/.test(char) : /[\p{L}\p{N}_]/u.test(char);

  let start = pos;
  if (start < doc.length && !isWordChar(doc[start]) && start > 0 && isWordChar(doc[start - 1])) {
    start--;
  }

  if (start >= doc.length || !isWordChar(doc[start])) {
    return null;
  }

  while (start > 0 && isWordChar(doc[start - 1])) {
    start--;
  }
  let end = pos;
  while (end < doc.length && isWordChar(doc[end])) {
    end++;
  }
  return { start, end: end - 1 };
}

function findEnclosingNumber(doc: string, pos: number): { start: number; end: number } | null {
  const isDigit = (char: string) => /\d/.test(char);

  let start = pos;
  if (start < doc.length && !isDigit(doc[start]) && start > 0 && isDigit(doc[start - 1])) {
    start--;
  }

  if (start >= doc.length || !isDigit(doc[start])) {
    return null;
  }

  while (start > 0 && isDigit(doc[start - 1])) {
    start--;
  }
  let end = pos;
  while (end < doc.length && isDigit(doc[end])) {
    end++;
  }
  return { start, end: end - 1 };
}

function findEnclosingParagraph(doc: string, pos: number, direction: "start" | "end"): { start: number; end: number } | null {
  let start = pos;
  if (direction === "start") {
    if (start > 1 && doc.slice(start - 2, start) === "\n\n") {
      start -= 2;
    }
    while (start > 0) {
      if (doc.slice(start - 2, start) === "\n\n") {
        break;
      }
      start--;
    }
    let end = start;
    while (end < doc.length) {
      if (doc.slice(end, end + 2) === "\n\n") {
        break;
      }
      end++;
    }
    return { start, end: end - 1 };
  } else {
    let end = pos;
    if (end < doc.length - 1 && doc.slice(end, end + 2) === "\n\n") {
      end += 2;
    }
    while (end < doc.length) {
      if (doc.slice(end, end + 2) === "\n\n") {
        break;
      }
      end++;
    }
    let start = end;
    while (start > 0) {
      if (doc.slice(start - 2, start) === "\n\n") {
        break;
      }
      start--;
    }
    return { start, end: end - 1 };
  }
}

function findEnclosingIndent(doc: string, pos: number): { start: number; end: number } | null {
  const lines = doc.split("\n");
  let currentLineIndex = 0;
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + 1;
    if (charCount + lineLen > pos) {
      currentLineIndex = i;
      break;
    }
    charCount += lineLen;
  }

  const getIndent = (line: string): number => {
    const match = line.match(/^[ \t]*/);
    return match ? match[0].length : 0;
  };

  const currentLine = lines[currentLineIndex];
  if (!currentLine || currentLine.trim() === "") {
    return null;
  }

  const targetIndent = getIndent(currentLine);

  let startLine = currentLineIndex;
  while (startLine > 0) {
    const prevLine = lines[startLine - 1];
    if (prevLine.trim() !== "" && getIndent(prevLine) < targetIndent) {
      break;
    }
    startLine--;
  }

  let endLine = currentLineIndex;
  while (endLine < lines.length - 1) {
    const nextLine = lines[endLine + 1];
    if (nextLine.trim() !== "" && getIndent(nextLine) < targetIndent) {
      break;
    }
    endLine++;
  }

  let startPos = 0;
  for (let i = 0; i < startLine; i++) {
    startPos += lines[i].length + 1;
  }
  let endPos = startPos;
  for (let i = startLine; i <= endLine; i++) {
    endPos += lines[i].length + 1;
  }
  return { start: startPos, end: Math.max(startPos, endPos - 2) };
}

function findEnclosingArgument(doc: string, pos: number): { start: number; end: number } | null {
  let start = pos;
  while (start > 0) {
    const char = doc[start - 1];
    if (char === "," || char === "(" || char === "[" || char === "{" || char === "\n") {
      break;
    }
    start--;
  }

  let end = pos;
  while (end < doc.length) {
    const char = doc[end];
    if (char === "," || char === ")" || char === "]" || char === "}" || char === "\n") {
      break;
    }
    end++;
  }

  while (start < end && /\s/.test(doc[start])) {
    start++;
  }
  let endIdx = end - 1;
  while (endIdx > start && /\s/.test(doc[endIdx])) {
    endIdx--;
  }

  if (start > endIdx) {
    return null;
  }

  return { start, end: endIdx };
}

function findEnclosingSentence(doc: string, pos: number, direction: "start" | "end"): { start: number; end: number } | null {
  let start = pos;
  if (direction === "start") {
    if (start > 0 && /\s/.test(doc[start - 1])) {
      let check = start - 1;
      while (check > 0 && /\s/.test(doc[check])) {
        check--;
      }
      if (doc[check] === "." || doc[check] === "?" || doc[check] === "!") {
        start = check;
      }
    }
    while (start > 0) {
      const prevChar = doc[start - 1];
      if (prevChar === "\n" || ((prevChar === "." || prevChar === "?" || prevChar === "!") && /\s/.test(doc[start]))) {
        break;
      }
      start--;
    }
    let end = start;
    while (end < doc.length) {
      const char = doc[end];
      if (char === "." || char === "?" || char === "!" || char === "\n") {
        break;
      }
      end++;
    }
    while (start < end && /\s/.test(doc[start])) {
      start++;
    }
    let endIdx = end;
    if (endIdx >= doc.length) {
      endIdx = doc.length - 1;
    }
    return { start, end: endIdx };
  } else {
    let end = pos;
    if (end < doc.length && (doc[end] === "." || doc[end] === "?" || doc[end] === "!")) {
      end++;
    }
    while (end < doc.length) {
      const char = doc[end];
      if (char === "." || char === "?" || char === "!" || char === "\n") {
        break;
      }
      end++;
    }
    let start = end;
    while (start > 0) {
      const prevChar = doc[start - 1];
      if (prevChar === "\n" || ((prevChar === "." || prevChar === "?" || prevChar === "!") && /\s/.test(doc[start]))) {
        break;
      }
      start--;
    }
    while (start < end && /\s/.test(doc[start])) {
      start++;
    }
    let endIdx = end;
    if (endIdx >= doc.length) {
      endIdx = doc.length - 1;
    }
    return { start, end: endIdx };
  }
}

function getObjectRange(doc: string, pos: number, key: string, direction: "start" | "end"): { start: number; end: number } | null {
  const pair = bracketPairs[key];
  if (pair) {
    return findEnclosingObject(doc, pos, pair.open, pair.close);
  }

  if (key === "\"" || key === "Q" || key === "<dquote>") {
    return findEnclosingQuote(doc, pos, "\"");
  }
  if (key === "'" || key === "q" || key === "<quote>") {
    return findEnclosingQuote(doc, pos, "'");
  }
  if (key === "`" || key === "g") {
    return findEnclosingQuote(doc, pos, "`");
  }

  if (key === " " || key === "<Space>") {
    return findEnclosingWhitespace(doc, pos);
  }

  if (key === "w") {
    return findEnclosingWord(doc, pos, false);
  }
  if (key === "<A-w>" || key === "<a-w>") {
    return findEnclosingWord(doc, pos, true);
  }

  if (key === "n") {
    return findEnclosingNumber(doc, pos);
  }

  if (key === "p") {
    return findEnclosingParagraph(doc, pos, direction);
  }

  if (key === "i") {
    return findEnclosingIndent(doc, pos);
  }

  if (key === "u") {
    return findEnclosingArgument(doc, pos);
  }

  if (key === "s") {
    return findEnclosingSentence(doc, pos, direction);
  }

  return null;
}

function moveToSurroundingObject(
  view: EditorView,
  objectKey: string,
  extend: boolean,
  direction: "start" | "end",
  inner: boolean = false
): boolean {
  const doc = view.state.doc.toString();
  const mapper = (range: SelectionRange): number => {
    const result = getObjectRange(doc, range.head, objectKey, direction);
    if (!result) {
      return range.head;
    }
    
    let startIdx = result.start;
    let endIdx = result.end;

    if (direction === "end" && !inner && (objectKey === "w" || objectKey === "<A-w>" || objectKey === "<a-w>")) {
      while (endIdx + 1 < doc.length && /[ \t]/.test(doc[endIdx + 1])) {
        endIdx++;
      }
    }

    const isDelimiterType = [
      "b", "(", ")", "B", "{", "}", "r", "[", "]", "a", "<", ">", "<lt>", "<gt>",
      "Q", "\"", "<dquote>", "q", "'", "<quote>", "g", "`"
    ].includes(objectKey);

    if (direction === "start") {
      return (inner && isDelimiterType) ? startIdx + 1 : startIdx;
    } else {
      return (inner && isDelimiterType) ? endIdx : endIdx + 1;
    }
  };

  if (extend) {
    return extendSelections(view, mapper);
  } else {
    return moveSelections(view, mapper);
  }
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

  return "";
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

function setSearchPrompt(view: EditorView, prompt: string | null): boolean {
  const selectionSnapshot = prompt === null
    ? null
    : view.state.selection.ranges.map(range => ({ anchor: range.anchor, head: range.head }));

  view.dispatch({
    effects: [
      setKakouneSearchPromptEffect.of(prompt),
      setKakouneSearchSelectionEffect.of(selectionSnapshot)
    ]
  });
  return true;
}

function appendSearchPrompt(view: EditorView, value: string): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  return setSearchPrompt(view, prompt + value);
}

export function deleteSearchPromptChar(view: EditorView): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  return setSearchPrompt(view, prompt.slice(0, -1));
}

export function cancelSearchPrompt(view: EditorView): boolean {
  const snapshot = view.state.field(kakouneStateField).searchSelection;
  const selection = snapshot
    ? EditorSelection.create(snapshot.map(range => EditorSelection.range(range.anchor, range.head)))
    : view.state.selection;

  view.dispatch({
    selection,
    effects: [
      setKakouneSearchPromptEffect.of(null),
      setKakouneSearchSelectionEffect.of(null)
    ]
  });
  return true;
}

export function commitSearchPrompt(view: EditorView): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  const snapshot = view.state.field(kakouneStateField).searchSelection;
  const selection = snapshot
    ? EditorSelection.create(snapshot.map(range => EditorSelection.range(range.anchor, range.head)))
    : view.state.selection;

  view.dispatch({
    selection,
    effects: [
      setKakouneSearchPromptEffect.of(null),
      setKakouneSearchSelectionEffect.of(null),
      setSearchQuery.of(
        new SearchQuery({
          search: prompt,
          literal: true
        })
      )
    ]
  });

  findNext(view);
  return true;
}

function jumpToNextSearch(view: EditorView): boolean {
  const query = getSearchQuery(view.state);
  if (!query.valid || !query.search) {
    return false;
  }

  return findNext(view);
}

function jumpToPreviousSearch(view: EditorView): boolean {
  const query = getSearchQuery(view.state);
  if (!query.valid || !query.search) {
    return false;
  }

  return findPrevious(view);
}

function selectSearchMatches(view: EditorView): boolean {
  const query = getSearchQuery(view.state);
  if (!query.valid || !query.search) {
    return false;
  }

  return selectMatches(view);
}

export function handleSearchPromptKey(view: EditorView, key: string): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  if (key === "<Esc>") {
    return cancelSearchPrompt(view);
  }

  if (key === "<Enter>") {
    return commitSearchPrompt(view);
  }

  if (key === "<Backspace>") {
    return deleteSearchPromptChar(view);
  }

  if (key === "<Space>") {
    return appendSearchPrompt(view, " ");
  }

  if (key.length === 1) {
    return appendSearchPrompt(view, key);
  }

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
  const ranges = state.selection.ranges.map(range => {
    const isForward = range.anchor <= range.head;
    const fromLine = state.doc.lineAt(Math.min(range.from, range.to));
    const toLine = state.doc.lineAt(Math.max(range.from, range.to));
    const end = toLine.to;
    return isForward
      ? EditorSelection.range(fromLine.from, end)
      : EditorSelection.range(end, fromLine.from);
  });

  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex)
  });
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

function openLine(view: EditorView, direction: "above" | "below"): boolean {
  const state = view.state;
  const result = state.changeByRange(range => {
    const line = state.doc.lineAt(range.head);
    const insertAt = direction === "below" ? line.to : line.from;
    const cursor = direction === "below" ? insertAt + 1 : insertAt;

    return {
      changes: { from: insertAt, insert: "\n" },
      range: EditorSelection.cursor(cursor)
    };
  });

  view.dispatch(result);
  setMode(view, "insert");
  return true;
}

function buildSelectBindings(): KakouneBinding[] {
  return [
    { keys: ["<Esc>"], run: () => true, description: "Do nothing / Cancel prefix" },
    { keys: ["i"], run: view => setMode(view, "insert"), description: "Insert mode before selections" },
    { keys: ["o"], run: view => openLine(view, "below"), description: "Insert new line below and enter insert mode" },
    { keys: ["O"], run: view => openLine(view, "above"), description: "Insert new line above and enter insert mode" },
    { keys: ["a"], run: view => moveSelections(view, range => clamp(range.to + 1, 0, view.state.doc.length)) && setMode(view, "insert"), description: "Insert mode after selections" },
    { keys: ["A"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to) && setMode(view, "insert"), description: "Insert mode at line end" },
    { keys: ["I"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from) && setMode(view, "insert"), description: "Insert mode at line start" },
    { keys: ["h"], run: view => moveSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)), description: "Move left" },
    { keys: ["l"], run: view => moveSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)), description: "Move right" },
    { keys: ["j"], run: view => moveSelections(view, range => moveLineColumn(view, range, 1)), description: "Move down" },
    { keys: ["k"], run: view => moveSelections(view, range => moveLineColumn(view, range, -1)), description: "Move up" },
    { keys: ["w"], run: view => moveWordSelections(view, range => moveWordForwardRange(view, range)), description: "Move word forward" },
    { keys: ["W"], run: view => extendSelections(view, range => moveWordForwardRange(view, range).head), description: "Extend word forward" },
    { keys: ["b"], run: view => moveWordSelections(view, range => moveWordBackwardRange(view, range)), description: "Move word backward" },
    { keys: ["B"], run: view => extendSelections(view, range => moveWordBackwardRange(view, range).head), description: "Extend word backward" },
    { keys: ["e"], run: view => moveWordSelections(view, range => moveWordEndRange(view, range)), description: "Move to word end" },
    { keys: ["E"], run: view => extendSelections(view, range => moveWordEndRange(view, range).head), description: "Extend to word end" },
    { keys: ["x"], run: view => selectLine(view), description: "Select line" },
    { keys: ["%"], run: view => selectAllBuffer(view), description: "Select all" },
    { keys: [","], run: view => clearSelections(view), description: "Clear other selections" },
    { keys: [";"], run: view => reduceSelectionsToCursor(view), description: "Reduce selections to cursor" },
    { keys: ["<A-;>"], run: view => flipSelections(view), description: "Flip selection direction" },
    { keys: [")"], run: view => rotateSelections(view, false), description: "Rotate selections forward" },
    { keys: ["("], run: view => rotateSelections(view, true), description: "Rotate selections backward" },
    { keys: ["g", "h"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Move to line begin" },
    { keys: ["g", "l"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Move to line end" },
    { keys: ["<A-h>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Extend to line begin" },
    { keys: ["<A-l>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Extend to line end" },
    { keys: ["H"], run: view => extendSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)), description: "Extend left" },
    { keys: ["J"], run: view => extendSelections(view, range => moveLineColumn(view, range, 1)), description: "Extend down" },
    { keys: ["K"], run: view => extendSelections(view, range => moveLineColumn(view, range, -1)), description: "Extend up" },
    { keys: ["L"], run: view => extendSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)), description: "Extend right" },
    { keys: ["G", "h"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Extend to line begin" },
    { keys: ["G", "H"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Extend to line begin" },
    { keys: ["G", "l"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Extend to line end" },
    { keys: ["G", "L"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Extend to line end" },
    { keys: ["G", "k"], run: view => extendSelections(view, () => 0), description: "Extend to document start" },
    { keys: ["G", "K"], run: view => extendSelections(view, () => 0), description: "Extend to document start" },
    { keys: ["G", "j"], run: view => extendSelections(view, () => view.state.doc.length), description: "Extend to document end" },
    { keys: ["G", "J"], run: view => extendSelections(view, () => view.state.doc.length), description: "Extend to document end" },
    { keys: ["G", "g"], run: view => extendSelections(view, () => 0), description: "Extend to document start" },
    { keys: ["G", "G"], run: view => extendSelections(view, () => 0), description: "Extend to document start" },
    { keys: ["g", "k"], run: view => moveSelections(view, () => 0), description: "Move to document start" },
    { keys: ["g", "j"], run: view => moveSelections(view, () => view.state.doc.line(view.state.doc.lines).from), description: "Move to document end" },
    { keys: ["d"], run: view => deleteSelection(view), description: "Delete selection" },
    { keys: ["c"], run: view => deleteSelection(view) && setMode(view, "insert"), description: "Change selection" },
    { keys: ["y"], run: view => yankSelection(view), description: "Yank selection" },
    { keys: ["p"], run: view => pasteRegister(view), description: "Paste register" },
    { keys: ["u"], run: view => undo(view), description: "Undo" },
    { keys: ["U"], run: view => redo(view), description: "Redo" },
    { keys: ["*"], run: view => setSearchFromSelection(view), description: "Search selection" },
    { keys: ["s"], run: view => setSearchPrompt(view, ""), description: "Select matches" },
    { keys: ["n"], run: view => jumpToNextSearch(view), description: "Jump to next search match" },
    { keys: ["<A-n>"], run: view => jumpToPreviousSearch(view), description: "Jump to previous search match" },
    { keys: ["N"], run: view => addNextTextSelection(view), description: "Add selection for next match" },
    { keys: ["f"], run: (view, arg) => {
      if (!arg) return true;
      return moveToFind(view, "f", arg);
    }, description: "Select to character" },
    { keys: ["t"], run: (view, arg) => {
      if (!arg) return true;
      return moveToFind(view, "t", arg);
    }, description: "Select until character" },
    { keys: ["F"], run: (view, arg) => {
      if (!arg) return true;
      return moveToFind(view, "F", arg);
    }, description: "Select backward to character" },
    { keys: ["T"], run: (view, arg) => {
      if (!arg) return true;
      return moveToFind(view, "T", arg);
    }, description: "Select backward until character" },
    { keys: ["g", "g"], run: view => moveSelections(view, () => 0), description: "Move to document start" }
  ];
}

function buildBracketBindings(): KakouneBinding[] {
  const bindings: KakouneBinding[] = [];
  const types = [
    "b", "(", ")",
    "B", "{", "}",
    "r", "[", "]",
    "a", "<", ">", "<lt>", "<gt>",
    "Q", "\"", "<dquote>",
    "q", "'", "<quote>",
    "g", "`",
    "w", "<A-w>", "<a-w>",
    "s", "p", " ", "<Space>", "i", "u", "n"
  ];

  types.forEach(type => {
    // [ -> whole object start
    bindings.push({
      keys: ["[", type],
      run: view => moveToSurroundingObject(view, type, false, "start", false),
      description: `Select to surrounding object start (${type})`
    });
    // ] -> whole object end
    bindings.push({
      keys: ["]", type],
      run: view => moveToSurroundingObject(view, type, false, "end", false),
      description: `Select to surrounding object end (${type})`
    });
    // { -> extend whole object start
    bindings.push({
      keys: ["{", type],
      run: view => moveToSurroundingObject(view, type, true, "start", false),
      description: `Extend to surrounding object start (${type})`
    });
    // } -> extend whole object end
    bindings.push({
      keys: ["}", type],
      run: view => moveToSurroundingObject(view, type, true, "end", false),
      description: `Extend to surrounding object end (${type})`
    });

    // Alt versions (inner object equivalents)
    bindings.push({
      keys: ["<A-[>", type],
      run: view => moveToSurroundingObject(view, type, false, "start", true),
      description: `Select to inner surrounding object start (${type})`
    });
    bindings.push({
      keys: ["<A-]>", type],
      run: view => moveToSurroundingObject(view, type, false, "end", true),
      description: `Select to inner surrounding object end (${type})`
    });
    bindings.push({
      keys: ["<A-{>", type],
      run: view => moveToSurroundingObject(view, type, true, "start", true),
      description: `Extend to inner surrounding object start (${type})`
    });
    bindings.push({
      keys: ["<A-}>", type],
      run: view => moveToSurroundingObject(view, type, true, "end", true),
      description: `Extend to inner surrounding object end (${type})`
    });
  });

  return bindings;
}

export function buildKakouneCommands(): Record<KakouneMode, KakouneBinding[]> {
  return {
    select: [...buildSelectBindings(), ...buildBracketBindings()],
    insert: [
      { keys: ["<Esc>"], run: view => setMode(view, "select"), description: "Exit insert mode" }
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
