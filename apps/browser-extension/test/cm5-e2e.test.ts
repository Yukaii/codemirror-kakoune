import CodeMirror5 from "codemirror";
import "codemirror/keymap/vim";
import { kakoune, Cm5Adapter } from "codemirror-kakoune-cm5";
import { normalizeKeyStroke } from "kakoune-core-js";

const zeroRect = (): DOMRect => ({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({})
});

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = zeroRect;
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [zeroRect()] as unknown as DOMRectList;
}

function createCM5Editor(initialText: string, options: CodeMirror5.EditorConfiguration = {}): CodeMirror5.Editor {
  const textarea = document.createElement("textarea");
  textarea.value = initialText;
  document.body.appendChild(textarea);

  return CodeMirror5.fromTextArea(textarea, {
    lineNumbers: true,
    tabSize: 2,
    ...options
  });
}

describe("CodeMirror 5 E2E Integration and Keymap Override", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("overrides conflicting Vim keymaps and executes Kakoune motions", () => {
    // 1. Create a CM5 editor configured with vim keyMap
    const cm = createCM5Editor("first line\nsecond line\nthird line", {
      keyMap: "vim" as any
    });

    expect(cm.getOption("keyMap")).toBe("vim");

    // 2. Attach Kakoune CM5 adapter
    let whichKeyPending: string[] = [];
    kakoune(cm, {
      initialMode: "select",
      onWhichKey: (pending) => {
        whichKeyPending = pending;
      }
    });

    // 3. Verify keyMap was reset to default to avoid Vim conflicts
    expect(cm.getOption("keyMap")).toBe("default");
    expect((cm as any).__kakoune_original_keymap).toBe("vim");

    const adapter = new Cm5Adapter(cm);
    expect(adapter.getMode()).toBe("select");

    // 4. Test Kakoune word motion 'w'
    const wrapper = cm.getWrapperElement();
    const input = cm.getInputField();

    // Trigger Kakoune 'w' motion via keydown event
    const eventW = new KeyboardEvent("keydown", { key: "w", bubbles: true, cancelable: true });
    input.dispatchEvent(eventW);

    const selectionsAfterW = adapter.getSelections();
    expect(selectionsAfterW[0].anchor).toBe(0);
    expect(selectionsAfterW[0].head).toBe(6); // 'first '

    // 5. Test Kakoune line selection 'x'
    const eventX = new KeyboardEvent("keydown", { key: "x", bubbles: true, cancelable: true });
    input.dispatchEvent(eventX);

    const selectionsAfterX = adapter.getSelections();
    expect(selectionsAfterX[0].anchor).toBe(0);
    expect(selectionsAfterX[0].head).toBe(11); // 'first line\n'

    // 6. Test joining lines '<A-j>'
    const eventAltJ = new KeyboardEvent("keydown", { key: "j", altKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(eventAltJ);

    expect(adapter.getDoc()).toContain("first line second line");
  });

  it("supports custom kakrc scripting in CodeMirror 5", () => {
    const cm = createCM5Editor("hello world");
    kakoune(cm, {
      initialMode: "select",
      customKakrc: "map global normal <space> ,"
    });

    const adapter = new Cm5Adapter(cm);
    expect(adapter.getDoc()).toBe("hello world");
  });
});
