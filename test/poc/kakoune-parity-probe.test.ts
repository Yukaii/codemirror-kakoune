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
});
