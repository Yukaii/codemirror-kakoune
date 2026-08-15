import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/mode/markdown/markdown";
import { kakoune } from "codemirror-kakoune-cm5";
import "../playground/style.css";
import "./style.css";

const textarea = document.querySelector<HTMLTextAreaElement>("#editor-input");
if (!textarea) throw new Error("CM5 playground editor is missing.");

const editor = CodeMirror.fromTextArea(textarea, {
  lineNumbers: true,
  mode: "markdown",
  lineWrapping: true,
  viewportMargin: Infinity
});
kakoune(editor);

const wrapper = editor.getWrapperElement();
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const settingsToggle = document.querySelector<HTMLButtonElement>("#config-toggle");
const settings = document.querySelector<HTMLDivElement>("#config-modal");
const settingsClose = document.querySelector<HTMLButtonElement>("#config-modal-close");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const fontSizeSelect = document.querySelector<HTMLSelectElement>("#font-size-select");

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

const savedTheme = window.localStorage.getItem("codemirror-kakoune.cm5.theme") ?? "night";
const savedFontSize = window.localStorage.getItem("codemirror-kakoune.cm5.fontSize") ?? "15";
if (themeSelect) {
  themeSelect.value = savedTheme;
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
}
if (fontSizeSelect) {
  fontSizeSelect.value = savedFontSize;
  fontSizeSelect.addEventListener("change", () => applyFontSize(fontSizeSelect.value));
}
applyTheme(savedTheme);
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
