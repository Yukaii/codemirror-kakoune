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
  selection: { anchor: number; head: number };
}

interface ParityCase {
  name: string;
  supported: boolean;
  reason: string;
  expectedSelection?: { anchor: number; head: number };
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
      head: head >= 0 ? head : 0
    }
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
        if (/^<(Esc|esc|Enter|enter|Backspace|backspace|Space|Tab|A-[^<>]+|C-[^<>]+)>$/.test(token)) {
          tokens.push(token === "<esc>" ? "<Esc>" : token === "<enter>" ? "<Enter>" : token === "<backspace>" ? "<Backspace>" : token);
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
  expectedSelection: { anchor: number; head: number },
  actual: { doc: string; selection: { anchor: number; head: number } }
): void {
  const normalize = (value: string) => value.replace(/\n$/, "");
  const issues: string[] = [];

  const normalizedExpectedDoc = normalize(expectedDoc);
  const normalizedActualDoc = normalize(actual.doc);

  if (normalizedActualDoc !== normalizedExpectedDoc) {
    issues.push(summarizeDocDiff(normalizedExpectedDoc, normalizedActualDoc));
  }

  if (actual.selection.anchor !== expectedSelection.anchor || actual.selection.head !== expectedSelection.head) {
    issues.push(
      `selection expected ${formatSelection(expectedSelection)} but got ${formatSelection(actual.selection)}`
    );
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

const parityCases: ParityCase[] = [
  {
    name: "open-above",
    supported: true,
    reason: "simple out-backed line opening without inserted text",
    expectedSelection: { anchor: 0, head: 0 }
  },
  {
    name: "open-below",
    supported: true,
    reason: "simple out-backed line opening without inserted text",
    expectedSelection: { anchor: 4, head: 4 }
  },
  {
    name: "delete",
    supported: true,
    reason: "single-selection edit with a deterministic out buffer",
    expectedSelection: { anchor: 4, head: 4 }
  },
  {
    name: "undo",
    supported: true,
    reason: "a delete followed by undo stays within the current non-insert edit path",
    expectedSelection: { anchor: 0, head: 3 }
  },
  {
    name: "redo",
    supported: true,
    reason: "a delete-undo-redo sequence stays within the current non-insert edit path",
    expectedSelection: { anchor: 4, head: 4 }
  },
  {
    name: "open-multiple-above",
    supported: true,
    reason: "counted open-above should create repeated blank lines and accept shared insert text",
    expectedSelection: { anchor: 3, head: 3 }
  },
  {
    name: "open-multiple-below",
    supported: true,
    reason: "counted open-below should create repeated blank lines and accept shared insert text",
    expectedSelection: { anchor: 7, head: 7 }
  },
  {
    name: "insert-at-line-start",
    supported: true,
    reason: "simple insert-mode typing at line start now works through the insert text path",
    expectedSelection: { anchor: 5, head: 5 }
  },
  {
    name: "repeat-insert/repeat-insert",
    supported: true,
    reason: "plain insert followed by dot replay should reuse the last inserted text",
    expectedSelection: { anchor: 6, head: 6 }
  },
  {
    name: "change",
    supported: true,
    reason: "requires insert-mode text entry and selection deletion semantics",
    expectedSelection: { anchor: 12, head: 12 }
  },
  {
    name: "append-at-eol",
    supported: true,
    reason: "requires insert-mode text entry at the end of the current line",
    expectedSelection: { anchor: 6, head: 6 }
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
    expect(summary).toMatchObject({ supported: 11, total: 280, percentage: "3.93" });
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
      const expectedSelection = testCase.expectedSelection ?? { anchor: 0, head: 0 };

      assertParityMatch(fixture, parsedOut.text, expectedSelection, actual);
    });
  }
});
