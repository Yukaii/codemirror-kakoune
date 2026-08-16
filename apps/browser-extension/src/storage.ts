import { DEFAULT_SETTINGS, type ExtensionSettings } from "./types";
import { browserAPI } from "./browser-api";

export async function loadSettings(): Promise<ExtensionSettings> {
  try {
    if (browserAPI?.storage) {
      const storageArea = browserAPI.storage.sync || browserAPI.storage.local;
      const res = await storageArea.get("kakoune_settings");
      if (res && res.kakoune_settings) {
        return { ...DEFAULT_SETTINGS, ...res.kakoune_settings };
      }
    } else if (typeof localStorage !== "undefined") {
      const item = localStorage.getItem("kakoune_settings");
      if (item) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(item) };
      }
    }
  } catch (err) {
    console.warn("[Kakoune Extension] Error loading settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const updated: ExtensionSettings = { ...current, ...settings };
  try {
    if (browserAPI?.storage) {
      const storageArea = browserAPI.storage.sync || browserAPI.storage.local;
      await storageArea.set({ kakoune_settings: updated });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem("kakoune_settings", JSON.stringify(updated));
    }
  } catch (err) {
    console.warn("[Kakoune Extension] Error saving settings:", err);
  }
  return updated;
}

export function isDomainEnabled(hostname: string, settings: ExtensionSettings): boolean {
  if (!settings.enabled) return false;
  const cleanHost = hostname.toLowerCase().replace(/:\d+$/, "");

  // Check specific override first
  if (typeof settings.siteOverrides[cleanHost] === "boolean") {
    return settings.siteOverrides[cleanHost];
  }

  // Check blacklist
  for (const pattern of settings.blacklistedDomains) {
    if (matchDomainPattern(cleanHost, pattern)) return false;
  }

  // Check whitelist if configured
  if (settings.whitelistedDomains.length > 0) {
    return settings.whitelistedDomains.some(pattern => matchDomainPattern(cleanHost, pattern));
  }

  return true;
}

export function matchDomainPattern(domain: string, pattern: string): boolean {
  const cleanPat = pattern.trim().toLowerCase();
  if (!cleanPat) return false;
  if (cleanPat === "*") return true;
  if (cleanPat.startsWith("*.")) {
    const suffix = cleanPat.slice(2);
    return domain === suffix || domain.endsWith("." + suffix);
  }
  return domain === cleanPat;
}
