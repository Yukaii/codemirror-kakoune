import {
  attachVirtualKeyboard,
  type VirtualKeyboardViewport
} from "../../../apps/playground-cm5/virtual-keyboard";

interface RecordedKey {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

function pointerEvent(type: "pointerdown" | "pointerup" | "pointercancel", target: EventTarget): void {
  target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

function createHarness(options: {
  viewport?: VirtualKeyboardViewport | null;
  getWindowHeight?: () => number;
} = {}) {
  const root = document.createElement("nav");
  root.innerHTML = `
    <button class="vk-key" data-mod="ctrl">Ctrl</button>
    <button class="vk-key" data-mod="alt">Alt</button>
    <button class="vk-key" data-key="s" data-code="KeyS">s</button>
    <button class="vk-key" data-key="S" data-code="KeyS" data-shift="true">S</button>
  `;
  const input = document.createElement("textarea");
  document.body.append(root, input);

  const focus = jest.fn();
  const keys: RecordedKey[] = [];
  input.addEventListener("keydown", event => {
    keys.push({
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey
    });
  });

  const detach = attachVirtualKeyboard(root, {
    focus,
    getInputField: () => input
  }, options);

  const button = (selector: string) => {
    const element = root.querySelector<HTMLButtonElement>(selector);
    if (!element) throw new Error(`Missing test button: ${selector}`);
    return element;
  };

  return { root, input, focus, keys, detach, button };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("CM5 playground virtual keyboard", () => {
  test("focuses the editor and forwards virtual keys", () => {
    const { button, focus, keys } = createHarness({ viewport: null });

    pointerEvent("pointerdown", button("[data-key='s']"));
    pointerEvent("pointerdown", button("[data-key='S']"));

    expect(focus).toHaveBeenCalledTimes(2);
    expect(keys).toEqual([
      { key: "s", code: "KeyS", ctrlKey: false, altKey: false, shiftKey: false },
      { key: "S", code: "KeyS", ctrlKey: false, altKey: false, shiftKey: true }
    ]);
  });

  test("latches one mutually exclusive modifier for the next virtual key", () => {
    const { button, keys } = createHarness({ viewport: null });
    const ctrl = button("[data-mod='ctrl']");
    const alt = button("[data-mod='alt']");

    pointerEvent("pointerdown", ctrl);
    expect(ctrl.classList.contains("active")).toBe(true);
    pointerEvent("pointerdown", alt);
    expect(ctrl.classList.contains("active")).toBe(false);
    expect(alt.classList.contains("active")).toBe(true);
    pointerEvent("pointerdown", button("[data-key='s']"));

    expect(keys).toEqual([
      { key: "s", code: "KeyS", ctrlKey: false, altKey: true, shiftKey: false }
    ]);
    expect(alt.classList.contains("active")).toBe(false);
  });

  test("applies a latched modifier to a key from the physical keyboard", () => {
    const { button, input, keys } = createHarness({ viewport: null });
    pointerEvent("pointerdown", button("[data-mod='ctrl']"));

    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "x",
      code: "KeyX",
      bubbles: true,
      cancelable: true
    }));

    expect(keys).toEqual([
      { key: "x", code: "KeyX", ctrlKey: true, altKey: false, shiftKey: false }
    ]);
    expect(button("[data-mod='ctrl']").classList.contains("active")).toBe(false);
  });

  test("maps a latched Ctrl plus Tab to Ctrl-I", () => {
    const { button, input, keys } = createHarness({ viewport: null });
    pointerEvent("pointerdown", button("[data-mod='ctrl']"));

    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true
    }));

    expect(keys).toEqual([
      { key: "i", code: "Tab", ctrlKey: true, altKey: false, shiftKey: false }
    ]);
  });

  test("clears pressed feedback on pointer up and cancellation", () => {
    const { button } = createHarness({ viewport: null });
    const key = button("[data-key='s']");

    pointerEvent("pointerdown", key);
    expect(key.classList.contains("pressed")).toBe(true);
    pointerEvent("pointercancel", document);
    expect(key.classList.contains("pressed")).toBe(false);

    pointerEvent("pointerdown", key);
    pointerEvent("pointerup", document);
    expect(key.classList.contains("pressed")).toBe(false);
  });

  test("follows visual viewport resize and scroll above the software keyboard", () => {
    const viewport = new EventTarget() as VirtualKeyboardViewport;
    viewport.height = 500;
    viewport.offsetTop = 100;
    const { root, detach } = createHarness({ viewport, getWindowHeight: () => 800 });

    expect(root.style.bottom).toBe("200px");

    viewport.height = 620;
    viewport.offsetTop = 80;
    viewport.dispatchEvent(new Event("resize"));
    expect(root.style.bottom).toBe("100px");

    viewport.offsetTop = 210;
    viewport.dispatchEvent(new Event("scroll"));
    expect(root.style.bottom).toBe("0px");

    detach();
    viewport.height = 400;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
    expect(root.style.bottom).toBe("0px");
  });
});
