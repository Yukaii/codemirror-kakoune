import {
  KakouneKeyProcessor,
  KakounePromptController,
  enterInsert,
  extendDown,
  extendDocumentEnd,
  extendDocumentStart,
  extendLeft,
  extendLineEnd,
  extendRight,
  extendToLine,
  extendUp,
  extendWordBackward,
  extendWordForward,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
  openLineAbove,
  openLineBelow,
  selectAll,
  deleteSelection,
  selectLine,
  joinLines,
  toUpperCaseSelection,
  toLowerCaseSelection,
  swapCaseSelection,
  trimSelections,
  addEmptyLineBelow,
  addEmptyLineAbove,
  reduceToCursor,
  flipSelectionDirection,
  ensureForwardDirection,
  selectWordBackward,
  selectWordEnd,
  selectWordForward,
  parseKakrc,
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

  it("extends character, line, and word motions without moving the anchor", () => {
    const editor = new MemoryEditor("alpha beta\ngamma", [{ anchor: 2, head: 2 }]);

    extendRight(editor, 2);
    expect(editor.getSelections()).toEqual([{ anchor: 2, head: 4 }]);
    extendLeft(editor);
    extendDown(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 2, head: 14 }]);
    extendUp(editor);
    extendLineEnd(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 2, head: 10 }]);

    editor.setSelections([{ anchor: 0, head: 0 }]);
    extendWordForward(editor, 2);
    expect(editor.getSelections()).toEqual([{ anchor: 0, head: 11 }]);
    extendWordBackward(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 0, head: 6 }]);
  });

  it("extends to counted lines and document boundaries", () => {
    const editor = new MemoryEditor("one\ntwo\nthree", [{ anchor: 5, head: 5 }]);

    extendToLine(editor, 3);
    expect(editor.getSelections()).toEqual([{ anchor: 5, head: 8 }]);
    extendDocumentStart(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 5, head: 0 }]);
    extendDocumentEnd(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 5, head: 13 }]);
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

describe("portable line selection and deletion", () => {
  it("selects the following newline so xd removes a non-final line", () => {
    const editor = new MemoryEditor("one\ntwo\nthree", [{ anchor: 5, head: 5 }]);

    selectLine(editor);
    expect(editor.getSelections()).toEqual([
      { anchor: 4, head: 8, linewise: true }
    ]);

    deleteSelection(editor);
    expect(editor.getDoc()).toBe("one\nthree");
  });

  it("consumes the preceding separator so xd removes the final line", () => {
    const editor = new MemoryEditor("one\ntwo\nthree", [{ anchor: 10, head: 10 }]);

    selectLine(editor);
    expect(editor.getSelections()).toEqual([
      { anchor: 8, head: 13, linewise: true }
    ]);

    deleteSelection(editor);
    expect(editor.getDoc()).toBe("one\ntwo");
  });

  it("removes a final empty line and handles a single-line document", () => {
    const trailingEmptyLine = new MemoryEditor("one\n", [{ anchor: 4, head: 4 }]);
    selectLine(trailingEmptyLine);
    deleteSelection(trailingEmptyLine);
    expect(trailingEmptyLine.getDoc()).toBe("one");

    const onlyLine = new MemoryEditor("one", [{ anchor: 1, head: 1 }]);
    selectLine(onlyLine);
    deleteSelection(onlyLine);
    expect(onlyLine.getDoc()).toBe("");
  });

  it("preserves direction and extends an existing linewise selection", () => {
    const editor = new MemoryEditor("one\ntwo\nthree", [{ anchor: 6, head: 1 }]);

    selectLine(editor);
    expect(editor.getSelections()).toEqual([
      { anchor: 8, head: 0, linewise: true }
    ]);
    selectLine(editor);
    expect(editor.getSelections()).toEqual([
      { anchor: 13, head: 0, linewise: true }
    ]);
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

describe("KakounePromptController", () => {
  it("selects all regex matches within the current selections", () => {
    const editor = new MemoryEditor("alpha beta gamma beta");
    const prompts = new KakounePromptController();
    selectAll(editor);

    prompts.open("select", editor);
    for (const key of "beta") prompts.handleKey(editor, key);
    expect(prompts.getState()).toEqual({ kind: "select", text: "beta" });
    expect(prompts.handleKey(editor, "<Enter>")).toBe(true);

    expect(prompts.getState()).toBeNull();
    expect(prompts.getError()).toBeNull();
    expect(editor.getSelections()).toEqual([
      { anchor: 6, head: 10 },
      { anchor: 17, head: 21 }
    ]);
  });

  it("splits selections on regex matches", () => {
    const editor = new MemoryEditor("foo bar baz", [{ anchor: 0, head: 11 }]);
    const prompts = new KakounePromptController();

    prompts.open("split", editor);
    for (const key of "\\s+") prompts.handleKey(editor, key);
    prompts.handleKey(editor, "<Enter>");

    expect(editor.getSelections()).toEqual([
      { anchor: 0, head: 3 },
      { anchor: 4, head: 7 },
      { anchor: 8, head: 11 }
    ]);
  });

  it("handles spaces, backspace, and cancellation while restoring selections", () => {
    const original = [{ anchor: 8, head: 2 }];
    const editor = new MemoryEditor("alpha beta", original);
    const prompts = new KakounePromptController();

    prompts.open("select", editor);
    prompts.handleKey(editor, "a");
    prompts.handleKey(editor, "<Space>");
    prompts.handleKey(editor, "b");
    prompts.handleKey(editor, "<Backspace>");
    expect(prompts.getState()).toEqual({ kind: "select", text: "a " });

    editor.setSelections([{ anchor: 0, head: 0 }]);
    expect(prompts.handleKey(editor, "<Esc>")).toBe(true);
    expect(prompts.getState()).toBeNull();
    expect(editor.getSelections()).toEqual(original);
  });

  it("reports invalid and empty patterns without changing selections", () => {
    const original = [{ anchor: 0, head: 5 }];
    const editor = new MemoryEditor("alpha", original);
    const prompts = new KakounePromptController();

    prompts.open("select", editor);
    prompts.handleKey(editor, "[");
    prompts.handleKey(editor, "<Enter>");
    expect(prompts.getError()).toBe("'select': invalid regex \"[\"");
    expect(editor.getSelections()).toEqual(original);

    prompts.open("split", editor);
    prompts.handleKey(editor, "<Enter>");
    expect(prompts.getError()).toBe("'split': empty regex");
    expect(editor.getSelections()).toEqual(original);
  });

  it("joins lines (<a-j> and <a-J>)", () => {
    const editor = new MemoryEditor("first line\n  second line\n    third line", [{ anchor: 0, head: 0 }]);
    joinLines(editor, false);
    expect(editor.getDoc()).toBe("first line second line\n    third line");

    selectAll(editor);
    joinLines(editor, false);
    expect(editor.getDoc()).toBe("first line second line third line");
  });

  it("handles case conversions (~, `, <a-`>)", () => {
    const editor = new MemoryEditor("Hello World", [{ anchor: 0, head: 5 }]);
    toUpperCaseSelection(editor);
    expect(editor.getDoc()).toBe("HELLO World");

    toLowerCaseSelection(editor);
    expect(editor.getDoc()).toBe("hello World");

    swapCaseSelection(editor);
    expect(editor.getDoc()).toBe("HELLO World");
  });

  it("handles whitespace trim (_)", () => {
    const editor = new MemoryEditor("  hello world  ", [{ anchor: 0, head: 15 }]);
    trimSelections(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 2, head: 13 }]);
  });

  it("handles adding empty lines (<a-o> and <a-O>)", () => {
    const editor = new MemoryEditor("first line\nsecond line", [{ anchor: 0, head: 0 }]);
    addEmptyLineBelow(editor);
    expect(editor.getDoc()).toBe("first line\n\nsecond line");

    addEmptyLineAbove(editor);
    expect(editor.getDoc()).toBe("\nfirst line\n\nsecond line");
  });

  it("handles selection direction adjustments (;, <a-;>, <a-:>)", () => {
    const editor = new MemoryEditor("hello", [{ anchor: 0, head: 4 }]);
    flipSelectionDirection(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 4, head: 0, linewise: undefined }]);

    ensureForwardDirection(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 0, head: 4, linewise: undefined }]);

    reduceToCursor(editor);
    expect(editor.getSelections()).toEqual([{ anchor: 4, head: 4 }]);
  });

  it("parses and executes kakrc mappings and user modes", () => {
    const rc = `
      # Custom mappings
      map global normal <space> ,
      map global insert jk <esc>
      declare-user-mode mymode
      map global mymode d 'xyd'
      set-register a 'custom macro'
    `;

    const config = parseKakrc(rc);
    expect(config.normalMappings.get("<Space>")).toEqual([","]);
    expect(config.insertMappings.get("jk")).toEqual(["<Esc>"]);
    expect(config.userModes.has("mymode")).toBe(true);
    expect(config.userModes.get("mymode")?.get("d")).toEqual(["x", "y", "d"]);
    expect(config.namedRegisters.get("a")).toBe("custom macro");
  });
});
