import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { kakoune as kakouneCm6 } from "codemirror-kakoune";
import CodeMirror5 from "codemirror";
import { kakoune as kakouneCm5 } from "codemirror-kakoune-cm5";
import { TextareaAdapter } from "../src/adapter/textarea";
import { buildKakouneBindings } from "../src/adapter/bindings";
import { loadSettings } from "../src/storage";
import { KakouneKeyProcessor, KakounePromptController, normalizeKeyStroke, type KakouneMode } from "kakoune-core-js";

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

function log(msg: string, isStroke = false): void {
  const container = document.getElementById("event-log");
  if (!container) return;
  const entry = document.createElement("div");
  entry.className = isStroke ? "log-entry log-stroke" : "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function updateBadge(badgeId: string, mode: KakouneMode, pending = ""): void {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.textContent = mode.toUpperCase() + (pending ? ` (${pending})` : "");
  if (mode === "insert") {
    el.classList.add("insert");
  } else {
    el.classList.remove("insert");
  }
}

function initTextarea(): void {
  const textarea = document.getElementById("demo-textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  const adapter = new TextareaAdapter(textarea);
  const prompts = new KakounePromptController();
  const processor = new KakouneKeyProcessor(buildKakouneBindings(prompts));
  adapter.setMode("select");

  textarea.addEventListener("beforeinput", event => {
    if (adapter.getMode() === "select" || prompts.isActive()) {
      event.preventDefault();
    }
  });

  textarea.addEventListener("keydown", event => {
    const key = normalizeKeyStroke(event);
    if (!key) return;

    log(`Textarea Key: ${key}`, true);

    if (prompts.isActive()) {
      const handled = prompts.handleKey(adapter, key);
      updateBadge("badge-textarea", adapter.getMode(), prompts.getState()?.text);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const mode = adapter.getMode();
    if (mode === "insert") {
      if (key === "<Esc>") {
        adapter.setMode("select");
        updateBadge("badge-textarea", "select");
        log("Textarea: Switched to SELECT mode");
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (key === "<Esc>") {
      processor.reset();
      updateBadge("badge-textarea", "select");
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const handled = processor.handle(mode, key, adapter);
    const pending = processor.getPending().join("");
    updateBadge("badge-textarea", adapter.getMode(), pending);

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (mode === "select" && (key.length === 1 || key === "<Enter>" || key === "<Backspace>")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function initInput(): void {
  const input = document.getElementById("demo-input") as HTMLInputElement;
  if (!input) return;

  const adapter = new TextareaAdapter(input);
  const prompts = new KakounePromptController();
  const processor = new KakouneKeyProcessor(buildKakouneBindings(prompts));
  adapter.setMode("select");

  input.addEventListener("beforeinput", event => {
    if (adapter.getMode() === "select" || prompts.isActive()) {
      event.preventDefault();
    }
  });

  input.addEventListener("keydown", event => {
    const key = normalizeKeyStroke(event);
    if (!key) return;

    log(`Input Key: ${key}`, true);

    if (prompts.isActive()) {
      const handled = prompts.handleKey(adapter, key);
      updateBadge("badge-input", adapter.getMode(), prompts.getState()?.text);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const mode = adapter.getMode();
    if (mode === "insert") {
      if (key === "<Esc>") {
        adapter.setMode("select");
        updateBadge("badge-input", "select");
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (key === "<Esc>") {
      processor.reset();
      updateBadge("badge-input", "select");
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const handled = processor.handle(mode, key, adapter);
    const pending = processor.getPending().join("");
    updateBadge("badge-input", adapter.getMode(), pending);

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (mode === "select" && (key.length === 1 || key === "<Enter>" || key === "<Backspace>")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function initCM6(): void {
  const container = document.getElementById("demo-cm6");
  if (!container) return;

  const initialDoc = `// CodeMirror 6 instance with Kakoune extension
interface UserProfile {
  id: string;
  name: string;
  roles: string[];
}

function formatGreeting(user: UserProfile): string {
  return \`Welcome, \${user.name}!\`;
}`;

  new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        javascript(),
        kakouneCm6({
          initialMode: "select",
          onWhichKey: (pending) => {
            const pendingStr = pending.join("");
            updateBadge("badge-cm6", "select", pendingStr);
          }
        })
      ]
    }),
    parent: container
  });
}

function initCM5(): void {
  const textarea = document.getElementById("demo-cm5-textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  const cm = CodeMirror5.fromTextArea(textarea, {
    lineNumbers: true,
    tabSize: 2
  });

  kakouneCm5(cm, {
    initialMode: "select",
    onWhichKey: (pending) => {
      const pendingStr = pending.join("");
      const mode = cm.getWrapperElement().dataset.kakouneMode === "insert" ? "insert" : "select";
      updateBadge("badge-cm5", mode, pendingStr);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();
  applyTheme(settings.theme);

  initTextarea();
  initInput();
  initCM6();
  initCM5();

  document.getElementById("btn-clear-log")?.addEventListener("click", () => {
    const container = document.getElementById("event-log");
    if (container) container.innerHTML = "";
  });
});
