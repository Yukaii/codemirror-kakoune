import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import { kakoune } from "codemirror-kakoune-cm5";
import "./style.css";

const textarea = document.querySelector<HTMLTextAreaElement>("#editor");
if (!textarea) throw new Error("CM5 playground editor is missing.");

const editor = CodeMirror.fromTextArea(textarea, {
  lineNumbers: true,
  mode: "text/plain",
  viewportMargin: Infinity
});
kakoune(editor);

const wrapper = editor.getWrapperElement();
const modePill = document.querySelector<HTMLElement>("#mode-pill");
const modeLabel = document.querySelector<HTMLElement>("#mode-label");
const cursorPosition = document.querySelector<HTMLElement>("#cursor-position");
const settingsToggle = document.querySelector<HTMLButtonElement>("#settings-toggle");
const settings = document.querySelector<HTMLDivElement>("#settings");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const fontSizeSelect = document.querySelector<HTMLSelectElement>("#font-size-select");

function updateStatus(): void {
  const mode = wrapper.dataset.kakouneMode === "insert" ? "insert" : "select";
  document.body.dataset.mode = mode;
  if (modePill) modePill.textContent = mode;
  if (modeLabel) modeLabel.textContent = `${mode} mode`;
  if (cursorPosition) {
    const cursor = editor.getCursor();
    cursorPosition.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
  }
}

function applyTheme(theme: string): void {
  document.body.dataset.theme = theme;
  window.localStorage.setItem("codemirror-kakoune.cm5.theme", theme);
}

function applyFontSize(size: string): void {
  wrapper.style.setProperty("--cm5-font-size", `${size}px`);
  wrapper.querySelector<HTMLElement>(".CodeMirror-code")?.style.setProperty("font-size", `${size}px`);
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

settingsToggle?.addEventListener("click", () => settings?.classList.toggle("hidden"));
document.addEventListener("click", event => {
  if (settings && settingsToggle && !settings.contains(event.target as Node) && !settingsToggle.contains(event.target as Node)) {
    settings.classList.add("hidden");
  }
});

const observer = new MutationObserver(updateStatus);
observer.observe(wrapper, { attributes: true, attributeFilter: ["data-kakoune-mode"] });
editor.on("cursorActivity", updateStatus);
updateStatus();
