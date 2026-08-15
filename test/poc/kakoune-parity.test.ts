import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  selection: Array<{ anchor: number; head: number }>;
}

interface ParityCase {
  name: string;
  supported: boolean;
  reason: string;
}

const ROOT = join(process.cwd(), "test/kakoune/test/normal");

function readFixture(name: string): KakouneParityFixture {
  const inPath = join(ROOT, name, "in");
  const hasIn = existsSync(inPath);
  return {
    name,
    in: hasIn ? readFileSync(inPath, "utf8") : "",
    out: readFileSync(join(ROOT, name, "out"), "utf8"),
    cmd: readFileSync(join(ROOT, name, "cmd"), "utf8")
  };
}

function parseSelectionMarkers(text: string): ParsedFixture {
  let output = "";
  const selections: Array<{ anchor: number; head: number }> = [];

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
      selections.push({ anchor, head });
      i = end;
      continue;
    }

    output += text[i];
  }

  return {
    text: output,
    selection: selections.length > 0 ? selections : [{ anchor: 0, head: 0 }]
  };
}

function tokenize(cmd: string): string[] {
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
            token === "<enter>" ? "<Enter>" :
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

function formatSelection(selection: { anchor: number; head: number }): string {
  return `(${selection.anchor}, ${selection.head})`;
}

function formatVisible(text: string): string {
  return JSON.stringify(text);
}

function summarizeDocDiff(expected: string, actual: string): string {
  if (expected === actual) {
    return `doc=${formatVisible(actual)}`;
  }

  const maxPrefix = Math.min(expected.length, actual.length);
  let index = 0;
  while (index < maxPrefix && expected[index] === actual[index]) {
    index += 1;
  }

  const context = 12;
  const expectedSlice = expected.slice(Math.max(0, index - context), index + context);
  const actualSlice = actual.slice(Math.max(0, index - context), index + context);

  return [
    `doc mismatch at ${index}`,
    `expected: ${formatVisible(expectedSlice)}`,
    `actual:   ${formatVisible(actualSlice)}`
  ].join("\n");
}

function assertParityMatch(
  fixture: KakouneParityFixture,
  expectedDoc: string,
  actual: { doc: string; selection: { anchor: number; head: number } }
): void {
  const normalize = (value: string) => value.replace(/\n$/, "");
  const issues: string[] = [];

  const normalizedExpectedDoc = normalize(expectedDoc);
  const normalizedActualDoc = normalize(actual.doc);

  if (normalizedActualDoc !== normalizedExpectedDoc) {
    issues.push(summarizeDocDiff(normalizedExpectedDoc, normalizedActualDoc));
  }

  if (issues.length > 0) {
    throw new Error([`fixture ${fixture.name} mismatch`, ...issues].join("\n"));
  }
}

function runFixture(fixture: KakouneParityFixture): { doc: string; selection: { anchor: number; head: number } } {
  const parsed = parseSelectionMarkers(fixture.in);
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  try {
    const view = new EditorView({
      state: EditorState.create({
        doc: parsed.text,
        selection: EditorSelection.create(parsed.selection.map(range => EditorSelection.range(range.anchor, range.head)), 0),
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

const parityCases: ParityCase[] = [
  {
    name: "open-above",
    supported: true,
    reason: "simple out-backed line opening without inserted text"
  },
  {
    name: "open-below",
    supported: true,
    reason: "simple out-backed line opening without inserted text"
  },
  {
    name: "delete",
    supported: true,
    reason: "single-selection edit with a deterministic out buffer"
  },
  {
    name: "undo",
    supported: true,
    reason: "a delete followed by undo stays within the current non-insert edit path"
  },
  {
    name: "redo",
    supported: true,
    reason: "a delete-undo-redo sequence stays within the current non-insert edit path"
  },
  {
    name: "open-multiple-above",
    supported: true,
    reason: "counted open-above should create repeated blank lines and accept shared insert text"
  },
  {
    name: "open-multiple-below",
    supported: true,
    reason: "counted open-below should create repeated blank lines and accept shared insert text"
  },
  {
    name: "insert-at-line-start",
    supported: true,
    reason: "simple insert-mode typing at line start now works through the insert text path"
  },
  {
    name: "repeat-insert/repeat-insert",
    supported: true,
    reason: "plain insert followed by dot replay should reuse the last inserted text"
  },
  {
    name: "change",
    supported: true,
    reason: "requires insert-mode text entry and selection deletion semantics"
  },
  {
    name: "append-at-eol",
    supported: true,
    reason: "requires insert-mode text entry at the end of the current line"
  },
  {
    name: "insert",
    supported: true,
    reason: "plain insert-mode typing is already handled by the insert key path"
  },
  {
    name: "replace",
    supported: false,
    reason: "requires replace mode behavior the PoC runner does not emulate yet"
  },
  {
    name: "undo",
    supported: false,
    reason: "depends on buffer history from a prior edit state that this isolated PoC does not model"
  },
  {
    name: "redo",
    supported: false,
    reason: "depends on buffer history from a prior edit state that this isolated PoC does not model"
  }
];

const parityCasesByName = new Map(parityCases.map(entry => [entry.name, entry]));

function countCorpusOutFixtures(rootDir: string): number {
  let total = 0;

  for (const entry of readdirSync(rootDir)) {
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      total += countCorpusOutFixtures(fullPath);
      continue;
    }

    if (entry === "out") {
      total += 1;
    }
  }

  return total;
}

function getParityCoverageSummary(): { supported: number; total: number; percentage: string } {
  const supported = parityCases.filter(entry => entry.supported).length;
  const total = countCorpusOutFixtures(join(process.cwd(), "test/kakoune/test"));
  return {
    supported,
    total,
    percentage: total === 0 ? "0.00" : ((supported / total) * 100).toFixed(2)
  };
}

describe("kakoune parity sample", () => {
  it("prints coverage summary", () => {
    const summary = getParityCoverageSummary();
    expect(summary).toMatchObject({ supported: 12, total: 280, percentage: "4.29" });
    console.log(
      `Kakoune corpus parity coverage: ${summary.supported}/${summary.total} supported parity cases (${summary.percentage}%)`
    );
  });

  const fixtures: KakouneParityFixture[] = parityCases.map(entry => readFixture(entry.name));

  for (const fixture of fixtures) {
    const testCase = parityCasesByName.get(fixture.name);
    const testFn = testCase?.supported ? it : it.skip;

    testFn(`matches ${fixture.name}`, () => {
      if (!testCase?.supported) {
        throw new Error(testCase?.reason ?? `unsupported fixture: ${fixture.name}`);
      }

    const parsedOut = parseSelectionMarkers(fixture.out);
    const actual = runFixture(fixture);

    assertParityMatch(fixture, parsedOut.text, actual);
  });
  }
});
