import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { getSearchQuery, highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from "@codemirror/language";
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { kakoune, kakouneStateField } from "../src/index";
import {
  buildPlaygroundEditorTheme,
  isPlaygroundThemeName,
  playgroundThemes,
  type PlaygroundThemeName
} from "./themes";
import "./style.css";

const editorElement = document.querySelector<HTMLDivElement>("#editor");
const configToggle = document.querySelector<HTMLButtonElement>("#config-toggle");
const configModal = document.querySelector<HTMLDivElement>("#config-modal");
const configModalClose = document.querySelector<HTMLButtonElement>("#config-modal-close");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const layoutSelect = document.querySelector<HTMLSelectElement>("#layout-select");
const lineNumbersSelect = document.querySelector<HTMLSelectElement>("#line-numbers-select");
const fontFamilySelect = document.querySelector<HTMLSelectElement>("#font-family-select");
const fontSizeSelect = document.querySelector<HTMLSelectElement>("#font-size-select");
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const searchPill = document.querySelector<HTMLElement>("#search-pill");
const registerPill = document.querySelector<HTMLElement>("#register-pill");
const registerPopover = document.querySelector<HTMLDivElement>("#register-popover");
const registerContent = document.querySelector<HTMLPreElement>("#register-content");
const popoverClose = document.querySelector<HTMLButtonElement>("#popover-close");
const searchPopover = document.querySelector<HTMLDivElement>("#search-popover");
const searchContent = document.querySelector<HTMLPreElement>("#search-content");
const searchPopoverClose = document.querySelector<HTMLButtonElement>("#search-popover-close");
const hudElement = document.querySelector<HTMLDivElement>("#which-key-hud");
const hudTitle = document.querySelector<HTMLElement>("#hud-title");
const hudPrompt = document.querySelector<HTMLElement>("#hud-prompt");
const hudItems = document.querySelector<HTMLDivElement>("#hud-items");
const vk = document.querySelector<HTMLElement>("#vk");
const themeCompartment = new Compartment();
const lineNumberCompartment = new Compartment();
const lineNumberUpdateCompartment = new Compartment();
const fontCompartment = new Compartment();

if (
  !editorElement ||
  !configToggle ||
  !configModal ||
  !configModalClose ||
  !themeSelect ||
  !layoutSelect ||
  !lineNumbersSelect ||
  !fontFamilySelect ||
  !fontSizeSelect ||
  !modePill ||
  !searchPill ||
  !registerPill ||
  !registerPopover ||
  !registerContent ||
  !popoverClose ||
  !searchPopover ||
  !searchContent ||
  !searchPopoverClose ||
  !hudElement ||
  !hudTitle ||
  !hudPrompt ||
  !hudItems ||
  !vk
) {
  throw new Error("Playground shell is missing required DOM nodes.");
}

const themeSelectElement = themeSelect;
const lineNumbersSelectElement = lineNumbersSelect;
const fontFamilySelectElement = fontFamilySelect;
const fontSizeSelectElement = fontSizeSelect;

const themeStorageKey = "codemirror-kakoune.playground.theme";
const layoutStorageKey = "codemirror-kakoune.playground.layout";
const lineNumbersStorageKey = "codemirror-kakoune.playground.lineNumbers";
const fontFamilyStorageKey = "codemirror-kakoune.playground.fontFamily";
const fontSizeStorageKey = "codemirror-kakoune.playground.fontSize";

function getInitialTheme(): PlaygroundThemeName {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return isPlaygroundThemeName(storedTheme) ? storedTheme : "night";
}

function applyTheme(view: EditorView, themeName: PlaygroundThemeName): void {
  const theme = playgroundThemes[themeName];
  document.body.dataset.theme = themeName;
  themeSelectElement.value = themeName;
  window.localStorage.setItem(themeStorageKey, themeName);
  view.dispatch({
    effects: themeCompartment.reconfigure(buildPlaygroundEditorTheme(theme))
  });
}

function relativeLineNumberFormat(lineNo: number, state: EditorState): string {
  const currentLine = state.doc.lineAt(state.selection.main.head).number;
  if (lineNo === currentLine) return String(lineNo);
  return String(Math.abs(lineNo - currentLine));
}

function buildLineNumberExtension(mode: "absolute" | "relative") {
  if (mode === "relative") {
    return lineNumbers({ formatNumber: relativeLineNumberFormat });
  }
  return lineNumbers();
}

function buildLineNumberUpdateExtension(mode: "absolute" | "relative") {
  if (mode === "relative") {
    return EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
        update.view.dispatch({
          effects: lineNumberCompartment.reconfigure(
            lineNumbers({ formatNumber: relativeLineNumberFormat })
          )
        });
      }
    });
  }
  return [];
}

function applyLineNumberMode(view: EditorView, mode: "absolute" | "relative") {
  lineNumbersSelectElement.value = mode;
  window.localStorage.setItem(lineNumbersStorageKey, mode);
  view.dispatch({
    effects: [
      lineNumberCompartment.reconfigure(buildLineNumberExtension(mode)),
      lineNumberUpdateCompartment.reconfigure(buildLineNumberUpdateExtension(mode))
    ]
  });
}

type FontFamily = "mono" | "sans" | "serif";
type FontSize = "small" | "medium" | "large";

const fontFamilies: Record<FontFamily, string> = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif'
};

const fontSizes: Record<FontSize, string> = {
  small: "12px",
  medium: "14px",
  large: "16px"
};

function isFontFamily(value: string | null): value is FontFamily {
  return value === "mono" || value === "sans" || value === "serif";
}

function isFontSize(value: string | null): value is FontSize {
  return value === "small" || value === "medium" || value === "large";
}

function buildFontExtension(family: FontFamily, size: FontSize) {
  return EditorView.theme({
    ".cm-scroller": {
      fontSize: fontSizes[size],
      fontFamily: fontFamilies[family]
    }
  });
}

function applyFontSettings(view: EditorView, family: FontFamily, size: FontSize) {
  fontFamilySelectElement.value = family;
  fontSizeSelectElement.value = size;
  window.localStorage.setItem(fontFamilyStorageKey, family);
  window.localStorage.setItem(fontSizeStorageKey, size);
  view.dispatch({
    effects: fontCompartment.reconfigure(buildFontExtension(family, size))
  });
}

const updateStatus = (view: EditorView): void => {
  const state = view.state.field(kakouneStateField);
  const searchQuery = getSearchQuery(view.state);
  modePill.textContent = state.mode;
  const searchStr =
    state.searchPrompt !== null
      ? `select: ${state.searchPrompt}`
      : searchQuery.valid && searchQuery.search
        ? searchQuery.search
        : "—";
  searchContent.textContent = searchStr;
  const registerStr = state.register ? JSON.stringify(state.register) : '""';
  registerContent.textContent = registerStr;
};

function getWhichKeyTitle(pending: string[]): string {
  if (pending.length === 0) return "which-key";
  const first = pending[0];
  switch (first) {
    case "g":
      return "goto";
    case "G":
      return "goto (extend to)";
    case "[":
      return "select to surrounding object start";
    case "]":
      return "select to surrounding object end";
    case "{":
      return "extend to surrounding object start";
    case "}":
      return "extend to surrounding object end";
    case "<A-[>":
      return "select to inner surrounding object start";
    case "<A-]>":
      return "select to inner surrounding object end";
    case "<A-{>":
      return "extend to inner surrounding object start";
    case "<A-}>":
      return "extend to inner surrounding object end";
    case "<A-i>":
      return "select inner surrounding object";
    case "<A-a>":
      return "select surrounding object";
    default:
      return `keys: ${pending.join(" ")}`;
  }
}

const initialTheme = getInitialTheme();
document.body.dataset.theme = initialTheme;

const initialLineNumberMode: "absolute" | "relative" =
  window.localStorage.getItem(lineNumbersStorageKey) === "relative" ? "relative" : "absolute";

const initialFontFamily: FontFamily = isFontFamily(window.localStorage.getItem(fontFamilyStorageKey))
  ? window.localStorage.getItem(fontFamilyStorageKey) as FontFamily
  : "mono";

const initialFontSize: FontSize = isFontSize(window.localStorage.getItem(fontSizeStorageKey))
  ? window.localStorage.getItem(fontSizeStorageKey) as FontSize
  : "medium";

const view = new EditorView({
  state: EditorState.create({
    doc: [
      "function renderGreeting(name) {",
      "  const greeting = `Hello, ${name}!`;",
      "  console.log(greeting);",
      "  return greeting;",
      "}",
      "",
      "// Kakoune playground sample",
      "renderGreeting(\"CodeMirror\");"
    ].join("\n"),
    extensions: [
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
      ]),
      javascript({ typescript: true, jsx: true }),
      themeCompartment.of(buildPlaygroundEditorTheme(playgroundThemes[initialTheme])),
      lineNumberCompartment.of(buildLineNumberExtension(initialLineNumberMode)),
      lineNumberUpdateCompartment.of(buildLineNumberUpdateExtension(initialLineNumberMode)),
      fontCompartment.of(buildFontExtension(initialFontFamily, initialFontSize)),
      kakoune({
        onWhichKey: (pending, items, isWaitingForChar) => {
          if (pending.length === 0 && !isWaitingForChar) {
            hudElement.classList.add("hidden");
            return;
          }

          hudElement.classList.remove("hidden");
          hudTitle.textContent = getWhichKeyTitle(pending);

          if (isWaitingForChar) {
            hudPrompt.classList.remove("hidden");
          } else {
            hudPrompt.classList.add("hidden");
          }

          hudItems.innerHTML = "";
          for (const item of items) {
            const el = document.createElement("div");
            el.className = "hud-item";

            const keyEl = document.createElement("span");
            keyEl.className = "hud-key";
            const remainingKeys = item.keys.slice(pending.length);
            keyEl.textContent = remainingKeys.join(" ");

            const descEl = document.createElement("span");
            descEl.className = "hud-desc";
            descEl.textContent = item.description || "";

            el.appendChild(keyEl);
            el.appendChild(descEl);
            hudItems.appendChild(el);
          }
        }
      }),
      EditorView.updateListener.of(update => {
        if (update.transactions.length > 0) {
          updateStatus(update.view);
        }
      })
    ]
  }),
  parent: editorElement
});

// ── Settings modal ──────────────────────────────────────────────────────────

function toggleConfigModal(show: boolean): void {
  if (!configModal) return;
  configModal.classList.toggle("show", show);
}

configToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleConfigModal(!configModal.classList.contains("show"));
  registerPopover.classList.remove("show");
  searchPopover.classList.remove("show");
});

configModalClose.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleConfigModal(false);
});

configModal.addEventListener("click", (e) => {
  e.stopPropagation();
});

// ── Theme ───────────────────────────────────────────────────────────────────

themeSelectElement.value = initialTheme;
themeSelectElement.addEventListener("change", () => {
  const nextTheme = themeSelectElement.value;
  if (isPlaygroundThemeName(nextTheme)) {
    applyTheme(view, nextTheme);
  }
});

// ── Line numbers ────────────────────────────────────────────────────────────

lineNumbersSelectElement.value = initialLineNumberMode;
lineNumbersSelectElement.addEventListener("change", () => {
  const nextMode = lineNumbersSelectElement.value;
  if (nextMode === "absolute" || nextMode === "relative") {
    applyLineNumberMode(view, nextMode);
  }
});

// ── Font family / size ──────────────────────────────────────────────────────

fontFamilySelectElement.value = initialFontFamily;
fontSizeSelectElement.value = initialFontSize;

fontFamilySelectElement.addEventListener("change", () => {
  const family = fontFamilySelectElement.value;
  const size = fontSizeSelectElement.value;
  if (isFontFamily(family) && isFontSize(size)) {
    applyFontSettings(view, family, size);
  }
});

fontSizeSelectElement.addEventListener("change", () => {
  const family = fontFamilySelectElement.value;
  const size = fontSizeSelectElement.value;
  if (isFontFamily(family) && isFontSize(size)) {
    applyFontSettings(view, family, size);
  }
});

// ── Which-key layout ──────────────────────────────────────────────────────────

const initialLayout = window.localStorage.getItem(layoutStorageKey) || "vertical";
hudElement.setAttribute("data-layout", initialLayout);
layoutSelect.value = initialLayout;

layoutSelect.addEventListener("change", () => {
  const nextLayout = layoutSelect.value;
  hudElement.setAttribute("data-layout", nextLayout);
  window.localStorage.setItem(layoutStorageKey, nextLayout);
});

// ── Register / Search popovers ───────────────────────────────────────────────

registerPill.addEventListener("click", (e) => {
  e.stopPropagation();
  registerPopover.classList.toggle("show");
  searchPopover.classList.remove("show");
  toggleConfigModal(false);
});

popoverClose.addEventListener("click", (e) => {
  e.stopPropagation();
  registerPopover.classList.remove("show");
});

searchPill.addEventListener("click", (e) => {
  e.stopPropagation();
  searchPopover.classList.toggle("show");
  registerPopover.classList.remove("show");
  toggleConfigModal(false);
});

searchPopoverClose.addEventListener("click", (e) => {
  e.stopPropagation();
  searchPopover.classList.remove("show");
});

document.addEventListener("click", () => {
  registerPopover.classList.remove("show");
  searchPopover.classList.remove("show");
  toggleConfigModal(false);
});

registerPopover.addEventListener("click", (e) => {
  e.stopPropagation();
});

searchPopover.addEventListener("click", (e) => {
  e.stopPropagation();
});

updateStatus(view);

// ── Virtual keyboard for mobile ──────────────────────────────────────────────

let pendingCtrl = false;
let pendingAlt = false;
const ctrlBtn = vk.querySelector<HTMLButtonElement>("[data-mod='ctrl']");
const altBtn = vk.querySelector<HTMLButtonElement>("[data-mod='alt']");

if (!ctrlBtn || !altBtn) {
  throw new Error("Virtual keyboard modifier buttons not found.");
}

function updateModUI(): void {
  if (!ctrlBtn || !altBtn) return;
  ctrlBtn.classList.toggle("active", pendingCtrl);
  altBtn.classList.toggle("active", pendingAlt);
}

vk.addEventListener("pointerdown", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".vk-key");
  if (!btn) return;
  e.preventDefault();

  btn.classList.add("pressed");

  const mod = btn.dataset.mod;
  if (mod === "ctrl") {
    pendingCtrl = !pendingCtrl;
    pendingAlt = false;
    updateModUI();
    return;
  }
  if (mod === "alt") {
    pendingAlt = !pendingAlt;
    pendingCtrl = false;
    updateModUI();
    return;
  }

  const key = btn.dataset.key ?? "";
  const code = btn.dataset.code ?? "";
  const ctrl = pendingCtrl;
  const alt = pendingAlt;
  pendingCtrl = false;
  pendingAlt = false;
  updateModUI();

  view.contentDOM.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code,
      ctrlKey: ctrl,
      altKey: alt,
      shiftKey: false,
      bubbles: true,
      cancelable: true
    })
  );
});

// Remove press state on pointer up / cancel
function clearPressed() {
  if (!vk) return;
  for (const el of vk.querySelectorAll(".vk-key.pressed")) {
    el.classList.remove("pressed");
  }
}
document.addEventListener("pointerup", clearPressed);
document.addEventListener("pointercancel", clearPressed);

// Intercept real keyboard events to apply pending modifiers
let isSynthetic = false;
view.contentDOM.addEventListener(
  "keydown",
  (event: Event) => {
    const kbEvent = event as KeyboardEvent;
    if (isSynthetic) {
      isSynthetic = false;
      return;
    }
    if ((pendingCtrl || pendingAlt) && kbEvent.key.length === 1 && !kbEvent.ctrlKey && !kbEvent.altKey) {
      kbEvent.preventDefault();
      kbEvent.stopImmediatePropagation();
      const ctrl = pendingCtrl;
      const alt = pendingAlt;
      pendingCtrl = false;
      pendingAlt = false;
      updateModUI();
      isSynthetic = true;
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: kbEvent.key,
          code: kbEvent.code,
          ctrlKey: ctrl,
          altKey: alt,
          shiftKey: kbEvent.shiftKey,
          bubbles: true,
          cancelable: true
        })
      );
      return;
    }
    if (pendingCtrl || pendingAlt) {
      pendingCtrl = false;
      pendingAlt = false;
      updateModUI();
    }
  },
  { capture: true }
);

// Keep vk above iOS virtual keyboard
const visualViewport = window.visualViewport;
if (visualViewport) {
  const repositionVk = () => {
    const bottomSpace = window.innerHeight - (visualViewport.offsetTop + visualViewport.height);
    if (vk) vk.style.bottom = `${Math.max(0, bottomSpace)}px`;
  };
  visualViewport.addEventListener("resize", repositionVk);
  visualViewport.addEventListener("scroll", repositionVk);
  repositionVk();
}
