import { kakoune, Cm5Adapter } from "codemirror-kakoune-cm5";
import type { KakouneMode, KakounePromptState, WhichKeyItem } from "kakoune-core-js";

interface CM5Element extends HTMLElement {
  CodeMirror?: any;
}

class InPageManager {
  private attachedEditors = new WeakSet<any>();
  private activeMode: KakouneMode = "select";
  private customKakrc = "";
  private isEnabled = true;

  init(): void {
    this.scanAndAttach();
    this.observeDOM();
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener("kakoune-inpage-config", (e: any) => {
      const config = e.detail;
      if (config) {
        this.isEnabled = config.enabled !== false;
        this.customKakrc = config.customKakrc || "";
        this.activeMode = config.defaultMode || "select";
      }
    });

    document.addEventListener("focusin", (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const cmEl = (target.closest(".CodeMirror") || (target.classList.contains("CodeMirror") ? target : null)) as CM5Element | null;
        if (cmEl) {
          this.attachToElement(cmEl);
        }
      }
    }, true);
  }

  private scanAndAttach(): void {
    const editors = document.querySelectorAll<HTMLElement>(".CodeMirror");
    editors.forEach(el => this.attachToElement(el as CM5Element));
  }

  private observeDOM(): void {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("CodeMirror")) {
              this.attachToElement(node as CM5Element);
            } else {
              const nested = node.querySelectorAll<HTMLElement>(".CodeMirror");
              nested.forEach(el => this.attachToElement(el as CM5Element));
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  private attachToElement(el: CM5Element): void {
    if (!this.isEnabled) return;
    const cm = el.CodeMirror || (el.nextElementSibling as CM5Element)?.CodeMirror;
    if (!cm || this.attachedEditors.has(cm)) return;

    this.attachedEditors.add(cm);

    // Override existing Vim or Emacs keymaps
    try {
      const currentKeyMap = cm.getOption?.("keyMap");
      if (currentKeyMap && currentKeyMap !== "default") {
        cm.__kakoune_original_keymap = currentKeyMap;
        cm.setOption("keyMap", "default");
      }
    } catch {
      // Ignore
    }

    kakoune(cm, {
      initialMode: this.activeMode,
      customKakrc: this.customKakrc,
      onWhichKey: (pending: string[], items: WhichKeyItem[]) => {
        window.dispatchEvent(new CustomEvent("kakoune-status-event", {
          detail: {
            engine: "cm5",
            mode: (el.dataset.kakouneMode === "insert" ? "insert" : "select") as KakouneMode,
            pendingKeys: pending,
            pendingItems: items,
            prompt: null,
            promptError: null
          }
        }));
      },
      onPrompt: (prompt: KakounePromptState | null) => {
        window.dispatchEvent(new CustomEvent("kakoune-status-event", {
          detail: {
            engine: "cm5",
            mode: (el.dataset.kakouneMode === "insert" ? "insert" : "select") as KakouneMode,
            pendingKeys: [],
            pendingItems: [],
            prompt: prompt ? { kind: prompt.kind, text: prompt.text } : null,
            promptError: null
          }
        }));
      },
      onPromptError: (error: string | null) => {
        window.dispatchEvent(new CustomEvent("kakoune-status-event", {
          detail: {
            engine: "cm5",
            mode: (el.dataset.kakouneMode === "insert" ? "insert" : "select") as KakouneMode,
            pendingKeys: [],
            pendingItems: [],
            prompt: null,
            promptError: error
          }
        }));
      }
    });

    // Notify initial attach
    window.dispatchEvent(new CustomEvent("kakoune-status-event", {
      detail: {
        engine: "cm5",
        mode: this.activeMode,
        pendingKeys: [],
        pendingItems: [],
        prompt: null,
        promptError: null
      }
    }));
  }
}

const manager = new InPageManager();
manager.init();
