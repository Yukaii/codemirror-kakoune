/**
 * Unified cross-browser WebExtension API wrapper supporting Chromium (Chrome, Edge, Brave, Arc, Opera)
 * and Mozilla Firefox.
 */
export const browserAPI: typeof chrome = (
  typeof globalThis !== "undefined" && (globalThis as any).browser
    ? (globalThis as any).browser
    : typeof globalThis !== "undefined" && (globalThis as any).chrome
    ? (globalThis as any).chrome
    : {}
) as typeof chrome;
