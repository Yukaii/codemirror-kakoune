import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadKakouneFixtures, resolveKakouneRoot } from "./kakoune-fixtures";

function createFixtureTree(): string {
  const root = mkdtempSync(join(tmpdir(), "kakoune-fixtures-"));
  const fixtureDir = join(root, "basic");

  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(fixtureDir, "cmd"), "gg");
  writeFileSync(join(fixtureDir, "in"), "hello");
  writeFileSync(join(fixtureDir, "rc"), "set-option foo bar");

  return root;
}

afterEach(() => {
  Reflect.deleteProperty(process.env, "KAKOUNE_ROOT");
});

describe("loadKakouneFixtures", () => {
  it("discovers Kakoune fixtures and loads optional fixture files", () => {
    const root = createFixtureTree();

    try {
      const fixtures = loadKakouneFixtures(root, 1);

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0]).toMatchObject({
        path: "basic/cmd",
        hasIn: true,
        hasRc: true,
        hasError: false,
        cmd: "gg",
        in: "hello",
        rc: "set-option foo bar",
        error: undefined
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves the repo-relative Kakoune root by default", () => {
    expect(resolveKakouneRoot()).toBe(join(process.cwd(), "test/kakoune"));
  });

  it("allows an explicit override for the Kakoune root", () => {
    expect(resolveKakouneRoot("/tmp/kakoune-test-tree")).toBe("/tmp/kakoune-test-tree");
  });

  it("allows an environment override for the Kakoune root", () => {
    process.env.KAKOUNE_ROOT = "/tmp/kakoune-test-tree";

    expect(resolveKakouneRoot()).toBe("/tmp/kakoune-test-tree");
  });
});
