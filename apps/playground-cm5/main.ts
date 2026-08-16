import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/mode/markdown/markdown";
import { kakoune } from "codemirror-kakoune-cm5";
import { attachVirtualKeyboard } from "./virtual-keyboard";
import "./style.css";

const textarea = document.querySelector<HTMLTextAreaElement>("#editor-input");
if (!textarea) throw new Error("CM5 playground editor is missing.");

const editor = CodeMirror.fromTextArea(textarea, {
  lineNumbers: true,
  mode: "markdown",
  lineWrapping: true,
  viewportMargin: Infinity
});
let promptActive = false;
kakoune(editor, {
  onWhichKey(pending, items) {
    if (!hud || !hudItems) return;
    hudItems.replaceChildren(...items.map(item => {
      const element = document.createElement("div");
      element.className = "hud-item";
      element.innerHTML = `<span class="hud-key">${item.keys.join(" ")}</span>${item.description ? `<span class="hud-desc">${item.description}</span>` : ""}`;
      return element;
    }));
    hud.classList.toggle("hidden", pending.length === 0 && !promptActive);
  },
  onPrompt(prompt) {
    if (!hud || !hudTitle || !hudPrompt || !hudItems) return;
    promptActive = prompt !== null;
    hudTitle.textContent = prompt?.kind ?? "which-key";
    hudPrompt.textContent = prompt ? `${prompt.kind}: ${prompt.text}` : "";
    hudPrompt.classList.toggle("hidden", prompt === null);
    if (prompt) hudItems.replaceChildren();
    hud.classList.toggle("hidden", prompt === null);
  },
  onPromptError(message) {
    if (!message || !hud || !hudTitle || !hudPrompt) return;
    hudTitle.textContent = "error";
    hudPrompt.textContent = message;
    hudPrompt.classList.remove("hidden");
    hud.classList.remove("hidden");
  }
});

const wrapper = editor.getWrapperElement();
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const settingsToggle = document.querySelector<HTMLButtonElement>("#config-toggle");
const settings = document.querySelector<HTMLDivElement>("#config-modal");
const settingsClose = document.querySelector<HTMLButtonElement>("#config-modal-close");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const fontFamilySelect = document.querySelector<HTMLSelectElement>("#font-family-select");
const fontSizeSelect = document.querySelector<HTMLSelectElement>("#font-size-select");
const lineNumbersSelect = document.querySelector<HTMLSelectElement>("#line-numbers-select");
const layoutSelect = document.querySelector<HTMLSelectElement>("#layout-select");
const vk = document.querySelector<HTMLElement>("#vk");
const hud = document.querySelector<HTMLDivElement>("#which-key-hud");
const hudItems = document.querySelector<HTMLDivElement>("#which-key-hud .hud-items");
const hudTitle = document.querySelector<HTMLElement>("#hud-title");
const hudPrompt = document.querySelector<HTMLElement>("#hud-prompt");

if (hud) {
  hud.dataset.layout = layoutSelect?.value ?? "vertical";
}

function updateStatus(): void {
  const mode = wrapper.dataset.kakouneMode === "insert" ? "insert" : "select";
  document.body.dataset.mode = mode;
  if (modePill) modePill.textContent = mode === "select" ? "normal" : "insert";
}

function applyTheme(theme: string): void {
  document.body.dataset.theme = theme;
  window.localStorage.setItem("codemirror-kakoune.cm5.theme", theme);
}

function applyFontSize(size: string): void {
  wrapper.style.setProperty("--cm5-font-size", `${size}px`);
  window.localStorage.setItem("codemirror-kakoune.cm5.fontSize", size);
}

function applyFontFamily(family: string): void {
  const values: Record<string, string> = {
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif'
  };
  wrapper.style.setProperty("--cm5-font-family", values[family] ?? values.mono);
  window.localStorage.setItem("codemirror-kakoune.cm5.fontFamily", family);
}

const savedTheme = window.localStorage.getItem("codemirror-kakoune.cm5.theme") ?? "night";
const savedFontFamily = window.localStorage.getItem("codemirror-kakoune.cm5.fontFamily") ?? "mono";
const savedFontSize = window.localStorage.getItem("codemirror-kakoune.cm5.fontSize") ?? "17";
if (themeSelect) {
  themeSelect.value = savedTheme;
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
}
if (fontFamilySelect) {
  fontFamilySelect.value = savedFontFamily;
  fontFamilySelect.addEventListener("change", () => applyFontFamily(fontFamilySelect.value));
}
if (fontSizeSelect) {
  fontSizeSelect.value = savedFontSize;
  fontSizeSelect.addEventListener("change", () => applyFontSize(fontSizeSelect.value));
}
if (lineNumbersSelect) {
  const savedLineNumbers = window.localStorage.getItem("codemirror-kakoune.cm5.lineNumbers") ?? "on";
  lineNumbersSelect.value = savedLineNumbers;
  editor.setOption("lineNumbers", savedLineNumbers === "on");
  lineNumbersSelect.addEventListener("change", () => {
    editor.setOption("lineNumbers", lineNumbersSelect.value === "on");
    window.localStorage.setItem("codemirror-kakoune.cm5.lineNumbers", lineNumbersSelect.value);
  });
}
if (layoutSelect) {
  layoutSelect.value = window.localStorage.getItem("codemirror-kakoune.cm5.layout") ?? "vertical";
  if (hud) hud.dataset.layout = layoutSelect.value;
  layoutSelect.addEventListener("change", () => {
    if (hud) hud.dataset.layout = layoutSelect.value;
    window.localStorage.setItem("codemirror-kakoune.cm5.layout", layoutSelect.value);
  });
}
applyTheme(savedTheme);
applyFontFamily(savedFontFamily);
applyFontSize(savedFontSize);

settingsToggle?.addEventListener("click", () => settings?.classList.toggle("show"));
settingsClose?.addEventListener("click", () => settings?.classList.remove("show"));
document.addEventListener("click", event => {
  if (settings && settingsToggle && !settings.contains(event.target as Node) && !settingsToggle.contains(event.target as Node)) {
    settings.classList.remove("show");
  }
});

const observer = new MutationObserver(updateStatus);
observer.observe(wrapper, { attributes: true, attributeFilter: ["data-kakoune-mode"] });
editor.on("cursorActivity", updateStatus);
updateStatus();

if (vk) attachVirtualKeyboard(vk, editor);
