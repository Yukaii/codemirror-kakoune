export interface VirtualKeyboardEditorTarget {
  focus(): void;
  getInputField(): HTMLElement;
}

export interface VirtualKeyboardViewport extends EventTarget {
  height: number;
  offsetTop: number;
}

export interface VirtualKeyboardOptions {
  viewport?: VirtualKeyboardViewport | null;
  getWindowHeight?: () => number;
}

function isModifierKey(key: string): boolean {
  return key === "Alt" || key === "Control" || key === "Meta" || key === "Shift";
}

export function attachVirtualKeyboard(
  root: HTMLElement,
  editor: VirtualKeyboardEditorTarget,
  options: VirtualKeyboardOptions = {}
): () => void {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const input = editor.getInputField();
  const ctrlButton = root.querySelector<HTMLButtonElement>("[data-mod='ctrl']");
  const altButton = root.querySelector<HTMLButtonElement>("[data-mod='alt']");
  let pendingCtrl = false;
  let pendingAlt = false;
  let dispatchingSynthetic = false;

  if (!ctrlButton || !altButton) {
    throw new Error("Virtual keyboard modifier buttons not found.");
  }

  const updateModifiers = () => {
    ctrlButton.classList.toggle("active", pendingCtrl);
    altButton.classList.toggle("active", pendingAlt);
  };

  const clearModifiers = () => {
    pendingCtrl = false;
    pendingAlt = false;
    updateModifiers();
  };

  const dispatchKey = (key: string, code: string, ctrlKey: boolean, altKey: boolean, shiftKey = false) => {
    editor.focus();
    dispatchingSynthetic = true;
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      ctrlKey,
      altKey,
      shiftKey,
      bubbles: true,
      cancelable: true
    }));
  };

  const onPointerDown = (event: PointerEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".vk-key");
    if (!button) return;
    event.preventDefault();
    button.classList.add("pressed");

    if (button.dataset.mod === "ctrl") {
      pendingCtrl = !pendingCtrl;
      pendingAlt = false;
      updateModifiers();
      editor.focus();
      return;
    }
    if (button.dataset.mod === "alt") {
      pendingAlt = !pendingAlt;
      pendingCtrl = false;
      updateModifiers();
      editor.focus();
      return;
    }

    const ctrlKey = pendingCtrl;
    const altKey = pendingAlt;
    clearModifiers();
    dispatchKey(
      button.dataset.key ?? "",
      button.dataset.code ?? "",
      ctrlKey,
      altKey,
      button.dataset.shift === "true"
    );
  };

  const clearPressed = () => {
    root.querySelectorAll(".vk-key.pressed").forEach(button => button.classList.remove("pressed"));
  };

  const onInputKeyDown = (event: KeyboardEvent) => {
    if (dispatchingSynthetic) {
      dispatchingSynthetic = false;
      return;
    }
    if ((!pendingCtrl && !pendingAlt) || isModifierKey(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const ctrlKey = pendingCtrl;
    const altKey = pendingAlt;
    clearModifiers();
    const ctrlTab = event.key === "Tab" && ctrlKey && !altKey;
    dispatchKey(ctrlTab ? "i" : event.key, event.code, ctrlKey, altKey, event.shiftKey);
  };

  const viewport = options.viewport === undefined
    ? window?.visualViewport ?? null
    : options.viewport;
  const getWindowHeight = options.getWindowHeight ?? (() => window?.innerHeight ?? 0);
  const reposition = () => {
    if (!viewport) return;
    const bottomSpace = getWindowHeight() - (viewport.offsetTop + viewport.height);
    root.style.bottom = `${Math.max(0, bottomSpace)}px`;
  };

  root.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointerup", clearPressed);
  document.addEventListener("pointercancel", clearPressed);
  input.addEventListener("keydown", onInputKeyDown, { capture: true });
  viewport?.addEventListener("resize", reposition);
  viewport?.addEventListener("scroll", reposition);
  reposition();

  return () => {
    root.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointerup", clearPressed);
    document.removeEventListener("pointercancel", clearPressed);
    input.removeEventListener("keydown", onInputKeyDown, { capture: true });
    viewport?.removeEventListener("resize", reposition);
    viewport?.removeEventListener("scroll", reposition);
  };
}
