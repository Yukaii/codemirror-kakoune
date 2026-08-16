import { loadSettings, saveSettings } from "../src/storage";
import { TextareaAdapter } from "../src/adapter/textarea";
import { buildKakouneBindings } from "../src/adapter/bindings";
import { KakouneKeyProcessor, KakounePromptController, normalizeKeyStroke, type KakouneMode } from "kakoune-core-js";
import type { BadgePosition, ExtensionSettings, ExtensionTheme } from "../src/types";

let currentSettings: ExtensionSettings;

async function initOptions(): Promise<void> {
  currentSettings = await loadSettings();
  setupTabs();
  bindFormControls();
  setupPlayground();
}

function setupTabs(): void {
  const tabs = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetId = `tab-${tab.getAttribute("data-tab")}`;
      document.getElementById(targetId)?.classList.add("active");
    });
  });
}

function bindFormControls(): void {
  const optEnabled = document.getElementById("opt-enabled") as HTMLInputElement;
  const optDefaultMode = document.getElementById("opt-default-mode") as HTMLSelectElement;
  const optEnableTextareas = document.getElementById("opt-enable-textareas") as HTMLInputElement;
  const optEnableCm5 = document.getElementById("opt-enable-cm5") as HTMLInputElement;
  const optEnableCm6 = document.getElementById("opt-enable-cm6") as HTMLInputElement;
  const optShowBadge = document.getElementById("opt-show-badge") as HTMLInputElement;
  const optBadgePosition = document.getElementById("opt-badge-position") as HTMLSelectElement;
  const optShowWhichKey = document.getElementById("opt-show-whichkey") as HTMLInputElement;
  const optTheme = document.getElementById("opt-theme") as HTMLSelectElement;
  const optBlacklist = document.getElementById("opt-blacklist") as HTMLTextAreaElement;
  const optWhitelist = document.getElementById("opt-whitelist") as HTMLTextAreaElement;
  const btnSave = document.getElementById("btn-save-all") as HTMLButtonElement;

  // Set values from currentSettings
  optEnabled.checked = currentSettings.enabled;
  optDefaultMode.value = currentSettings.defaultMode;
  optEnableTextareas.checked = currentSettings.enableTextareas;
  optEnableCm5.checked = currentSettings.enableCodeMirror5;
  optEnableCm6.checked = currentSettings.enableCodeMirror6;
  optShowBadge.checked = currentSettings.showBadge;
  optBadgePosition.value = currentSettings.badgePosition;
  optShowWhichKey.checked = currentSettings.showWhichKey;
  optTheme.value = currentSettings.theme;
  optBlacklist.value = currentSettings.blacklistedDomains.join("\n");
  optWhitelist.value = currentSettings.whitelistedDomains.join("\n");

  btnSave.addEventListener("click", async () => {
    const updated: Partial<ExtensionSettings> = {
      enabled: optEnabled.checked,
      defaultMode: optDefaultMode.value as KakouneMode,
      enableTextareas: optEnableTextareas.checked,
      enableCodeMirror5: optEnableCm5.checked,
      enableCodeMirror6: optEnableCm6.checked,
      showBadge: optShowBadge.checked,
      badgePosition: optBadgePosition.value as BadgePosition,
      showWhichKey: optShowWhichKey.checked,
      theme: optTheme.value as ExtensionTheme,
      blacklistedDomains: optBlacklist.value.split("\n").map(s => s.trim()).filter(Boolean),
      whitelistedDomains: optWhitelist.value.split("\n").map(s => s.trim()).filter(Boolean)
    };

    currentSettings = await saveSettings(updated);
    showToast();
  });
}

function showToast(): void {
  const toast = document.getElementById("save-toast");
  if (!toast) return;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function setupPlayground(): void {
  const textarea = document.getElementById("play-textarea") as HTMLTextAreaElement;
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

    if (prompts.isActive()) {
      const handled = prompts.handleKey(adapter, key);
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
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (key === "<Esc>") {
      processor.reset();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const handled = processor.handle(mode, key, adapter);
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

document.addEventListener("DOMContentLoaded", initOptions);
