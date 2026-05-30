import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseParityProgress,
  findPromotableFixture,
  promoteParityFixture,
  renderParityProgress,
  selectNextProbeFixture
} from "./kakoune-parity-probe-helpers.cjs";

const ROOT = resolve(process.cwd(), "test/kakoune/test/normal");
const DOC_PATH = resolve(process.cwd(), "docs/kakoune-parity-progress.md");
function readFixture(name) {
  const dir = join(ROOT, name);
  if (!existsSync(join(dir, "out")) || !existsSync(join(dir, "cmd"))) {
    return null;
  }

  return {
    name,
    in: existsSync(join(dir, "in")) ? readFileSync(join(dir, "in"), "utf8") : "",
    out: readFileSync(join(dir, "out"), "utf8"),
    cmd: readFileSync(join(dir, "cmd"), "utf8")
  };
}

function normalize(value) {
  return value.replace(/\n$/, "");
}

function buildProbeTest(candidateName) {
  return [
    '// @ts-nocheck',
    'import { existsSync, readFileSync } from "node:fs";',
    'import { join } from "node:path";',
    'import { runKakouneFixture } from "../run-kakoune-fixture";',
    '',
    `const ROOT = ${JSON.stringify(ROOT)};`,
    '',
    'function readFixture(name) {',
    '  const dir = join(ROOT, name);',
    '  return {',
    '    name,',
    '    in: existsSync(join(dir, "in")) ? readFileSync(join(dir, "in"), "utf8") : "",',
    '    out: readFileSync(join(dir, "out"), "utf8"),',
    '    cmd: readFileSync(join(dir, "cmd"), "utf8")',
    '  };',
    '}',
    '',
    'function parseSelectionMarkers(text) {',
    '  let output = "";',
    '  for (let i = 0; i < text.length; i += 1) {',
    '    if (text.startsWith("%(", i)) {',
    '      const end = text.indexOf(")", i + 2);',
    '      output += text.slice(i + 2, end);',
    '      i = end;',
    '      continue;',
    '    }',
    '    output += text[i];',
    '  }',
    '  return output;',
    '}',
    '',
    'function normalize(value) {',
    '  return value.replace(/\\n$/, "");',
    '}',
    '',
    `test(${JSON.stringify(candidateName)}, () => {`,
    `  const fixture = readFixture(${JSON.stringify(candidateName)});`,
    '  const actual = runKakouneFixture({ in: fixture.in, cmd: fixture.cmd });',
    '  expect(normalize(actual.doc)).toBe(normalize(parseSelectionMarkers(fixture.out)));',
    '});',
    ''
  ].join("\n");
}

async function main() {
  const progress = parseParityProgress(readFileSync(DOC_PATH, "utf8"));
  const tempDir = join(process.cwd(), "test/poc/.kakoune-parity-probe");
  const testPath = join(tempDir, "probe.test.ts");

  mkdirSync(tempDir, { recursive: true });
  try {
    const resolved = await findPromotableFixture(progress, async name => {
      const fixture = readFixture(name);
      if (!fixture) {
        return false;
      }

      writeFileSync(testPath, buildProbeTest(fixture.name));

      const result = spawnSync("pnpm", ["exec", "jest", "--runInBand", "--runTestsByPath", testPath], {
        encoding: "utf8"
      });

      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);

      return result.status === 0;
    });

    if (!resolved) {
      console.log("No promotable red fixtures found.");
      return;
    }

    const updated = promoteParityFixture(progress, resolved);
    writeFileSync(DOC_PATH, renderParityProgress(updated));
    console.log(`Promoted ${resolved}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
