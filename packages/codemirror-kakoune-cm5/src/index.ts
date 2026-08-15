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
  cm.setOption("keyMap", mode === "select" ? "kakoune" : "kakouneInsert");
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
  x: selectLine,
  u: cm => cm.undo(),
  U: cm => cm.redo(),
  d: deleteSelection,
  y: cm => cm.execCommand("copy")
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
  h: "kakoune_h", j: "kakoune_j", k: "kakoune_k", l: "kakoune_l",
  w: "kakoune_w", b: "kakoune_b", x: "kakoune_x", d: "kakouneDelete",
  i: "kakouneEnterInsert", a: "kakouneAppend", u: "kakoune_u", U: "kakoune_U",
  Esc: "kakouneEnterSelect",
  nofallthrough: true
} as unknown as CodeMirror.KeyMap & { nofallthrough: boolean };

export const kakouneInsertKeyMap: CodeMirror.KeyMap = {
  Esc: "kakouneEnterSelect",
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
