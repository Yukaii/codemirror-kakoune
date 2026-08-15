import CodeMirror from "codemirror";

export type KakouneCm5Mode = "select" | "insert";

export interface KakouneCm5Options {
  initialMode?: KakouneCm5Mode;
}

type Cm = CodeMirror.Editor;
type Command = (cm: Cm) => void;
const codeMirror = CodeMirror as typeof CodeMirror & { keyMap: Record<string, CodeMirror.KeyMap> };

function setMode(cm: Cm, mode: KakouneCm5Mode): void {
  cm.getWrapperElement().dataset.kakouneMode = mode;
  (cm as Cm & { kakounePending?: string }).kakounePending = undefined;
  const editor = cm as Cm & { kakouneKeyMap?: CodeMirror.KeyMap };
  if (editor.kakouneKeyMap) {
    cm.removeKeyMap(editor.kakouneKeyMap);
  }
  editor.kakouneKeyMap = mode === "select" ? kakouneKeyMap : kakouneInsertKeyMap;
  cm.setOption("keyMap", "default");
  cm.addKeyMap(editor.kakouneKeyMap);
}

function signalWhichKey(cm: Cm, pending: string | null): void {
  if (typeof CustomEvent === "undefined") return;
  cm.getWrapperElement().dispatchEvent(new CustomEvent("kakoune-which-key", {
    bubbles: true,
    detail: { pending, items: pending === "g" ? ["g h", "g l", "g k", "g j", "g g"] : [] }
  }));
}

function moveToLineBoundary(cm: Cm, end: boolean): void {
  move(cm, (cursor, editor) => ({
    line: cursor.line,
    ch: end ? editor.getLine(cursor.line).length : 0
  }));
}

function jumpToDocument(cm: Cm, end: boolean): void {
  const line = end ? cm.lastLine() : cm.firstLine();
  const ch = end ? cm.getLine(line).length : 0;
  cm.setSelections(cm.listSelections().map(() => ({ anchor: { line, ch }, head: { line, ch } })));
}

function handleGPrefix(cm: Cm, key: string): boolean {
  const editor = cm as Cm & { kakounePending?: string };
  if (editor.kakounePending !== "g") {
    editor.kakounePending = "g";
    signalWhichKey(cm, "g");
    return true;
  }

  editor.kakounePending = undefined;
  signalWhichKey(cm, null);
  switch (key.toLowerCase()) {
    case "h": moveToLineBoundary(cm, false); return true;
    case "l": moveToLineBoundary(cm, true); return true;
    case "k": jumpToDocument(cm, false); return true;
    case "j": jumpToDocument(cm, true); return true;
    case "g": jumpToDocument(cm, false); return true;
    default: return true;
  }
}

function normalCommand(key: string, command: Command): Command {
  return cm => {
    const editor = cm as Cm & { kakounePending?: string };
    if (editor.kakounePending === "g") {
      return handleGPrefix(cm, key);
    }
    command(cm);
  };
}

function move(cm: Cm, delta: (cursor: CodeMirror.Position, cm: Cm) => CodeMirror.Position): void {
  cm.setSelections(cm.listSelections().map(selection => ({
    anchor: delta(selection.anchor, cm),
    head: delta(selection.head, cm)
  })));
}

function horizontal(direction: -1 | 1): Command {
  return cm => move(cm, (cursor, editor) => editor.findPosH(cursor, direction, "char", false));
}

function vertical(direction: -1 | 1): Command {
  return cm => move(cm, (cursor, editor) => editor.findPosV(cursor, direction, "line"));
}

function enterInsert(cm: Cm, after = false): void {
  if (after) {
    move(cm, (cursor, editor) => editor.findPosH(cursor, 1, "char", false));
  }
  setMode(cm, "insert");
}

function insertLine(cm: Cm, above: boolean): void {
  const selections = cm.listSelections();
  const next = selections.map(selection => {
    const line = selection.head.line + (above ? 0 : 1);
    const position = { line, ch: 0 };
    return { anchor: position, head: position };
  });
  for (const selection of selections.slice().reverse()) {
    const line = selection.head.line + (above ? 0 : 1);
    cm.replaceRange("\n", { line, ch: 0 });
  }
  cm.setSelections(next);
  setMode(cm, "insert");
}

function selectLine(cm: Cm): void {
  cm.setSelections(cm.listSelections().map(selection => {
    const from = { line: selection.head.line, ch: 0 };
    const line = cm.getLine(selection.head.line);
    const to = { line: selection.head.line, ch: line.length };
    return { anchor: from, head: to };
  }));
}

function deleteSelection(cm: Cm): void {
  const ranges = cm.listSelections().map(selection => {
    if (!selection.empty()) return { from: selection.from(), to: selection.to() };
    const line = cm.getLine(selection.head.line);
    return {
      from: selection.head,
      to: { line: selection.head.line, ch: Math.min(line.length, selection.head.ch + 1) }
    };
  });
  for (const range of ranges.reverse()) {
    cm.replaceRange("", range.from, range.to);
  }
}

const selectCommands: Record<string, Command> = {
  h: horizontal(-1),
  l: horizontal(1),
  j: vertical(1),
  k: vertical(-1),
  "0": cm => cm.execCommand("goLineStart"),
  "$": cm => cm.execCommand("goLineEnd"),
  w: cm => cm.execCommand("goWordRight"),
  b: cm => cm.execCommand("goGroupLeft"),
  e: cm => cm.execCommand("goWordRight"),
  x: selectLine,
  u: cm => cm.undo(),
  U: cm => cm.redo(),
  d: deleteSelection,
  y: cm => cm.execCommand("copy"),
  c: cm => { deleteSelection(cm); setMode(cm, "insert"); },
  o: cm => insertLine(cm, false),
  O: cm => insertLine(cm, true)
};

// Keep command registration separate from the keymap, matching CM5's Sublime
// integration and allowing applications to extend the map with addKeyMap.
function installCommands(cm: Cm): void {
  const commands = CodeMirror.commands as unknown as Record<string, Command>;
  for (const [key, command] of Object.entries(selectCommands)) {
    commands[`kakoune_${key}`] = command;
  }
  commands.kakouneEnterInsert = editor => enterInsert(editor);
  commands.kakouneAppend = editor => enterInsert(editor, true);
  commands.kakouneEnterSelect = editor => setMode(editor, "select");
  commands.kakouneDelete = editor => editor.replaceSelections(editor.getSelections().map(() => ""));
  setMode(cm, "select");
}

export const kakouneKeyMap = {
  G: (editor: Cm) => handleGPrefix(editor, "g"),
  H: normalCommand("h", selectCommands.h), J: normalCommand("j", selectCommands.j), K: normalCommand("k", selectCommands.k), L: normalCommand("l", selectCommands.l),
  W: normalCommand("w", selectCommands.w), B: normalCommand("b", selectCommands.b), X: normalCommand("x", selectCommands.x), D: normalCommand("d", selectCommands.d),
  E: normalCommand("e", selectCommands.e),
  I: (editor: Cm) => { moveToLineBoundary(editor, false); enterInsert(editor); },
  A: (editor: Cm) => { moveToLineBoundary(editor, true); enterInsert(editor, true); },
  "Shift-G": (editor: Cm) => jumpToDocument(editor, true),
  O: selectCommands.O,
  U: selectCommands.u, "Shift-U": selectCommands.U,
  g: (editor: Cm) => handleGPrefix(editor, "g"),
  h: normalCommand("h", selectCommands.h), j: normalCommand("j", selectCommands.j), k: normalCommand("k", selectCommands.k), l: normalCommand("l", selectCommands.l),
  w: normalCommand("w", selectCommands.w), b: normalCommand("b", selectCommands.b), x: normalCommand("x", selectCommands.x), d: normalCommand("d", selectCommands.d),
  e: normalCommand("e", selectCommands.e),
  i: (editor: Cm) => enterInsert(editor), a: (editor: Cm) => enterInsert(editor, true),
  o: selectCommands.o, "Shift-O": selectCommands.O,
  c: selectCommands.c, y: selectCommands.y, u: selectCommands.u,
  Esc: (editor: Cm) => setMode(editor, "select"),
  nofallthrough: true
} as unknown as CodeMirror.KeyMap;

export const kakouneInsertKeyMap: CodeMirror.KeyMap = {
  Esc: (editor: Cm) => setMode(editor, "select"),
  fallthrough: "default"
};

export function registerKakouneKeyMaps(): void {
  codeMirror.keyMap.kakoune = kakouneKeyMap as CodeMirror.KeyMap;
  codeMirror.keyMap.kakouneInsert = kakouneInsertKeyMap;
}

/** Installs the CM5 Kakoune keymaps on an editor instance. */
export function kakoune(cm: Cm, options: KakouneCm5Options = {}): void {
  registerKakouneKeyMaps();
  installCommands(cm);
  setMode(cm, options.initialMode ?? "select");
}
