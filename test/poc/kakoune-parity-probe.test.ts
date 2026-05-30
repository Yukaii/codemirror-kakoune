import probeHelpers from "../../scripts/kakoune-parity-probe-helpers.cjs";
import { runKakouneFixture } from "./run-kakoune-fixture";

const { parseParityProgress, renderParityProgress, selectNextProbeFixture, promoteParityFixture, findPromotableFixture } = probeHelpers;

describe("kakoune parity probe helpers", () => {
  it("parses the progress doc into supported and red fixtures", () => {
    const parsed = parseParityProgress(`
# Kakoune Parity Progress

## Verified Supported
- open-above
- delete

## Still Red
- replace
- redo
`);

    expect(parsed.supported).toEqual(["open-above", "delete"]);
    expect(parsed.red).toEqual(["replace", "redo"]);
  });

  it("selects the first red fixture that is not already supported", () => {
    const candidate = selectNextProbeFixture({
      supported: ["open-above", "delete"],
      red: ["delete", "replace", "redo"]
    });

    expect(candidate).toBe("replace");
  });

  it("promotes a fixture by moving it out of red and into supported", () => {
    const updated = promoteParityFixture({
      supported: ["open-above"],
      red: ["replace", "redo", "replace"]
    }, "replace");

    expect(updated).toEqual({
      supported: ["open-above", "replace"],
      red: ["redo"]
    });

    expect(renderParityProgress(updated)).toContain("- replace");
  });

  it("finds the first promotable fixture by probing candidates in order", async () => {
    const candidate = await findPromotableFixture(
      {
        supported: ["open-above"],
        red: ["replace", "redo", "delete"]
      },
      async (name: string) => name === "redo"
    );

    expect(candidate).toBe("redo");
  });

  it("seeds the initial selection from input markers", () => {
    const result = runKakouneFixture({ in: "%(foo)", cmd: "" });

    expect(result.doc).toBe("foo");
    expect(result.selectionRanges).toEqual([{ anchor: 0, head: 3 }]);
  });

  it("supports replace-char against the fixture runner", () => {
    const result = runKakouneFixture({ in: "a", cmd: "rb" });

    expect(result.doc).toBe("b");
  });

  it("inserts the yank register in insert mode", () => {
    const result = runKakouneFixture({ in: "%(foo)", cmd: "ya<c-r>\"" });

    expect(result.doc).toBe("foofoo");
  });

  it("pastes after the cursor after a delete", () => {
    const result = runKakouneFixture({ in: "-foo%(bar)-", cmd: "dp" });

    expect(result.doc).toBe("-foo-bar");
  });

  it("jumps forward through the jump list", () => {
    const result = runKakouneFixture({ in: "%(foo)\nbar\nqux", cmd: "gj\n/bar<ret>\n/qux<ret>\n<c-o><c-o><c-o>\n<c-i><c-i><c-i>\naend<esc>" });

    expect(result.doc).toBe("foo\nbar\nquxend");
  });

  it("restores a dirty middle jump entry", () => {
    const result = runKakouneFixture({ in: "%(foo)\nbar\nqux", cmd: "gj\n/bar<ret>\n/qux<ret>\n<c-o>\nh\n<c-o>\naend<esc>" });

    expect(result.doc).toBe("foo\nbarend\nqux");
  });

  it("duplicates selections before insert mode", () => {
    const result = runKakouneFixture({ in: "%(f) %(b) %(t)", cmd: "++ao<esc>" });

    expect(result.doc).toBe("fooo booo tooo");
  });

  it("moves j without extending the selection", () => {
    const result = runKakouneFixture({ in: "foo\n%()\nbar", cmd: "j" });

    expect(result.selectionRanges).toEqual([{ anchor: 5, head: 5 }]);
  });
});
