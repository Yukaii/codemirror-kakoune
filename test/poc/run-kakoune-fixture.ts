import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kakoune, getKakouneState } from "../../src";
import { KakouneKeyProcessor } from "../../src/keys";
import { buildKakouneCommands, handleSearchPromptKey, handleSplitPromptKey } from "../../src/commands";

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
  error?: string;
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

export function parseRcMappings(rc?: string): {
  insertMappings: Map<string, string[]>;
  normalMappings: Map<string, string[]>;
  userModes: Map<string, Map<string, string[]>>;
} {
  const insertMappings = new Map<string, string[]>();
  const normalMappings = new Map<string, string[]>();
  const userModes = new Map<string, Map<string, string[]>>();

  if (!rc) {
    return { insertMappings, normalMappings, userModes };
  }

  const lines = rc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const insertMatch = line.match(/^map\s+global\s+insert\s+(\S+)\s+'?(.+?)'?$/);
    if (insertMatch) {
      const trigger = insertMatch[1];
      const val = insertMatch[2].replace(/^'|'$/g, "");
      insertMappings.set(trigger, tokenizeKakouneCmd(val));
      continue;
    }

    const normalMatch = line.match(/^map\s+global\s+normal\s+(\S+)\s+'(.*)'$/);
    if (normalMatch) {
      const trigger = normalMatch[1].startsWith("<") ? (
        normalMatch[1].toLowerCase().startsWith("<a-") ? `<A-${normalMatch[1].slice(3, -1)}>` : normalMatch[1]
      ) : normalMatch[1];
      const val = normalMatch[2];
      normalMappings.set(trigger, tokenizeKakouneCmd(val));
      continue;
    }

    const normalMatchNoQuote = line.match(/^map\s+global\s+normal\s+(\S+)\s+(\S+)$/);
    if (normalMatchNoQuote) {
      const trigger = normalMatchNoQuote[1].startsWith("<") ? (
        normalMatchNoQuote[1].toLowerCase().startsWith("<a-") ? `<A-${normalMatchNoQuote[1].slice(3, -1)}>` : normalMatchNoQuote[1]
      ) : normalMatchNoQuote[1];
      const val = normalMatchNoQuote[2];
      normalMappings.set(trigger, tokenizeKakouneCmd(val));
      continue;
    }

    const userModeMatch = line.match(/^map\s+global\s+(\S+)\s+(\S+)\s+'(.*)'$/);
    if (userModeMatch && userModeMatch[1] !== "insert" && userModeMatch[1] !== "normal") {
      const modeName = userModeMatch[1];
      const trigger = userModeMatch[2];
      const val = userModeMatch[3];
      if (!userModes.has(modeName)) {
        userModes.set(modeName, new Map());
      }
      userModes.get(modeName)!.set(trigger, tokenizeKakouneCmd(val));
      continue;
    }

    const userModeMatchNoQuote = line.match(/^map\s+global\s+(\S+)\s+(\S+)\s+(\S+)$/);
    if (userModeMatchNoQuote && userModeMatchNoQuote[1] !== "insert" && userModeMatchNoQuote[1] !== "normal") {
      const modeName = userModeMatchNoQuote[1];
      const trigger = userModeMatchNoQuote[2];
      const val = userModeMatchNoQuote[3];
      if (!userModes.has(modeName)) {
        userModes.set(modeName, new Map());
      }
      userModes.get(modeName)!.set(trigger, tokenizeKakouneCmd(val));
      continue;
    }
  }

  return { insertMappings, normalMappings, userModes };
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
        if (/^<(Esc|esc|Enter|enter|ret|ret\b|Backspace|backspace|Space|Tab|tab|right|left|up|down|Right|Left|Up|Down|A-[^<>]+|a-[^<>]+|C-[^<>]+|c-[^<>]+)>$/i.test(token)) {
          tokens.push(
            /^<esc>$/i.test(token) ? "<Esc>" :
            /^<(enter|ret)>$/i.test(token) ? "<Enter>" :
            /^<tab>$/i.test(token) ? "<Tab>" :
            /^<backspace>$/i.test(token) ? "<Backspace>" :
            token.toLowerCase() === "<right>" ? "<Right>" :
            token.toLowerCase() === "<left>" ? "<Left>" :
            token.toLowerCase() === "<up>" ? "<Up>" :
            token.toLowerCase() === "<down>" ? "<Down>" :
            token.toLowerCase().startsWith("<a-") ? `<A-${token.slice(3, -1)}>` :
            token.toLowerCase().startsWith("<c-") ? `<C-${token.slice(3, -1)}>` :
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
    const { insertMappings, normalMappings, userModes } = parseRcMappings(input.rc);
    const processor = new KakouneKeyProcessor(buildKakouneCommands());
    processor.setInsertMappings(insertMappings);
    processor.setNormalMappings(normalMappings);
    processor.setUserModes(userModes);
    const parsed = parseSelectionMarkers(input.in ?? "");
    const view = new EditorView({
      state: EditorState.create({
        doc: parsed.text,
        selection: EditorSelection.create(parsed.selection.map(range => EditorSelection.range(range.anchor, range.head)), 0),
        extensions: [kakoune()]
      }),
      parent
    });

    for (const token of tokenizeKakouneCmd(input.cmd)) {
      const state = getKakouneState(view.state);
      if (state.searchPrompt !== null) {
        handleSearchPromptKey(view, token);
        continue;
      }

      if (state.splitPrompt !== null) {
        handleSplitPromptKey(view, token);
        continue;
      }

      processor.handle(state.mode, token, view);
    }

    const state = getKakouneState(view.state);

    return {
      doc: view.state.doc.toString(),
      selectionRanges: view.state.selection.ranges.map(range => ({ anchor: range.anchor, head: range.head })),
      mode: state.mode,
      tokens: tokenizeKakouneCmd(input.cmd),
      error: state.commandError ?? undefined
    };
  } finally {
    parent.remove();
  }
}
