import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  buildKakouneCommands,
  kakoune,
  kakouneStateField,
  normalizeKeyStroke
} from "../src";
import { KakouneKeyProcessor } from "../src/keys";

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

    expect(processor.handle("normal", "g", view)).toBe(true);
    expect(processor.handle("normal", "g", view)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("supports find motions and repetition", () => {
    const view = createView("alpha beta beta");
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    expect(processor.handle("normal", "f", view)).toBe(true);
    expect(processor.handle("normal", "b", view)).toBe(true);

    const firstPosition = view.state.selection.main.head;
    expect(firstPosition).toBeGreaterThan(0);

    expect(processor.handle("normal", ";", view)).toBe(true);
    expect(view.state.selection.main.head).not.toBe(firstPosition);
  });
});

describe("kakoune extension", () => {
  it("switches between normal and insert mode", () => {
    const view = createView("hello");

    expect(view.state.field(kakouneStateField).mode).toBe("normal");

    view.dispatch({ selection: EditorSelection.cursor(0) });
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));

    expect(view.state.field(kakouneStateField).mode).toBe("insert");
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(view.state.field(kakouneStateField).mode).toBe("normal");

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
});
