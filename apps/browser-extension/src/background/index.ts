import { DEFAULT_SETTINGS, type MessageType } from "../types";
import { isDomainEnabled, loadSettings, saveSettings } from "../storage";
import { browserAPI } from "../browser-api";

// On installation, initialize settings and context menus
browserAPI.runtime?.onInstalled?.addListener(async details => {
  if (details.reason === "install") {
    await saveSettings(DEFAULT_SETTINGS);
  }

  // Create context menus
  try {
    browserAPI.contextMenus?.removeAll(() => {
      browserAPI.contextMenus?.create({
        id: "kakoune_toggle_element",
        title: "Toggle Kakoune on element (Alt+Shift+K)",
        contexts: ["editable"]
      });

      browserAPI.contextMenus?.create({
        id: "kakoune_open_options",
        title: "Kakoune Settings & Keybindings",
        contexts: ["action"]
      });

      browserAPI.contextMenus?.create({
        id: "kakoune_open_demo",
        title: "Open Interactive Demo / Testpad",
        contexts: ["action"]
      });
    });
  } catch (err) {
    console.warn("[Kakoune Background] Context menu error:", err);
  }
});

// Handle context menu clicks
browserAPI.contextMenus?.onClicked?.addListener(async (info, tab) => {
  if (info.menuItemId === "kakoune_open_options") {
    browserAPI.runtime.openOptionsPage();
  } else if (info.menuItemId === "kakoune_open_demo") {
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL("demo/index.html") });
  } else if (info.menuItemId === "kakoune_toggle_element" && tab?.id) {
    browserAPI.tabs.sendMessage(tab.id, { type: "TOGGLE_ENABLED" });
  }
});

// Handle keyboard command shortcuts configured in manifest
browserAPI.commands?.onCommand?.addListener(async (command, tab) => {
  if (command === "toggle-kakoune" && tab?.id) {
    browserAPI.tabs.sendMessage(tab.id, { type: "TOGGLE_ENABLED" });
  }
});

// Update badge icon when tabs update
browserAPI.tabs?.onUpdated?.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const url = new URL(tab.url);
      const settings = await loadSettings();
      const enabled = isDomainEnabled(url.hostname, settings);

      const action = browserAPI.action || (browserAPI as any).browserAction;
      action?.setBadgeText?.({
        tabId,
        text: enabled ? "ON" : "OFF"
      });

      action?.setBadgeBackgroundColor?.({
        tabId,
        color: enabled ? "#eb6f92" : "#6c757d"
      });
    } catch {
      // Ignore non-http urls (chrome://, about:blank, etc.)
    }
  }
});

// Listen for messages from popup or options
browserAPI.runtime?.onMessage?.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    loadSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    saveSettings(message.payload).then(updated => {
      // Notify all tabs of updated settings
      browserAPI.tabs?.query({}, tabs => {
        for (const tab of tabs) {
          if (tab.id) {
            browserAPI.tabs.sendMessage(tab.id, {
              type: "SAVE_SETTINGS",
              payload: updated
            }).catch(() => {});
          }
        }
      });
      sendResponse(updated);
    });
    return true;
  }

  return false;
});
