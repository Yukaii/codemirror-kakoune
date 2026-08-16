import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  buildKakouneCommands,
  kakoune,
  kakouneStateField,
  normalizeKeyStroke,
  normalizeCm5Key,
  normalizeCm5Keys
} from "../src";
import { getSearchQuery } from "@codemirror/search";
import { KakouneKeyProcessor } from "../src/keys";
import { handleSearchPromptKey, handleSelectPromptKey, handleSplitPromptKey } from "../src/commands";

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

  it("resolves dead keys with Alt modifier to base key (macOS)", () => {
    // On macOS, Alt+i produces a circumflex dead key
    const event = new KeyboardEvent("keydown", {
      key: "Dead",
      code: "KeyI",
      altKey: true
    });
    expect(normalizeKeyStroke(event)).toBe("<A-i>");
  });

  it("returns null for dead keys without modifiers", () => {
    const event = new KeyboardEvent("keydown", {
      key: "Dead",
      code: "KeyE"
    });
    expect(normalizeKeyStroke(event)).toBeNull();
  });

  it("maps Ctrl+[ to Escape (Vim/Kakoune convention)", () => {
    const event = new KeyboardEvent("keydown", {
      key: "[",
      code: "BracketLeft",
      ctrlKey: true
    });
    expect(normalizeKeyStroke(event)).toBe("<Esc>");
  });

  it("does not map Ctrl+Shift+[ to Escape", () => {
    const event = new KeyboardEvent("keydown", {
      key: "{",
      code: "BracketLeft",
      ctrlKey: true,
      shiftKey: true
    });
    expect(normalizeKeyStroke(event)).toBe("<C-{>");
  });

  it("maps Ctrl+I to the Kakoune jump-forward key", () => {
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      ctrlKey: true
    });
    expect(normalizeKeyStroke(event)).toBe("<C-Tab>");
  });
});

describe("normalizeCm5Key", () => {
  it("converts CM5 modifier and named-key notation", () => {
    expect(normalizeCm5Key("Ctrl-X")).toBe("<C-x>");
    expect(normalizeCm5Key("Cmd-S")).toBe("<M-s>");
    expect(normalizeCm5Key("Alt-Shift-F")).toBe("<A-S-f>");
    expect(normalizeCm5Key("Space")).toBe("<Space>");
    expect(normalizeCm5Key("Ctrl-[")).toBe("<Esc>");
  });

  it("converts CM5 sequences", () => {
    expect(normalizeCm5Keys("g g")).toEqual(["g", "g"]);
    expect(normalizeCm5Keys(["Ctrl-X", "Ctrl-S"])).toEqual(["<C-x>", "<C-s>"]);
  });
});

describe("KakouneKeyProcessor", () => {
  it("renders a drawn cursor for a zero-width selection", () => {
    const view = createView("hello");

    expect(view.state.selection.main.empty).toBe(true);
    expect(view.dom.querySelector(".cm-cursorLayer")).not.toBeNull();
  });

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
    // In Kakoune, `x` expands to full line including newline
    expect(view.state.selection.main.anchor).toBe(view.state.doc.lineAt(8).to + 1);
    expect(view.state.selection.main.head).toBe(view.state.doc.lineAt(8).from);
  });

  it("expands line selection to next line when x is repeated", () => {
    const view = createView("alpha beta\ngamma delta\nthird line");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(3) });

    expect(processor.handle("select", "x", view)).toBe(true);
    const first = view.state.selection.main;
    // In Kakoune, `x` expands to full line including newline
    expect(first.head).toBe(view.state.doc.lineAt(3).to + 1);
    expect(processor.handle("select", "x", view)).toBe(true);
    const second = view.state.selection.main;

    expect(second.anchor).toBe(first.anchor);
    expect(second.head).toBe(view.state.doc.line(2).to + 1);
  });

  it("highlights only text for linewise and characterwise multiline selections", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    expect(processor.handle("select", "x", view)).toBe(true);

    const highlights = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".cm-kakoune-selection")
    );
    expect(highlights.map(highlight => highlight.textContent)).toEqual(["alpha beta"]);
    expect(view.dom.classList.contains("cm-line-selection")).toBe(true);

    view.dispatch({ selection: EditorSelection.cursor(2) });
    expect(processor.handle("select", "G", view)).toBe(true);
    expect(processor.handle("select", "j", view)).toBe(true);

    const multilineHighlights = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".cm-kakoune-selection")
    );
    expect(multilineHighlights.map(highlight => highlight.textContent).join(""))
      .toBe("pha betagamma delta");
    expect(view.dom.classList.contains("cm-line-selection")).toBe(false);
  });

  it("keeps an empty line in the x selection range", () => {
    const view = createView("alpha beta\n\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    const firstLine = view.state.doc.line(1);
    const emptyLine = view.state.doc.line(2);
    view.dispatch({ selection: EditorSelection.range(firstLine.from, emptyLine.from) });

    expect(processor.handle("select", "x", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(firstLine.from);
    expect(view.state.selection.main.head).toBe(emptyLine.to + 1);
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
    expect(view.state.selection.main.to).toBe(view.state.doc.line(3).to);
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

  it("records document jumps so Ctrl-o can return to the previous selection", () => {
    const view = createView("alpha beta\ngamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(15) });
    expect(processor.handle("select", "g", view)).toBe(true);
    expect(processor.handle("select", "k", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);

    expect(processor.handle("select", "<C-o>", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(15);
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

    expect(processor.handle("select", "/", view)).toBe(true);
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

  it("preserves the main selection when portable motions update multiple selections", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({
      selection: EditorSelection.create(
        [EditorSelection.cursor(0), EditorSelection.cursor(6)],
        1
      )
    });

    expect(processor.handle("select", "l", view)).toBe(true);
    expect(view.state.selection.mainIndex).toBe(1);
    expect(view.state.selection.main.head).toBe(7);
  });

  it("enters insert mode at the end of a non-empty selection with a", () => {
    const view = createView("alpha beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.range(6, 2) });

    expect(processor.handle("select", "a", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(6);
    expect(view.state.field(kakouneStateField).mode).toBe("insert");
  });

  it("creates selection on w, b, e motions", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Press 'w' -> moves over "alpha "
    expect(processor.handle("select", "w", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(0);
    expect(view.state.selection.main.head).toBe(6); // 'b' of "beta"

    // Press 'w' again -> moves over "beta "
    expect(processor.handle("select", "w", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(11); // 'g' of "gamma"

    // Press 'b' -> moves back over "beta "
    expect(processor.handle("select", "b", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(11);
    expect(view.state.selection.main.head).toBe(6); // 'b' of "beta"

    // Reset to cursor(0)
    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Press 'e' -> moves to end of "alpha"
    expect(processor.handle("select", "e", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(0);
    expect(view.state.selection.main.head).toBe(5); // space after "alpha"

    // Press 'e' again -> moves to end of "beta"
    expect(processor.handle("select", "e", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(10); // space after "beta"

    // Test punctuation handling
    const viewPunct = createView("hello...world");
    const procPunct = new KakouneKeyProcessor(buildKakouneCommands());
    viewPunct.dispatch({ selection: EditorSelection.cursor(0) });

    // Press 'w' -> should stop at '.'
    expect(procPunct.handle("select", "w", viewPunct)).toBe(true);
    expect(viewPunct.state.selection.main.anchor).toBe(0);
    expect(viewPunct.state.selection.main.head).toBe(5); // start of "..."

    // Press 'w' again -> should stop at 'w'
    expect(procPunct.handle("select", "w", viewPunct)).toBe(true);
    expect(viewPunct.state.selection.main.anchor).toBe(5);
    expect(viewPunct.state.selection.main.head).toBe(8); // start of "world"

    // Test starting on whitespace
    const viewSpace = createView("hello   world");
    const procSpace = new KakouneKeyProcessor(buildKakouneCommands());
    
    // Start cursor at the first space (pos 5)
    viewSpace.dispatch({ selection: EditorSelection.cursor(5) });
    expect(procSpace.handle("select", "w", viewSpace)).toBe(true);
    expect(viewSpace.state.selection.main.anchor).toBe(8); // skips space
    expect(viewSpace.state.selection.main.head).toBe(13); // end of "world"

    // Test backward movement from start of word (pos 8)
    viewSpace.dispatch({ selection: EditorSelection.cursor(8) });
    expect(procSpace.handle("select", "b", viewSpace)).toBe(true);
    expect(viewSpace.state.selection.main.anchor).toBe(8);
    expect(viewSpace.state.selection.main.head).toBe(0); // start of "hello"

    // Test end of word starting on whitespace (pos 5)
    viewSpace.dispatch({ selection: EditorSelection.cursor(5) });
    expect(procSpace.handle("select", "e", viewSpace)).toBe(true);
    expect(viewSpace.state.selection.main.anchor).toBe(5);
    expect(viewSpace.state.selection.main.head).toBe(13); // end of "world"

    // Test jump from } with w to // over empty lines
    const viewSlash = createView("}\n\n// Kakoune");
    const procSlash = new KakouneKeyProcessor(buildKakouneCommands());
    viewSlash.dispatch({ selection: EditorSelection.cursor(0) }); // cursor on }

    expect(procSlash.handle("select", "w", viewSlash)).toBe(true);
    expect(viewSlash.state.selection.main.anchor).toBe(3); // start of "//"
    expect(viewSlash.state.selection.main.head).toBe(6); // end of "// "
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

  it("accepts a search prompt on / and keeps n/Alt-n navigation working", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });
    expect(processor.handle("select", "/", view)).toBe(true);
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
    expect(processor.handle("select", "/", view)).toBe(true);
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
    expect(processor.handle("select", "/", view)).toBe(true);

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

  it("selects regex matches within selection using s", () => {
    const view = createView("alpha beta gamma beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Select entire buffer
    expect(processor.handle("select", "%", view)).toBe(true);
    expect(
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "s", bubbles: true, cancelable: true })
      )
    ).toBe(false);
    expect(view.state.field(kakouneStateField).selectPrompt).toBe("");

    for (const key of "beta") {
      expect(handleSelectPromptKey(view, key)).toBe(true);
    }
    expect(view.state.field(kakouneStateField).selectPrompt).toBe("beta");

    expect(
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      )
    ).toBe(false);

    expect(view.state.field(kakouneStateField).selectPrompt).toBeNull();
    expect(view.state.selection.ranges).toHaveLength(2);
    expect(view.state.selection.ranges[0].from).toBe(6);
    expect(view.state.selection.ranges[0].to).toBe(10);
    expect(view.state.selection.ranges[1].from).toBe(17);
    expect(view.state.selection.ranges[1].to).toBe(21);

    view.destroy();
  });

  it("splits selection on regex matches using S", () => {
    const view = createView("foo bar baz");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Select all
    expect(processor.handle("select", "%", view)).toBe(true);
    expect(
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "S", shiftKey: true, bubbles: true, cancelable: true })
      )
    ).toBe(false);
    expect(view.state.field(kakouneStateField).splitPrompt).toBe("");

    for (const key of "\\s+") {
      expect(handleSplitPromptKey(view, key)).toBe(true);
    }
    expect(view.state.field(kakouneStateField).splitPrompt).toBe("\\s+");

    expect(
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      )
    ).toBe(false);

    expect(view.state.field(kakouneStateField).splitPrompt).toBeNull();
    expect(view.state.selection.ranges).toHaveLength(3);
    expect(view.state.sliceDoc(view.state.selection.ranges[0].from, view.state.selection.ranges[0].to)).toBe("foo");
    expect(view.state.sliceDoc(view.state.selection.ranges[1].from, view.state.selection.ranges[1].to)).toBe("bar");
    expect(view.state.sliceDoc(view.state.selection.ranges[2].from, view.state.selection.ranges[2].to)).toBe("baz");

    view.destroy();
  });

  it("handles backspace and cancel on select and split prompts", () => {
    const view = createView("alpha beta gamma");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    expect(processor.handle("select", "s", view)).toBe(true);
    handleSelectPromptKey(view, "a");
    handleSelectPromptKey(view, "b");
    expect(view.state.field(kakouneStateField).selectPrompt).toBe("ab");

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    expect(view.state.field(kakouneStateField).selectPrompt).toBe("a");

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(view.state.field(kakouneStateField).selectPrompt).toBeNull();

    expect(processor.handle("select", "S", view)).toBe(true);
    handleSplitPromptKey(view, "x");
    handleSplitPromptKey(view, "y");
    expect(view.state.field(kakouneStateField).splitPrompt).toBe("xy");

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    expect(view.state.field(kakouneStateField).splitPrompt).toBe("x");

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(view.state.field(kakouneStateField).splitPrompt).toBeNull();

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

  it("selects inner surrounding object with <A-i>", () => {
    const view = createView("if (x > 0) { return [1, 2]; }");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Cursor at position 24 (inside [1, 2])
    view.dispatch({ selection: EditorSelection.cursor(24) });

    // <A-i> then [ -> select inner brackets content
    expect(processor.handle("select", "<A-i>", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    // Inner of [...] should be "1, 2" (positions 21-25)
    expect(view.state.selection.main.from).toBe(21);
    expect(view.state.selection.main.to).toBe(25);

    view.destroy();
  });

  it("selects whole surrounding object with <A-a>", () => {
    const view = createView("if (x > 0) { return [1, 2]; }");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Cursor at position 24 (inside [1, 2])
    view.dispatch({ selection: EditorSelection.cursor(24) });

    // <A-a> then [ -> select entire brackets including delimiters
    expect(processor.handle("select", "<A-a>", view)).toBe(true);
    expect(processor.handle("select", "[", view)).toBe(true);
    // Whole [1, 2] includes brackets (positions 20-26)
    expect(view.state.selection.main.from).toBe(20);
    expect(view.state.selection.main.to).toBe(26);

    view.destroy();
  });

  it("selects inner surrounding quotes with <A-i>", () => {
    const view = createView('const x = "hello world";');
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    // Cursor inside "hello world" at position 14
    view.dispatch({ selection: EditorSelection.cursor(14) });

    expect(processor.handle("select", "<A-i>", view)).toBe(true);
    expect(processor.handle("select", "Q", view)).toBe(true);
    // Inner of "hello world" -> positions 11-22
    expect(view.state.selection.main.from).toBe(11);
    expect(view.state.selection.main.to).toBe(22);

    view.destroy();
  });

  it("supports count-prefixed h/l movements", () => {
    const view = createView("hello world");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(5) });

    // Type 3l -> move right 3 characters
    expect(processor.handle("select", "3", view)).toBe(true);
    expect(processor.handle("select", "l", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(8);

    // Type 2h -> move left 2 characters
    expect(processor.handle("select", "2", view)).toBe(true);
    expect(processor.handle("select", "h", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(6);

    view.destroy();
  });

  it("supports count-prefixed j/k movements", () => {
    const view = createView("line one\nline two\nline three\nline four");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Type 2j -> move down 2 lines
    expect(processor.handle("select", "2", view)).toBe(true);
    expect(processor.handle("select", "j", view)).toBe(true);
    const line3 = view.state.doc.line(3);
    expect(view.state.selection.main.head).toBe(line3.from);

    // Type 1k -> move up 1 line
    expect(processor.handle("select", "1", view)).toBe(true);
    expect(processor.handle("select", "k", view)).toBe(true);
    const line2 = view.state.doc.line(2);
    expect(view.state.selection.main.head).toBe(line2.from);

    view.destroy();
  });

  it("supports count-prefixed w movements", () => {
    const view = createView("alpha beta gamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Type 2w -> move forward 2 words
    expect(processor.handle("select", "2", view)).toBe(true);
    expect(processor.handle("select", "w", view)).toBe(true);
    // After 2w from "alpha", should be at "gamma" (pos 11)
    expect(view.state.selection.main.head).toBe(11);

    view.destroy();
  });

  it("supports count+g to jump to a specific line", () => {
    const view = createView("line one\nline two\nline three\nline four");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Type 3g -> jump to line 3
    expect(processor.handle("select", "3", view)).toBe(true);
    expect(processor.handle("select", "g", view)).toBe(true);
    const line3 = view.state.doc.line(3);
    expect(view.state.selection.main.head).toBe(line3.from);

    view.destroy();
  });

  it("supports count+G to extend selection to a specific line", () => {
    const view = createView("line one\nline two\nline three\nline four");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(5) });

    // Type 3G -> extend to line 3
    expect(processor.handle("select", "3", view)).toBe(true);
    expect(processor.handle("select", "G", view)).toBe(true);
    const line3 = view.state.doc.line(3);
    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(line3.from);

    view.destroy();
  });

  it("falls through to g prefix menu when no count is active", () => {
    const view = createView("line one\nline two\nline three");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(15) });

    // Type g without count -> should buffer as prefix
    expect(processor.handle("select", "g", view)).toBe(true);
    // Then type h -> should go to line begin
    expect(processor.handle("select", "h", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from);

    view.destroy();
  });

  it("supports count-prefixed extend movements (uppercase)", () => {
    const view = createView("alpha beta gamma delta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    view.dispatch({ selection: EditorSelection.cursor(0) });

    // Type 3L -> extend right 3
    expect(processor.handle("select", "3", view)).toBe(true);
    expect(processor.handle("select", "L", view)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(0);
    expect(view.state.selection.main.head).toBe(3);

    view.destroy();
  });

  it("swallows Enter and Backspace in select mode", () => {
    const view = createView("alpha beta");

    view.dispatch({ selection: EditorSelection.cursor(5) });
    expect(view.state.field(kakouneStateField).mode).toBe("select");

    const initialDoc = view.state.doc.toString();
    const initialHead = view.state.selection.main.head;

    const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    expect(view.contentDOM.dispatchEvent(enterEvent)).toBe(false);
    expect(view.state.doc.toString()).toBe(initialDoc);
    expect(view.state.selection.main.head).toBe(initialHead);

    const backspaceEvent = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    expect(view.contentDOM.dispatchEvent(backspaceEvent)).toBe(false);
    expect(view.state.doc.toString()).toBe(initialDoc);
    expect(view.state.selection.main.head).toBe(initialHead);

    view.destroy();
  });

  it("allows Enter in insert mode", () => {
    const view = createView("alpha beta");

    view.dispatch({ selection: EditorSelection.cursor(5) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    expect(view.state.field(kakouneStateField).mode).toBe("insert");

    const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    expect(view.contentDOM.dispatchEvent(enterEvent)).toBe(true);

    view.destroy();
  });

  it("ignores bare modifier keys so they don't reset pending prefixes", () => {
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Shift" }))).toBeNull();
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Control" }))).toBeNull();
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Alt" }))).toBeNull();
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Meta" }))).toBeNull();
    expect(normalizeKeyStroke(new KeyboardEvent("keydown", { key: "CapsLock" }))).toBeNull();

    // Modifier combos with other modifiers should also be ignored
    expect(
      normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Shift", altKey: true }))
    ).toBeNull();
    expect(
      normalizeKeyStroke(new KeyboardEvent("keydown", { key: "Shift", ctrlKey: true }))
    ).toBeNull();
  });

  it("preserves <A-i> prefix through a Shift key and selects inner quotes", () => {
    const view = createView('const x = "hello";');

    // Cursor inside "hello" at position 14 (on second 'l')
    view.dispatch({ selection: EditorSelection.cursor(14) });

    // Press Alt+i
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: "i", altKey: true, bubbles: true })
    );

    // Press Shift (should NOT reset the pending <A-i> prefix)
    const shiftEvent = new KeyboardEvent("keydown", {
      key: "Shift",
      bubbles: true,
      cancelable: true
    });
    // Shift is not swallowed (it passes through), so dispatchEvent returns true
    expect(view.contentDOM.dispatchEvent(shiftEvent)).toBe(true);

    // Press " (with shift held) -> should trigger <A-i> " binding
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: '"', shiftKey: true, bubbles: true })
    );

    // Inner of "hello" -> positions 11-16 (without the quotes)
    expect(view.state.selection.main.from).toBe(11);
    expect(view.state.selection.main.to).toBe(16);

    view.destroy();
  });

  describe("character find motions and repeat (f/t/F/T and <A-.>)", () => {
    it("selects to next character with f (inclusive)", () => {
      const view = createView("hello world");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.cursor(0) });
      expect(processor.handle("select", "f", view)).toBe(true);
      expect(processor.isWaitingForChar()).toBe(true);
      expect(processor.handle("select", "o", view)).toBe(true);

      // 'o' is at pos 4, anchor = 0
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(4);

      view.destroy();
    });

    it("selects until next character with t (exclusive)", () => {
      const view = createView("hello world");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.cursor(0) });
      expect(processor.handle("select", "t", view)).toBe(true);
      expect(processor.handle("select", "o", view)).toBe(true);

      // Character before 'o' is second 'l' at pos 3
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(3);

      view.destroy();
    });

    it("extends to next character with F and T", () => {
      const view = createView("alpha beta gamma");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      // Initial selection covering "alpha" (0..5)
      view.dispatch({ selection: EditorSelection.range(0, 5) });

      // Extend to 'g' of gamma (pos 11)
      expect(processor.handle("select", "F", view)).toBe(true);
      expect(processor.handle("select", "g", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(11);

      // Extend until 'm' of gamma (pos 12)
      expect(processor.handle("select", "T", view)).toBe(true);
      expect(processor.handle("select", "m", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(12);

      view.destroy();
    });

    it("supports backward character find with <A-f> and <A-t>", () => {
      const view = createView("alpha beta gamma");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      // Cursor at pos 11 ('g')
      view.dispatch({ selection: EditorSelection.cursor(11) });

      // Select backward to 'b' of beta (pos 6)
      expect(processor.handle("select", "<A-f>", view)).toBe(true);
      expect(processor.handle("select", "b", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(11);
      expect(view.state.selection.main.head).toBe(6);

      // Select backward until 'a' at end of alpha (pos 4), so target is pos 5 (space)
      expect(processor.handle("select", "<A-t>", view)).toBe(true);
      expect(processor.handle("select", "a", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(6);
      expect(view.state.selection.main.head).toBe(5);

      view.destroy();
    });

    it("supports count prefix with character find", () => {
      const view = createView("banana");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.cursor(0) });
      // 2fa -> find 2nd 'a' (pos 3)
      expect(processor.handle("select", "2", view)).toBe(true);
      expect(processor.handle("select", "f", view)).toBe(true);
      expect(processor.handle("select", "a", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(3);

      view.destroy();
    });

    it("repeats last character find with <A-.>", () => {
      const view = createView("one two three two one");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.cursor(0) });

      // Find first 't' (pos 4)
      expect(processor.handle("select", "f", view)).toBe(true);
      expect(processor.handle("select", "t", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(0);
      expect(view.state.selection.main.head).toBe(4);

      // Repeat with <A-.> -> find next 't' (pos 8 in "three")
      expect(processor.handle("select", "<A-.>", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(4);
      expect(view.state.selection.main.head).toBe(8);

      // Repeat with <A-.> again -> find next 't' (pos 14 in second "two")
      expect(processor.handle("select", "<A-.>", view)).toBe(true);
      expect(view.state.selection.main.anchor).toBe(8);
      expect(view.state.selection.main.head).toBe(14);

      view.destroy();
    });

    it("repeats last object selection with <A-.>", () => {
      const view = createView("para one\n\npara two\n\npara three");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.cursor(0) });

      // Move to end of first paragraph (pos 8)
      expect(processor.handle("select", "]", view)).toBe(true);
      expect(processor.handle("select", "p", view)).toBe(true);
      expect(view.state.selection.main.head).toBe(8);

      // Repeat with <A-.> -> move to end of second paragraph (pos 18)
      expect(processor.handle("select", "<A-.>", view)).toBe(true);
      expect(view.state.selection.main.head).toBe(18);

      view.destroy();
    });

    it("duplicates selections on next lines with C", () => {
      const view = createView("line one\nline two\nline three");
      const processor = new KakouneKeyProcessor(buildKakouneCommands());

      view.dispatch({ selection: EditorSelection.range(0, 4) });
      expect(processor.handle("select", "C", view)).toBe(true);
      expect(view.state.selection.ranges.length).toBe(2);
      expect(view.state.selection.ranges[0].from).toBe(0);
      expect(view.state.selection.ranges[0].to).toBe(4);
      expect(view.state.selection.ranges[1].from).toBe(9);
      expect(view.state.selection.ranges[1].to).toBe(13);

      view.destroy();
    });
  });
});
