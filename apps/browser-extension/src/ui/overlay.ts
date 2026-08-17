import type { ExtensionSettings, UIState } from "../types";
import { getOverlayStyles } from "./styles";

export class OverlayController {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private isVisible = false;
  private currentSettings: ExtensionSettings;
  private onToggleOffCallback?: () => void;

  constructor(settings: ExtensionSettings, onToggleOff?: () => void) {
    this.currentSettings = settings;
    this.onToggleOffCallback = onToggleOff;
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

    // 1. Prompt overlay box if prompt is active
    if (state.prompt) {
      let promptLabel = state.prompt.kind.toUpperCase();
      let promptPrefix = "/";

      if (state.prompt.kind === "select") {
        promptLabel = "SELECT (REGEX)";
        promptPrefix = "/";
      } else if (state.prompt.kind === "split") {
        promptLabel = "SPLIT (REGEX)";
        promptPrefix = "/";
      } else if (state.prompt.kind === "search") {
        promptLabel = "SEARCH";
        promptPrefix = "/";
      } else if (state.prompt.kind === "pipe") {
        promptLabel = "PIPE";
        promptPrefix = "|";
      }

      const query = state.prompt.text || "";
      const errorHtml = state.promptError
        ? `<div class="kakoune-prompt-error">${this.escapeHtml(state.promptError)}</div>`
        : "";

      html += `
        <div class="kakoune-prompt-container">
          <div class="kakoune-prompt-label">${promptLabel}</div>
          <div class="kakoune-prompt-input-row">
            <span class="kakoune-prompt-prefix">${promptPrefix}</span>
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

    // 3. Mode Badge with prompt indicator and toggle button
    if (this.currentSettings.showBadge) {
      let modeClass = state.mode === "select" ? "mode-select" : "mode-insert";
      let modeLabel = state.mode.toUpperCase();

      if (state.prompt) {
        modeClass = "mode-select";
        modeLabel = `PROMPT: ${state.prompt.kind}`;
      }

      const engineLabel = state.engine.toUpperCase();
      const pendingLabel = state.pendingKeys.length > 0
        ? ` <span class="kakoune-badge-pending">${this.escapeHtml(state.pendingKeys.join(""))}</span>`
        : "";

      html += `
        <div class="kakoune-badge ${modeClass}" title="Alt+Shift+K to toggle back to native textarea">
          <span class="kakoune-badge-engine">${engineLabel}</span>
          <span>${modeLabel}${pendingLabel}</span>
          <button class="kakoune-badge-close" id="btn-toggle-off" title="Switch back to native textarea" style="background:transparent;border:none;color:inherit;opacity:0.7;cursor:pointer;padding:0 2px;font-size:10px;line-height:1;margin-left:2px;">&times;</button>
        </div>
      `;
    }

    this.container.innerHTML = html;

    // Attach close button click handler
    const closeBtn = this.container.querySelector("#btn-toggle-off");
    if (closeBtn && this.onToggleOffCallback) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onToggleOffCallback?.();
      });
    }
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
