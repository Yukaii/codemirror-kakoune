import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { getSearchQuery } from "@codemirror/search";
import { kakoune, kakouneStateField } from "../src/index";
import {
  buildPlaygroundEditorTheme,
  isPlaygroundThemeName,
  playgroundThemes,
  type PlaygroundThemeName
} from "./themes";
import "./style.css";

const editorElement = document.querySelector<HTMLDivElement>("#editor");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const layoutSelect = document.querySelector<HTMLSelectElement>("#layout-select");
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const searchPill = document.querySelector<HTMLElement>("#search-pill");
const registerPill = document.querySelector<HTMLElement>("#register-pill");
const registerPopover = document.querySelector<HTMLDivElement>("#register-popover");
const registerContent = document.querySelector<HTMLPreElement>("#register-content");
const popoverClose = document.querySelector<HTMLButtonElement>("#popover-close");
const hudElement = document.querySelector<HTMLDivElement>("#which-key-hud");
const hudTitle = document.querySelector<HTMLElement>("#hud-title");
const hudPrompt = document.querySelector<HTMLElement>("#hud-prompt");
const hudItems = document.querySelector<HTMLDivElement>("#hud-items");
const themeCompartment = new Compartment();

if (
  !editorElement ||
  !themeSelect ||
  !layoutSelect ||
  !modePill ||
  !searchPill ||
  !registerPill ||
  !registerPopover ||
  !registerContent ||
  !popoverClose ||
  !hudElement ||
  !hudTitle ||
  !hudPrompt ||
  !hudItems
) {
  throw new Error("Playground shell is missing required DOM nodes.");
}

const themeSelectElement = themeSelect;

const themeStorageKey = "codemirror-kakoune.playground.theme";
const layoutStorageKey = "codemirror-kakoune.playground.layout";

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

const updateStatus = (view: EditorView): void => {
  const state = view.state.field(kakouneStateField);
  const searchQuery = getSearchQuery(view.state);
  modePill.textContent = state.mode;
  searchPill.textContent =
    state.searchPrompt !== null
      ? `select: ${state.searchPrompt}`
      : searchQuery.valid && searchQuery.search
        ? `/${searchQuery.search}`
        : "—";
  const registerStr = state.register ? JSON.stringify(state.register) : '""';
  registerPill.textContent = registerStr.length > 25 ? registerStr.slice(0, 22) + "..." : registerStr;
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
    default:
      return `keys: ${pending.join(" ")}`;
  }
}

const initialTheme = getInitialTheme();
document.body.dataset.theme = initialTheme;

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
      basicSetup,
      javascript({ typescript: true, jsx: true }),
      themeCompartment.of(buildPlaygroundEditorTheme(playgroundThemes[initialTheme])),
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
          items.forEach(item => {
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
          });
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

themeSelectElement.value = initialTheme;
themeSelectElement.addEventListener("change", () => {
  const nextTheme = themeSelectElement.value;
  if (isPlaygroundThemeName(nextTheme)) {
    applyTheme(view, nextTheme);
  }
});

const initialLayout = window.localStorage.getItem(layoutStorageKey) || "vertical";
hudElement.setAttribute("data-layout", initialLayout);
layoutSelect.value = initialLayout;

layoutSelect.addEventListener("change", () => {
  const nextLayout = layoutSelect.value;
  hudElement.setAttribute("data-layout", nextLayout);
  window.localStorage.setItem(layoutStorageKey, nextLayout);
});

registerPill.addEventListener("click", (e) => {
  e.stopPropagation();
  registerPopover.classList.toggle("show");
});

popoverClose.addEventListener("click", (e) => {
  e.stopPropagation();
  registerPopover.classList.remove("show");
});

document.addEventListener("click", () => {
  registerPopover.classList.remove("show");
});

registerPopover.addEventListener("click", (e) => {
  e.stopPropagation();
});

updateStatus(view);
