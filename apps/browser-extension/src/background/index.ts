import { DEFAULT_SETTINGS, type ExtensionSettings, type MessageType } from "../types";
import { isDomainEnabled, loadSettings, saveSettings } from "../storage";

// On installation, initialize settings and context menus
chrome.runtime.onInstalled.addListener(async details => {
  const current = await loadSettings();
  if (details.reason === "install") {
    await saveSettings(DEFAULT_SETTINGS);
  }

  // Create context menus
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "kakoune_toggle_element",
        title: "Toggle Kakoune on element (Alt+Shift+K)",
        contexts: ["editable"]
      });

      chrome.contextMenus.create({
        id: "kakoune_open_options",
        title: "Kakoune Settings & Keybindings",
        contexts: ["action"]
      });

      chrome.contextMenus.create({
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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "kakoune_open_options") {
    chrome.runtime.openOptionsPage();
  } else if (info.menuItemId === "kakoune_open_demo") {
    chrome.tabs.create({ url: chrome.runtime.getURL("demo/index.html") });
  } else if (info.menuItemId === "kakoune_toggle_element" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_ENABLED" });
  }
});

// Handle keyboard command shortcuts configured in manifest
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-kakoune" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_ENABLED" });
  }
});

// Update badge icon when tabs update
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const url = new URL(tab.url);
      const settings = await loadSettings();
      const enabled = isDomainEnabled(url.hostname, settings);

      chrome.action.setBadgeText({
        tabId,
        text: enabled ? "ON" : "OFF"
      });

      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: enabled ? "#eb6f92" : "#6c757d"
      });
    } catch {
      // Ignore non-http urls (chrome://, about:blank, etc.)
    }
  }
});

// Listen for messages from popup or options
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    loadSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    saveSettings(message.payload).then(updated => {
      // Notify all tabs of updated settings
      chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
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
