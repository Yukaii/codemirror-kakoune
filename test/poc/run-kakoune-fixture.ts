import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kakoune, getKakouneState } from "../../src";
import { KakouneKeyProcessor } from "../../src/keys";
import { buildKakouneCommands, handleSearchPromptKey } from "../../src/commands";

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

function parseSelectionMarkers(text: string): { text: string; selection: Array<{ anchor: number; head: number }> } {
  let output = "";
  const selection: Array<{ anchor: number; head: number }> = [];

  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith("%(", i)) {
      const end = text.indexOf(")", i + 2);
      if (end === -1) {
        throw new Error(`Unterminated selection marker in fixture input: ${text}`);
      }

      const markerText = text.slice(i + 2, end);
      const anchor = output.length;
      output += markerText;
      const head = output.length;
      selection.push({ anchor, head });
      i = end;
      continue;
    }

    output += text[i];
  }

  return {
    text: output,
    selection: selection.length > 0 ? selection : [{ anchor: 0, head: 0 }]
  };
}

export function tokenizeKakouneCmd(cmd: string): string[] {
  const tokens: string[] = [];

  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];

    if (ch === "\n" || ch === "\r") {
      continue;
    }

    if (ch === "<") {
      const end = cmd.indexOf(">", i + 1);
      if (end > i + 1) {
        const token = cmd.slice(i, end + 1);
        if (/^<(Esc|esc|Enter|enter|ret|Backspace|backspace|Space|Tab|A-[^<>]+|a-[^<>]+|C-[^<>]+|c-[^<>]+)>$/.test(token)) {
          tokens.push(
            token === "<esc>" ? "<Esc>" :
            token === "<enter>" || token === "<ret>" ? "<Enter>" :
            token === "<backspace>" ? "<Backspace>" :
            token.startsWith("<a-") ? `<A-${token.slice(3, -1)}>` :
            token.startsWith("<c-") ? `<C-${token.slice(3, -1)}>` :
            token
          );
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
    const parsed = parseSelectionMarkers(input.in ?? "");
    const view = new EditorView({
      state: EditorState.create({
        doc: parsed.text,
        selection: EditorSelection.create(parsed.selection.map(range => EditorSelection.range(range.anchor, range.head)), 0),
        extensions: [kakoune()]
      }),
      parent
    });

    // PoC placeholder: keep rc accepted without trying to interpret Kakoune rc files.
    void input.rc;

    for (const token of tokenizeKakouneCmd(input.cmd)) {
      const state = getKakouneState(view.state);
      if (state.searchPrompt !== null) {
        handleSearchPromptKey(view, token);
        continue;
      }

      processor.handle(state.mode, token, view);
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
