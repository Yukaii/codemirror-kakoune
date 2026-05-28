import type { EditorView } from "@codemirror/view";
import type { KakouneMode } from "./state";

export interface KakouneBinding {
  keys: string[];
  run(view: EditorView, arg?: string): boolean;
}

export interface KeyProcessorBindings {
  normal: KakouneBinding[];
  insert: KakouneBinding[];
}

export function normalizeKeyStroke(event: KeyboardEvent): string | null {
  if (event.isComposing || event.key === "Dead") {
    return null;
  }

  const key = event.key;

  if (event.ctrlKey || event.metaKey || event.altKey) {
    const modifiers = [
      event.ctrlKey ? "C" : null,
      event.altKey ? "A" : null,
      event.metaKey ? "M" : null
    ].filter(Boolean) as string[];

    const base = key.length === 1 ? key.toLowerCase() : key;
    return `<${modifiers.join("-")}-${base}>`;
  }

  switch (key) {
    case "Escape":
      return "<Esc>";
    case "Tab":
      return "<Tab>";
    case "Enter":
      return "<Enter>";
    case "Backspace":
      return "<Backspace>";
    case "Delete":
      return "<Delete>";
    case " ":
      return "<Space>";
    case "ArrowLeft":
      return "<Left>";
    case "ArrowRight":
      return "<Right>";
    case "ArrowUp":
      return "<Up>";
    case "ArrowDown":
      return "<Down>";
    case "Home":
      return "<Home>";
    case "End":
      return "<End>";
    case "PageUp":
      return "<PageUp>";
    case "PageDown":
      return "<PageDown>";
    default:
      return key;
  }
}

function sequenceKey(sequence: string[]): string {
  return sequence.join("\u0001");
}

function isPrefix(prefix: string[], candidate: string[]): boolean {
  if (prefix.length > candidate.length) {
    return false;
  }

  return prefix.every((part, index) => part === candidate[index]);
}

export class KakouneKeyProcessor {
  private pending: string[] = [];
  private pendingCharBinding: KakouneBinding | null = null;

  constructor(private readonly bindings: KeyProcessorBindings) {}

  reset(): void {
    this.pending = [];
    this.pendingCharBinding = null;
  }

  handle(mode: KakouneMode, key: string, view: EditorView): boolean {
    if (this.pendingCharBinding) {
      const binding = this.pendingCharBinding;
      this.pendingCharBinding = null;

      if (key === "<Esc>") {
        return true;
      }

      return binding.run(view, key);
    }

    const bindings = this.bindings[mode];
    const nextSequence = [...this.pending, key];
    const exact = bindings.find(binding => sequenceKey(binding.keys) === sequenceKey(nextSequence));
    const hasLongerPrefix = bindings.some(binding => isPrefix(nextSequence, binding.keys) && binding.keys.length > nextSequence.length);

    if (exact && exact.keys.length === 1 && ["f", "t", "F", "T"].includes(exact.keys[0])) {
      this.pending = [];
      this.pendingCharBinding = exact;
      return true;
    }

    if (exact && !hasLongerPrefix) {
      this.pending = [];
      return exact.run(view);
    }

    if (hasLongerPrefix) {
      this.pending = nextSequence;
      return true;
    }

    if (this.pending.length > 0) {
      const pendingSequence = this.pending;
      const pendingBinding = bindings.find(binding => sequenceKey(binding.keys) === sequenceKey(pendingSequence));
      this.pending = [];

      if (pendingBinding) {
        const handled = pendingBinding.run(view);
        if (handled) {
          return this.handle(mode, key, view);
        }
      }
    }

    const single = bindings.find(binding => binding.keys.length === 1 && binding.keys[0] === key);
    if (single) {
      if (["f", "t", "F", "T"].includes(single.keys[0])) {
        this.pendingCharBinding = single;
        return true;
      }

      this.pending = [];
      return single.run(view);
    }

    const singleHasPrefix = bindings.some(binding => isPrefix([key], binding.keys) && binding.keys.length > 1);
    if (singleHasPrefix) {
      this.pending = [key];
      return true;
    }

    this.pending = [];
    return false;
  }
}
