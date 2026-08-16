import type { KakouneMode, KakounePromptState, WhichKeyItem } from "kakoune-core-js";

export type BadgePosition = "bottom-right" | "top-right" | "bottom-left" | "top-left";
export type ExtensionTheme = "dark" | "light" | "kakoune" | "nord" | "gruvbox";

export interface ExtensionSettings {
  enabled: boolean;
  defaultMode: KakouneMode;
  enableTextareas: boolean;
  enableCodeMirror5: boolean;
  enableCodeMirror6: boolean;
  showBadge: boolean;
  showWhichKey: boolean;
  badgePosition: BadgePosition;
  theme: ExtensionTheme;
  blacklistedDomains: string[];
  whitelistedDomains: string[];
  siteOverrides: Record<string, boolean>; // domain -> enabled
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  defaultMode: "select",
  enableTextareas: true,
  enableCodeMirror5: true,
  enableCodeMirror6: true,
  showBadge: true,
  showWhichKey: true,
  badgePosition: "bottom-right",
  theme: "kakoune",
  blacklistedDomains: [],
  whitelistedDomains: [],
  siteOverrides: {}
};

export type MessageType =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; payload: Partial<ExtensionSettings> }
  | { type: "TOGGLE_ENABLED" }
  | { type: "TOGGLE_CURRENT_SITE"; payload: { domain: string } }
  | { type: "GET_TAB_STATUS" }
  | { type: "TAB_STATUS_RESPONSE"; payload: { enabled: boolean; domain: string; activeEngine?: string; mode?: KakouneMode } };

export interface UIState {
  mode: KakouneMode;
  pendingKeys: string[];
  pendingItems: WhichKeyItem[];
  prompt: KakounePromptState | null;
  promptError: string | null;
  engine: "textarea" | "cm5" | "cm6" | "none";
}
