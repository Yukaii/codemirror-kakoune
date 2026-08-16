import type CodeMirror from "codemirror";
import { kakoune, Cm5Adapter, type KakouneCm5Options } from "codemirror-kakoune-cm5";
import type { KakouneMode, KakounePromptState, WhichKeyItem } from "kakoune-core-js";

type Cm = CodeMirror.Editor;

export interface CM5InstanceInfo {
  cm: Cm;
  adapter: Cm5Adapter;
}

export function detectCM5(element: HTMLElement): Cm | null {
  // 1. Direct .CodeMirror property on element
  if ((element as any).CodeMirror) {
    return (element as any).CodeMirror;
  }

  // 2. Element inside a .CodeMirror container
  const cmWrapper = element.closest(".CodeMirror") as HTMLElement & { CodeMirror?: Cm };
  if (cmWrapper && cmWrapper.CodeMirror) {
    return cmWrapper.CodeMirror;
  }

  // 3. Sibling of textarea (common CM5 layout: textarea followed by .CodeMirror div)
  const nextSibling = element.nextElementSibling as HTMLElement & { CodeMirror?: Cm };
  if (nextSibling && nextSibling.classList.contains("CodeMirror") && nextSibling.CodeMirror) {
    return nextSibling.CodeMirror;
  }

  return null;
}

export function attachCM5Kakoune(
  cm: Cm,
  options: {
    initialMode?: KakouneMode;
    onStateChange?: (state: {
      mode: KakouneMode;
      pendingKeys: string[];
      pendingItems: WhichKeyItem[];
      prompt: KakounePromptState | null;
      promptError: string | null;
    }) => void;
  } = {}
): Cm5Adapter {
  const wrapper = cm.getWrapperElement();
  if ((wrapper as any).__kakoune_attached) {
    return (wrapper as any).__kakoune_adapter;
  }

  let currentMode: KakouneMode = options.initialMode ?? "select";
  let currentPending: string[] = [];
  let currentPendingItems: WhichKeyItem[] = [];
  let currentPrompt: KakounePromptState | null = null;
  let currentPromptError: string | null = null;

  const emit = () => {
    options.onStateChange?.({
      mode: currentMode,
      pendingKeys: currentPending,
      pendingItems: currentPendingItems,
      prompt: currentPrompt,
      promptError: currentPromptError
    });
  };

  const cmOptions: KakouneCm5Options = {
    initialMode: currentMode,
    onWhichKey: (pending, items) => {
      currentPending = pending;
      currentPendingItems = items;
      emit();
    },
    onPrompt: prompt => {
      currentPrompt = prompt;
      emit();
    },
    onPromptError: error => {
      currentPromptError = error;
      emit();
    }
  };

  kakoune(cm, cmOptions);
  const adapter = new Cm5Adapter(cm);

  (wrapper as any).__kakoune_attached = true;
  (wrapper as any).__kakoune_adapter = adapter;

  return adapter;
}
