import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core-js";

export type TextInputElement = HTMLTextAreaElement | HTMLInputElement;

interface HistoryEntry {
  doc: string;
  selections: SelectionRange[];
}

export class TextareaAdapter implements EditorHost {
  private mode: KakouneMode = "select";
  private register = "";
  private storedSelections: SelectionRange[] = [{ anchor: 0, head: 0 }];
  private linewiseSignature: string | null = null;
  
  // Custom Undo/Redo stack
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private isUndoingOrRedoing = false;

  constructor(private readonly element: TextInputElement) {
    this.recordHistory();
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
      currentOffset = nextOffset + 1; // +1 for the newline character
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
        if (idx === 0) return primaryRange;
        return range;
      });
    }

    return [primaryRange];
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    if (ranges.length === 0) return;
    this.storedSelections = ranges.map(r => ({ ...r }));

    const targetIdx = mainIndex ?? 0;
    const primary = ranges[targetIdx] ?? ranges[0];

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
      // Inputs of certain types (e.g. number/email) may throw on setSelectionRange
    }

    if (ranges.every(r => r.linewise)) {
      this.linewiseSignature = `${primary.anchor}:${primary.head}`;
    } else {
      this.linewiseSignature = null;
    }
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

  private setDocumentValue(nextValue: string): void {
    this.element.value = nextValue;
    // Dispatch input & change events for reactive form libraries
    try {
      this.element.dispatchEvent(new Event("input", { bubbles: true }));
      this.element.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      // Ignore if event dispatch fails in test environments
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

    // Avoid duplicate history entries
    const last = this.history[this.historyIndex];
    if (last && last.doc === currentDoc) {
      last.selections = currentSelections;
      return;
    }

    // Truncate any redo history if we are in the middle
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      doc: currentDoc,
      selections: currentSelections
    });

    // Limit history size to 100 entries
    if (this.history.length > 100) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  getRegister(): string {
    return this.register;
  }

  setRegister(text: string): void {
    this.register = text;
  }
}
