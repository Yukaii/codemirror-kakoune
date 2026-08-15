import {
  KakouneKeyProcessor,
  enterInsert,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
  openLineAbove,
  openLineBelow,
  selectWordBackward,
  selectWordEnd,
  selectWordForward,
  type EditorHost,
  type KakouneBinding,
  type KakouneMode,
  type LineInfo,
  type SelectionRange
} from "../src";

class MemoryEditor implements EditorHost {
  mode: KakouneMode = "select";
  register = "";
  mainIndex = 0;
  undoCalls = 0;
  redoCalls = 0;

  constructor(
    private doc: string,
    private selections: SelectionRange[] = [{ anchor: 0, head: 0 }]
  ) {}

  getMode(): KakouneMode { return this.mode; }
  setMode(mode: KakouneMode): void { this.mode = mode; }
  getDoc(): string { return this.doc; }
  getDocLength(): number { return this.doc.length; }
  getLineCount(): number { return this.doc.split("\n").length; }

  lineAt(pos: number): LineInfo {
    const offset = Math.max(0, Math.min(pos, this.doc.length));
    const before = this.doc.slice(0, offset);
    return this.line(before.split("\n").length);
  }

  line(number: number): LineInfo {
    const lines = this.doc.split("\n");
    const lineNumber = Math.max(1, Math.min(number, lines.length));
    const from = lines.slice(0, lineNumber - 1).reduce((length, text) => length + text.length + 1, 0);
    const text = lines[lineNumber - 1];
    return { from, to: from + text.length, number: lineNumber, text };
  }

  getSelections(): SelectionRange[] {
    return this.selections.map(range => ({ ...range }));
  }

  setSelections(ranges: SelectionRange[], mainIndex?: number): void {
    this.selections = ranges.map(range => ({ ...range }));
    this.mainIndex = mainIndex ?? Math.min(this.mainIndex, Math.max(0, ranges.length - 1));
  }

  replaceRange(from: number, to: number, text: string): void {
    this.doc = this.doc.slice(0, from) + text + this.doc.slice(to);
  }

  undo(): void { this.undoCalls += 1; }
  redo(): void { this.redoCalls += 1; }
  getRegister(): string { return this.register; }
  setRegister(text: string): void { this.register = text; }
}

describe("portable motion commands", () => {
  it("moves every selection by character and line while preserving the main index", () => {
    const editor = new MemoryEditor("one\ntwelve\nx", [
      { anchor: 1, head: 1 },
      { anchor: 6, head: 6 }
    ]);
    editor.mainIndex = 1;

    moveRight(editor, 2);
    expect(editor.getSelections()).toEqual([
      { anchor: 3, head: 3 },
      { anchor: 8, head: 8 }
    ]);
    moveLeft(editor);
    moveDown(editor);
    expect(editor.getSelections()).toEqual([
      { anchor: 6, head: 6 },
      { anchor: 12, head: 12 }
    ]);
    moveUp(editor);
    expect(editor.mainIndex).toBe(1);
  });

  it("selects word ranges repeatedly in both directions", () => {
    const editor = new MemoryEditor("alpha beta gamma");

    selectWordForward(editor, 2);
    expect(editor.getSelections()).toEqual([{ anchor: 6, head: 11 }]);
    selectWordBackward(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 11, head: 6 }]);
    editor.setSelections([{ anchor: 0, head: 0 }]);
    selectWordEnd(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 0, head: 5 }]);
  });

  it("enters insert mode after the end of non-empty selections", () => {
    const editor = new MemoryEditor("alpha beta", [
      { anchor: 6, head: 2 },
      { anchor: 8, head: 8 }
    ]);

    enterInsert(editor, true);

    expect(editor.getSelections()).toEqual([
      { anchor: 6, head: 6 },
      { anchor: 9, head: 9 }
    ]);
    expect(editor.getMode()).toBe("insert");
  });
});

describe("portable line insertion", () => {
  it("opens lines above multiple selections and places cursors on the inserted lines", () => {
    const editor = new MemoryEditor("one\ntwo", [
      { anchor: 1, head: 1 },
      { anchor: 5, head: 5 }
    ]);

    openLineAbove(editor);

    expect(editor.getDoc()).toBe("\none\n\ntwo");
    expect(editor.getSelections()).toEqual([
      { anchor: 0, head: 0 },
      { anchor: 5, head: 5 }
    ]);
    expect(editor.getMode()).toBe("insert");
  });

  it("opens lines below multiple selections and accounts for earlier insertions", () => {
    const editor = new MemoryEditor("one\ntwo", [
      { anchor: 1, head: 1 },
      { anchor: 5, head: 5 }
    ]);

    openLineBelow(editor);

    expect(editor.getDoc()).toBe("one\n\ntwo\n");
    expect(editor.getSelections()).toEqual([
      { anchor: 4, head: 4 },
      { anchor: 9, head: 9 }
    ]);
    expect(editor.getMode()).toBe("insert");
  });
});

describe("KakouneKeyProcessor", () => {
  const binding = (keys: string[], run: KakouneBinding<MemoryEditor>["run"]): KakouneBinding<MemoryEditor> => ({
    keys,
    run
  });

  it("passes counts to complete commands and clears a stale count after an invalid key", () => {
    const counts: Array<number | undefined> = [];
    const processor = new KakouneKeyProcessor<MemoryEditor>({
      select: [binding(["l"], (_editor, _arg, count) => {
        counts.push(count);
        return true;
      })],
      insert: []
    });
    const editor = new MemoryEditor("");

    expect(processor.handle("select", "3", editor)).toBe(true);
    expect(processor.handle("select", "l", editor)).toBe(true);
    expect(processor.handle("select", "2", editor)).toBe(true);
    expect(processor.handle("select", "?", editor)).toBe(false);
    expect(processor.handle("select", "l", editor)).toBe(true);
    expect(counts).toEqual([3, undefined]);
  });

  it("tracks prefixes and character arguments", () => {
    const calls: string[] = [];
    const processor = new KakouneKeyProcessor<MemoryEditor>({
      select: [
        binding(["g", "g"], () => {
          calls.push("gg");
          return true;
        }),
        binding(["f"], (_editor, arg) => {
          calls.push(`f:${arg}`);
          return true;
        })
      ],
      insert: []
    });
    const editor = new MemoryEditor("");

    expect(processor.handle("select", "g", editor)).toBe(true);
    expect(processor.getPending()).toEqual(["g"]);
    expect(processor.handle("select", "g", editor)).toBe(true);
    expect(processor.handle("select", "f", editor)).toBe(true);
    expect(processor.isWaitingForChar()).toBe(true);
    expect(processor.handle("select", "x", editor)).toBe(true);
    expect(calls).toEqual(["gg", "f:x"]);
  });
});
