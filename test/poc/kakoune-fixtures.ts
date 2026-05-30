import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export interface KakouneFixture {
  path: string;
  cmd: string;
  in?: string;
  rc?: string;
  error?: string;
  hasIn: boolean;
  hasRc: boolean;
  hasError: boolean;
}

function readOptionalFile(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

export function resolveKakouneRoot(override?: string): string {
  return override || process.env.KAKOUNE_ROOT || join(process.cwd(), "test/kakoune");
}

function walk(root: string, dir: string, fixtures: KakouneFixture[]): void {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, fullPath, fixtures);
      continue;
    }

    if (entry.name !== "cmd") {
      continue;
    }

    const fixtureDir = dir;
    const cmdPath = fullPath;
    const inPath = join(fixtureDir, "in");
    const rcPath = join(fixtureDir, "rc");
    const errorPath = join(fixtureDir, "error");

    const inExists = existsSync(inPath);
    const rcExists = existsSync(rcPath);
    const errorExists = existsSync(errorPath);

    fixtures.push({
      path: relative(root, cmdPath),
      cmd: readFileSync(cmdPath, "utf8"),
      in: readOptionalFile(inPath),
      rc: readOptionalFile(rcPath),
      error: readOptionalFile(errorPath),
      hasIn: inExists,
      hasRc: rcExists,
      hasError: errorExists
    });
  }
}

export function loadKakouneFixtures(root: string, limit: number): KakouneFixture[] {
  const fixtures: KakouneFixture[] = [];
  walk(root, root, fixtures);
  return fixtures.slice(0, limit);
}
