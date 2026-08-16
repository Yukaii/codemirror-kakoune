import { loadSettings, saveSettings, isDomainEnabled } from "../src/storage";
import { TextareaAdapter } from "../src/adapter/textarea";
import { buildKakouneBindings } from "../src/adapter/bindings";
import { browserAPI } from "../src/browser-api";
import { KakouneKeyProcessor, KakounePromptController, normalizeKeyStroke, type KakouneMode } from "kakoune-core-js";
import type { ExtensionSettings } from "../src/types";

let currentSettings: ExtensionSettings;
let currentDomain = "";

async function initPopup(): Promise<void> {
  currentSettings = await loadSettings();

  // Try to query active tab for current domain
  try {
    if (browserAPI?.tabs?.query) {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        currentDomain = url.hostname.toLowerCase().replace(/:\d+$/, "");
      }
    }
  } catch {
    // Ignore in standalone preview
  }

  setupUI();
  setupScratchpad();
}

function setupUI(): void {
  const globalToggle = document.getElementById("toggle-global") as HTMLInputElement;
  const globalStatus = document.getElementById("global-status") as HTMLElement;
  const siteCard = document.getElementById("site-card") as HTMLElement;
  const siteName = document.getElementById("site-name") as HTMLElement;
  const siteToggle = document.getElementById("toggle-site") as HTMLInputElement;
  const defaultModeSelect = document.getElementById("select-default-mode") as HTMLSelectElement;
  const themeSelect = document.getElementById("select-theme") as HTMLSelectElement;
  const textareasToggle = document.getElementById("toggle-textareas") as HTMLInputElement;
  const cm5Toggle = document.getElementById("toggle-cm5") as HTMLInputElement;
  const cm6Toggle = document.getElementById("toggle-cm6") as HTMLInputElement;
  const whichkeyToggle = document.getElementById("toggle-whichkey") as HTMLInputElement;
  const btnOptions = document.getElementById("btn-open-options") as HTMLButtonElement;
  const btnDemo = document.getElementById("btn-open-demo") as HTMLButtonElement;

  // Apply initial values
  globalToggle.checked = currentSettings.enabled;
  updateStatusBadge(currentSettings.enabled);

  if (currentDomain && !currentDomain.startsWith("chrome") && !currentDomain.startsWith("extension")) {
    siteName.textContent = currentDomain;
    siteToggle.checked = isDomainEnabled(currentDomain, currentSettings);
  } else {
    siteCard.style.display = "none";
  }

  defaultModeSelect.value = currentSettings.defaultMode;
  themeSelect.value = currentSettings.theme;
  textareasToggle.checked = currentSettings.enableTextareas;
  cm5Toggle.checked = currentSettings.enableCodeMirror5;
  cm6Toggle.checked = currentSettings.enableCodeMirror6;
  whichkeyToggle.checked = currentSettings.showWhichKey;

  // Event Listeners
  globalToggle.addEventListener("change", async () => {
    currentSettings.enabled = globalToggle.checked;
    updateStatusBadge(currentSettings.enabled);
    await saveSettings({ enabled: currentSettings.enabled });
  });

  siteToggle.addEventListener("change", async () => {
    if (!currentDomain) return;
    const overrides = { ...currentSettings.siteOverrides, [currentDomain]: siteToggle.checked };
    currentSettings.siteOverrides = overrides;
    await saveSettings({ siteOverrides: overrides });
  });

  defaultModeSelect.addEventListener("change", async () => {
    currentSettings.defaultMode = defaultModeSelect.value as KakouneMode;
    await saveSettings({ defaultMode: currentSettings.defaultMode });
  });

  themeSelect.addEventListener("change", async () => {
    currentSettings.theme = themeSelect.value as any;
    await saveSettings({ theme: currentSettings.theme });
  });

  textareasToggle.addEventListener("change", async () => {
    currentSettings.enableTextareas = textareasToggle.checked;
    await saveSettings({ enableTextareas: currentSettings.enableTextareas });
  });

  cm5Toggle.addEventListener("change", async () => {
    currentSettings.enableCodeMirror5 = cm5Toggle.checked;
    await saveSettings({ enableCodeMirror5: currentSettings.enableCodeMirror5 });
  });

  cm6Toggle.addEventListener("change", async () => {
    currentSettings.enableCodeMirror6 = cm6Toggle.checked;
    await saveSettings({ enableCodeMirror6: currentSettings.enableCodeMirror6 });
  });

  whichkeyToggle.addEventListener("change", async () => {
    currentSettings.showWhichKey = whichkeyToggle.checked;
    await saveSettings({ showWhichKey: currentSettings.showWhichKey });
  });

  btnOptions.addEventListener("click", () => {
    if (browserAPI?.runtime?.openOptionsPage) {
      browserAPI.runtime.openOptionsPage();
    } else {
      window.open("../options/index.html", "_blank");
    }
  });

  btnDemo.addEventListener("click", () => {
    if (browserAPI?.tabs?.create) {
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL("demo/index.html") });
    } else {
      window.open("../demo/index.html", "_blank");
    }
  });
}

function updateStatusBadge(enabled: boolean): void {
  const globalStatus = document.getElementById("global-status") as HTMLElement;
  if (enabled) {
    globalStatus.textContent = "ACTIVE";
    globalStatus.classList.remove("disabled");
  } else {
    globalStatus.textContent = "DISABLED";
    globalStatus.classList.add("disabled");
  }
}

function setupScratchpad(): void {
  const scratchpad = document.getElementById("scratchpad") as HTMLTextAreaElement;
  const modeBadge = document.getElementById("scratch-mode") as HTMLElement;
  if (!scratchpad || !modeBadge) return;

  const adapter = new TextareaAdapter(scratchpad);
  const prompts = new KakounePromptController();
  const processor = new KakouneKeyProcessor(buildKakouneBindings(prompts));
  adapter.setMode("select");

  const updateBadge = () => {
    const mode = adapter.getMode();
    const pending = processor.getPending().join("");
    modeBadge.textContent = (mode.toUpperCase() + (pending ? ` ${pending}` : ""));
    modeBadge.style.background = mode === "select" ? "var(--accent)" : "var(--accent-secondary)";
  };

  scratchpad.addEventListener("beforeinput", event => {
    if (adapter.getMode() === "select" || prompts.isActive()) {
      event.preventDefault();
    }
  });

  scratchpad.addEventListener("keydown", event => {
    const key = normalizeKeyStroke(event);
    if (!key) return;

    if (prompts.isActive()) {
      const handled = prompts.handleKey(adapter, key);
      updateBadge();
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
        updateBadge();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (key === "<Esc>") {
      processor.reset();
      updateBadge();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const handled = processor.handle(mode, key, adapter);
    updateBadge();

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

document.addEventListener("DOMContentLoaded", initPopup);
