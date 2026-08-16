import { DEFAULT_SETTINGS, type BadgePosition, type ExtensionSettings, type ExtensionTheme } from "../src/types";
import { loadSettings, saveSettings } from "../src/storage";
import { CM6OverlayEditor } from "../src/adapter/cm6-overlay";
import type { KakouneMode } from "kakoune-core-js";

let currentSettings: ExtensionSettings;

async function initOptions(): Promise<void> {
  currentSettings = await loadSettings();
  setupTabs();
  bindFormControls();
  setupSearchFilter();
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
  const optKakrc = document.getElementById("opt-kakrc") as HTMLTextAreaElement;
  const btnSave = document.getElementById("btn-save-all") as HTMLButtonElement;
  const btnReset = document.getElementById("btn-reset-defaults") as HTMLButtonElement;

  const populate = (s: ExtensionSettings) => {
    optEnabled.checked = s.enabled;
    optDefaultMode.value = s.defaultMode;
    optEnableTextareas.checked = s.enableTextareas;
    optEnableCm5.checked = s.enableCodeMirror5;
    optEnableCm6.checked = s.enableCodeMirror6;
    optShowBadge.checked = s.showBadge;
    optBadgePosition.value = s.badgePosition;
    optShowWhichKey.checked = s.showWhichKey;
    optTheme.value = s.theme;
    optBlacklist.value = s.blacklistedDomains.join("\n");
    optWhitelist.value = s.whitelistedDomains.join("\n");
    if (optKakrc) {
      optKakrc.value = s.customKakrc || "";
    }
  };

  populate(currentSettings);

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
      customKakrc: optKakrc ? optKakrc.value : "",
      blacklistedDomains: optBlacklist.value.split("\n").map(s => s.trim()).filter(Boolean),
      whitelistedDomains: optWhitelist.value.split("\n").map(s => s.trim()).filter(Boolean)
    };

    currentSettings = await saveSettings(updated);
    showToast("Settings saved successfully!");
  });

  btnReset.addEventListener("click", async () => {
    if (confirm("Reset all browser-kakoune settings to defaults?")) {
      currentSettings = await saveSettings(DEFAULT_SETTINGS);
      populate(currentSettings);
      showToast("Reset to default settings.");
    }
  });
}

function setupSearchFilter(): void {
  const searchInput = document.getElementById("key-filter") as HTMLInputElement;
  const table = document.getElementById("key-table");
  if (!searchInput || !table) return;

  const rows = table.querySelectorAll("tbody tr");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    rows.forEach(row => {
      const text = row.textContent?.toLowerCase() || "";
      if (query === "" || text.includes(query)) {
        (row as HTMLElement).style.display = "";
      } else {
        (row as HTMLElement).style.display = "none";
      }
    });
  });
}

function showToast(msg = "Settings saved successfully!") {
  const toast = document.getElementById("save-toast");
  if (!toast) return;
  toast.textContent = `✓ ${msg}`;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function setupPlayground(): void {
  const textarea = document.getElementById("play-textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  new CM6OverlayEditor(textarea, {
    initialMode: "select"
  });
}

document.addEventListener("DOMContentLoaded", initOptions);
