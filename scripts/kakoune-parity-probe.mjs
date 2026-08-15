import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  parseParityProgress,
  findPromotableFixture,
  promoteParityFixture,
  renderParityProgress,
  selectNextProbeFixture
} from "./kakoune-parity-probe-helpers.cjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const ROOT = resolve(rootDir, "test/kakoune/test");
const DOC_PATH = resolve(rootDir, "docs/kakoune-parity-progress.md");
function readFixture(name) {
  let dir = join(ROOT, name);
  if (!existsSync(dir)) {
    dir = join(ROOT, "normal", name);
  }
  const cmdFile = join(dir, "cmd");
  const scriptFile = join(dir, "script");
  let cmd = "";

  if (existsSync(cmdFile)) {
    cmd = readFileSync(cmdFile, "utf8");
  }

  if (existsSync(scriptFile)) {
    const script = readFileSync(scriptFile, "utf8");
    const match = script.match(/"params":\s*\[\s*"([^"]+)"\s*\]/);
    if (match) {
      cmd = match[1];
    }
  }

  return {
    name,
    rc: existsSync(join(dir, "rc")) ? readFileSync(join(dir, "rc"), "utf8") : undefined,
    in: existsSync(join(dir, "in")) ? readFileSync(join(dir, "in"), "utf8") : "",
    out: existsSync(join(dir, "out")) ? readFileSync(join(dir, "out"), "utf8") : undefined,
    error: existsSync(join(dir, "error")) ? readFileSync(join(dir, "error"), "utf8") : undefined,
    cmd
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
    '  let dir = join(ROOT, name);',
    '  if (!existsSync(dir)) {',
    '    dir = join(ROOT, "normal", name);',
    '  }',
    '  const cmdFile = join(dir, "cmd");',
    '  const scriptFile = join(dir, "script");',
    '  let cmd = "";',
    '  if (existsSync(cmdFile)) {',
    '    cmd = readFileSync(cmdFile, "utf8");',
    '  }',
    '  if (existsSync(scriptFile)) {',
    '    const script = readFileSync(scriptFile, "utf8");',
    '    const match = script.match(/"params":\\s*\\[\\s*"([^"]+)"\\s*\\]/);',
    '    if (match) {',
    '      cmd = match[1];',
    '    }',
    '  }',
    '  return {',
    '    name,',
    '    rc: existsSync(join(dir, "rc")) ? readFileSync(join(dir, "rc"), "utf8") : undefined,',
    '    in: existsSync(join(dir, "in")) ? readFileSync(join(dir, "in"), "utf8") : "",',
    '    out: existsSync(join(dir, "out")) ? readFileSync(join(dir, "out"), "utf8") : undefined,',
    '    error: existsSync(join(dir, "error")) ? readFileSync(join(dir, "error"), "utf8") : undefined,',
    '    cmd',
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
    '  const actual = runKakouneFixture({ in: fixture.in, rc: fixture.rc, cmd: fixture.cmd });',
    '  if (fixture.out !== undefined) {',
    '    expect(normalize(actual.doc)).toBe(normalize(parseSelectionMarkers(fixture.out)));',
    '  }',
    '  if (fixture.error) {',
    '    expect(actual.error).toBe(normalize(fixture.error));',
    '  }',
    '});',
    ''
  ].join("\n");
}

async function main() {
  const progress = parseParityProgress(readFileSync(DOC_PATH, "utf8"));
  const tempDir = join(rootDir, "packages/codemirror-kakoune/test/poc/.kakoune-parity-probe");
  const testPath = join(tempDir, "probe.test.ts");

  mkdirSync(tempDir, { recursive: true });
  try {
    const resolved = await findPromotableFixture(progress, async name => {
      const fixture = readFixture(name);
      if (!fixture) {
        return false;
      }

      writeFileSync(testPath, buildProbeTest(fixture.name));

      const result = spawnSync("pnpm", ["--filter", "codemirror-kakoune", "exec", "jest", "--runInBand", "--runTestsByPath", testPath], {
        cwd: rootDir,
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
