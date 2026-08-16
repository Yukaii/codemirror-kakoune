import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core-js";

interface HistoryEntry {
  doc: string;
  selections: SelectionRange[];
}

export class ContentEditableAdapter implements EditorHost {
  private mode: KakouneMode = "select";
  private register = "";
  private storedSelections: SelectionRange[] = [{ anchor: 0, head: 0 }];

  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private isUndoingOrRedoing = false;

  constructor(private readonly element: HTMLElement) {
    this.recordHistory();
  }

  getElement(): HTMLElement {
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
    return this.element.innerText || this.element.textContent || "";
  }

  getDocLength(): number {
    return this.getDoc().length;
  }

  getLineCount(): number {
    return this.getDoc().split("\n").length;
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
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return this.storedSelections;
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(this.element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    const end = start + range.toString().length;

    const isBackward = selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset;
    const primary: SelectionRange = isBackward ? { anchor: end, head: start } : { anchor: start, head: end };

    if (this.storedSelections.length > 1) {
      return this.storedSelections.map((s, idx) => (idx === 0 ? primary : s));
    }
    return [primary];
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    if (ranges.length === 0) return;
    this.storedSelections = ranges.map(r => ({ ...r }));
    const targetIdx = mainIndex ?? 0;
    const primary = ranges[targetIdx] ?? ranges[0];

    const from = Math.min(primary.anchor, primary.head);
    const to = Math.max(primary.anchor, primary.head);

    try {
      const selection = window.getSelection();
      if (!selection) return;

      const domRange = this.createDOMRange(from, to);
      if (domRange) {
        selection.removeAllRanges();
        selection.addRange(domRange);
      }
    } catch {
      // Ignore selection errors in detached or non-rendered elements
    }
  }

  private createDOMRange(from: number, to: number): Range | null {
    const range = document.createRange();
    let currentOffset = 0;
    let startFound = false;

    const walker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      const textLen = node.textContent?.length ?? 0;
      const nextOffset = currentOffset + textLen;

      if (!startFound && from >= currentOffset && from <= nextOffset) {
        range.setStart(node, from - currentOffset);
        startFound = true;
      }

      if (startFound && to >= currentOffset && to <= nextOffset) {
        range.setEnd(node, to - currentOffset);
        return range;
      }

      currentOffset = nextOffset;
      node = walker.nextNode();
    }

    return null;
  }

  replaceRange(from: number, to: number, text: string): void {
    const doc = this.getDoc();
    const safeFrom = Math.max(0, Math.min(from, doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, doc.length));

    const nextDoc = doc.slice(0, safeFrom) + text + doc.slice(safeTo);
    this.element.innerText = nextDoc;

    const newCursor = safeFrom + text.length;
    this.setSelections([{ anchor: newCursor, head: newCursor }]);
    this.recordHistory();
  }

  undo(): void {
    if (this.historyIndex > 0) {
      this.isUndoingOrRedoing = true;
      this.historyIndex -= 1;
      const entry = this.history[this.historyIndex];
      this.element.innerText = entry.doc;
      this.setSelections(entry.selections);
      this.isUndoingOrRedoing = false;
    }
  }

  redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.isUndoingOrRedoing = true;
      this.historyIndex += 1;
      const entry = this.history[this.historyIndex];
      this.element.innerText = entry.doc;
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

  getRegister(): string {
    return this.register;
  }

  setRegister(text: string): void {
    this.register = text;
  }
}
