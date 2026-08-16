import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core";
import type CodeMirror from "codemirror";

type Cm = CodeMirror.Editor;

function posToOffset(cm: Cm, pos: CodeMirror.Position): number {
  let offset = 0;
  for (let line = cm.firstLine(); line < pos.line; line += 1) {
    offset += cm.getLine(line).length + 1;
  }
  return offset + pos.ch;
}

function offsetToPos(cm: Cm, offset: number): CodeMirror.Position {
  let remaining = offset;
  for (let line = cm.firstLine(); line <= cm.lastLine(); line += 1) {
    const length = cm.getLine(line).length;
    if (remaining <= length) return { line, ch: remaining };
    remaining -= length + 1;
  }
  const last = cm.lastLine();
  return { line: last, ch: cm.getLine(last).length };
}

function positionsEqual(left: CodeMirror.Position, right: CodeMirror.Position): boolean {
  return left.line === right.line && left.ch === right.ch;
}

export class Cm5Adapter implements EditorHost {
  register = "";
  private linewiseSelectionSignature: string | null = null;

  constructor(private readonly cm: Cm) {}

  getMode(): KakouneMode {
    return this.cm.getWrapperElement().dataset.kakouneMode === "insert" ? "insert" : "select";
  }

  setMode(mode: KakouneMode): void {
    const wrapper = this.cm.getWrapperElement();
    wrapper.dataset.kakouneMode = mode;
    wrapper.classList.toggle("cm-fat-cursor", mode === "select");
    this.cm.refresh();
  }

  getDoc(): string {
    return this.cm.getValue();
  }

  getDocLength(): number {
    return this.getDoc().length;
  }

  getLineCount(): number {
    return this.cm.lineCount();
  }

  lineAt(pos: number): LineInfo {
    const position = offsetToPos(this.cm, pos);
    return this.line(position.line + 1);
  }

  line(number: number): LineInfo {
    const line = number - 1;
    const text = this.cm.getLine(line);
    const from = posToOffset(this.cm, { line, ch: 0 });
    return { from, to: from + text.length, number, text };
  }

  getSelections(): SelectionRange[] {
    const ranges = this.cm.listSelections().map(selection => ({
      anchor: posToOffset(this.cm, selection.anchor),
      head: posToOffset(this.cm, selection.head)
    }));
    const isLinewise = this.linewiseSelectionSignature === this.selectionSignature(ranges);
    return ranges.map(range => isLinewise ? { ...range, linewise: true } : range);
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    const currentSelections = this.cm.listSelections();
    const primaryAnchor = this.cm.getCursor("anchor");
    const primaryHead = this.cm.getCursor("head");
    const currentMainIndex = currentSelections.findIndex(selection => (
      positionsEqual(selection.anchor, primaryAnchor) && positionsEqual(selection.head, primaryHead)
    ));
    const nextMainIndex = mainIndex ?? Math.min(
      Math.max(0, currentMainIndex),
      Math.max(0, ranges.length - 1)
    );
    this.cm.setSelections(ranges.map(range => ({
      anchor: offsetToPos(this.cm, range.anchor),
      head: offsetToPos(this.cm, range.head)
    })), nextMainIndex);
    this.linewiseSelectionSignature = ranges.length > 0 && ranges.every(range => range.linewise)
      ? this.selectionSignature(this.cm.listSelections().map(selection => ({
        anchor: posToOffset(this.cm, selection.anchor),
        head: posToOffset(this.cm, selection.head)
      })))
      : null;
  }

  replaceRange(from: number, to: number, text: string): void {
    this.cm.replaceRange(text, offsetToPos(this.cm, from), offsetToPos(this.cm, to));
  }

  undo(): void {
    this.cm.undo();
  }

  redo(): void {
    this.cm.redo();
  }

  getRegister(): string {
    return this.register;
  }

  setRegister(text: string): void {
    this.register = text;
  }

  private selectionSignature(ranges: Array<Pick<SelectionRange, "anchor" | "head">>): string {
    return ranges.map(range => `${range.anchor}:${range.head}`).join("|");
  }
}
