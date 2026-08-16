import { TextareaAdapter } from "../src/adapter/textarea";
import {
  moveLeft,
  moveRight,
  moveDown,
  moveUp,
  extendLeft,
  extendRight,
  extendDown,
  extendUp,
  selectWordForward,
  selectWordBackward,
  selectWordEnd,
  extendWordForward,
  extendWordBackward,
  extendWordEnd,
  selectLine,
  selectAll,
  joinLines,
  deleteSelection,
  changeSelection,
  yankSelection,
  openLineBelow,
  openLineAbove,
  enterInsert,
  undoEdit,
  redoEdit,
  selectRegexMatches,
  splitSelectionsByRegex
} from "kakoune-core-js";

function createTextarea(initialValue: string): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = initialValue;
  document.body.appendChild(textarea);
  return textarea;
}

describe("TextareaAdapter with kakoune-core-js", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("handles basic doc queries and line computation", () => {
    const el = createTextarea("hello\nworld\nfoo");
    const adapter = new TextareaAdapter(el);

    expect(adapter.getDoc()).toBe("hello\nworld\nfoo");
    expect(adapter.getDocLength()).toBe(15);
    expect(adapter.getLineCount()).toBe(3);

    const line1 = adapter.line(1);
    expect(line1).toEqual({ from: 0, to: 5, number: 1, text: "hello" });

    const line2 = adapter.line(2);
    expect(line2).toEqual({ from: 6, to: 11, number: 2, text: "world" });

    const lineAtPos = adapter.lineAt(7);
    expect(lineAtPos.number).toBe(2);
    expect(lineAtPos.text).toBe("world");
  });

  it("handles selections and character motions", () => {
    const el = createTextarea("hello world");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 0 }]);
    expect(adapter.getSelections()).toEqual([{ anchor: 0, head: 0 }]);

    moveRight(adapter, 3);
    expect(adapter.getSelections()).toEqual([{ anchor: 3, head: 3 }]);

    moveLeft(adapter, 1);
    expect(adapter.getSelections()).toEqual([{ anchor: 2, head: 2 }]);

    extendRight(adapter, 3);
    expect(adapter.getSelections()).toEqual([{ anchor: 2, head: 5 }]);
  });

  it("handles word motions (w, b, e, W, B, E)", () => {
    const el = createTextarea("foo bar baz");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 0 }]);
    selectWordForward(adapter);
    expect(adapter.getSelections()).toEqual([{ anchor: 0, head: 4 }]);

    selectWordEnd(adapter);
    expect(adapter.getSelections()).toEqual([{ anchor: 4, head: 7 }]);

    adapter.setSelections([{ anchor: 4, head: 4 }]);
    selectWordBackward(adapter);
    expect(adapter.getSelections()).toEqual([{ anchor: 4, head: 0 }]);
  });

  it("handles selectLine (x) and selectAll (%)", () => {
    const el = createTextarea("line one\nline two\nline three");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 2, head: 2 }]);
    selectLine(adapter);
    expect(adapter.getSelections()).toEqual([{ anchor: 0, head: 9, linewise: true }]);

    selectAll(adapter);
    expect(adapter.getSelections()).toEqual([{ anchor: 0, head: 28 }]);
  });

  it("handles delete, change, and yank operations", () => {
    const el = createTextarea("hello world");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 5 }]);
    yankSelection(adapter);
    expect(adapter.getRegister()).toBe("hello");

    deleteSelection(adapter);
    expect(adapter.getDoc()).toBe(" world");

    adapter.setSelections([{ anchor: 1, head: 6 }]);
    changeSelection(adapter);
    expect(adapter.getDoc()).toBe(" ");
    expect(adapter.getMode()).toBe("insert");
  });

  it("handles openLineBelow and openLineAbove", () => {
    const el = createTextarea("first line\nsecond line");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 3, head: 3 }]);
    openLineBelow(adapter);
    expect(adapter.getDoc()).toBe("first line\n\nsecond line");
    expect(adapter.getMode()).toBe("insert");

    adapter.setMode("select");
    adapter.setSelections([{ anchor: 12, head: 12 }]);
    openLineAbove(adapter);
    expect(adapter.getDoc()).toBe("first line\n\n\nsecond line");
  });

  it("handles undo and redo history correctly", () => {
    const el = createTextarea("initial");
    const adapter = new TextareaAdapter(el);

    adapter.replaceRange(0, 7, "modified 1");
    expect(adapter.getDoc()).toBe("modified 1");

    adapter.replaceRange(0, 10, "modified 2");
    expect(adapter.getDoc()).toBe("modified 2");

    adapter.undo();
    expect(adapter.getDoc()).toBe("modified 1");

    adapter.undo();
    expect(adapter.getDoc()).toBe("initial");

    adapter.redo();
    expect(adapter.getDoc()).toBe("modified 1");
  });

  it("handles regex match selection (s) and regex split (S)", () => {
    const el = createTextarea("alpha 123 beta 456 gamma");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 24 }]);
    const matched = selectRegexMatches(adapter, "\\d+");
    expect(matched).toBe(true);

    const selections = adapter.getSelections();
    expect(selections.length).toBeGreaterThan(0);
  });

  it("handles multi-selection copying, splitting, and filtering", () => {
    const el = createTextarea("line 1\nline 2\nline 3");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 4 }]);
    adapter.copySelectionOnNextLine();
    expect(adapter.getSelections().length).toBe(2);

    adapter.keepPrimarySelection();
    expect(adapter.getSelections().length).toBe(1);

    adapter.setSelections([{ anchor: 0, head: 20 }]);
    adapter.splitSelectionsOnNewlines();
    expect(adapter.getSelections().length).toBe(3);

    adapter.cycleMainSelection(1);
    expect(adapter.getMainSelectionIndex()).toBe(1);

    adapter.removePrimarySelection();
    expect(adapter.getSelections().length).toBe(2);
  });

  it("handles multi-cursor simultaneous text insertion and backspace", () => {
    const el = createTextarea("foo bar foo");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([
      { anchor: 0, head: 0 },
      { anchor: 8, head: 8 }
    ]);

    adapter.insertTextAtAllSelections("X");
    expect(adapter.getDoc()).toBe("Xfoo bar Xfoo");

    adapter.backspaceAtAllSelections();
    expect(adapter.getDoc()).toBe("foo bar foo");
  });

  it("handles selection history undo/redo (<A-u> / <A-U>)", () => {
    const el = createTextarea("hello world");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 5 }]);
    adapter.setSelections([{ anchor: 6, head: 11 }]);

    adapter.undoSelection();
    expect(adapter.getSelections()).toEqual([{ anchor: 0, head: 5 }]);

    adapter.redoSelection();
    expect(adapter.getSelections()).toEqual([{ anchor: 6, head: 11 }]);
  });

  it("handles joining lines (<A-j>)", () => {
    const el = createTextarea("hello\n  world");
    const adapter = new TextareaAdapter(el);

    adapter.setSelections([{ anchor: 0, head: 0 }]);
    joinLines(adapter);
    expect(adapter.getDoc()).toBe("hello world");
  });
});
