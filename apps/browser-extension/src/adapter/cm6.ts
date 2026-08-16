import { EditorView } from "@codemirror/view";
import { Cm6Adapter, kakouneStateField } from "codemirror-kakoune";
import type { KakouneMode, KakounePromptState, WhichKeyItem } from "kakoune-core-js";

export function detectCM6(element: HTMLElement): EditorView | null {
  // 1. Try EditorView.findFromDOM
  try {
    const view = EditorView.findFromDOM(element);
    if (view) return view;
  } catch {
    // Ignore
  }

  // 2. Look for .cm-editor or .cm-content
  const cmEditor = element.closest(".cm-editor") || (element.classList.contains("cm-editor") ? element : null);
  if (cmEditor) {
    // Check known internal properties
    const cmView = (cmEditor as any).cmView;
    if (cmView && cmView.view instanceof EditorView) {
      return cmView.view;
    }
    const content = cmEditor.querySelector(".cm-content");
    if (content && (content as any).cmView && (content as any).cmView.view instanceof EditorView) {
      return (content as any).cmView.view;
    }
  }

  return null;
}

export function isCM6KakouneActive(view: EditorView): boolean {
  try {
    return Boolean(view.state.field(kakouneStateField, false));
  } catch {
    return false;
  }
}
