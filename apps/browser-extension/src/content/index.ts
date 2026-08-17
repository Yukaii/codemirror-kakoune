import {
  normalizeKeyStroke,
  KakounePromptController,
  KakouneKeyProcessor,
  type KakouneMode
} from "kakoune-core-js";
import { TextareaAdapter, type TextInputElement } from "../adapter/textarea";
import { buildKakouneBindings } from "../adapter/bindings";
import { detectCM5, getCM5Wrapper, attachCM5Kakoune } from "../adapter/cm5";
import { detectCM6 } from "../adapter/cm6";
import { CM6OverlayEditor } from "../adapter/cm6-overlay";
import { OverlayController } from "../ui/overlay";
import { isDomainEnabled, loadSettings } from "../storage";
import { browserAPI } from "../browser-api";
import type { ExtensionSettings, UIState, MessageType } from "../types";

class ContentScriptManager {
  private settings: ExtensionSettings | null = null;
  private overlay: OverlayController | null = null;
  private activeElement: HTMLElement | null = null;
  private activeOverlayEditor: CM6OverlayEditor | null = null;
  private activeAdapter: TextareaAdapter | null = null;
  private activeProcessor: KakouneKeyProcessor<TextareaAdapter> | null = null;
  private activePrompts: KakounePromptController | null = null;
  private activeEngine: "textarea" | "cm5" | "cm6" | "none" = "none";
  private attachedElements = new WeakSet<HTMLElement>();

  async init(): Promise<void> {
    this.settings = await loadSettings();
    if (!this.settings) return;

    this.overlay = new OverlayController(this.settings, () => this.toggleOnActiveElement());
    this.setupEventListeners();
    this.setupMessageListener();
    this.setupStorageListener();
    this.injectInPageScript();

    // Check if domain is enabled
    if (!isDomainEnabled(window.location.hostname, this.settings)) {
      this.overlay.hide();
      return;
    }

    // Auto-detect existing active element if any
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      this.handleFocus(document.activeElement);
    }
  }

  private injectInPageScript(): void {
    if (typeof document === "undefined") return;

    try {
      const scriptUrl = browserAPI?.runtime?.getURL
        ? browserAPI.runtime.getURL("inpage.js")
        : null;

      if (scriptUrl) {
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.onload = () => {
          script.remove();
          this.syncInPageConfig();
        };
        (document.head || document.documentElement).appendChild(script);
      }
    } catch {
      // Ignore in restricted environments
    }

    // Listen to status events from inpage script
    window.addEventListener("kakoune-status-event", (e: any) => {
      const detail = e.detail;
      if (detail && this.settings && isDomainEnabled(window.location.hostname, this.settings)) {
        this.activeEngine = detail.engine || "cm5";
        this.overlay?.render({
          mode: detail.mode || "select",
          pendingKeys: detail.pendingKeys || [],
          pendingItems: detail.pendingItems || [],
          prompt: detail.prompt || null,
          promptError: detail.promptError || null,
          engine: this.activeEngine
        });
      }
    });
  }

  private syncInPageConfig(): void {
    if (!this.settings) return;
    window.dispatchEvent(new CustomEvent("kakoune-inpage-config", {
      detail: {
        enabled: isDomainEnabled(window.location.hostname, this.settings),
        defaultMode: this.settings.defaultMode,
        customKakrc: this.settings.customKakrc
      }
    }));
  }

  private setupStorageListener(): void {
    if (browserAPI?.storage?.onChanged) {
      browserAPI.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" || area === "local") {
          if (changes.kakoune_settings && changes.kakoune_settings.newValue) {
            this.applySettingsUpdate(changes.kakoune_settings.newValue);
          }
        }
      });
    }
  }

  private applySettingsUpdate(newSettings: ExtensionSettings): void {
    this.settings = newSettings;
    this.overlay?.updateSettings(this.settings);
    this.syncInPageConfig();

    const isEnabled = isDomainEnabled(window.location.hostname, this.settings);
    if (!isEnabled) {
      if (this.activeOverlayEditor) {
        this.activeOverlayEditor.destroy(false);
        this.activeOverlayEditor = null;
      }
      this.activeAdapter = null;
      this.activeEngine = "none";
      this.activeElement = null;
      this.overlay?.hide();
    } else {
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        this.handleFocus(document.activeElement);
      }
    }
  }

  private setupEventListeners(): void {
    document.addEventListener("focusin", event => {
      const target = event.target as HTMLElement | null;
      if (target) {
        this.handleFocus(target);
      }
    }, true);

    document.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          this.activeEngine = "none";
          this.activeElement = null;
          this.overlay?.hide();
        }
      }, 100);
    }, true);

    // Global keyboard shortcut to toggle kakoune on current element: Alt+Shift+K
    window.addEventListener("keydown", event => {
      if (event.altKey && event.shiftKey && (event.key === "K" || event.key === "k")) {
        event.preventDefault();
        this.toggleOnActiveElement();
      }
    }, true);
  }

  private setupMessageListener(): void {
    if (browserAPI?.runtime?.onMessage) {
      browserAPI.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
        if (message.type === "GET_TAB_STATUS") {
          const isEnabled = this.settings ? isDomainEnabled(window.location.hostname, this.settings) : true;
          const currentMode = this.activeOverlayEditor
            ? this.activeOverlayEditor.getMode()
            : this.activeAdapter
            ? this.activeAdapter.getMode()
            : this.settings?.defaultMode ?? "select";

          sendResponse({
            type: "TAB_STATUS_RESPONSE",
            payload: {
              enabled: isEnabled,
              domain: window.location.hostname,
              activeEngine: this.activeEngine,
              mode: currentMode
            }
          });
          return true;
        }

        if (message.type === "SAVE_SETTINGS") {
          this.settings = { ...this.settings!, ...message.payload };
          this.applySettingsUpdate(this.settings);
          sendResponse({ success: true });
          return true;
        }

        return false;
      });
    }
  }

  private toggleOnActiveElement(): void {
    if (this.activeOverlayEditor) {
      // Revert from CM6 overlay back to native textarea
      const targetTextarea = this.activeOverlayEditor.getTextarea();
      (targetTextarea as any).__kakoune_disabled = true;
      this.activeOverlayEditor.destroy(true);
      this.activeOverlayEditor = null;
      this.activeEngine = "none";
      this.overlay?.hide();
      return;
    }

    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === "TEXTAREA") {
      // Re-enable CM6 overlay on textarea
      (activeEl as any).__kakoune_disabled = false;
      this.handleFocus(activeEl as HTMLElement);
      return;
    }

    if (this.activeAdapter) {
      const current = this.activeAdapter.getMode();
      const next: KakouneMode = current === "select" ? "insert" : "select";
      this.activeAdapter.setMode(next);
      this.updateUI();
    }
  }

  private handleFocus(element: HTMLElement): void {
    if (!this.settings || !isDomainEnabled(window.location.hostname, this.settings)) {
      this.overlay?.hide();
      return;
    }

    // If focus is inside our own CM6 overlay editor, keep active
    if (element.closest(".kakoune-cm6-overlay-wrapper")) {
      return;
    }

    // If element was manually toggled off by user, respect it
    if ((element as any).__kakoune_disabled) {
      this.overlay?.hide();
      return;
    }

    // 1. Check CodeMirror 5
    if (this.settings.enableCodeMirror5) {
      const cm5Wrapper = getCM5Wrapper(element);
      if (cm5Wrapper) {
        this.activeEngine = "cm5";
        this.activeElement = cm5Wrapper;
        const cm5 = detectCM5(cm5Wrapper);
        if (cm5) {
          attachCM5Kakoune(cm5, {
            initialMode: this.settings.defaultMode,
            customKakrc: this.settings.customKakrc,
            onStateChange: state => {
              this.overlay?.render({
                mode: state.mode,
                pendingKeys: state.pendingKeys,
                pendingItems: state.pendingItems,
                prompt: state.prompt,
                promptError: state.promptError,
                engine: "cm5"
              });
            }
          });
        } else {
          this.overlay?.render({
            mode: this.settings.defaultMode,
            pendingKeys: [],
            pendingItems: [],
            prompt: null,
            promptError: null,
            engine: "cm5"
          });
        }
        return;
      }
    }

    // 2. Check native CodeMirror 6
    if (this.settings.enableCodeMirror6) {
      const cm6 = detectCM6(element);
      if (cm6) {
        this.activeEngine = "cm6";
        this.activeElement = element;
        this.overlay?.render({
          mode: this.settings.defaultMode,
          pendingKeys: [],
          pendingItems: [],
          prompt: null,
          promptError: null,
          engine: "cm6"
        });
        return;
      }
    }

    // 3. Check Textarea -> In-place CodeMirror 6 swap!
    if (this.settings.enableTextareas && !this.isCodeEditorElement(element) && element.tagName === "TEXTAREA") {
      const textarea = element as HTMLTextAreaElement;
      this.activeEngine = "textarea";
      this.activeElement = element;

      if (!this.activeOverlayEditor || (element as any).__kakoune_overlay !== this.activeOverlayEditor) {
        let lastPending: string[] = [];
        let lastItems: any[] = [];
        let lastPrompt: { kind: string; text: string } | null = null;
        let lastPromptError: string | null = null;

        const updateOverlayUI = (mode: KakouneMode) => {
          this.overlay?.render({
            mode,
            pendingKeys: lastPending,
            pendingItems: lastItems,
            prompt: lastPrompt,
            promptError: lastPromptError,
            engine: "textarea"
          });
        };

        const overlay = new CM6OverlayEditor(textarea, {
          initialMode: this.settings.defaultMode,
          customKakrc: this.settings.customKakrc,
          onWhichKey: (pending, items) => {
            lastPending = pending;
            lastItems = items;
            updateOverlayUI(overlay.getMode());
          },
          onModeChange: mode => {
            updateOverlayUI(mode);
          },
          onPrompt: (prompt, error) => {
            lastPrompt = prompt;
            lastPromptError = error;
            updateOverlayUI(overlay.getMode());
          }
        });

        (element as any).__kakoune_overlay = overlay;
        this.activeOverlayEditor = overlay;
        overlay.focus();
      }

      this.overlay?.render({
        mode: this.activeOverlayEditor.getMode(),
        pendingKeys: [],
        pendingItems: [],
        prompt: null,
        promptError: null,
        engine: "textarea"
      });
      return;
    }

    // 4. Check Single-line text input
    if (this.settings.enableTextareas && element.tagName === "INPUT" && this.isTextInput(element)) {
      this.activeEngine = "textarea";
      this.activeElement = element;
      this.attachTextInput(element as TextInputElement);
      return;
    }

    this.activeEngine = "none";
    this.activeElement = null;
    this.overlay?.hide();
  }

  private isCodeEditorElement(el: HTMLElement): boolean {
    return Boolean(
      el.closest(".CodeMirror") ||
      el.classList.contains("CodeMirror") ||
      (el.nextElementSibling && el.nextElementSibling.classList.contains("CodeMirror")) ||
      el.closest(".cm-editor") ||
      el.classList.contains("cm-editor") ||
      el.closest(".cm-content") ||
      el.closest(".monaco-editor") ||
      el.closest(".ace_editor")
    );
  }

  private isTextInput(el: HTMLElement): boolean {
    if (this.isCodeEditorElement(el)) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const type = (el as HTMLInputElement).type.toLowerCase();
      return ["text", "search", "url", "tel", "password", ""].includes(type);
    }
    return false;
  }

  private attachTextInput(el: TextInputElement): void {
    let adapter: TextareaAdapter;
    let processor: KakouneKeyProcessor<TextareaAdapter>;
    let prompts: KakounePromptController;

    if (this.attachedElements.has(el) && (el as any).__kakoune_instance) {
      const instance = (el as any).__kakoune_instance;
      adapter = instance.adapter;
      processor = instance.processor;
      prompts = instance.prompts;
    } else {
      adapter = new TextareaAdapter(el);
      prompts = new KakounePromptController();
      processor = new KakouneKeyProcessor(buildKakouneBindings(prompts));
      if (this.settings?.customKakrc) {
        processor.loadKakrc(this.settings.customKakrc);
      }

      adapter.setMode(this.settings?.defaultMode ?? "select");
      (el as any).__kakoune_instance = { adapter, processor, prompts };
      this.attachedElements.add(el);

      this.wireTextInputListeners(el, adapter, processor, prompts);
    }

    this.activeAdapter = adapter;
    this.activeProcessor = processor;
    this.activePrompts = prompts;

    this.updateUI();
  }

  private wireTextInputListeners(
    el: TextInputElement,
    adapter: TextareaAdapter,
    processor: KakouneKeyProcessor<TextareaAdapter>,
    prompts: KakounePromptController
  ): void {
    el.addEventListener("beforeinput", event => {
      if (!this.settings || !isDomainEnabled(window.location.hostname, this.settings)) return;
      const mode = adapter.getMode();
      if (mode === "select" || prompts.isActive()) {
        event.preventDefault();
      }
    });

    el.addEventListener("keydown", (evt: Event) => {
      const event = evt as KeyboardEvent;
      if (!this.settings || !isDomainEnabled(window.location.hostname, this.settings)) return;

      const key = normalizeKeyStroke(event);
      if (!key) return;

      if (prompts.isActive()) {
        const handled = prompts.handleKey(adapter, key);
        this.updateUI();
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      const mode = adapter.getMode();

      if (mode === "insert") {
        if (key === "<Esc>") {
          adapter.setMode("select");
          this.updateUI();
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (adapter.getSelections().length > 1) {
          if (key === "<Backspace>") {
            adapter.backspaceAtAllSelections();
            this.updateUI();
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            adapter.insertTextAtAllSelections(key);
            this.updateUI();
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        return;
      }

      if (key === "<Esc>") {
        processor.reset();
        this.updateUI();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const handled = processor.handle(mode, key, adapter);
      this.updateUI();

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (mode === "select" && (key.length === 1 || key === "<Enter>" || key === "<Backspace>")) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    el.addEventListener("input", () => {
      adapter.recordHistory();
    });
  }

  private updateUI(): void {
    if (!this.overlay || !this.settings) return;

    if (this.activeOverlayEditor) {
      this.overlay.render({
        mode: this.activeOverlayEditor.getMode(),
        pendingKeys: [],
        pendingItems: [],
        prompt: null,
        promptError: null,
        engine: "textarea"
      });
      return;
    }

    if (this.activeEngine === "none" || !this.activeAdapter) {
      this.overlay.hide();
      return;
    }

    const state: UIState = {
      mode: this.activeAdapter.getMode(),
      pendingKeys: this.activeProcessor?.getPending() ?? [],
      pendingItems: this.activeProcessor?.getPendingItems(this.activeAdapter.getMode()) ?? [],
      prompt: this.activePrompts?.getState() ?? null,
      promptError: this.activePrompts?.getError() ?? null,
      engine: this.activeEngine
    };

    this.overlay.render(state);
  }
}

const manager = new ContentScriptManager();
manager.init().catch(err => console.error("[Kakoune Extension] Content script init failed:", err));
