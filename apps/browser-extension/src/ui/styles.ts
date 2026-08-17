import type { BadgePosition, ExtensionTheme } from "../types";

export function getOverlayStyles(theme: ExtensionTheme = "kakoune", position: BadgePosition = "bottom-right"): string {
  const themeVars = getThemeVariables(theme);
  const positionStyles = getPositionStyles(position);

  return `
    :host {
      all: initial;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      line-height: 1.3;
      z-index: 2147483647;
      pointer-events: none;
    }

    ${themeVars}

    .kakoune-overlay-container {
      position: fixed;
      ${positionStyles}
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      z-index: 2147483647;
      pointer-events: none;
    }

    .kakoune-badge {
      pointer-events: auto;
      user-select: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 6px;
      border-radius: 2px;
      font-weight: 600;
      font-size: 10px;
      letter-spacing: 0.3px;
      background: var(--bg-badge);
      color: var(--fg-badge);
      border: 1px solid var(--border-badge);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }

    .kakoune-badge.mode-select {
      background: var(--bg-select);
      color: var(--fg-select);
      border-color: var(--border-select);
    }

    .kakoune-badge.mode-insert {
      background: var(--bg-insert);
      color: var(--fg-insert);
      border-color: var(--border-insert);
    }

    .kakoune-badge-engine {
      font-size: 9px;
      font-weight: 700;
      padding: 0 3px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.25);
    }

    .kakoune-badge-pending {
      color: var(--accent-color);
      font-weight: bold;
    }

    .kakoune-badge-close {
      background: transparent;
      border: none;
      color: inherit;
      opacity: 0.6;
      cursor: pointer;
      padding: 0 2px;
      font-size: 11px;
      line-height: 1;
      font-family: inherit;
    }

    .kakoune-badge-close:hover {
      opacity: 1;
    }

    .kakoune-which-key {
      pointer-events: auto;
      min-width: 200px;
      max-width: 300px;
      background: var(--bg-card);
      color: var(--fg-card);
      border: 1px solid var(--border-card);
      border-radius: 2px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 240px;
      overflow-y: auto;
    }

    .kakoune-which-key-header {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--muted-color);
      padding: 1px 3px 3px;
      border-bottom: 1px solid var(--border-card);
    }

    .kakoune-which-key-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 2px 4px;
      border-radius: 2px;
      font-size: 10px;
    }

    .kakoune-which-key-item:hover {
      background: var(--bg-hover);
    }

    .kakoune-which-key-keys {
      font-weight: 700;
      color: var(--accent-color);
      background: var(--bg-key);
      padding: 0 4px;
      border-radius: 2px;
      border: 1px solid var(--border-badge);
    }

    .kakoune-which-key-desc {
      color: var(--fg-card);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kakoune-prompt-container {
      pointer-events: auto;
      min-width: 240px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 2px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
      padding: 5px 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .kakoune-prompt-label {
      font-size: 9px;
      font-weight: 700;
      color: var(--accent-color);
      text-transform: uppercase;
    }

    .kakoune-prompt-input-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .kakoune-prompt-prefix {
      font-weight: bold;
      color: var(--fg-card);
    }

    .kakoune-prompt-value {
      font-weight: 600;
      color: var(--fg-card);
      background: var(--bg-key);
      padding: 1px 4px;
      border-radius: 2px;
      border: 1px solid var(--border-badge);
      flex: 1;
    }

    .kakoune-prompt-error {
      color: #ff5555;
      font-size: 9px;
      font-weight: 500;
    }
  `;
}

function getPositionStyles(position: BadgePosition): string {
  switch (position) {
    case "top-left":
      return "top: 10px; left: 10px; align-items: flex-start;";
    case "top-right":
      return "top: 10px; right: 10px; align-items: flex-end;";
    case "bottom-left":
      return "bottom: 10px; left: 10px; align-items: flex-start;";
    case "bottom-right":
    default:
      return "bottom: 10px; right: 10px; align-items: flex-end;";
  }
}

function getThemeVariables(theme: ExtensionTheme): string {
  switch (theme) {
    case "nord":
      return `
        :host {
          --bg-badge: #242933;
          --fg-badge: #eceff4;
          --border-badge: #3b4252;
          --bg-select: #88c0d0;
          --fg-select: #1e222a;
          --border-select: #81a1c1;
          --bg-insert: #a3be8c;
          --fg-insert: #1e222a;
          --border-insert: #8fbcbb;
          --bg-card: #242933;
          --fg-card: #eceff4;
          --border-card: #3b4252;
          --bg-hover: #2e3440;
          --bg-key: #1e222a;
          --accent-color: #88c0d0;
          --muted-color: #d8dee9;
        }
      `;
    case "gruvbox":
      return `
        :host {
          --bg-badge: #1d2021;
          --fg-badge: #ebdbb2;
          --border-badge: #3c3836;
          --bg-select: #fe8019;
          --fg-select: #1d2021;
          --border-select: #d65d0e;
          --bg-insert: #b8bb26;
          --fg-insert: #1d2021;
          --border-insert: #98971a;
          --bg-card: #282828;
          --fg-card: #ebdbb2;
          --border-card: #3c3836;
          --bg-hover: #3c3836;
          --bg-key: #1d2021;
          --accent-color: #fabd2f;
          --muted-color: #a89984;
        }
      `;
    case "light":
      return `
        :host {
          --bg-badge: #f6f8fa;
          --fg-badge: #24292e;
          --border-badge: #d1d5da;
          --bg-select: #0366d6;
          --fg-select: #ffffff;
          --border-select: #005cc5;
          --bg-insert: #28a745;
          --fg-insert: #ffffff;
          --border-insert: #22863a;
          --bg-card: #ffffff;
          --fg-card: #24292e;
          --border-card: #d1d5da;
          --bg-hover: #f1f3f5;
          --bg-key: #f6f8fa;
          --accent-color: #0366d6;
          --muted-color: #586069;
        }
      `;
    case "dark":
      return `
        :host {
          --bg-badge: #111111;
          --fg-badge: #e0e0e0;
          --border-badge: #262626;
          --bg-select: #2f81f7;
          --fg-select: #ffffff;
          --border-select: #388bfd;
          --bg-insert: #238636;
          --fg-insert: #ffffff;
          --border-insert: #2ea043;
          --bg-card: #161616;
          --fg-card: #e0e0e0;
          --border-card: #262626;
          --bg-hover: #222222;
          --bg-key: #111111;
          --accent-color: #58a6ff;
          --muted-color: #888888;
        }
      `;
    case "kakoune":
    default:
      return `
        :host {
          --bg-badge: #14131b;
          --fg-badge: #e0def4;
          --border-badge: #26233a;
          --bg-select: #eb6f92;
          --fg-select: #14131b;
          --border-select: #f6c177;
          --bg-insert: #9ccfd8;
          --fg-insert: #14131b;
          --border-insert: #31748f;
          --bg-card: #191724;
          --fg-card: #e0def4;
          --border-card: #26233a;
          --bg-hover: #21202e;
          --bg-key: #14131b;
          --accent-color: #f6c177;
          --muted-color: #908caa;
        }
      `;
  }
}
