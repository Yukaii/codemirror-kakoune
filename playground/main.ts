import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { kakoune, kakouneStateField } from "../src/index";
import "./style.css";

const editorElement = document.querySelector<HTMLDivElement>("#editor");
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const registerPill = document.querySelector<HTMLElement>("#register-pill");

if (!editorElement || !modePill || !registerPill) {
  throw new Error("Playground shell is missing required DOM nodes.");
}

const updateStatus = (view: EditorView): void => {
  const state = view.state.field(kakouneStateField);
  modePill.textContent = state.mode;
  registerPill.textContent = state.register ? JSON.stringify(state.register) : '""';
};

const view = new EditorView({
  state: EditorState.create({
    doc: [
      "fn main() {",
      "  println!(\"Hello from CodeMirror Kakoune\");",
      "}",
      "",
      "This playground is wired for fast iteration on keymaps and selection behavior."
    ].join("\n"),
    extensions: [
      basicSetup,
      kakoune(),
      EditorView.updateListener.of(update => {
        if (update.transactions.length > 0) {
          updateStatus(update.view);
        }
      })
    ]
  }),
  parent: editorElement
});

updateStatus(view);
