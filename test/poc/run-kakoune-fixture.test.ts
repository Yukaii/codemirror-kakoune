import { runKakouneFixture, tokenizeKakouneCmd } from "./run-kakoune-fixture";

describe("tokenizeKakouneCmd", () => {
  it("splits plain printable keys", () => {
    expect(tokenizeKakouneCmd("gk")).toEqual(["g", "k"]);
  });

  it("keeps supported bracketed tokens intact", () => {
    expect(tokenizeKakouneCmd("o<Esc><Enter><Backspace><A-w><C-x>")).toEqual([
      "o",
      "<Esc>",
      "<Enter>",
      "<Backspace>",
      "<A-w>",
      "<C-x>"
    ]);
  });
});

describe("runKakouneFixture", () => {
  it("executes a minimal insert-line PoC", () => {
    const result = runKakouneFixture({
      in: "hello",
      cmd: "o"
    });

    expect(result.tokens).toEqual(["o"]);
    expect(result.doc).toBe("hello\n");
    expect(result.mode).toBe("insert");
    expect(result.selectionRanges).toHaveLength(1);
  });

  it("executes a minimal motion PoC", () => {
    const result = runKakouneFixture({
      in: "hello\nworld",
      cmd: "gk"
    });

    expect(result.tokens).toEqual(["g", "k"]);
    expect(result.mode).toBe("select");
    expect(result.selectionRanges[0]?.head).toBe(0);
  });

  it("surfaces jump count errors", () => {
    const result = runKakouneFixture({
      in: "foo\nbar\nqux",
      cmd: "gj\n/bar<ret>\n/qux<ret>\n<c-o><c-o><c-o>\n42<c-i>"
    });

    expect(result.error).toBe("'exec': no next jump");
  });

  it("expands a simple insert-mode map from rc", () => {
    const first = runKakouneFixture({
      rc: "map global insert y '<a-;>gh'",
      cmd: "ixyz<esc>"
    });
    const result = runKakouneFixture({
      rc: "map global insert y '<a-;>gh'",
      cmd: "ixyz<esc>."
    });

    expect(first.doc).toBe("zx");
    expect(result.doc).toBe("zzxx");
  });
});
