import { loadSettings, saveSettings, isDomainEnabled } from "../src/storage";
import { browserAPI } from "../src/browser-api";
import type { ExtensionSettings, ExtensionTheme } from "../src/types";
import type { KakouneMode } from "kakoune-core-js";

let currentSettings: ExtensionSettings;
let currentDomain = "";

function applyTheme(theme: ExtensionTheme): void {
  document.documentElement.dataset.theme = theme;
}

async function initPopup(): Promise<void> {
  currentSettings = await loadSettings();
  applyTheme(currentSettings.theme);

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
  if (globalToggle) {
    globalToggle.checked = currentSettings.enabled;
    updateStatusBadge(currentSettings.enabled);
  }

  const updateSiteStatusText = (enabled: boolean) => {
    const statusEl = document.getElementById("site-status");
    if (statusEl) {
      statusEl.textContent = enabled ? "Enabled" : "Disabled";
    }
  };

  if (currentDomain && !currentDomain.startsWith("chrome") && !currentDomain.startsWith("extension") && !currentDomain.startsWith("about")) {
    if (siteName) siteName.textContent = currentDomain;
    const isEnabled = isDomainEnabled(currentDomain, currentSettings);
    if (siteToggle) siteToggle.checked = isEnabled;
    updateSiteStatusText(isEnabled);
  } else if (siteCard) {
    siteCard.style.display = "none";
  }

  if (defaultModeSelect) defaultModeSelect.value = currentSettings.defaultMode;
  if (themeSelect) themeSelect.value = currentSettings.theme;
  if (textareasToggle) textareasToggle.checked = currentSettings.enableTextareas;
  if (cm5Toggle) cm5Toggle.checked = currentSettings.enableCodeMirror5;
  if (cm6Toggle) cm6Toggle.checked = currentSettings.enableCodeMirror6;
  if (whichkeyToggle) whichkeyToggle.checked = currentSettings.showWhichKey;

  // Event Listeners
  globalToggle?.addEventListener("change", async () => {
    currentSettings.enabled = globalToggle.checked;
    updateStatusBadge(currentSettings.enabled);
    await saveSettings({ enabled: currentSettings.enabled });
  });

  siteToggle?.addEventListener("change", async () => {
    if (!currentDomain) return;
    const isEnabled = siteToggle.checked;
    updateSiteStatusText(isEnabled);

    const overrides = { ...(currentSettings.siteOverrides || {}), [currentDomain]: isEnabled };
    currentSettings.siteOverrides = overrides;
    await saveSettings({ siteOverrides: overrides });

    try {
      if (browserAPI?.tabs?.query) {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          browserAPI.tabs.sendMessage(tab.id, {
            type: "SAVE_SETTINGS",
            payload: { siteOverrides: overrides }
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore
    }
  });

  defaultModeSelect?.addEventListener("change", async () => {
    currentSettings.defaultMode = defaultModeSelect.value as KakouneMode;
    await saveSettings({ defaultMode: currentSettings.defaultMode });
  });

  themeSelect?.addEventListener("change", async () => {
    currentSettings.theme = themeSelect.value as ExtensionTheme;
    applyTheme(currentSettings.theme);
    await saveSettings({ theme: currentSettings.theme });
  });

  textareasToggle?.addEventListener("change", async () => {
    currentSettings.enableTextareas = textareasToggle.checked;
    await saveSettings({ enableTextareas: currentSettings.enableTextareas });
  });

  cm5Toggle?.addEventListener("change", async () => {
    currentSettings.enableCodeMirror5 = cm5Toggle.checked;
    await saveSettings({ enableCodeMirror5: currentSettings.enableCodeMirror5 });
  });

  cm6Toggle?.addEventListener("change", async () => {
    currentSettings.enableCodeMirror6 = cm6Toggle.checked;
    await saveSettings({ enableCodeMirror6: currentSettings.enableCodeMirror6 });
  });

  whichkeyToggle?.addEventListener("change", async () => {
    currentSettings.showWhichKey = whichkeyToggle.checked;
    await saveSettings({ showWhichKey: currentSettings.showWhichKey });
  });

  btnOptions?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else if (browserAPI?.runtime?.openOptionsPage) {
      browserAPI.runtime.openOptionsPage();
    } else {
      window.open("../options/index.html", "_blank");
    }
  });

  btnDemo?.addEventListener("click", (e) => {
    e.preventDefault();
    const demoUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("demo/index.html")
      : browserAPI?.runtime?.getURL
      ? browserAPI.runtime.getURL("demo/index.html")
      : "../demo/index.html";

    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url: demoUrl });
    } else if (browserAPI?.tabs?.create) {
      browserAPI.tabs.create({ url: demoUrl });
    } else {
      window.open(demoUrl, "_blank");
    }
  });
}

function updateStatusBadge(enabled: boolean): void {
  const globalStatus = document.getElementById("global-status") as HTMLElement;
  if (!globalStatus) return;
  if (enabled) {
    globalStatus.textContent = "ON";
    globalStatus.classList.remove("disabled");
  } else {
    globalStatus.textContent = "OFF";
    globalStatus.classList.add("disabled");
  }
}

document.addEventListener("DOMContentLoaded", initPopup);
