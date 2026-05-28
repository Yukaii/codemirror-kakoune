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
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const searchPill = document.querySelector<HTMLElement>("#search-pill");
const registerPill = document.querySelector<HTMLElement>("#register-pill");
const themeCompartment = new Compartment();

if (!editorElement || !themeSelect || !modePill || !searchPill || !registerPill) {
  throw new Error("Playground shell is missing required DOM nodes.");
}

const themeSelectElement = themeSelect;

const themeStorageKey = "codemirror-kakoune.playground.theme";

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
      ? `S ${state.searchPrompt}`
      : searchQuery.valid && searchQuery.search
        ? `/${searchQuery.search}`
        : "—";
  registerPill.textContent = state.register ? JSON.stringify(state.register) : '""';
};

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
      kakoune(),
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

updateStatus(view);
