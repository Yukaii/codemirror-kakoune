import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  buildKakouneCommands,
  kakoune,
  kakouneStateField,
  normalizeKeyStroke
} from "../src";
import { getSearchQuery } from "@codemirror/search";
import { KakouneKeyProcessor } from "../src/keys";
import { handleSearchPromptKey } from "../src/commands";

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(0),
      extensions: [kakoune()]
    }),
    parent
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("normalizeKeyStroke", () => {
  it("normalizes common editing keys", () => {
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("<Esc>");
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: " " }))).toBe("<Space>");
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "w", ctrlKey: true }))).toBe(
      "<C-w>"
    );
  });
});

describe("KakouneKeyProcessor", () => {
  it("tracks prefixes and executes complete sequences", () => {
    const view = createView("hello\nworld");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "g", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("supports select-all and clearing extra selections", () => {
    const view = createView("alpha beta beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    expect(processor.handle("select", "%", view)).toBe(true);
    expect(view.state.selection.ranges).toHaveLength(1);
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(view.state.doc.length);

    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.cursor(1),
        EditorSelection.cursor(6)
      ])
    });

    expect(processor.handle("select", ",", view)).toBe(true);
    expect(view.state.selection.ranges).toHaveLength(1);
    expect(view.state.selection.main.head).toBe(1);
  });

  it("preserves selection direction when selecting a line with x", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(8, 3) });

    expect(processor.handle("select", "x", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(view.state.doc.lineAt(8).to);
    expect(view.state.selection.main.head).toBe(view.state.doc.lineAt(8).from);
  });

  it("does not keep extending line selection when x is repeated", () => {
    const view = createView("alpha beta\ngamma delta\nthird line");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(3) });

    expect(processor.handle("select", "x", view)).toBe(true);
    const first = view.state.selection.main;
    expect(first.head).toBe(view.state.doc.lineAt(3).to);
    expect(processor.handle("select", "x", view)).toBe(true);
    const second = view.state.selection.main;

    expect(second.anchor).toBe(first.anchor);
    expect(second.head).toBe(first.head);
  });

  it("keeps an empty line in the x selection range", () => {
    const view = createView("alpha beta\n\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    const firstLine = view.state.doc.line(1);
    const emptyLine = view.state.doc.line(2);
    view.dispatch({ selection: EditorSelection.range(firstLine.from, emptyLine.from) });

    expect(processor.handle("select", "x", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(firstLine.from);
    expect(view.state.selection.main.head).toBe(emptyLine.to);
  });

  it("keeps the original line when x is repeated after extending down with J", () => {
    const view = createView("}\n\nnext");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    expect(processor.handle("select", "x", view)).toBe(true);
    const first = view.state.selection.main;

    expect(processor.handle("select", "J", view)).toBe(true);
    expect(processor.handle("select", "x", view)).toBe(true);

    expect(view.state.selection.main.anchor).toBe(first.anchor);
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(view.state.doc.line(2).to);
  });

  it("supports line begin and line end motions through gh and gl", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(8) });
    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "h", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "l", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(10);
  });

  it("supports goto top and bottom aliases through gk and gj", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(8) });

    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "k", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "j", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(view.state.doc.line(view.state.doc.lines).from);
  });

  it("supports Kakoune's Alt-h and Alt-l aliases for line begin and end", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(8) });

    expect(processor.handle("select", "<A-h>", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "<A-l>", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(10);
  });

  it("uses select-mode G motions for boundaries", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(8) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "h", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "l", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(10);

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "k", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "j", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it("extends to the top with Gg and GG", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(8) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "g", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(0);

    view.dispatch({ selection: EditorSelection.cursor(8) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "G", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(8);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("extends selections with uppercase motion keys", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(6) });

    expect(processor.handle("select", "H", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(5);

    expect(processor.handle("select", "L", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(6);

    expect(processor.handle("select", "W", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBeGreaterThan(6);
  });

  it("extends the current selection to the top with GG", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(6) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(6);

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("waits for a follow-up motion after G and extends with G-prefixed motions", () => {
    const view = createView("abcd\nefgh");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(6) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(6);

    expect(processor.handle("select", "l", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(view.state.doc.lineAt(6).to);

    view.dispatch({ selection: EditorSelection.cursor(6) });

    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "k", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("can seed search from the current selection and jump to the next match", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(6, 10) });

    expect(processor.handle("select", "*", view)).toBe(true);
    expect(getSearchQuery(view.state).search).toBe("beta");

    expect(processor.handle("select", "s", view)).toBe(true);
    expect(view.state.field(kakouneStateField).searchPrompt).toBe("");
    for (const key of "beta") {
      expect(handleSearchPromptKey(view, key)).toBe(true);
    }
    expect(view.state.selection.main.from).toBe(6);
    expect(view.state.selection.main.to).toBe(10);
    expect(handleSearchPromptKey(view, "<Enter>")).toBe(true);
    expect(view.state.selection.main.from).toBe(17);
    expect(view.state.selection.main.to).toBe(21);

    expect(processor.handle("select", "n", view)).toBe(true);
    expect(view.state.selection.main.from).toBe(6);
    expect(view.state.selection.main.to).toBe(10);
  });

  it("adds a new selection for the next match", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(6, 10) });
    expect(processor.handle("select", "*", view)).toBe(true);
    expect(processor.handle("select", "N", view)).toBe(true);

    expect(view.state.selection.ranges).toHaveLength(2);
    expect(view.state.selection.ranges[0].from).toBe(6);
    expect(view.state.selection.ranges[1].from).toBe(17);
  });

  it("rotates selections forward and backward", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({
      selection: EditorSelection.create(
        [EditorSelection.cursor(0), EditorSelection.cursor(6), EditorSelection.cursor(12)],
        0
      )
    });

    expect(processor.handle("select", ")", view)).toBe(true);
    expect(view.state.selection.mainIndex).toBe(1);
    expect(view.state.selection.main.head).toBe(6);

    expect(processor.handle("select", "(", view)).toBe(true);
    expect(view.state.selection.mainIndex).toBe(0);
    expect(view.state.selection.main.head).toBe(0);
  });
});

describe("kakoune extension", () => {
  it("switches between select and insert mode", () => {
    const view = createView("hello");

    expect(view.state.field(kakouneStateField).mode).toBe("select");

    view.dispatch({ selection: EditorSelection.cursor(0) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));

    expect(view.state.field(kakouneStateField).mode).toBe("insert");
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(view.state.field(kakouneStateField).mode).toBe("select");

    view.destroy();
  });

  it("opens a new line below with o and above with O", () => {
    const view = createView("alpha\nbeta");

    view.dispatch({ selection: EditorSelection.cursor(6) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "o", bubbles: true }));

    expect(view.state.doc.toString()).toBe("alpha\nbeta\n");
    expect(view.state.field(kakouneStateField).mode).toBe("insert");
    expect(view.state.selection.main.head).toBe(view.state.doc.length);

    view.dispatch({ selection: EditorSelection.cursor(6) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "O", bubbles: true }));

    expect(view.state.doc.toString()).toBe("alpha\n\nbeta\n");
    expect(view.state.field(kakouneStateField).mode).toBe("insert");
    expect(view.state.selection.main.head).toBe(6);

    view.destroy();
  });

  it("accepts a search prompt on s and keeps n/Alt-n navigation working", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });
    expect(processor.handle("select", "s", view)).toBe(true);
    expect(view.state.field(kakouneStateField).searchPrompt).toBe("");

    for (const key of "beta") {
      expect(handleSearchPromptKey(view, key)).toBe(true);
    }

    expect(
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      )
    ).toBe(false);
    expect(view.state.field(kakouneStateField).searchPrompt).toBeNull();
    expect(getSearchQuery(view.state).search).toBe("beta");
    expect(view.state.doc.toString()).toBe("alpha beta gamma beta");
    expect(view.state.selection.main.from).toBe(6);
    expect(view.state.selection.main.to).toBe(10);

    expect(processor.handle("select", "n", view)).toBe(true);
    expect(view.state.selection.main.from).toBe(17);
    expect(view.state.selection.main.to).toBe(21);

    expect(processor.handle("select", "<A-n>", view)).toBe(true);
    expect(view.state.selection.main.from).toBe(6);
    expect(view.state.selection.main.to).toBe(10);

    view.destroy();
  });

  it("deletes characters in the search prompt on Backspace", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });
    expect(processor.handle("select", "s", view)).toBe(true);
    expect(view.state.field(kakouneStateField).searchPrompt).toBe("");

    for (const key of "beta") {
      expect(handleSearchPromptKey(view, key)).toBe(true);
    }
    expect(view.state.field(kakouneStateField).searchPrompt).toBe("beta");

    const event = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    expect(view.contentDOM.dispatchEvent(event)).toBe(false);

    expect(view.state.field(kakouneStateField).searchPrompt).toBe("bet");
    expect(view.state.doc.toString()).toBe("alpha beta gamma beta");

    view.destroy();
  });

  it("cancels the search prompt on Escape", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });
    expect(processor.handle("select", "s", view)).toBe(true);

    for (const key of "beta") {
      expect(handleSearchPromptKey(view, key)).toBe(true);
    }
    expect(view.state.field(kakouneStateField).searchPrompt).toBe("beta");

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    expect(view.contentDOM.dispatchEvent(event)).toBe(false);

    expect(view.state.field(kakouneStateField).searchPrompt).toBeNull();
    expect(view.state.doc.toString()).toBe("alpha beta gamma beta");

    view.destroy();
  });

  it("yanks, deletes, and pastes the current selection", () => {
    const view = createView("alpha\nbeta");

    view.dispatch({ selection: EditorSelection.range(0, 5) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "y", bubbles: true }));
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));

    expect(view.state.doc.toString()).toBe("\nbeta");

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(view.state.doc.toString()).toContain("alpha");

    view.destroy();
  });

  it("supports redo with U after undo", () => {
    const view = createView("alpha");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(0, 5) });
    expect(processor.handle("select", "d", view)).toBe(true);
    expect(view.state.doc.toString()).toBe("");

    expect(processor.handle("select", "u", view)).toBe(true);
    expect(view.state.doc.toString()).toBe("alpha");

    expect(processor.handle("select", "U", view)).toBe(true);
    expect(view.state.doc.toString()).toBe("");

    view.destroy();
  });

  it("flips selection direction on <A-;>", () => {
    const view = createView("hello world");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(0, 5) });
    expect(view.state.selection.main.anchor).toBe(0);
    expect(view.state.selection.main.head).toBe(5);

    expect(processor.handle("select", "<A-;>", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(0);

    view.destroy();
  });

  it("supports jumping to whole surrounding object starts/ends with [ and ]", () => {
    const view = createView("if (x > 0) { return [1, 2]; }");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(24) });

    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(20);

    view.dispatch({ selection: EditorSelection.cursor(24) });

    expect(processor.handle("select", "]", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(26);

    view.dispatch({ selection: EditorSelection.cursor(24) });
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "{", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(11);

    view.destroy();
  });

  it("supports extending selections to surrounding objects with { and }", () => {
    const view = createView("if (x > 0) { return [1, 2]; }");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(24) });

    expect(processor.handle("select", "{", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(24);
    expect(view.state.selection.main.head).toBe(20);

    view.destroy();
  });

  it("supports inner object boundaries using Alt versions", () => {
    const view = createView("if (x > 0) { return [1, 2]; }");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(24) });

    expect(processor.handle("select", "<A-[>", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(21);

    view.dispatch({ selection: EditorSelection.cursor(24) });
    expect(processor.handle("select", "<A-]>", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(25);

    view.destroy();
  });

  it("invokes the onWhichKey hook on keydown and lists matching prefix bindings", () => {
    const mockCallback = jest.fn();
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello world",
        selection: EditorSelection.cursor(0),
        extensions: [kakoune({ onWhichKey: mockCallback })]
      }),
      parent
    });

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));

    expect(mockCallback).toHaveBeenCalled();
    const lastCall = mockCallback.mock.calls[mockCallback.mock.calls.length - 1];
    expect(lastCall[0]).toEqual(["g"]);
    expect(lastCall[2]).toBe(false);
    expect(lastCall[1].length).toBeGreaterThan(0);
    for (const item of lastCall[1]) {
      expect(item.keys[0]).toBe("g");
      expect(item.description).toBeDefined();
    }

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));
    const finalCall = mockCallback.mock.calls[mockCallback.mock.calls.length - 1];
    expect(finalCall[0]).toEqual([]);
    expect(finalCall[1]).toEqual([]);
    expect(finalCall[2]).toBe(false);

    view.destroy();
  });

  it("supports quote strings, words, and other boundaries", () => {
    const view = createView('const text = "hello" + \'world\' + `test`;');
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Cursor inside double quotes: at character 'e' (index 15)
    view.dispatch({ selection: EditorSelection.cursor(15) });
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "Q", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(13); // opening quote is at index 13

    // Inner double quote
    view.dispatch({ selection: EditorSelection.cursor(15) });
    expect(processor.handle("select", "<A-[>", view)).toBe(true);
    expect(processor.handle("select", "\"", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(14); // character 'h' at 14

    // Word boundaries
    // Cursor at 't' in const (index 4)
    view.dispatch({ selection: EditorSelection.cursor(4) });
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "w", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0); // start of word 'const'

    view.destroy();
  });

  it("resolves Option/Alt keyboard events to base keys on macOS", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: "hello world",
        selection: EditorSelection.range(0, 5),
        extensions: [kakoune()]
      }),
      parent
    });

    const event = new KeyboardEvent("keydown", {
      key: "…",
      code: "Semicolon",
      altKey: true,
      bubbles: true,
      cancelable: true
    });
    view.contentDOM.dispatchEvent(event);

    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(0);

    view.destroy();
  });

  it("supports paragraphs boundaries", () => {
    const view = createView("para one\n\npara two\n\npara three");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Cursor inside "para two" (index 15)
    // "para one\n\npara two\n\npara three"
    // 01234567 8 9 01234567 8 9 0123456789
    //             para two starts at 10
    view.dispatch({ selection: EditorSelection.cursor(15) });

    // Select to paragraph start: `[` then `p`
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "p", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(10); // Start of "para two"

    // Press `[` then `p` again: should jump to previous paragraph start (index 0)
    expect(processor.handle("select", "[", view)).toBe(true);
    expect(processor.handle("select", "p", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0); // Start of "para one"

    // Select to paragraph end: `]` then `p`
    view.dispatch({ selection: EditorSelection.cursor(15) });
    expect(processor.handle("select", "]", view)).toBe(true);
    expect(processor.handle("select", "p", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(18); // End of "para two" (after 'o', before '\n')

    // Press `]` then `p` again: should jump to next paragraph end (index 30)
    expect(processor.handle("select", "]", view)).toBe(true);
    expect(processor.handle("select", "p", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(30); // End of "para three"

    view.destroy();
  });
});
