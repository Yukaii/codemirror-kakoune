import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kakoune, getKakouneState } from "../../src";
import { KakouneKeyProcessor } from "../../src/keys";
import { buildKakouneCommands } from "../../src/commands";

export interface KakouneFixtureInput {
  in?: string;
  rc?: string;
  cmd: string;
}

export interface KakouneFixtureResult {
  doc: string;
  selectionRanges: Array<{ anchor: number; head: number }>;
  mode: "select" | "insert";
  tokens: string[];
}

export function tokenizeKakouneCmd(cmd: string): string[] {
  const tokens: string[] = [];

  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];

    if (ch === "<") {
      const end = cmd.indexOf(">", i + 1);
      if (end > i + 1) {
        const token = cmd.slice(i, end + 1);
        if (/^<(Esc|Enter|Backspace|A-[^<>]+|C-[^<>]+)>$/.test(token)) {
          tokens.push(token);
          i = end;
          continue;
        }
      }
    }

    tokens.push(ch);
  }

  return tokens;
}

export function runKakouneFixture(input: KakouneFixtureInput): KakouneFixtureResult {
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  try {
    const processor = new KakouneKeyProcessor(buildKakouneCommands());
    const view = new EditorView({
      state: EditorState.create({
        doc: input.in ?? "",
        selection: EditorSelection.cursor(0),
        extensions: [kakoune()]
      }),
      parent
    });

    // PoC placeholder: keep rc accepted without trying to interpret Kakoune rc files.
    void input.rc;

    for (const token of tokenizeKakouneCmd(input.cmd)) {
      const mode = getKakouneState(view.state).mode;
      processor.handle(mode, token, view);
    }

    const state = getKakouneState(view.state);

    return {
      doc: view.state.doc.toString(),
      selectionRanges: view.state.selection.ranges.map(range => ({ anchor: range.anchor, head: range.head })),
      mode: state.mode,
      tokens: tokenizeKakouneCmd(input.cmd)
    };
  } finally {
    parent.remove();
  }
}
