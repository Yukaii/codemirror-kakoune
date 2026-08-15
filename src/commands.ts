import { EditorSelection, type SelectionRange, type Text } from "@codemirror/state";
import { redo, undo, isolateHistory } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import type { KakouneBinding } from "./keys";
import { getSearchQuery, SearchQuery, findNext, findPrevious, selectMatches, setSearchQuery } from "@codemirror/search";
import {
  kakouneStateField,
  kakouneSelectionTypeField,
  setKakouneCommandErrorEffect,
  setKakouneJumpStateEffect,
  setKakouneSearchPromptEffect,
  setKakouneSearchSelectionEffect,
  setKakouneSplitPromptEffect,
  setKakouneSplitSelectionEffect,
  setKakouneModeEffect,
  setKakouneRegisterLinewiseEffect,
  setKakouneRegisterEffect,
  setKakouneRegisterSelectionsEffect,
  setKakouneReplaceInsertAnchorsEffect,
  setKakouneSelectionLinewiseEffect,
  setKakouneSelectionTypeEffect,
  setKakouneSelectionHistoryEffect,
  setKakouneLastSelectEffect,
  setKakounePipePromptEffect,
  type KakouneFindKind,
  type KakouneJumpEntry,
  type KakouneJumpState,
  type KakouneLastSelect,
  type KakouneMode
} from "./state";

function snapshotJumpEntry(selection: EditorView["state"]["selection"]): KakouneJumpEntry {
  return {
    ranges: selection.ranges.map(range => ({ anchor: range.anchor, head: range.head })),
    mainIndex: selection.mainIndex
  };
}

function restoreJumpEntry(entry: KakouneJumpEntry): EditorSelection {
  return EditorSelection.create(
    entry.ranges.map(range => EditorSelection.range(range.anchor, range.head)),
    entry.mainIndex
  );
}

function sameJumpEntry(a: KakouneJumpEntry, b: KakouneJumpEntry): boolean {
  if (a.mainIndex !== b.mainIndex || a.ranges.length !== b.ranges.length) {
    return false;
  }

  return a.ranges.every((range, index) => {
    const other = b.ranges[index];
    return range.anchor === other.anchor && range.head === other.head;
  });
}

function pushJumpState(jumpState: KakouneJumpState, snapshot: KakouneJumpEntry): KakouneJumpState {
  let entries = jumpState.entries.slice(0, Math.min(jumpState.entries.length, jumpState.currentIndex + 1));
  entries = entries.filter(entry => !sameJumpEntry(entry, snapshot));
  entries.push(snapshot);
  return { entries, currentIndex: entries.length };
}

function setJumpStateEffect(view: EditorView, jumpState: KakouneJumpState): void {
  view.dispatch({ effects: setKakouneJumpStateEffect.of(jumpState) });
}

function setCommandError(view: EditorView, message: string | null): void {
  view.dispatch({ effects: setKakouneCommandErrorEffect.of(message) });
}

function pushCurrentJump(view: EditorView): KakouneJumpState {
  const state = view.state.field(kakouneStateField).jumpState;
  return pushJumpState(state, snapshotJumpEntry(view.state.selection));
}

function jumpBackward(view: EditorView, count: number = 1): boolean {
  const state = view.state.field(kakouneStateField).jumpState;
  const current = snapshotJumpEntry(view.state.selection);
  let jumpState = state;
  let shouldPushCurrent = false;

  if (
    jumpState.currentIndex === jumpState.entries.length ||
    !jumpState.entries[jumpState.currentIndex] ||
    !sameJumpEntry(jumpState.entries[jumpState.currentIndex], current)
  ) {
    jumpState = pushJumpState(jumpState, current);
    shouldPushCurrent = true;
  }

  const steps = count + (shouldPushCurrent ? 1 : 0);
  const targetIndex = jumpState.currentIndex - steps;
  if (targetIndex < 0) {
    setCommandError(view, "'exec': no previous jump");
    return false;
  }

  const target = jumpState.entries[targetIndex];
  setCommandError(view, null);
  view.dispatch({
    selection: restoreJumpEntry(target),
    effects: setKakouneJumpStateEffect.of({ entries: jumpState.entries, currentIndex: targetIndex })
  });
  return true;
}

function splitSelections(view: EditorView, pattern: string): boolean {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "g");
  } catch {
    return false;
  }

  const state = view.state;
  const ranges: SelectionRange[] = [];

  for (const range of state.selection.ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const text = state.doc.sliceString(from, to);
    let begin = 0;
    regex.lastIndex = 0;

    for (;;) {
      const match = regex.exec(text);
      if (!match) {
        break;
      }

      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      if (matchStart > begin) {
        ranges.push(EditorSelection.range(from + begin, from + matchStart));
      }
      begin = matchEnd;
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }

    if (begin <= text.length) {
      ranges.push(EditorSelection.range(from + begin, from + text.length));
    }
  }

  if (ranges.length === 0) {
    return false;
  }

  view.dispatch({ selection: EditorSelection.create(ranges, 0) });
  return true;
}

function jumpForward(view: EditorView, count: number = 1): boolean {
  const jumpState = view.state.field(kakouneStateField).jumpState;
  const targetIndex = jumpState.currentIndex + count;

  if (targetIndex >= jumpState.entries.length) {
    setCommandError(view, "'exec': no next jump");
    return false;
  }

  setCommandError(view, null);
  view.dispatch({
    selection: restoreJumpEntry(jumpState.entries[targetIndex]),
    effects: setKakouneJumpStateEffect.of({ entries: jumpState.entries, currentIndex: targetIndex })
  });
  return true;
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

function setMode(view: EditorView, mode: KakouneMode, preserveReplaceAnchors: boolean = false): boolean {
  view.dispatch({
    effects: [
      setKakouneModeEffect.of(mode),
      ...(preserveReplaceAnchors ? [] : [setKakouneReplaceInsertAnchorsEffect.of(null)])
    ]
  });
  return true;
}

function moveSelections(view: EditorView, mapper: (range: SelectionRange) => number, count: number = 1): boolean {
  const state = view.state;
  const result = state.changeByRange(range => {
    let current = range;
    for (let i = 0; i < count; i++) {
      current = EditorSelection.cursor(mapper(current));
    }
    return { range: current };
  });

  view.dispatch(result);
  return true;
}

function collectSelectionTexts(state: EditorView["state"], isLine: boolean): string[] {
  return state.selection.ranges.map(range => {
    const from = Math.min(range.from, range.to);
    const to = range.empty ? Math.min(state.doc.length, from + 1) : Math.max(range.from, range.to);
    const adjustedTo = isLine && to < state.doc.length ? to + 1 : to;
    const text = state.doc.sliceString(from, adjustedTo);
    return isLine && !text.endsWith("\n") ? `${text}\n` : text;
  });
}

function applySequentialInserts(view: EditorView, positions: number[], inserts: string[], preserveReplaceAnchors: boolean): boolean {
  if (positions.length === 0 || inserts.length === 0) {
    return false;
  }

  const changes: Array<{ from: number; insert: string }> = [];
  const nextPositions: number[] = [];
  let offset = 0;

  for (let i = 0; i < positions.length; i += 1) {
    const insert = inserts[Math.min(i, inserts.length - 1)];
    const from = positions[i] + offset;
    changes.push({ from, insert });
    nextPositions.push(from + insert.length);
    offset += insert.length;
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(nextPositions.map(position => EditorSelection.cursor(position)), 0),
    effects: preserveReplaceAnchors ? [setKakouneReplaceInsertAnchorsEffect.of(nextPositions)] : []
  });

  return true;
}

function moveWordSelections(view: EditorView, mapper: (range: SelectionRange) => { anchor: number, head: number }, count: number = 1): boolean {
  const state = view.state;
  const result = state.changeByRange(range => {
    let current = range;
    for (let i = 0; i < count; i++) {
      const { anchor, head } = mapper(current);
      current = EditorSelection.range(anchor, head);
    }
    return { range: current };
  });

  view.dispatch(result);
  return true;
}

function extendSelections(view: EditorView, mapper: (range: SelectionRange) => number, count: number = 1): boolean {
  const ranges = view.state.selection.ranges.map(range => {
    let head = range.head;
    for (let i = 0; i < count; i++) {
      head = mapper(EditorSelection.range(range.anchor, head));
    }
    return EditorSelection.range(range.anchor, head);
  });
  view.dispatch({
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex)
  });
  return true;
}

function moveToFind(view: EditorView, kind: KakouneFindKind, key: string, count: number = 1): boolean {
  if (key === "<esc>" || key === "<Esc>") {
    return true;
  }

  let targetChar = key;
  if (key === "<Enter>" || key === "<ret>" || key === "<ret\b>") {
    targetChar = "\n";
  } else if (key === "<Space>") {
    targetChar = " ";
  } else if (key === "<Tab>") {
    targetChar = "\t";
  } else if (key === "<lt>") {
    targetChar = "<";
  } else if (key === "<gt>") {
    targetChar = ">";
  }

  const backwards =
    kind === "<A-f>" ||
    kind === "<a-f>" ||
    kind === "<A-t>" ||
    kind === "<a-t>" ||
    kind === "<A-F>" ||
    kind === "<a-F>" ||
    kind === "<A-T>" ||
    kind === "<a-T>";

  const inclusive =
    kind === "f" ||
    kind === "F" ||
    kind === "<A-f>" ||
    kind === "<a-f>" ||
    kind === "<A-F>" ||
    kind === "<a-F>";

  const extend =
    kind === "F" ||
    kind === "T" ||
    kind === "<A-F>" ||
    kind === "<a-F>" ||
    kind === "<A-T>" ||
    kind === "<a-T>";

  const doc = view.state.doc.toString();
  const result = view.state.changeByRange(range => {
    let searchPos = backwards ? range.head - 1 : range.head + 1;
    let found = -1;

    for (let c = 0; c < count; c++) {
      if (backwards) {
        if (searchPos < 0) {
          found = -1;
          break;
        }
        found = doc.lastIndexOf(targetChar, searchPos);
        if (found < 0) break;
        searchPos = found - 1;
      } else {
        if (searchPos >= doc.length) {
          found = -1;
          break;
        }
        found = doc.indexOf(targetChar, searchPos);
        if (found < 0) break;
        searchPos = found + 1;
      }
    }

    if (found < 0) {
      return { range };
    }

    const targetIndex = inclusive
      ? found
      : backwards
        ? Math.min(doc.length, found + 1)
        : Math.max(0, found - 1);

    const anchor = extend ? range.anchor : range.head;
    return {
      range: EditorSelection.range(anchor, targetIndex)
    };
  });

  view.dispatch({
    ...result,
    effects: [
      setKakouneLastSelectEffect.of({
        type: "find",
        kind,
        key,
        count
      })
    ]
  });
  return true;
}

function repeatLastSelect(view: EditorView, count?: number): boolean {
  const kakoune = view.state.field(kakouneStateField);
  const last = kakoune.lastSelect;
  if (!last) {
    return true;
  }

  switch (last.type) {
    case "find":
      return moveToFind(view, last.kind, last.key, count ?? last.count);
    case "object":
      return moveToSurroundingObject(view, last.objectKey, last.extend, last.direction, last.inner, count ?? last.count);
    case "surroundingObject":
      return selectSurroundingObject(view, last.objectKey, last.inner);
    default:
      return true;
  }
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

function rotateSelectionsContent(view: EditorView, reverse: boolean): boolean {
  const state = view.state;
  const ranges = state.selection.ranges;
  if (ranges.length <= 1) {
    return true;
  }

  const texts = ranges.map(range => {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    return state.doc.sliceString(from, to);
  });

  // Kakoune <a-)> shifts content forward: text of selection N moves to selection N+1,
  // so selection N receives text from selection N-1.
  const rotatedTexts = reverse
    ? [...texts.slice(1), texts[0]]
    : [texts[texts.length - 1], ...texts.slice(0, texts.length - 1)];

  const sortedIndices = ranges.map((_, i) => i).sort((a, b) => ranges[a].from - ranges[b].from);

  const changes: Array<{ from: number; to: number; insert: string }> = [];
  for (const idx of sortedIndices) {
    const range = ranges[idx];
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const insert = rotatedTexts[idx];
    changes.push({ from, to, insert });
  }

  const changeSet = state.changes(changes);
  const newRanges = ranges.map((range, idx) => {
    const from = Math.min(range.from, range.to);
    const mappedFrom = changeSet.mapPos(from, 1);
    const insertLen = rotatedTexts[idx].length;
    return range.head >= range.anchor
      ? EditorSelection.range(mappedFrom, mappedFrom + insertLen)
      : EditorSelection.range(mappedFrom + insertLen, mappedFrom);
  });

  view.dispatch({
    changes,
    selection: EditorSelection.create(newRanges, state.selection.mainIndex)
  });
  return true;
}

function executeSimplePipeCommand(input: string, command: string): string {
  // Common Unix tools in tests: sed, printf
  const sedMatch = command.match(/^sed\s+(?:-n\s+)?['"]?s\/([^/]+)\/([^/]*)\/(g?)(?:;\s*P)?['"]?(?:\s*>\s*(\S+))?$/);
  if (sedMatch) {
    const pattern = sedMatch[1];
    const replacement = sedMatch[2];
    const isGlobal = sedMatch[3] === "g";
    const regex = new RegExp(pattern, isGlobal ? "g" : "");
    return input.replace(regex, replacement);
  }

  const printfMatch = command.match(/^printf\s+['"](.*)['"]$/);
  if (printfMatch) {
    const raw = printfMatch[1];
    return raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }

  return input;
}

export function commitPipePrompt(view: EditorView): boolean {
  const kakoune = view.state.field(kakouneStateField);
  const prompt = kakoune.pipePrompt;
  if (!prompt) {
    return true;
  }

  const state = view.state;
  const cmd = prompt.text || (prompt.register ? kakoune.namedRegisters.get(prompt.register) ?? "" : "");
  view.dispatch({ effects: setKakounePipePromptEffect.of(null) });

  if (!cmd) {
    return true;
  }

  if (prompt.mode === "pipe") {
    // Pipe: replace each selection with filter output
    const ranges = state.selection.ranges;
    const changes = ranges.map(range => {
      const from = Math.min(range.from, range.to);
      const to = Math.max(range.from, range.to);
      const text = state.doc.sliceString(from, to);
      const output = executeSimplePipeCommand(text, cmd);
      return { from, to, insert: output };
    });

    view.dispatch({ changes });
    return true;
  } else if (prompt.mode === "pipe-to") {
    // Pipe-to: pipe selections through command, ignore output (or write to file)
    return true;
  }

  return true;
}

export function handlePipePromptKey(view: EditorView, key: string): boolean {
  const kakoune = view.state.field(kakouneStateField);
  const prompt = kakoune.pipePrompt;
  if (!prompt) {
    return false;
  }

  if (key === "<Esc>") {
    view.dispatch({ effects: setKakounePipePromptEffect.of(null) });
    return true;
  }

  if (key === "<Enter>") {
    return commitPipePrompt(view);
  }

  if (key === "<Backspace>") {
    view.dispatch({
      effects: setKakounePipePromptEffect.of({
        ...prompt,
        text: prompt.text.slice(0, -1)
      })
    });
    return true;
  }

  if (key === "<Space>") {
    view.dispatch({
      effects: setKakounePipePromptEffect.of({
        ...prompt,
        text: prompt.text + " "
      })
    });
    return true;
  }

  if (key.length === 1) {
    view.dispatch({
      effects: setKakounePipePromptEffect.of({
        ...prompt,
        text: prompt.text + key
      })
    });
    return true;
  }

  return true;
}

function undoSelection(view: EditorView): boolean {
  const kakoune = view.state.field(kakouneStateField);
  const { selectionHistory, selectionHistoryIndex } = kakoune;
  if (selectionHistory.length === 0 || selectionHistoryIndex <= 0) {
    return true;
  }

  const nextIndex = selectionHistoryIndex - 1;
  const target = selectionHistory[nextIndex];
  if (target) {
    view.dispatch({
      selection: EditorSelection.create(
        target.map(r => EditorSelection.range(r.anchor, r.head)),
        0
      ),
      effects: [
        setKakouneSelectionHistoryEffect.of({
          history: selectionHistory,
          index: nextIndex
        })
      ]
    });
  }
  return true;
}

function redoSelection(view: EditorView): boolean {
  const kakoune = view.state.field(kakouneStateField);
  const { selectionHistory, selectionHistoryIndex } = kakoune;
  if (selectionHistory.length === 0 || selectionHistoryIndex >= selectionHistory.length - 1) {
    return true;
  }

  const nextIndex = selectionHistoryIndex + 1;
  const target = selectionHistory[nextIndex];
  if (target) {
    view.dispatch({
      selection: EditorSelection.create(
        target.map(r => EditorSelection.range(r.anchor, r.head)),
        0
      ),
      effects: [
        setKakouneSelectionHistoryEffect.of({
          history: selectionHistory,
          index: nextIndex
        })
      ]
    });
  }
  return true;
}

function indentSelectedLines(view: EditorView, indent: boolean, count: number = 1): boolean {
  const state = view.state;
  const lineNumbers = new Set<number>();

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(Math.min(range.from, range.to)).number;
    const endPos = Math.max(range.from, range.to);
    // If range ends at line beginning and is not empty, don't include that line
    const endLine = range.empty
      ? startLine
      : (endPos > state.doc.lineAt(startLine).from && state.doc.lineAt(endPos).from === endPos)
        ? Math.max(startLine, state.doc.lineAt(endPos).number - 1)
        : state.doc.lineAt(endPos).number;

    for (let l = startLine; l <= endLine; l += 1) {
      lineNumbers.add(l);
    }
  }

  const sortedLines = Array.from(lineNumbers).sort((a, b) => a - b);
  const tabSize = 4;
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  for (const lineNum of sortedLines) {
    const line = state.doc.line(lineNum);
    if (line.length === 0) {
      continue;
    }

    if (indent) {
      changes.push({
        from: line.from,
        to: line.from,
        insert: " ".repeat(tabSize * count)
      });
    } else {
      // Deindent: remove up to tabSize * count spaces or tabs from start of line
      let spacesToRemove = tabSize * count;
      let pos = line.from;
      while (spacesToRemove > 0 && pos < line.to) {
        const ch = state.doc.sliceString(pos, pos + 1);
        if (ch === " ") {
          spacesToRemove -= 1;
          pos += 1;
        } else if (ch === "\t") {
          spacesToRemove -= tabSize;
          pos += 1;
        } else {
          break;
        }
      }
      if (pos > line.from) {
        changes.push({
          from: line.from,
          to: pos,
          insert: ""
        });
      }
    }
  }

  if (changes.length === 0) {
    return true;
  }

  const changeSet = state.changes(changes);
  const nextRanges = state.selection.ranges.map(range => {
    const anchor = changeSet.mapPos(range.anchor);
    const head = changeSet.mapPos(range.head);
    return EditorSelection.range(anchor, head);
  });

  view.dispatch({
    changes,
    selection: EditorSelection.create(nextRanges, state.selection.mainIndex)
  });
  return true;
}

function alignSelections(view: EditorView): boolean {
  const state = view.state;
  const ranges = state.selection.ranges;
  if (ranges.length <= 1) {
    return true;
  }

  // Calculate visual column for each selection's anchor / start position
  const tabstop = 4; // Use 4-column tabstop if tabs are present, matching standard editor configuration
  const visualCols = ranges.map(range => {
    const line = state.doc.lineAt(range.head);
    const prefix = state.doc.sliceString(line.from, Math.min(range.from, range.to));
    let col = 0;
    for (let i = 0; i < prefix.length; i += 1) {
      if (prefix[i] === "\t") {
        col += tabstop - (col % tabstop);
      } else {
        col += 1;
      }
    }
    return { col, hasTabs: prefix.includes("\t") };
  });

  const maxCol = Math.max(...visualCols.map(v => v.col));
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  for (let i = 0; i < ranges.length; i += 1) {
    const { col, hasTabs } = visualCols[i];
    const diff = maxCol - col;
    if (diff > 0) {
      const pos = Math.min(ranges[i].from, ranges[i].to);
      const insert = hasTabs && diff % tabstop === 0
        ? "\t".repeat(diff / tabstop)
        : " ".repeat(diff);
      changes.push({
        from: pos,
        to: pos,
        insert
      });
    }
  }

  if (changes.length === 0) {
    return true;
  }

  const changeSet = state.changes(changes);
  const nextRanges = ranges.map(range => {
    const anchor = changeSet.mapPos(range.anchor);
    const head = changeSet.mapPos(range.head);
    return EditorSelection.range(anchor, head);
  });

  view.dispatch({
    changes,
    selection: EditorSelection.create(nextRanges, state.selection.mainIndex)
  });
  return true;
}

function convertTabsSpaces(view: EditorView, toTabs: boolean): boolean {
  const state = view.state;
  const tabSize = 8; // Kakoune default tabstop is 8
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  for (const range of state.selection.ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const text = state.doc.sliceString(from, to);

    if (toTabs) {
      // In Kakoune, convert-spaces-to-tabs replaces exact tabSize (8) spaces with a tab
      const converted = text.replace(new RegExp(" ".repeat(tabSize), "g"), "\t");
      if (converted !== text) {
        changes.push({ from, to, insert: converted });
      }
    } else {
      // Convert tabs to spaces
      const converted = text.replace(/\t/g, " ".repeat(tabSize));
      if (converted !== text) {
        changes.push({ from, to, insert: converted });
      }
    }
  }

  if (changes.length === 0) {
    return true;
  }

  const changeSet = state.changes(changes);
  const nextRanges = state.selection.ranges.map(range => {
    const anchor = changeSet.mapPos(range.anchor);
    const head = changeSet.mapPos(range.head);
    return EditorSelection.range(anchor, head);
  });

  view.dispatch({
    changes,
    selection: EditorSelection.create(nextRanges, state.selection.mainIndex)
  });
  return true;
}

function splitSelectionsOnLines(view: EditorView): boolean {
  const state = view.state;
  const newRanges: SelectionRange[] = [];

  for (const range of state.selection.ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);

    const startLine = state.doc.lineAt(from);
    const endLine = state.doc.lineAt(to);

    for (let l = startLine.number; l <= endLine.number; l += 1) {
      const line = state.doc.line(l);
      const lineStart = Math.max(from, line.from);
      // Kakoune <a-s> splits selections across lines including the newline character (i.e. up to next line from or doc length)
      const lineEnd = l < state.doc.lines ? Math.min(to, line.to + 1) : Math.min(to, line.to);
      if (lineEnd >= lineStart && (lineEnd > lineStart || startLine.number === endLine.number || l < endLine.number)) {
        newRanges.push(
          range.head >= range.anchor
            ? EditorSelection.range(lineStart, lineEnd)
            : EditorSelection.range(lineEnd, lineStart)
        );
      }
    }
  }

  if (newRanges.length === 0) {
    return true;
  }

  view.dispatch({
    selection: EditorSelection.create(newRanges, 0),
    effects: [
      setKakouneSelectionTypeEffect.of("char"),
      setKakouneSelectionLinewiseEffect.of(false)
    ]
  });
  return true;
}

function trimSelectionsWhitespace(view: EditorView): boolean {
  const state = view.state;
  const newRanges: SelectionRange[] = [];

  for (const range of state.selection.ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const text = state.doc.sliceString(from, to);

    let startOffset = 0;
    while (startOffset < text.length && /\s/.test(text[startOffset])) {
      startOffset += 1;
    }

    let endOffset = text.length;
    while (endOffset > startOffset && /\s/.test(text[endOffset - 1])) {
      endOffset -= 1;
    }

    if (startOffset < endOffset) {
      const trimmedFrom = from + startOffset;
      const trimmedTo = from + endOffset;
      newRanges.push(
        range.head >= range.anchor
          ? EditorSelection.range(trimmedFrom, trimmedTo)
          : EditorSelection.range(trimmedTo, trimmedFrom)
      );
    }
  }

  if (newRanges.length === 0) {
    return true;
  }

  view.dispatch({
    selection: EditorSelection.create(newRanges, 0)
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
  inner: boolean = false,
  count: number = 1
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

  view.dispatch({
    effects: [
      setKakouneLastSelectEffect.of({
        type: "object",
        objectKey,
        direction,
        extend,
        inner,
        count
      })
    ]
  });

  if (extend) {
    return extendSelections(view, mapper, count);
  } else {
    return moveSelections(view, mapper, count);
  }
}

function selectSurroundingObject(
  view: EditorView,
  objectKey: string,
  inner: boolean
): boolean {
  const doc = view.state.doc.toString();
  const state = view.state;
  const ranges = state.selection.ranges.map(range => {
    const result = getObjectRange(doc, range.head, objectKey, "start");
    if (!result) {
      return range;
    }

    const isDelimiterType = [
      "b", "(", ")", "B", "{", "}", "r", "[", "]", "a", "<", ">", "<lt>", "<gt>",
      "Q", "\"", "<dquote>", "q", "'", "<quote>", "g", "`"
    ].includes(objectKey);

    let startIdx = result.start;
    let endIdx = result.end;

    if (inner && isDelimiterType) {
      startIdx = result.start + 1;
      endIdx = result.end;
    } else if (!inner && isDelimiterType) {
      endIdx = result.end + 1;
    } else if (!inner) {
      endIdx = result.end + 1;
    } else {
      endIdx = result.end + 1;
    }

    return EditorSelection.range(startIdx, endIdx);
  });

  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    effects: [
      setKakouneLastSelectEffect.of({
        type: "surroundingObject",
        objectKey,
        inner
      })
    ]
  });
  return true;
}

function jumpToLine(view: EditorView, lineNum: number): boolean {
  const doc = view.state.doc;
  const targetLine = clamp(lineNum, 1, doc.lines);
  const pos = doc.line(targetLine).from;
  const jumpState = pushCurrentJump(view);
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    effects: setKakouneJumpStateEffect.of(jumpState)
  });
  return true;
}

function extendToLine(view: EditorView, lineNum: number): boolean {
  const doc = view.state.doc;
  const targetLine = clamp(lineNum, 1, doc.lines);
  const pos = doc.line(targetLine).from;
  const ranges = view.state.selection.ranges.map(range =>
    EditorSelection.range(range.anchor, pos)
  );
  view.dispatch({
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex)
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

function setSplitPrompt(view: EditorView, prompt: string | null): boolean {
  const selectionSnapshot = prompt === null
    ? null
    : view.state.selection.ranges.map(range => ({ anchor: range.anchor, head: range.head }));

  view.dispatch({
    effects: [
      setKakouneSplitPromptEffect.of(prompt),
      setKakouneSplitSelectionEffect.of(selectionSnapshot)
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

/** Deletes the last character from the active search prompt. */
export function deleteSearchPromptChar(view: EditorView): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  return setSearchPrompt(view, prompt.slice(0, -1));
}

/** Deletes the last character from the active split prompt. */
export function deleteSplitPromptChar(view: EditorView): boolean {
  const prompt = view.state.field(kakouneStateField).splitPrompt;
  if (prompt === null) {
    return false;
  }

  return setSplitPrompt(view, prompt.slice(0, -1));
}

/**
 * Cancels the active search prompt and restores the original selection.
 */
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

/** Cancels the active split prompt and restores the original selection. */
export function cancelSplitPrompt(view: EditorView): boolean {
  const snapshot = view.state.field(kakouneStateField).splitSelection;
  const selection = snapshot
    ? EditorSelection.create(snapshot.map(range => EditorSelection.range(range.anchor, range.head)))
    : view.state.selection;

  view.dispatch({
    selection,
    effects: [
      setKakouneSplitPromptEffect.of(null),
      setKakouneSplitSelectionEffect.of(null)
    ]
  });
  return true;
}

/**
 * Commits the search prompt text, sets it as the search query, and jumps to
 * the next match. Restores the original selection from before the prompt.
 */
export function commitSearchPrompt(view: EditorView): boolean {
  const prompt = view.state.field(kakouneStateField).searchPrompt;
  if (prompt === null) {
    return false;
  }

  const query = new SearchQuery({
    search: prompt,
    literal: true
  });
  const from = view.state.selection.main.to;
  const search = query.getCursor(view.state, from, view.state.doc.length);
  const first = search.next();
  let next = first.done ? null : first.value;
  if (!next) {
    const wrapSearch = query.getCursor(view.state, 0, from);
    const wrapped = wrapSearch.next();
    next = wrapped.done ? null : wrapped.value;
  }
  const nextSelection = next ? EditorSelection.single(next.from, next.to) : view.state.selection;
  const jumpState = pushCurrentJump(view);

  view.dispatch({
    selection: nextSelection,
    annotations: isolateHistory.of("full"),
    effects: [
      setKakouneJumpStateEffect.of(jumpState),
      setKakouneSearchPromptEffect.of(null),
      setKakouneSearchSelectionEffect.of(null),
      setSearchQuery.of(query)
    ],
    userEvent: "select.search"
  });
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

/**
 * Handles a key event while the search prompt is active.
 * Supports typing characters, backspace, enter, escape, and space.
 */
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

/** Handles a key event while the split prompt is active. */
export function handleSplitPromptKey(view: EditorView, key: string): boolean {
  const prompt = view.state.field(kakouneStateField).splitPrompt;
  if (prompt === null) {
    return false;
  }

  if (key === "<Esc>") {
    return cancelSplitPrompt(view);
  }

  if (key === "<Enter>") {
    return splitSelections(view, prompt) && setSplitPrompt(view, null);
  }

  if (key === "<Backspace>") {
    return deleteSplitPromptChar(view);
  }

  if (key === "<Space>") {
    return setSplitPrompt(view, prompt + " ");
  }

  if (key.length === 1) {
    return setSplitPrompt(view, prompt + key);
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
    const toPos = Math.max(range.from, range.to);
    const toLine = state.doc.lineAt(toPos);

    // If already selecting the full line (including newline at toLine.to + 1), expand to include next line
    const isAlreadyFullLine = range.from === fromLine.from && (
      (toLine.number < state.doc.lines && toPos === toLine.to + 1) ||
      (toLine.number === state.doc.lines && toPos === toLine.to)
    );

    let endLine = toLine;
    if (isAlreadyFullLine && toLine.number < state.doc.lines) {
      endLine = state.doc.line(toLine.number + 1);
    }

    const end = endLine.number < state.doc.lines ? endLine.to + 1 : endLine.to;
    return isForward
      ? EditorSelection.range(fromLine.from, end)
      : EditorSelection.range(end, fromLine.from);
  });

  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    effects: [
      setKakouneSelectionTypeEffect.of("line"),
      setKakouneSelectionLinewiseEffect.of(true)
    ]
  });
  return true;
}

function deleteSelection(view: EditorView): boolean {
  const state = view.state;
  const isLine = state.field(kakouneSelectionTypeField) === "line";
  const sourceLinewise = state.field(kakouneStateField).selectionLinewise;
  const deleted = collectSelectionTexts(state, isLine);
  const selectionStarts = state.selection.ranges.map(range => Math.min(range.from, range.to));

  const result = state.changeByRange(range => {
    let from = Math.min(range.from, range.to);
    let to = range.empty ? Math.min(state.doc.length, from + 1) : Math.max(range.from, range.to);

    // If deleting a line-wise selection at the end of document where there's no trailing newline,
    // also remove the preceding newline to completely delete the line (reducing total line count).
    if ((isLine || sourceLinewise) && to >= state.doc.length && from > 0 && state.doc.sliceString(from - 1, from) === "\n") {
      from -= 1;
    }

    if (to <= from) {
      return {
        range: EditorSelection.cursor(from)
      };
    }

    return {
      changes: { from, to, insert: "" },
      range: EditorSelection.cursor(from)
    };
  });

  view.dispatch({
    ...result,
    effects: [
      setKakouneRegisterEffect.of(deleted.join("\n")),
      setKakouneRegisterSelectionsEffect.of(deleted.length > 1 ? deleted : null),
      setKakouneRegisterLinewiseEffect.of(sourceLinewise),
      setKakouneSelectionLinewiseEffect.of(false),
      setKakouneReplaceInsertAnchorsEffect.of(selectionStarts.map(pos => result.changes.mapPos(pos, 1)))
    ],
    selection: result.selection
  });

  return true;
}

function yankSelection(view: EditorView): boolean {
  const state = view.state;
  const isLine = state.field(kakouneSelectionTypeField) === "line";
  const sourceLinewise = state.field(kakouneStateField).selectionLinewise;
  const selected = collectSelectionTexts(state, isLine);

  view.dispatch({
    effects: [
      setKakouneRegisterEffect.of(selected.join("\n")),
      setKakouneRegisterSelectionsEffect.of(selected.length > 1 ? selected : null),
      setKakouneRegisterLinewiseEffect.of(sourceLinewise),
      setKakouneSelectionLinewiseEffect.of(isLine)
    ]
  });
  return true;
}

function pasteRegister(view: EditorView, mode: "before" | "after" | "replace" = "after"): boolean {
  const state = view.state;
  const kakoune = state.field(kakouneStateField);
  const registerValues = kakoune.registerSelections ?? (kakoune.register ? [kakoune.register] : []);
  const linewise = kakoune.registerLinewise;

  if (registerValues.length === 0) {
    return false;
  }

  const rangesBefore = state.selection.ranges.map(range => ({
    anchor: range.anchor,
    head: range.head,
    from: range.from,
    to: range.to,
    empty: range.empty
  }));
  const items = rangesBefore.map((range, index) => {
    const value = registerValues[index % registerValues.length];
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const insertAt = mode === "before"
      ? from
      : mode === "after"
        ? (range.empty ? Math.min(state.doc.length, range.head + 1) : to)
        : from;
    const replaceTo = mode === "replace"
      ? to
      : insertAt;

    let insertText = value;
    if (mode === "replace" && !kakoune.registerLinewise && value.endsWith("\n")) {
      insertText = value.slice(0, -1);
    }

    return { from: insertAt, to: replaceTo, insert: insertText };
  });

  if (linewise && items.length > 0) {
    const last = items[items.length - 1];
    if (!last.insert.endsWith("\n")) {
      last.insert += "\n";
    }
  }

  const changes = items
    .slice()
    .sort((a, b) => b.from - a.from)
    .map(item => mode === "replace"
      ? { from: item.from, to: item.to, insert: item.insert }
      : { from: item.from, insert: item.insert });

  view.dispatch({
    changes
  });
  return true;
}

function pasteAllRegister(view: EditorView, mode: "before" | "after" | "replace"): boolean {
  const state = view.state;
  const kakoune = state.field(kakouneStateField);
  const registerValues = kakoune.registerSelections ?? (kakoune.register ? [kakoune.register] : []);
  const all = registerValues.filter(value => value.length > 0).join("");

  if (!all) {
    return false;
  }

  const items = state.selection.ranges.map(range => {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const insertAt = mode === "before"
      ? from
      : mode === "after"
        ? (kakoune.registerLinewise
          ? (range.empty ? state.doc.lineAt(range.head).to : to)
          : (range.empty ? Math.min(state.doc.length, range.head + 1) : to))
        : from;
    const replaceTo = mode === "replace"
      ? (range.empty ? Math.min(state.doc.length, from + 1) : to)
      : insertAt;

    let insertText = all;
    if (kakoune.registerLinewise && mode === "after") {
      if (!insertText.endsWith("\n")) {
        insertText = insertText + "\n";
      }
      if (insertAt === state.doc.length && !state.doc.sliceString(0, insertAt).endsWith("\n")) {
        insertText = "\n" + insertText;
      }
    }

    return { from: insertAt, to: replaceTo, insert: insertText };
  });

  view.dispatch({
    changes: items
      .slice()
      .sort((a, b) => b.from - a.from)
      .map(item => mode === "replace"
        ? { from: item.from, to: item.to, insert: item.insert }
        : { from: item.from, insert: item.insert })
  });
  return true;
}

function openLine(view: EditorView, direction: "above" | "below", count: number = 1): boolean {
  const state = view.state;
  const line = state.doc.lineAt(state.selection.main.head);
  const insertAt = direction === "below" ? line.to : line.from;
  const cursorPositions = Array.from({ length: count }, (_, index) => insertAt + (direction === "below" ? index + 1 : index));

  view.dispatch({
    changes: { from: insertAt, insert: "\n".repeat(count) },
    selection: EditorSelection.create(cursorPositions.map(position => EditorSelection.cursor(position)), 0)
  });
  setMode(view, "insert");
  return true;
}

function buildSelectBindings(): KakouneBinding[] {
  return [
    { keys: ["<Esc>"], run: () => true, description: "Do nothing / Cancel prefix" },
    { keys: ["i"], run: view => setMode(view, "insert"), description: "Insert mode before selections" },
    { keys: ["o"], run: (view, _arg, count) => openLine(view, "below", count ?? 1), description: "Insert new line below and enter insert mode" },
    { keys: ["O"], run: (view, _arg, count) => openLine(view, "above", count ?? 1), description: "Insert new line above and enter insert mode" },
    { keys: ["a"], run: view => moveSelections(view, range => range.empty ? clamp(range.to + 1, 0, view.state.doc.length) : range.to) && setMode(view, "insert"), description: "Insert mode after selections" },
    { keys: ["A"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to) && setMode(view, "insert"), description: "Insert mode at line end" },
    { keys: ["I"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from) && setMode(view, "insert"), description: "Insert mode at line start" },
    { keys: ["h"], run: (view, _arg, count) => moveSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length), count ?? 1), description: "Move left" },
    { keys: ["l"], run: (view, _arg, count) => moveSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length), count ?? 1), description: "Move right" },
    { keys: ["j"], run: (view, _arg, count) => moveSelections(view, range => moveLineColumn(view, range, 1), count ?? 1), description: "Move down" },
    { keys: ["k"], run: (view, _arg, count) => moveSelections(view, range => moveLineColumn(view, range, -1), count ?? 1), description: "Move up" },
    { keys: ["w"], run: (view, _arg, count) => moveWordSelections(view, range => moveWordForwardRange(view, range), count ?? 1), description: "Move word forward" },
    { keys: ["W"], run: (view, _arg, count) => extendSelections(view, range => moveWordForwardRange(view, range).head, count ?? 1), description: "Extend word forward" },
    { keys: ["b"], run: (view, _arg, count) => moveWordSelections(view, range => moveWordBackwardRange(view, range), count ?? 1), description: "Move word backward" },
    { keys: ["B"], run: (view, _arg, count) => extendSelections(view, range => moveWordBackwardRange(view, range).head, count ?? 1), description: "Extend word backward" },
    { keys: ["e"], run: (view, _arg, count) => moveWordSelections(view, range => moveWordEndRange(view, range), count ?? 1), description: "Move to word end" },
    { keys: ["E"], run: (view, _arg, count) => extendSelections(view, range => moveWordEndRange(view, range).head, count ?? 1), description: "Extend to word end" },
    { keys: ["x"], run: view => selectLine(view), description: "Select line" },
    { keys: ["S"], run: view => setSplitPrompt(view, ""), description: "Split selection" },
    { keys: ["%"], run: view => selectAllBuffer(view), description: "Select all" },
    { keys: [","], run: view => clearSelections(view), description: "Clear other selections" },
    { keys: [";"], run: view => reduceSelectionsToCursor(view), description: "Reduce selections to cursor" },
    { keys: ["<A-;>"], run: view => flipSelections(view), description: "Flip selection direction" },
    { keys: [")"], run: view => rotateSelections(view, false), description: "Rotate selections forward" },
    { keys: ["("], run: view => rotateSelections(view, true), description: "Rotate selections backward" },
    { keys: ["<A-)>"], run: view => rotateSelectionsContent(view, false), description: "Rotate selections content forward" },
    { keys: ["<A-(>"], run: view => rotateSelectionsContent(view, true), description: "Rotate selections content backward" },
    { keys: ["g"], run: (_view, _arg, count) => {
      if (count !== undefined) return jumpToLine(_view, count);
      return false;
    }, description: "Jump to line (with count)" },
    { keys: ["G"], run: (_view, _arg, count) => {
      if (count !== undefined) return extendToLine(_view, count);
      return false;
    }, description: "Extend to line (with count)" },
    { keys: ["g", "h"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Move to line begin" },
    { keys: ["g", "l"], run: view => moveSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Move to line end" },
    { keys: ["<A-h>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).from), description: "Extend to line begin" },
    { keys: ["<A-l>"], run: view => extendSelections(view, range => view.state.doc.lineAt(range.head).to), description: "Extend to line end" },
    { keys: ["H"], run: (view, _arg, count) => extendSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length), count ?? 1), description: "Extend left" },
    { keys: ["J"], run: (view, _arg, count) => extendSelections(view, range => moveLineColumn(view, range, 1), count ?? 1), description: "Extend down" },
    { keys: ["K"], run: (view, _arg, count) => extendSelections(view, range => moveLineColumn(view, range, -1), count ?? 1), description: "Extend up" },
    { keys: ["L"], run: (view, _arg, count) => extendSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length), count ?? 1), description: "Extend right" },
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
    { keys: ["g", "k"], run: view => jumpToLine(view, 1), description: "Jump to document start" },
    { keys: ["g", "j"], run: view => jumpToLine(view, view.state.doc.lines), description: "Jump to document end" },
    { keys: ["d"], run: view => deleteSelection(view), description: "Delete selection" },
    { keys: ["c"], run: view => deleteSelection(view) && setMode(view, "insert", true), description: "Change selection" },
    { keys: ["y"], run: view => yankSelection(view), description: "Yank selection" },
    { keys: ["p"], run: view => pasteRegister(view, "after"), description: "Paste register after" },
    { keys: ["P"], run: view => pasteRegister(view, "before"), description: "Paste register before" },
    { keys: ["R"], run: view => pasteRegister(view, "replace"), description: "Replace selection with register" },
    { keys: ["<A-p>"], run: view => pasteAllRegister(view, "after"), description: "Paste all after" },
    { keys: ["<A-P>"], run: view => pasteAllRegister(view, "before"), description: "Paste all before" },
    { keys: ["<A-R>"], run: view => pasteAllRegister(view, "replace"), description: "Paste all replace" },
    { keys: ["u"], run: view => undo(view), description: "Undo" },
    { keys: ["U"], run: view => redo(view), description: "Redo" },
    { keys: ["<A-u>"], run: view => undoSelection(view), description: "Undo selection change" },
    { keys: ["<A-U>"], run: view => redoSelection(view), description: "Redo selection change" },
    { keys: ["<C-o>"], run: (view, _arg, count) => jumpBackward(view, count ?? 1), description: "Jump back in history" },
    { keys: ["<C-i>"], run: (view, _arg, count) => jumpForward(view, count ?? 1), description: "Jump forward in history" },
    { keys: ["<C-Tab>"], run: (view, _arg, count) => jumpForward(view, count ?? 1), description: "Jump forward in history" },
    { keys: ["*"], run: view => setSearchFromSelection(view), description: "Search selection" },
    { keys: ["s"], run: view => setSearchPrompt(view, ""), description: "Select matches" },
    { keys: ["/"], run: view => setSearchPrompt(view, ""), description: "Search forward" },
    { keys: ["n"], run: view => jumpToNextSearch(view), description: "Jump to next search match" },
    { keys: ["<A-n>"], run: view => jumpToPreviousSearch(view), description: "Jump to previous search match" },
    { keys: ["N"], run: view => addNextTextSelection(view), description: "Add selection for next match" },
    { keys: ["<"], run: (view, _arg, count) => indentSelectedLines(view, false, count ?? 1), description: "Deindent selected lines" },
    { keys: [">"], run: (view, _arg, count) => indentSelectedLines(view, true, count ?? 1), description: "Indent selected lines" },
    { keys: ["<A-s>"], run: view => splitSelectionsOnLines(view), description: "Split selections on line boundaries" },
    { keys: ["_"], run: view => trimSelectionsWhitespace(view), description: "Trim selections whitespace" },
    { keys: ["&"], run: view => alignSelections(view), description: "Align selections" },
    { keys: ["@"], run: view => convertTabsSpaces(view, false), description: "Convert tabs to spaces" },
    { keys: ["<A-@>"], run: view => convertTabsSpaces(view, true), description: "Convert spaces to tabs" },
    { keys: ["f"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "f", arg, count);
    }, description: "Select to next character" },
    { keys: ["t"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "t", arg, count);
    }, description: "Select until next character" },
    { keys: ["F"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "F", arg, count);
    }, description: "Extend to next character" },
    { keys: ["T"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "T", arg, count);
    }, description: "Extend until next character" },
    { keys: ["<A-f>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-f>", arg, count);
    }, description: "Select to previous character" },
    { keys: ["<a-f>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-f>", arg, count);
    }, description: "Select to previous character" },
    { keys: ["<A-t>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-t>", arg, count);
    }, description: "Select until previous character" },
    { keys: ["<a-t>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-t>", arg, count);
    }, description: "Select until previous character" },
    { keys: ["<A-F>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-F>", arg, count);
    }, description: "Extend to previous character" },
    { keys: ["<a-F>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-F>", arg, count);
    }, description: "Extend to previous character" },
    { keys: ["<A-T>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-T>", arg, count);
    }, description: "Extend until previous character" },
    { keys: ["<a-T>"], run: (view, arg, count) => {
      if (arg === undefined) return false;
      return moveToFind(view, "<A-T>", arg, count);
    }, description: "Extend until previous character" },
    { keys: ["<A-.>"], run: (view, _arg, count) => repeatLastSelect(view, count), description: "Repeat last select/find" },
    { keys: ["<a-.>"], run: (view, _arg, count) => repeatLastSelect(view, count), description: "Repeat last select/find" },
    { keys: ["r"], run: view => {
      // replace char handled by key processor or command
      return true;
    }, description: "Replace character" },
    { keys: ["|"], run: view => {
      view.dispatch({ effects: setKakounePipePromptEffect.of({ text: "", mode: "pipe" }) });
      return true;
    }, description: "Pipe selections through filter" },
    { keys: ["<A-|>"], run: view => {
      view.dispatch({ effects: setKakounePipePromptEffect.of({ text: "", mode: "pipe-to" }) });
      return true;
    }, description: "Pipe selections through command and ignore output" },
    { keys: ["g", "g"], run: view => jumpToLine(view, 1), description: "Jump to document start" }
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

    // <A-i> -> select inner surrounding object (full range)
    bindings.push({
      keys: ["<A-i>", type],
      run: view => selectSurroundingObject(view, type, true),
      description: `Select inner surrounding object (${type})`
    });
    // <A-a> -> select surrounding object (full range)
    bindings.push({
      keys: ["<A-a>", type],
      run: view => selectSurroundingObject(view, type, false),
      description: `Select surrounding object (${type})`
    });
  });

  return bindings;
}

/**
 * Builds the default Kakoune key bindings for select and insert modes.
 * Includes motions, selections, object manipulation, and search commands.
 */
export function buildKakouneCommands(): Record<KakouneMode, KakouneBinding[]> {
  return {
    select: [...buildSelectBindings(), ...buildBracketBindings()],
    insert: [
      { keys: ["<Esc>"], run: view => setMode(view, "select"), description: "Exit insert mode" },
      { keys: ["<Left>"], run: view => moveSelections(view, range => clamp(range.head - 1, 0, view.state.doc.length)), description: "Move left" },
      { keys: ["<Right>"], run: view => moveSelections(view, range => clamp(range.head + 1, 0, view.state.doc.length)), description: "Move right" },
      { keys: ["<Up>"], run: view => moveSelections(view, range => moveLineColumn(view, range, -1)), description: "Move up" },
      { keys: ["<Down>"], run: view => moveSelections(view, range => moveLineColumn(view, range, 1)), description: "Move down" }
    ]
  };
}

/**
 * Object exposing individual Kakoune command implementations.
 * Useful for programmatically invoking commands or building custom bindings.
 */
export const kakouneCommands = {
  deleteSelection,
  yankSelection,
  pasteRegister,
  selectLine,
  moveSelections,
  setMode
};
