import { EditorSelection } from "@codemirror/state";
import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import type { EditorHost, KakouneMode, LineInfo, SelectionRange } from "kakoune-core";
import {
  kakouneStateField,
  setKakouneModeEffect,
  setKakouneRegisterEffect,
  setKakouneReplaceInsertAnchorsEffect
} from "./state";

export class Cm6Adapter implements EditorHost {
  constructor(private readonly view: EditorView) {}

  getMode(): KakouneMode {
    return this.view.state.field(kakouneStateField).mode;
  }

  setMode(mode: KakouneMode): void {
    this.view.dispatch({
      effects: [
        setKakouneModeEffect.of(mode),
        setKakouneReplaceInsertAnchorsEffect.of(null)
      ]
    });
  }

  getDoc(): string {
    return this.view.state.doc.toString();
  }

  getDocLength(): number {
    return this.view.state.doc.length;
  }

  getLineCount(): number {
    return this.view.state.doc.lines;
  }

  lineAt(pos: number): LineInfo {
    const line = this.view.state.doc.lineAt(pos);
    return { from: line.from, to: line.to, number: line.number, text: line.text };
  }

  line(number: number): LineInfo {
    const line = this.view.state.doc.line(number);
    return { from: line.from, to: line.to, number: line.number, text: line.text };
  }

  getSelections(): SelectionRange[] {
    return this.view.state.selection.ranges.map(range => ({
      anchor: range.anchor,
      head: range.head
    }));
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    const nextMainIndex = mainIndex ?? Math.min(
      this.view.state.selection.mainIndex,
      Math.max(0, ranges.length - 1)
    );
    this.view.dispatch({
      selection: EditorSelection.create(
        ranges.map(range => EditorSelection.range(range.anchor, range.head)),
        nextMainIndex
      ),
      scrollIntoView: true
    });
  }

  replaceRange(from: number, to: number, text: string): void {
    this.view.dispatch({
      changes: { from, to, insert: text },
      scrollIntoView: true
    });
  }

  undo(): void {
    undo(this.view);
  }

  redo(): void {
    redo(this.view);
  }

  getRegister(): string {
    return this.view.state.field(kakouneStateField).register;
  }

  setRegister(text: string): void {
    this.view.dispatch({ effects: setKakouneRegisterEffect.of(text) });
  }
}

export function withAdapter(view: EditorView, run: (editor: Cm6Adapter) => boolean): boolean {
  return run(new Cm6Adapter(view));
}
