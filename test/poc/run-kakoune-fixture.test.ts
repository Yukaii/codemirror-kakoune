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
});
