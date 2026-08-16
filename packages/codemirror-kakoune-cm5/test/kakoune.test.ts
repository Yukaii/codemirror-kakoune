import CodeMirror from "codemirror";
import { kakoune } from "../src";

function createEditor(
  doc: string,
  options: Parameters<typeof kakoune>[1] = {}
): CodeMirror.Editor {
  const textarea = document.createElement("textarea");
  textarea.value = doc;
  document.body.appendChild(textarea);
  const editor = CodeMirror.fromTextArea(textarea);
  kakoune(editor, options);
  return editor;
}

function dispatchKey(
  editor: CodeMirror.Editor,
  key: string,
  modifiers: Pick<KeyboardEventInit, "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers
  });
  editor.getInputField().dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CM5 normal-mode input isolation", () => {
  it.each(["z", "Enter", "Backspace", "Delete", "Tab"])(
    "prevents the unhandled %s key from reaching CM5's default keymap",
    key => {
      const editor = createEditor("alpha");

      const event = dispatchKey(editor, key);

      expect(event.defaultPrevented).toBe(true);
      expect(editor.getValue()).toBe("alpha");
    }
  );

  it.each([
    ["Ctrl-v", "v", { ctrlKey: true }],
    ["Meta-v", "v", { metaKey: true }],
    ["Ctrl-x", "x", { ctrlKey: true }],
    ["Alt-Backspace", "Backspace", { altKey: true }]
  ] as const)("prevents the unhandled %s editing shortcut", (_name, key, modifiers) => {
    const editor = createEditor("alpha");

    const event = dispatchKey(editor, key, modifiers);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.getValue()).toBe("alpha");
  });

  it.each(["+input", "+delete", "paste", "cut"])(
    "rejects direct %s document changes in normal mode",
    origin => {
      const editor = createEditor("alpha");

      editor.replaceRange("X", { line: 0, ch: 0 }, { line: 0, ch: 1 }, origin);

      expect(editor.getValue()).toBe("alpha");
    }
  );

  it("manages cm-fat-cursor class and kakouneMode when switching modes", () => {
    const editor = createEditor("alpha");
    const wrapper = editor.getWrapperElement();

    expect(wrapper.dataset.kakouneMode).toBe("select");
    expect(wrapper.classList.contains("cm-fat-cursor")).toBe(true);

    dispatchKey(editor, "i");
    expect(wrapper.dataset.kakouneMode).toBe("insert");
    expect(wrapper.classList.contains("cm-fat-cursor")).toBe(false);

    dispatchKey(editor, "Escape");
    expect(wrapper.dataset.kakouneMode).toBe("select");
    expect(wrapper.classList.contains("cm-fat-cursor")).toBe(true);
  });

  it("allows direct input after entering insert mode", () => {
    const editor = createEditor("alpha");

    expect(dispatchKey(editor, "i").defaultPrevented).toBe(true);
    expect(editor.getWrapperElement().dataset.kakouneMode).toBe("insert");

    editor.replaceRange("X", { line: 0, ch: 0 }, { line: 0, ch: 0 }, "+input");
    expect(editor.getValue()).toBe("Xalpha");
  });

  it("still allows Kakoune commands to edit in normal mode", () => {
    const editor = createEditor("alpha");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });

    expect(dispatchKey(editor, "d").defaultPrevented).toBe(true);
    expect(editor.getValue()).toBe("lpha");
  });
});

describe("CM5 extend motions", () => {
  it.each([
    ["H", { line: 0, ch: 2 }, { line: 0, ch: 1 }],
    ["L", { line: 0, ch: 1 }, { line: 0, ch: 2 }],
    ["J", { line: 0, ch: 1 }, { line: 1, ch: 1 }],
    ["K", { line: 1, ch: 1 }, { line: 0, ch: 1 }]
  ] as const)("extends with %s while keeping the original anchor", (key, start, expectedHead) => {
    const editor = createEditor("abc\ndef");
    editor.setCursor(start);

    expect(dispatchKey(editor, key).defaultPrevented).toBe(true);

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual(start);
    expect(selection.head).toEqual(expectedHead);
  });

  it.each([
    ["W", { line: 0, ch: 4 }],
    ["E", { line: 0, ch: 3 }]
  ] as const)("extends with the %s word motion", (key, expectedHead) => {
    const editor = createEditor("one two three");
    editor.setCursor({ line: 0, ch: 0 });

    expect(dispatchKey(editor, key).defaultPrevented).toBe(true);

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual({ line: 0, ch: 0 });
    expect(selection.head).toEqual(expectedHead);
  });

  it("extends backward with B", () => {
    const editor = createEditor("one two three");
    editor.setCursor({ line: 0, ch: 4 });

    expect(dispatchKey(editor, "B").defaultPrevented).toBe(true);

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual({ line: 0, ch: 4 });
    expect(selection.head).toEqual({ line: 0, ch: 0 });
  });

  it("supports counts with uppercase extend motions", () => {
    const editor = createEditor("abcdef");
    editor.setCursor({ line: 0, ch: 1 });

    dispatchKey(editor, "3");
    dispatchKey(editor, "L");

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual({ line: 0, ch: 1 });
    expect(selection.head).toEqual({ line: 0, ch: 4 });
  });

  it.each([
    ["h", { line: 0, ch: 0 }],
    ["l", { line: 0, ch: 5 }]
  ] as const)("extends to the line boundary with Alt-%s", (key, expectedHead) => {
    const editor = createEditor("alpha");
    editor.setCursor({ line: 0, ch: 2 });

    dispatchKey(editor, key, { altKey: true });

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual({ line: 0, ch: 2 });
    expect(selection.head).toEqual(expectedHead);
  });
});

describe("CM5 G-prefix motions", () => {
  it.each([
    ["h", { line: 1, ch: 0 }],
    ["H", { line: 1, ch: 0 }],
    ["l", { line: 1, ch: 3 }],
    ["L", { line: 1, ch: 3 }],
    ["k", { line: 0, ch: 0 }],
    ["K", { line: 0, ch: 0 }],
    ["j", { line: 2, ch: 5 }],
    ["J", { line: 2, ch: 5 }],
    ["g", { line: 0, ch: 0 }],
    ["G", { line: 0, ch: 0 }]
  ] as const)("extends with G %s", (key, expectedHead) => {
    const editor = createEditor("one\ntwo\nthree");
    const start = { line: 1, ch: 1 };
    editor.setCursor(start);

    expect(dispatchKey(editor, "G").defaultPrevented).toBe(true);
    expect(dispatchKey(editor, key).defaultPrevented).toBe(true);

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual(start);
    expect(selection.head).toEqual(expectedHead);
  });

  it("extends to a counted line with count+G", () => {
    const editor = createEditor("one\ntwo\nthree");
    const start = { line: 0, ch: 1 };
    editor.setCursor(start);

    dispatchKey(editor, "3");
    dispatchKey(editor, "G");

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual(start);
    expect(selection.head).toEqual({ line: 2, ch: 0 });
  });

  it("advertises every g and G prefix completion", () => {
    const updates: Array<{ pending: string[]; keys: string[] }> = [];
    const editor = createEditor("one\ntwo", {
      onWhichKey(pending, items) {
        updates.push({
          pending: [...pending],
          keys: items.map(item => item.keys.join(" ")).sort()
        });
      }
    });

    dispatchKey(editor, "g");
    expect(updates.at(-1)).toEqual({
      pending: ["g"],
      keys: ["g g", "g h", "g j", "g k", "g l"]
    });

    dispatchKey(editor, "Escape");
    dispatchKey(editor, "G");
    expect(updates.at(-1)).toEqual({
      pending: ["G"],
      keys: ["G G", "G H", "G J", "G K", "G L", "G g", "G h", "G j", "G k", "G l"]
    });
  });
});

describe("CM5 select and split prompts", () => {
  it("selects regex matches with % s and Enter", () => {
    const states: Array<{ kind: string; text: string } | null> = [];
    const editor = createEditor("alpha beta gamma beta", {
      onPrompt(prompt) {
        states.push(prompt ? { ...prompt } : null);
      }
    });

    dispatchKey(editor, "%");
    dispatchKey(editor, "s");
    expect(states.at(-1)).toEqual({ kind: "select", text: "" });
    for (const key of "betax") dispatchKey(editor, key);
    dispatchKey(editor, "Backspace");
    expect(states.at(-1)).toEqual({ kind: "select", text: "beta" });
    dispatchKey(editor, "Enter");

    expect(states.at(-1)).toBeNull();
    expect(editor.listSelections().map(selection => editor.getRange(selection.from(), selection.to())))
      .toEqual(["beta", "beta"]);
  });

  it("splits the current selection with S", () => {
    const editor = createEditor("foo bar baz");
    dispatchKey(editor, "%");
    dispatchKey(editor, "S");
    for (const key of "\\s+") dispatchKey(editor, key);
    dispatchKey(editor, "Enter");

    expect(editor.listSelections().map(selection => editor.getRange(selection.from(), selection.to())))
      .toEqual(["foo", "bar", "baz"]);
  });

  it("cancels a prompt with Escape and restores its selection snapshot", () => {
    const editor = createEditor("alpha beta");
    const original = { anchor: { line: 0, ch: 2 }, head: { line: 0, ch: 8 } };
    editor.setSelection(original.anchor, original.head);

    dispatchKey(editor, "s");
    dispatchKey(editor, "a");
    editor.setCursor({ line: 0, ch: 0 });
    dispatchKey(editor, "Escape");

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual(original.anchor);
    expect(selection.head).toEqual(original.head);
  });

  it("reports invalid and empty prompt results without changing selections", () => {
    const errors: Array<string | null> = [];
    const editor = createEditor("alpha", {
      onPromptError(message) {
        errors.push(message);
      }
    });
    dispatchKey(editor, "%");
    const original = editor.listSelections()[0];

    dispatchKey(editor, "s");
    dispatchKey(editor, "[");
    dispatchKey(editor, "Enter");
    expect(errors.at(-1)).toBe("'select': invalid regex \"[\"");
    expect(editor.listSelections()[0].anchor).toEqual(original.anchor);
    expect(editor.listSelections()[0].head).toEqual(original.head);

    dispatchKey(editor, "S");
    dispatchKey(editor, "Enter");
    expect(errors.at(-1)).toBe("'split': empty regex");
  });
});

describe("CM5 advertised key audit", () => {
  it.each([
    ["h", { line: 0, ch: 2 }, { line: 0, ch: 1 }],
    ["l", { line: 0, ch: 1 }, { line: 0, ch: 2 }],
    ["j", { line: 0, ch: 1 }, { line: 1, ch: 1 }],
    ["k", { line: 1, ch: 1 }, { line: 0, ch: 1 }]
  ] as const)("moves with %s", (key, start, expectedHead) => {
    const editor = createEditor("abc\ndef");
    editor.setCursor(start);

    dispatchKey(editor, key);

    expect(editor.getCursor()).toEqual(expectedHead);
    expect(editor.somethingSelected()).toBe(false);
  });

  it.each([
    ["w", { line: 0, ch: 0 }, { line: 0, ch: 4 }],
    ["b", { line: 0, ch: 4 }, { line: 0, ch: 0 }],
    ["e", { line: 0, ch: 0 }, { line: 0, ch: 3 }]
  ] as const)("selects with the %s word motion", (key, start, expectedHead) => {
    const editor = createEditor("one two three");
    editor.setCursor(start);

    dispatchKey(editor, key);

    const selection = editor.listSelections()[0];
    expect(selection.anchor).toEqual(start);
    expect(selection.head).toEqual(expectedHead);
  });

  it.each([
    ["0", [], { line: 1, ch: 0 }],
    ["$", [], { line: 1, ch: 3 }],
    ["g h", ["g", "h"], { line: 1, ch: 0 }],
    ["g l", ["g", "l"], { line: 1, ch: 3 }],
    ["g k", ["g", "k"], { line: 0, ch: 0 }],
    ["g j", ["g", "j"], { line: 2, ch: 5 }],
    ["g g", ["g", "g"], { line: 0, ch: 0 }]
  ] as const)("moves to the expected boundary with %s", (name, sequence, expectedHead) => {
    const editor = createEditor("one\ntwo\nthree");
    editor.setCursor({ line: 1, ch: 1 });

    if (sequence.length === 0) {
      dispatchKey(editor, name);
    } else {
      sequence.forEach(key => dispatchKey(editor, key));
    }

    expect(editor.getCursor()).toEqual(expectedHead);
  });

  it("supports counts with lowercase motions", () => {
    const editor = createEditor("abcdef");
    editor.setCursor({ line: 0, ch: 1 });

    dispatchKey(editor, "3");
    dispatchKey(editor, "l");

    expect(editor.getCursor()).toEqual({ line: 0, ch: 4 });
  });

  it.each([
    ["i", { line: 0, ch: 2 }, { line: 0, ch: 2 }],
    ["a", { line: 0, ch: 2 }, { line: 0, ch: 3 }],
    ["I", { line: 0, ch: 2 }, { line: 0, ch: 0 }],
    ["A", { line: 0, ch: 2 }, { line: 0, ch: 5 }]
  ] as const)("enters insert mode with %s", (key, start, expectedHead) => {
    const editor = createEditor("alpha");
    editor.setCursor(start);

    dispatchKey(editor, key);

    expect(editor.getWrapperElement().dataset.kakouneMode).toBe("insert");
    expect(editor.getCursor()).toEqual(expectedHead);
    dispatchKey(editor, "Escape");
    expect(editor.getWrapperElement().dataset.kakouneMode).toBe("select");
  });

  it.each([
    ["o", "one\n\ntwo", { line: 1, ch: 0 }],
    ["O", "\none\ntwo", { line: 0, ch: 0 }]
  ] as const)("opens a line with %s", (key, expectedDoc, expectedHead) => {
    const editor = createEditor("one\ntwo");
    editor.setCursor({ line: 0, ch: 1 });

    dispatchKey(editor, key);

    expect(editor.getValue()).toBe(expectedDoc);
    expect(editor.getCursor()).toEqual(expectedHead);
    expect(editor.getWrapperElement().dataset.kakouneMode).toBe("insert");
  });

  it("selects, deletes, and changes with x, d, and c", () => {
    const editor = createEditor("alpha\nbeta");

    dispatchKey(editor, "x");
    expect(editor.getSelection()).toBe("alpha\n");
    dispatchKey(editor, "d");
    expect(editor.getValue()).toBe("beta");

    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
    dispatchKey(editor, "c");
    expect(editor.getValue()).toBe("eta");
    expect(editor.getWrapperElement().dataset.kakouneMode).toBe("insert");
  });

  it("removes the final line completely with xd", () => {
    const editor = createEditor("alpha\nbeta");
    editor.setCursor({ line: 1, ch: 2 });

    dispatchKey(editor, "x");
    expect(editor.getSelection()).toBe("beta");
    dispatchKey(editor, "d");

    expect(editor.getValue()).toBe("alpha");
  });

  it("removes a final empty line completely with xd", () => {
    const editor = createEditor("alpha\n");
    editor.setCursor({ line: 1, ch: 0 });

    dispatchKey(editor, "x");
    dispatchKey(editor, "d");

    expect(editor.getValue()).toBe("alpha");
  });

  it("yanks without editing and supports u/U history", () => {
    const editor = createEditor("alpha");
    editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });

    dispatchKey(editor, "y");
    expect(editor.getValue()).toBe("alpha");
    dispatchKey(editor, "d");
    expect(editor.getValue()).toBe("lpha");
    dispatchKey(editor, "u");
    expect(editor.getValue()).toBe("alpha");
    dispatchKey(editor, "U");
    expect(editor.getValue()).toBe("lpha");
  });
});
