import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core-js";
import { clamp, lineColumnPos } from "kakoune-core-js";

export type TextInputElement = HTMLTextAreaElement | HTMLInputElement;

interface HistoryEntry {
  doc: string;
  selections: SelectionRange[];
}

export class TextareaAdapter implements EditorHost {
  private mode: KakouneMode = "select";
  private register = "";
  private storedSelections: SelectionRange[] = [{ anchor: 0, head: 0 }];
  private mainSelectionIndex = 0;
  private linewiseSignature: string | null = null;

  // Custom Edit Undo/Redo stack
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private isUndoingOrRedoing = false;

  // Selection history stack (for <A-u> / <A-U>)
  private selectionHistory: SelectionRange[][] = [];
  private selectionHistoryIndex = -1;

  constructor(private readonly element: TextInputElement) {
    this.recordHistory();
    this.recordSelectionHistory();
  }

  getElement(): TextInputElement {
    return this.element;
  }

  getMode(): KakouneMode {
    return this.mode;
  }

  setMode(mode: KakouneMode): void {
    this.mode = mode;
    this.element.dataset.kakouneMode = mode;
    if (mode === "select") {
      this.element.classList.add("kakoune-active-select");
      this.element.classList.remove("kakoune-active-insert");
    } else {
      this.element.classList.add("kakoune-active-insert");
      this.element.classList.remove("kakoune-active-select");
    }
  }

  getDoc(): string {
    return this.element.value;
  }

  getDocLength(): number {
    return this.element.value.length;
  }

  getLineCount(): number {
    return this.element.value.split("\n").length;
  }

  lineAt(pos: number): LineInfo {
    const doc = this.getDoc();
    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const lines = doc.split("\n");
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const nextOffset = currentOffset + lineText.length;
      if (clampedPos <= nextOffset || i === lines.length - 1) {
        return {
          from: currentOffset,
          to: nextOffset,
          number: i + 1,
          text: lineText
        };
      }
      currentOffset = nextOffset + 1;
    }

    return { from: 0, to: 0, number: 1, text: "" };
  }

  line(number: number): LineInfo {
    const doc = this.getDoc();
    const lines = doc.split("\n");
    const safeLineNum = Math.max(1, Math.min(number, lines.length));

    let from = 0;
    for (let i = 0; i < safeLineNum - 1; i++) {
      from += lines[i].length + 1;
    }
    const text = lines[safeLineNum - 1] ?? "";
    return {
      from,
      to: from + text.length,
      number: safeLineNum,
      text
    };
  }

  getSelections(): SelectionRange[] {
    const start = this.element.selectionStart ?? 0;
    const end = this.element.selectionEnd ?? 0;
    const dir = this.element.selectionDirection ?? "forward";

    const primaryRange: SelectionRange = dir === "backward"
      ? { anchor: end, head: start }
      : { anchor: start, head: end };

    const isLinewise = this.linewiseSignature === `${primaryRange.anchor}:${primaryRange.head}`;
    if (isLinewise) {
      primaryRange.linewise = true;
    }

    if (this.storedSelections.length > 1) {
      return this.storedSelections.map((range, idx) => {
        if (idx === this.mainSelectionIndex) return primaryRange;
        return range;
      });
    }

    return [primaryRange];
  }

  getMainSelectionIndex(): number {
    return this.mainSelectionIndex;
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    if (ranges.length === 0) return;
    this.storedSelections = ranges.map(r => ({ ...r }));
    this.mainSelectionIndex = Math.max(0, Math.min(mainIndex ?? 0, ranges.length - 1));

    const primary = ranges[this.mainSelectionIndex] ?? ranges[0];
    const isBackward = primary.anchor > primary.head;
    const start = isBackward ? primary.head : primary.anchor;
    const end = isBackward ? primary.anchor : primary.head;

    try {
      this.element.setSelectionRange(
        Math.max(0, start),
        Math.max(0, end),
        isBackward ? "backward" : "forward"
      );
    } catch {
      // Ignored for input elements that don't support setSelectionRange
    }

    if (ranges.every(r => r.linewise)) {
      this.linewiseSignature = `${primary.anchor}:${primary.head}`;
    } else {
      this.linewiseSignature = null;
    }

    this.recordSelectionHistory();
  }

  replaceRange(from: number, to: number, text: string): void {
    const doc = this.getDoc();
    const safeFrom = Math.max(0, Math.min(from, doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, doc.length));

    const nextDoc = doc.slice(0, safeFrom) + text + doc.slice(safeTo);
    this.setDocumentValue(nextDoc);

    const newCursor = safeFrom + text.length;
    this.setSelections([{ anchor: newCursor, head: newCursor }]);
    this.recordHistory();
  }

  /**
   * Inserts text at all selection points simultaneously (multi-cursor editing).
   */
  insertTextAtAllSelections(text: string): void {
    const selections = this.getSelections();
    if (selections.length <= 1) {
      const primary = selections[0] || { anchor: 0, head: 0 };
      const from = Math.min(primary.anchor, primary.head);
      const to = Math.max(primary.anchor, primary.head);
      this.replaceRange(from, to, text);
      return;
    }

    // Sort selections ascending to compute shift offsets
    const ascending = selections.map((s, idx) => ({ ...s, idx }))
      .sort((a, b) => Math.min(a.anchor, a.head) - Math.min(b.anchor, b.head));

    // Descending for string splicing
    const descending = [...ascending].reverse();

    let doc = this.getDoc();
    for (const item of descending) {
      const from = Math.max(0, Math.min(Math.min(item.anchor, item.head), doc.length));
      const to = Math.max(from, Math.min(Math.max(item.anchor, item.head), doc.length));
      doc = doc.slice(0, from) + text + doc.slice(to);
    }

    // Calculate updated cursor positions in ascending order
    let cumulativeDelta = 0;
    const newRanges: Array<{ anchor: number; head: number; idx: number }> = [];

    for (const item of ascending) {
      const from = Math.min(item.anchor, item.head);
      const to = Math.max(item.anchor, item.head);
      const replacedLen = to - from;
      const newPos = from + cumulativeDelta + text.length;
      cumulativeDelta += text.length - replacedLen;
      newRanges.push({ anchor: newPos, head: newPos, idx: item.idx });
    }

    this.setDocumentValue(doc);
    const restored = newRanges.sort((a, b) => a.idx - b.idx).map(r => ({ anchor: r.anchor, head: r.head }));
    this.setSelections(restored, this.mainSelectionIndex);
    this.recordHistory();
  }

  /**
   * Deletes one character backwards at all selection points.
   */
  backspaceAtAllSelections(): void {
    const selections = this.getSelections();
    const ascending = selections.map((s, idx) => ({ ...s, idx }))
      .sort((a, b) => Math.min(a.anchor, a.head) - Math.min(b.anchor, b.head));

    const descending = [...ascending].reverse();

    let doc = this.getDoc();
    for (const item of descending) {
      const from = Math.min(item.anchor, item.head);
      const to = Math.max(item.anchor, item.head);
      if (from !== to) {
        doc = doc.slice(0, from) + doc.slice(to);
      } else if (from > 0) {
        doc = doc.slice(0, from - 1) + doc.slice(to);
      }
    }

    let cumulativeDelta = 0;
    const newRanges: Array<{ anchor: number; head: number; idx: number }> = [];

    for (const item of ascending) {
      const from = Math.min(item.anchor, item.head);
      const to = Math.max(item.anchor, item.head);
      let newPos: number;
      if (from !== to) {
        newPos = Math.max(0, from + cumulativeDelta);
        cumulativeDelta -= (to - from);
      } else if (from > 0) {
        newPos = Math.max(0, from - 1 + cumulativeDelta);
        cumulativeDelta -= 1;
      } else {
        newPos = 0;
      }
      newRanges.push({ anchor: newPos, head: newPos, idx: item.idx });
    }

    this.setDocumentValue(doc);
    const restored = newRanges.sort((a, b) => a.idx - b.idx).map(r => ({ anchor: r.anchor, head: r.head }));
    this.setSelections(restored, this.mainSelectionIndex);
    this.recordHistory();
  }

  // --- Multi-selection operations ---

  /** Copy / duplicate selection on next line (C) */
  copySelectionOnNextLine(): void {
    const doc = this.getDoc();
    const current = this.getSelections();
    const additions: SelectionRange[] = [];

    for (const sel of current) {
      const nextAnchor = lineColumnPos(doc, sel.anchor, 1);
      const nextHead = lineColumnPos(doc, sel.head, 1);
      additions.push({ anchor: nextAnchor, head: nextHead });
    }

    this.setSelections([...current, ...additions]);
  }

  /** Copy / duplicate selection on previous line (<A-C>) */
  copySelectionOnPrevLine(): void {
    const doc = this.getDoc();
    const current = this.getSelections();
    const additions: SelectionRange[] = [];

    for (const sel of current) {
      const prevAnchor = lineColumnPos(doc, sel.anchor, -1);
      const prevHead = lineColumnPos(doc, sel.head, -1);
      additions.push({ anchor: prevAnchor, head: prevHead });
    }

    this.setSelections([...current, ...additions]);
  }

  /** Split selections on newlines (<A-s>) */
  splitSelectionsOnNewlines(): void {
    const doc = this.getDoc();
    const result: SelectionRange[] = [];

    for (const sel of this.getSelections()) {
      const from = Math.min(sel.anchor, sel.head);
      const to = Math.max(sel.anchor, sel.head);
      const isForward = sel.anchor <= sel.head;
      const text = doc.slice(from, to);
      const parts = text.split("\n");

      let offset = from;
      for (const part of parts) {
        const segEnd = offset + part.length;
        if (part.length > 0) {
          result.push(isForward ? { anchor: offset, head: segEnd } : { anchor: segEnd, head: offset });
        }
        offset = segEnd + 1; // +1 for newline
      }
    }

    if (result.length > 0) {
      this.setSelections(result);
    }
  }

  /** Keep only the main selection (<space>) */
  keepPrimarySelection(): void {
    const selections = this.getSelections();
    const primary = selections[this.mainSelectionIndex] || selections[0];
    if (primary) {
      this.setSelections([primary], 0);
    }
  }

  /** Remove the main selection, keeping others (<A-space>) */
  removePrimarySelection(): void {
    const selections = this.getSelections();
    if (selections.length > 1) {
      const remaining = selections.filter((_, idx) => idx !== this.mainSelectionIndex);
      this.setSelections(remaining, 0);
    }
  }

  /** Cycle main selection forward or backward ()) / (() */
  cycleMainSelection(direction: 1 | -1): void {
    const selections = this.getSelections();
    if (selections.length <= 1) return;
    let nextIdx = (this.mainSelectionIndex + direction) % selections.length;
    if (nextIdx < 0) nextIdx += selections.length;
    this.setSelections(selections, nextIdx);
  }

  /** Rotate selections text content (<A-)> / <A-(>) */
  rotateSelectionsContent(direction: 1 | -1): void {
    const selections = this.getSelections();
    if (selections.length <= 1) return;

    const doc = this.getDoc();
    const texts = selections.map(s => doc.slice(Math.min(s.anchor, s.head), Math.max(s.anchor, s.head)));

    // Shift text array
    const rotated = direction > 0
      ? [texts[texts.length - 1], ...texts.slice(0, texts.length - 1)]
      : [...texts.slice(1), texts[0]];

    // Apply rotated text back to selections from right to left
    const indexed = selections.map((s, idx) => ({ ...s, text: rotated[idx] }))
      .sort((a, b) => Math.min(b.anchor, b.head) - Math.min(a.anchor, a.head));

    let nextDoc = doc;
    for (const item of indexed) {
      const from = Math.min(item.anchor, item.head);
      const to = Math.max(item.anchor, item.head);
      nextDoc = nextDoc.slice(0, from) + item.text + nextDoc.slice(to);
    }

    this.setDocumentValue(nextDoc);
    this.recordHistory();
  }

  private setDocumentValue(nextValue: string): void {
    this.element.value = nextValue;
    try {
      this.element.dispatchEvent(new Event("input", { bubbles: true }));
      this.element.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      // Ignored in test mock environments
    }
  }

  undo(): void {
    if (this.historyIndex > 0) {
      this.isUndoingOrRedoing = true;
      this.historyIndex -= 1;
      const entry = this.history[this.historyIndex];
      this.setDocumentValue(entry.doc);
      this.setSelections(entry.selections);
      this.isUndoingOrRedoing = false;
    }
  }

  redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.isUndoingOrRedoing = true;
      this.historyIndex += 1;
      const entry = this.history[this.historyIndex];
      this.setDocumentValue(entry.doc);
      this.setSelections(entry.selections);
      this.isUndoingOrRedoing = false;
    }
  }

  recordHistory(): void {
    if (this.isUndoingOrRedoing) return;
    const currentDoc = this.getDoc();
    const currentSelections = this.getSelections();

    const last = this.history[this.historyIndex];
    if (last && last.doc === currentDoc) {
      last.selections = currentSelections;
      return;
    }

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      doc: currentDoc,
      selections: currentSelections
    });

    if (this.history.length > 100) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  undoSelection(): void {
    if (this.selectionHistoryIndex > 0) {
      this.selectionHistoryIndex -= 1;
      this.setSelections(this.selectionHistory[this.selectionHistoryIndex]);
    }
  }

  redoSelection(): void {
    if (this.selectionHistoryIndex < this.selectionHistory.length - 1) {
      this.selectionHistoryIndex += 1;
      this.setSelections(this.selectionHistory[this.selectionHistoryIndex]);
    }
  }

  private recordSelectionHistory(): void {
    if (this.isUndoingOrRedoing) return;
    const current = this.storedSelections;
    const last = this.selectionHistory[this.selectionHistoryIndex];
    if (last && JSON.stringify(last) === JSON.stringify(current)) return;

    if (this.selectionHistoryIndex < this.selectionHistory.length - 1) {
      this.selectionHistory = this.selectionHistory.slice(0, this.selectionHistoryIndex + 1);
    }
    this.selectionHistory.push(current.map(s => ({ ...s })));
    if (this.selectionHistory.length > 50) {
      this.selectionHistory.shift();
    }
    this.selectionHistoryIndex = this.selectionHistory.length - 1;
  }

  getRegister(): string {
    return this.register;
  }

  setRegister(text: string): void {
    this.register = text;
  }
}
