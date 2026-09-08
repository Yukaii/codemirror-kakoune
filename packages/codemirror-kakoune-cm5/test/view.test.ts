import CodeMirror from "codemirror";
import { kakoune } from "../src";

function createEditor(doc: string): CodeMirror.Editor {
  const textarea = document.createElement("textarea");
  textarea.value = doc;
  document.body.appendChild(textarea);
  const editor = CodeMirror.fromTextArea(textarea);
  kakoune(editor);
  return editor;
}

function dispatchKey(
  editor: CodeMirror.Editor,
  key: string,
  modifiers: Pick<KeyboardEventInit, "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
  editor.getInputField().dispatchEvent(event);
  return event;
}

function headOffset(editor: CodeMirror.Editor): number {
  const head = editor.getCursor("head");
  let offset = 0;
  for (let line = 0; line < head.line; line += 1) {
    offset += editor.getLine(line).length + 1;
  }
  return offset + head.ch;
}

const DOC = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");

afterEach(() => {
  document.body.innerHTML = "";
});

test("v c centers without moving selection or changing doc", () => {
  const editor = createEditor(DOC);
  editor.setCursor({ line: 49, ch: 2 });
  const before = headOffset(editor);
  expect(dispatchKey(editor, "v").defaultPrevented).toBe(true);
  expect(dispatchKey(editor, "c").defaultPrevented).toBe(true);
  expect(headOffset(editor)).toBe(before);
  expect(editor.getValue()).toBe(DOC);
});

test("v j preserves selection while v is a pending prefix", () => {
  const editor = createEditor(DOC);
  editor.setCursor({ line: 49, ch: 2 });
  const before = headOffset(editor);
  expect(dispatchKey(editor, "v").defaultPrevented).toBe(true);
  expect(dispatchKey(editor, "j").defaultPrevented).toBe(true);
  expect(headOffset(editor)).toBe(before);
});

test("V lock repeats view keys until Escape", () => {
  const editor = createEditor(DOC);
  editor.setCursor({ line: 49, ch: 2 });
  const before = headOffset(editor);
  expect(dispatchKey(editor, "V").defaultPrevented).toBe(true);
  expect(dispatchKey(editor, "j").defaultPrevented).toBe(true);
  expect(headOffset(editor)).toBe(before);
  expect(dispatchKey(editor, "k").defaultPrevented).toBe(true);
  expect(headOffset(editor)).toBe(before);
  expect(dispatchKey(editor, "Escape").defaultPrevented).toBe(true);
  // normal motion still works after leaving lock
  expect(dispatchKey(editor, "j").defaultPrevented).toBe(true);
  expect(headOffset(editor)).not.toBe(before);
});

test("C-d moves down and C-u moves back up", () => {
  const editor = createEditor(DOC);
  editor.setCursor({ line: 9, ch: 0 });
  const start = headOffset(editor);
  expect(dispatchKey(editor, "d", { ctrlKey: true }).defaultPrevented).toBe(true);
  const down = headOffset(editor);
  expect(down).toBeGreaterThan(start);
  expect(dispatchKey(editor, "u", { ctrlKey: true }).defaultPrevented).toBe(true);
  expect(headOffset(editor)).toBeLessThan(down);
});
