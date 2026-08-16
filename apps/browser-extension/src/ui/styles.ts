import type { BadgePosition, ExtensionTheme } from "../types";

export function getOverlayStyles(theme: ExtensionTheme = "kakoune", position: BadgePosition = "bottom-right"): string {
  const themeVars = getThemeVariables(theme);
  const positionStyles = getPositionStyles(position);

  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
      font-size: 12px;
      line-height: 1.4;
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
      gap: 6px;
      z-index: 2147483647;
      pointer-events: none;
      transition: all 0.15s ease-in-out;
    }

    .kakoune-badge {
      pointer-events: auto;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--bg-badge);
      color: var(--fg-badge);
      border: 1px solid var(--border-badge);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(8px);
      transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
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
      opacity: 0.75;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.2);
    }

    .kakoune-badge-pending {
      color: var(--accent-color);
      font-family: monospace;
      font-weight: bold;
    }

    .kakoune-which-key {
      pointer-events: auto;
      min-width: 220px;
      max-width: 320px;
      background: var(--bg-card);
      color: var(--fg-card);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      padding: 8px;
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 280px;
      overflow-y: auto;
    }

    .kakoune-which-key-header {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--muted-color);
      padding: 2px 4px 4px;
      border-bottom: 1px solid var(--border-card);
    }

    .kakoune-which-key-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    .kakoune-which-key-item:hover {
      background: var(--bg-hover);
    }

    .kakoune-which-key-keys {
      font-family: monospace;
      font-weight: 700;
      color: var(--accent-color);
      background: var(--bg-key);
      padding: 1px 5px;
      border-radius: 3px;
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
      min-width: 260px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      backdrop-filter: blur(12px);
    }

    .kakoune-prompt-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-color);
      text-transform: uppercase;
    }

    .kakoune-prompt-input-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kakoune-prompt-prefix {
      font-family: monospace;
      font-weight: bold;
      color: var(--fg-card);
    }

    .kakoune-prompt-value {
      font-family: monospace;
      font-weight: 600;
      color: var(--fg-card);
      background: var(--bg-key);
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid var(--border-badge);
      flex: 1;
    }

    .kakoune-prompt-error {
      color: #ff5555;
      font-size: 10px;
      font-weight: 500;
    }
  `;
}

function getPositionStyles(position: BadgePosition): string {
  switch (position) {
    case "top-left":
      return "top: 16px; left: 16px; align-items: flex-start;";
    case "top-right":
      return "top: 16px; right: 16px; align-items: flex-end;";
    case "bottom-left":
      return "bottom: 16px; left: 16px; align-items: flex-start;";
    case "bottom-right":
    default:
      return "bottom: 16px; right: 16px; align-items: flex-end;";
  }
}

function getThemeVariables(theme: ExtensionTheme): string {
  switch (theme) {
    case "nord":
      return `
        :host {
          --bg-badge: #2e3440;
          --fg-badge: #eceff4;
          --border-badge: #4c566a;
          --bg-select: #88c0d0;
          --fg-select: #2e3440;
          --border-select: #81a1c1;
          --bg-insert: #a3be8c;
          --fg-insert: #2e3440;
          --border-insert: #8fbcbb;
          --bg-card: #3b4252;
          --fg-card: #eceff4;
          --border-card: #4c566a;
          --bg-hover: #434c5e;
          --bg-key: #2e3440;
          --accent-color: #88c0d0;
          --muted-color: #d8dee9;
        }
      `;
    case "gruvbox":
      return `
        :host {
          --bg-badge: #282828;
          --fg-badge: #ebdbb2;
          --border-badge: #504945;
          --bg-select: #fe8019;
          --fg-select: #282828;
          --border-select: #d65d0e;
          --bg-insert: #b8bb26;
          --fg-insert: #282828;
          --border-insert: #98971a;
          --bg-card: #3c3836;
          --fg-card: #ebdbb2;
          --border-card: #504945;
          --bg-hover: #504945;
          --bg-key: #282828;
          --accent-color: #fabd2f;
          --muted-color: #a89984;
        }
      `;
    case "light":
      return `
        :host {
          --bg-badge: #ffffff;
          --fg-badge: #24292e;
          --border-badge: #e1e4e8;
          --bg-select: #0366d6;
          --fg-select: #ffffff;
          --border-select: #005cc5;
          --bg-insert: #28a745;
          --fg-insert: #ffffff;
          --border-insert: #22863a;
          --bg-card: #f6f8fa;
          --fg-card: #24292e;
          --border-card: #d1d5da;
          --bg-hover: #e1e4e8;
          --bg-key: #ffffff;
          --accent-color: #0366d6;
          --muted-color: #586069;
        }
      `;
    case "dark":
      return `
        :host {
          --bg-badge: #161b22;
          --fg-badge: #c9d1d9;
          --border-badge: #30363d;
          --bg-select: #1f6feb;
          --fg-select: #ffffff;
          --border-select: #388bfd;
          --bg-insert: #238636;
          --fg-insert: #ffffff;
          --border-insert: #2ea043;
          --bg-card: #0d1117;
          --fg-card: #c9d1d9;
          --border-card: #30363d;
          --bg-hover: #21262d;
          --bg-key: #161b22;
          --accent-color: #58a6ff;
          --muted-color: #8b949e;
        }
      `;
    case "kakoune":
    default:
      return `
        :host {
          --bg-badge: #1a1a24;
          --fg-badge: #e0def4;
          --border-badge: #393552;
          --bg-select: #eb6f92;
          --fg-select: #191724;
          --border-select: #f6c177;
          --bg-insert: #9ccfd8;
          --fg-insert: #191724;
          --border-insert: #31748f;
          --bg-card: #1f1d2e;
          --fg-card: #e0def4;
          --border-card: #26233a;
          --bg-hover: #2a283e;
          --bg-key: #191724;
          --accent-color: #f6c177;
          --muted-color: #908caa;
        }
      `;
  }
}
