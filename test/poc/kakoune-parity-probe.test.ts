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

  it("pastes before a selection", () => {
    const result = runKakouneFixture({ in: "-foo-%(bar)", cmd: "dhP" });

    expect(result.doc).toBe("-foobar-");
  });

  it("pastes before multiple selections", () => {
    const result = runKakouneFixture({ in: "foobar", cmd: "xSo<ret>dP" });

    expect(result.doc).toBe("foobar\n");
  });

  it("reports split-selection state for the multi-selection paste path", () => {
    const result = runKakouneFixture({ in: "foobar", cmd: "xSo<ret>" });

    expect(result.selectionRanges).toEqual([
      { anchor: 0, head: 1 },
      { anchor: 3, head: 6 }
    ]);
  });

  it("reports the doc after delete in the multi-selection paste path", () => {
    const result = runKakouneFixture({ in: "foobar", cmd: "xSo<ret>d" });

    expect(result.doc).toBe("oo");
  });

  it("pastes all after multiple selections", () => {
    const result = runKakouneFixture({ in: "-%(foo)-%(bar)-%(baz)-", cmd: "y<a-p>" });

    expect(result.doc).toBe("-foofoobarbaz-barfoobarbaz-bazfoobarbaz-");
  });

  it("pastes all before multiple selections", () => {
    const result = runKakouneFixture({ in: "-%(foo)-%(bar)-%(baz)-", cmd: "y<a-P>" });

    expect(result.doc).toBe("-foobarbazfoo-foobarbazbar-foobarbazbaz-");
  });

  it("replaces multiple selections with all pasted content", () => {
    const result = runKakouneFixture({ in: "-%(foo)-%(bar)-%(baz)-", cmd: "y<a-R>" });

    expect(result.doc).toBe("-foobarbaz-foobarbaz-foobarbaz-");
  });

  it("replaces insert mode selections", () => {
    const result = runKakouneFixture({ in: "%(word1)%(word2)%(word3)%(word4)", cmd: "cthis was <c-r>\" <esc>" });

    expect(result.doc).toBe("this was word1 this was word2 this was word3 this was word4 ");
  });

  it("handles single selection change without reversing typed text", () => {
    const result = runKakouneFixture({ in: "c’est %(difficile).", cmd: "cfacile" });

    expect(result.doc).toBe("c’est facile.");
  });

  it("rotates selections content", () => {
    const result = runKakouneFixture({ in: "%(foo) %(bar) %(baz)", cmd: "<a-)>" });

    expect(result.doc).toBe("baz foo bar");
  });

  it("converts tabs to spaces and spaces to tabs", () => {
    const spaces = runKakouneFixture({ in: "void main()\n{\n\tfoo();\n}", cmd: "%@" });
    expect(spaces.doc).toBe("void main()\n{\n        foo();\n}");

    const tabs = runKakouneFixture({ in: "void main()\n{\n        foo();\n}", cmd: "%<a-@>" });
    expect(tabs.doc).toBe("void main()\n{\n\tfoo();\n}");
  });

  it("indents and deindents selected lines", () => {
    const deindented = runKakouneFixture({ in: "    foo", cmd: "<" });
    expect(deindented.doc).toBe("foo");

    const indented = runKakouneFixture({ in: "    %(foo)", cmd: "<" });
    expect(indented.doc).toBe("foo");
  });

  it("trims whitespace from selections", () => {
    const result = runKakouneFixture({ in: "line 1\n  line 2\n    line 3", cmd: "%<a-s>_<a-)>" });
    expect(result.doc).toBe("line 3\n  line 1\n    line 2");
  });

  it("aligns selections with spaces and tabs", () => {
    const spaces = runKakouneFixture({ in: "a %(a)\nbb %(b)b\nccc %(c)cc", cmd: "&" });
    expect(spaces.doc).toBe("a   a\nbb  bb\nccc ccc");

    const tabs = runKakouneFixture({ in: "\t\t\t\tif (%(v)alid)\n\t\t\t\t%(x)", cmd: "&" });
    expect(tabs.doc).toBe("\t\t\t\tif (valid)\n\t\t\t\t\tx");
  });

  it("replaces lines with yanked text across split selections and handles undo", () => {
    const replaced = runKakouneFixture({ in: "line 1\nline 2\nline 3\nline 4", cmd: "ey%<a-s>R" });
    expect(replaced.doc).toBe("linelinelineline");

    const undone = runKakouneFixture({ in: "line 1\nline 2\nline 3\nline 4", cmd: "ey%<a-s>RuU" });
    expect(undone.doc).toBe("linelinelineline");
  });

});
