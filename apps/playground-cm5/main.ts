import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import { kakoune } from "codemirror-kakoune-cm5";
import "./style.css";

const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
if (!textarea) throw new Error("CM5 playground editor is missing.");

const editor = CodeMirror.fromTextArea(textarea, {
  lineNumbers: true,
  mode: "text/plain",
  viewportMargin: Infinity
});
kakoune(editor);

editor.on("cursorActivity", cm => {
  cm.getWrapperElement().dataset.kakouneMode = cm.getOption("keyMap") === "kakoune" ? "select" : "insert";
});
