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

export class Cm5Adapter implements EditorHost {
  register = "";

  constructor(private readonly cm: Cm) {}

  getMode(): KakouneMode {
    return this.cm.getWrapperElement().dataset.kakouneMode === "insert" ? "insert" : "select";
  }

  setMode(mode: KakouneMode): void {
    this.cm.getWrapperElement().dataset.kakouneMode = mode;
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
    return this.cm.listSelections().map(selection => ({
      anchor: posToOffset(this.cm, selection.anchor),
      head: posToOffset(this.cm, selection.head)
    }));
  }

  setSelections(ranges: SelectionRange[]): void {
    this.cm.setSelections(ranges.map(range => ({
      anchor: offsetToPos(this.cm, range.anchor),
      head: offsetToPos(this.cm, range.head)
    })));
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
}
