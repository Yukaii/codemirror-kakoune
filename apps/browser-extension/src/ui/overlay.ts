import type { ExtensionSettings, UIState } from "../types";
import { getOverlayStyles } from "./styles";

export class OverlayController {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private isVisible = false;
  private currentSettings: ExtensionSettings;

  constructor(settings: ExtensionSettings) {
    this.currentSettings = settings;
    this.init();
  }

  private init(): void {
    if (typeof document === "undefined") return;

    const existing = document.getElementById("kakoune-extension-overlay-host");
    if (existing) {
      this.hostElement = existing;
      this.shadowRoot = existing.shadowRoot;
      this.container = this.shadowRoot?.querySelector(".kakoune-overlay-container") || null;
      return;
    }

    this.hostElement = document.createElement("div");
    this.hostElement.id = "kakoune-extension-overlay-host";
    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });

    this.container = document.createElement("div");
    this.container.className = "kakoune-overlay-container";
    this.shadowRoot.appendChild(this.container);

    this.updateStyles();
    document.documentElement.appendChild(this.hostElement);
  }

  updateSettings(settings: ExtensionSettings): void {
    this.currentSettings = settings;
    this.updateStyles();
  }

  private updateStyles(): void {
    if (!this.shadowRoot) return;
    let styleTag = this.shadowRoot.querySelector("style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      this.shadowRoot.prepend(styleTag);
    }
    styleTag.textContent = getOverlayStyles(
      this.currentSettings.theme,
      this.currentSettings.badgePosition
    );
  }

  render(state: UIState | null): void {
    if (!this.container) return;

    if (!state || !this.currentSettings.enabled || state.engine === "none") {
      this.container.innerHTML = "";
      this.isVisible = false;
      return;
    }

    this.isVisible = true;
    let html = "";

    // 1. Regex prompt overlay if prompt is active
    if (state.prompt) {
      const promptLabel = state.prompt.kind === "select" ? "Select (Regex)" : "Split (Regex)";
      const query = state.prompt.text || "";
      const errorHtml = state.promptError
        ? `<div class="kakoune-prompt-error">${this.escapeHtml(state.promptError)}</div>`
        : "";

      html += `
        <div class="kakoune-prompt-container">
          <div class="kakoune-prompt-label">${promptLabel}</div>
          <div class="kakoune-prompt-input-row">
            <span class="kakoune-prompt-prefix">/</span>
            <span class="kakoune-prompt-value">${this.escapeHtml(query)}<span style="opacity: 0.6; animation: blink 1s infinite">|</span></span>
          </div>
          ${errorHtml}
        </div>
      `;
    }

    // 2. Which-Key popup if pending items exist
    if (this.currentSettings.showWhichKey && state.pendingItems && state.pendingItems.length > 0) {
      const pendingStr = state.pendingKeys.join("");
      const itemsHtml = state.pendingItems
        .map(
          item => `
          <div class="kakoune-which-key-item">
            <span class="kakoune-which-key-keys">${this.escapeHtml(item.keys.join(" "))}</span>
            <span class="kakoune-which-key-desc">${this.escapeHtml(item.description || "")}</span>
          </div>
        `
        )
        .join("");

      html += `
        <div class="kakoune-which-key">
          <div class="kakoune-which-key-header">Prefix: ${this.escapeHtml(pendingStr)}</div>
          ${itemsHtml}
        </div>
      `;
    }

    // 3. Mode Badge
    if (this.currentSettings.showBadge) {
      const modeClass = state.mode === "select" ? "mode-select" : "mode-insert";
      const modeLabel = state.mode.toUpperCase();
      const engineLabel = state.engine.toUpperCase();
      const pendingLabel = state.pendingKeys.length > 0
        ? ` <span class="kakoune-badge-pending">${this.escapeHtml(state.pendingKeys.join(""))}</span>`
        : "";

      html += `
        <div class="kakoune-badge ${modeClass}">
          <span class="kakoune-badge-engine">${engineLabel}</span>
          <span>${modeLabel}${pendingLabel}</span>
        </div>
      `;
    }

    this.container.innerHTML = html;
  }

  hide(): void {
    if (this.container) {
      this.container.innerHTML = "";
      this.isVisible = false;
    }
  }

  destroy(): void {
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
    this.hostElement = null;
    this.shadowRoot = null;
    this.container = null;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
