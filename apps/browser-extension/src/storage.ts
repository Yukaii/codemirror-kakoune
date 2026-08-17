import { DEFAULT_SETTINGS, type ExtensionSettings } from "./types";
import { browserAPI } from "./browser-api";

export function loadSettings(): Promise<ExtensionSettings> {
  return new Promise(resolve => {
    try {
      const storage = browserAPI?.storage?.sync || browserAPI?.storage?.local;
      if (storage) {
        storage.get(["kakoune_settings"], (res: any) => {
          if (browserAPI?.runtime?.lastError) {
            console.warn("[browser-kakoune] Storage get error:", browserAPI.runtime.lastError);
            resolve({ ...DEFAULT_SETTINGS });
          } else if (res && res.kakoune_settings) {
            resolve({ ...DEFAULT_SETTINGS, ...res.kakoune_settings });
          } else {
            resolve({ ...DEFAULT_SETTINGS });
          }
        });
        return;
      }
    } catch (err) {
      console.warn("[browser-kakoune] Error loading storage:", err);
    }

    if (typeof localStorage !== "undefined") {
      try {
        const item = localStorage.getItem("kakoune_settings");
        if (item) {
          resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(item) });
          return;
        }
      } catch (err) {
        console.warn("[browser-kakoune] Error loading localStorage:", err);
      }
    }

    resolve({ ...DEFAULT_SETTINGS });
  });
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const updated: ExtensionSettings = {
    ...current,
    ...settings,
    siteOverrides: {
      ...(current.siteOverrides || {}),
      ...(settings.siteOverrides || {})
    }
  };

  return new Promise(resolve => {
    try {
      const storage = browserAPI?.storage?.sync || browserAPI?.storage?.local;
      if (storage) {
        storage.set({ kakoune_settings: updated }, () => {
          if (browserAPI?.runtime?.lastError) {
            console.warn("[browser-kakoune] Storage set error:", browserAPI.runtime.lastError);
          }
          resolve(updated);
        });
        return;
      }
    } catch (err) {
      console.warn("[browser-kakoune] Error saving storage:", err);
    }

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("kakoune_settings", JSON.stringify(updated));
      } catch (err) {
        console.warn("[browser-kakoune] Error saving localStorage:", err);
      }
    }

    resolve(updated);
  });
}

export function isDomainEnabled(hostname: string, settings: ExtensionSettings): boolean {
  if (!settings || !settings.enabled) return false;
  const cleanHost = hostname.toLowerCase().replace(/:\d+$/, "");

  // Check specific override first
  if (settings.siteOverrides && typeof settings.siteOverrides[cleanHost] === "boolean") {
    return settings.siteOverrides[cleanHost];
  }

  // Check blacklist
  if (Array.isArray(settings.blacklistedDomains)) {
    for (const pattern of settings.blacklistedDomains) {
      if (matchDomainPattern(cleanHost, pattern)) return false;
    }
  }

  // Check whitelist if configured
  if (Array.isArray(settings.whitelistedDomains) && settings.whitelistedDomains.length > 0) {
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
