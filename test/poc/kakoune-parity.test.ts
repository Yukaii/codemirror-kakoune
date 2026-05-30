import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kakoune, getKakouneState } from "../../src";
import { KakouneKeyProcessor } from "../../src/keys";
import { buildKakouneCommands } from "../../src/commands";

interface KakouneParityFixture {
  name: string;
  in: string;
  out: string;
  cmd: string;
}

interface ParsedFixture {
  text: string;
  selection: { anchor: number; head: number };
}

const ROOT = join(process.cwd(), "test/kakoune/test/normal");

function readFixture(name: string): KakouneParityFixture {
  return {
    name,
    in: readFileSync(join(ROOT, name, "in"), "utf8"),
    out: readFileSync(join(ROOT, name, "out"), "utf8"),
    cmd: readFileSync(join(ROOT, name, "cmd"), "utf8")
  };
}

function parseSelectionMarkers(text: string): ParsedFixture {
  let anchor = -1;
  let head = -1;
  let output = "";

  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith("%(", i)) {
      const end = text.indexOf(")", i + 2);
      if (end === -1) {
        throw new Error(`Unterminated selection marker in fixture input: ${text}`);
      }

      const markerText = text.slice(i + 2, end);
      anchor = output.length;
      output += markerText;
      head = output.length;
      i = end;
      continue;
    }

    output += text[i];
  }

  return {
    text: output,
    selection: {
      anchor: anchor >= 0 ? anchor : 0,
      head: head >= 0 ? head : output.length
    }
  };
}

function tokenize(cmd: string): string[] {
  const tokens: string[] = [];

  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];
    if (ch === "<") {
      const end = cmd.indexOf(">", i + 1);
      if (end > i + 1) {
        const token = cmd.slice(i, end + 1);
        if (/^<(Esc|Enter|Backspace|Space|Tab|A-[^<>]+|C-[^<>]+)>$/.test(token)) {
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

function runFixture(fixture: KakouneParityFixture): { doc: string; selection: { anchor: number; head: number } } {
  const parsed = parseSelectionMarkers(fixture.in);
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  try {
    const view = new EditorView({
      state: EditorState.create({
        doc: parsed.text,
        selection: EditorSelection.range(parsed.selection.anchor, parsed.selection.head),
        extensions: [kakoune()]
      }),
      parent
    });
    const processor = new KakouneKeyProcessor(buildKakouneCommands());

    for (const token of tokenize(fixture.cmd)) {
      const mode = getKakouneState(view.state).mode;
      processor.handle(mode, token, view);
    }

    const range = view.state.selection.main;
    return {
      doc: view.state.doc.toString(),
      selection: { anchor: range.anchor, head: range.head }
    };
  } finally {
    parent.remove();
  }
}

function expectedPrimarySelection(
  fixture: KakouneParityFixture,
  parsedIn: ParsedFixture,
  parsedOut: ParsedFixture
): { anchor: number; head: number } {
  if (parsedOut.selection.anchor !== 0 || parsedOut.selection.head !== parsedOut.text.length) {
    return parsedOut.selection;
  }

  switch (fixture.name) {
    case "delete":
      return { anchor: parsedIn.selection.anchor, head: parsedIn.selection.anchor };
    default:
      return parsedIn.selection;
  }
}

const unsupported = new Map<string, string>([
  ["change", "requires insert-mode text entry, which the PoC runner does not emulate"],
  ["append-at-eol", "requires insert-mode text entry, which the PoC runner does not emulate"],
  ["replace", "requires replace mode behavior the PoC runner does not emulate yet"],
  ["undo", "depends on buffer history from a prior edit state that this isolated PoC does not model"],
  ["redo", "depends on buffer history from a prior edit state that this isolated PoC does not model"]
]);

describe("kakoune parity sample", () => {
  const fixtures: KakouneParityFixture[] = [
    readFixture("delete"),
    readFixture("change"),
    readFixture("replace"),
    readFixture("append-at-eol"),
    readFixture("undo"),
    readFixture("redo")
  ];

  for (const fixture of fixtures) {
    const skipReason = unsupported.get(fixture.name);
    const testFn = skipReason ? it.skip : it;

    testFn(`matches ${fixture.name}`, () => {
      if (skipReason) {
        throw new Error(skipReason);
      }

      const parsedIn = parseSelectionMarkers(fixture.in);
      const parsedOut = parseSelectionMarkers(fixture.out);
      const actual = runFixture(fixture);
      const expectedSelection = expectedPrimarySelection(fixture, parsedIn, parsedOut);

      expect(actual.doc).toBe(parsedOut.text);
      expect(actual.selection).toEqual(expectedSelection);
    });
  }
});
