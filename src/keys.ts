import type { EditorView } from "@codemirror/view";
import type { KakouneMode, WhichKeyItem } from "./state";

/** A single key binding mapping a key sequence to a command. */
export interface KakouneBinding {
  /** The key sequence that triggers this binding, e.g. `["g", "g"]` or `["<A-w>"]` . */
  keys: string[];
  /**
   * The command to run when the binding matches.
   * @param view - The current editor view.
   * @param arg - Optional character argument (for `f`/`t`/`F`/`T` commands).
   * @param count - Optional numeric repeat count.
   * @returns `true` if the key was handled.
   */
  run(view: EditorView, arg?: string, count?: number): boolean;
  /** Human-readable description shown in which-key UIs. */
  description?: string;
}

/** All bindings grouped by editing mode. */
export interface KeyProcessorBindings {
  /** Bindings active in select/normal mode. */
  select: KakouneBinding[];
  /** Bindings active in insert mode. */
  insert: KakouneBinding[];
}

function getBaseKeyFromCode(code: string, shift: boolean): string | null {
  if (code.startsWith("Key")) {
    const char = code.slice(3).toLowerCase();
    return shift ? char.toUpperCase() : char;
  }
  if (code.startsWith("Digit")) {
    const digit = code.slice(5);
    if (!shift) return digit;
    const shiftDigits: Record<string, string> = {
      "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
      "6": "^", "7": "&", "8": "*", "9": "(", "0": ")"
    };
    return shiftDigits[digit] ?? digit;
  }
  switch (code) {
    case "Semicolon":
      return shift ? ":" : ";";
    case "Equal":
      return shift ? "+" : "=";
    case "Comma":
      return shift ? "<" : ",";
    case "Minus":
      return shift ? "_" : "-";
    case "Period":
      return shift ? ">" : ".";
    case "Slash":
      return shift ? "?" : "/";
    case "Backquote":
      return shift ? "~" : "`";
    case "BracketLeft":
      return shift ? "{" : "[";
    case "BracketRight":
      return shift ? "}" : "]";
    case "Quote":
      return shift ? "\"" : "'";
    case "Backslash":
      return shift ? "|" : "\\";
    default:
      return null;
  }
}

const modifierOnlyKeys = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "OS",
  "CapsLock",
  "NumLock",
  "ScrollLock"
]);

/**
 * Normalizes a DOM `KeyboardEvent` into a Kakoune key string.
 *
 * Returns strings like `"a"`, `"<Enter>"`, `"<A-w>"`, or `"<C-Alt-x>"`.
 * Returns `null` for modifier-only keys or when the event should be ignored.
 */
export function normalizeKeyStroke(event: KeyboardEvent): string | null {
  if (event.isComposing) {
    return null;
  }

  // Handle dead keys produced by modifier combinations (e.g., Alt+i on macOS produces circumflex dead key)
  if (event.key === "Dead") {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      const modifiers = [
        event.ctrlKey ? "C" : null,
        event.altKey ? "A" : null,
        event.metaKey ? "M" : null
      ].filter(Boolean) as string[];

      const mapped = getBaseKeyFromCode(event.code, event.shiftKey);
      if (mapped !== null) {
        const base = mapped.length === 1 ? mapped.toLowerCase() : mapped;
        return `<${modifiers.join("-")}-${base}>`;
      }
    }
    return null;
  }

  let key = event.key;

  if (event.ctrlKey || event.metaKey || event.altKey) {
    const modifiers = [
      event.ctrlKey ? "C" : null,
      event.altKey ? "A" : null,
      event.metaKey ? "M" : null
    ].filter(Boolean) as string[];

    const mapped = getBaseKeyFromCode(event.code, event.shiftKey);
    if (mapped !== null) {
      key = mapped;
    }

    const base = key.length === 1 ? key.toLowerCase() : key;

    // Ignore modifier-only chords (e.g., Ctrl+Shift, Alt+Shift) so they don't
    // interfere with pending prefixes like <A-i> waiting for a follow-up key.
    if (modifierOnlyKeys.has(base)) {
      return null;
    }

    return `<${modifiers.join("-")}-${base}>`;
  }

  // Ignore bare modifier key presses so they don't reset pending prefixes.
  if (modifierOnlyKeys.has(key)) {
    return null;
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

/**
 * Processes keyboard events against Kakoune-style key bindings.
 *
 * Handles multi-key sequences, numeric counts, and character arguments
 * (e.g. `f` followed by a character).
 */
export class KakouneKeyProcessor {
  private pending: string[] = [];
  private pendingCharBinding: KakouneBinding | null = null;
  private count: number | null = null;

  constructor(private readonly bindings: Record<KakouneMode, KakouneBinding[]>) {}

  /** Clears the pending sequence, count, and character binding. */
  reset(): void {
    this.pending = [];
    this.pendingCharBinding = null;
    this.count = null;
  }

  /** Returns the currently pending key sequence. */
  getPending(): string[] {
    return this.pending;
  }

  /** Returns `true` if the processor is waiting for a single character argument. */
  isWaitingForChar(): boolean {
    return this.pendingCharBinding !== null;
  }

  /**
   * Returns which-key items for bindings that extend the current pending
   * sequence in the given mode.
   */
  getPendingItems(mode: KakouneMode): WhichKeyItem[] {
    if (this.pendingCharBinding) {
      return [];
    }

    const bindings = this.bindings[mode];
    if (this.pending.length === 0) {
      return [];
    }

    return bindings
      .filter(binding => isPrefix(this.pending, binding.keys) && binding.keys.length > this.pending.length)
      .map(binding => ({
        keys: binding.keys,
        description: binding.description
      }));
  }

  /**
   * Handles a single normalized key in the given mode.
   * @returns `true` if the key was consumed.
   */
  handle(mode: KakouneMode, key: string, view: EditorView): boolean {
    if (key === "<Esc>") {
      this.reset();
    }

    if (this.pendingCharBinding) {
      const binding = this.pendingCharBinding;
      this.pendingCharBinding = null;

      if (key === "<Esc>") {
        return true;
      }

      const currentCount = this.count;
      this.count = null;
      return binding.run(view, key, currentCount ?? undefined);
    }

    if (mode === "select" && this.pending.length === 0 && /^[0-9]$/.test(key)) {
      if (key !== "0" || this.count !== null) {
        this.count = (this.count ?? 0) * 10 + Number.parseInt(key, 10);
        return true;
      }
    }

    const bindings = this.bindings[mode];
    const nextSequence = [...this.pending, key];
    const exact = bindings.find(binding => sequenceKey(binding.keys) === sequenceKey(nextSequence));
    const hasLongerPrefix = bindings.some(binding => isPrefix(nextSequence, binding.keys) && binding.keys.length > nextSequence.length);

    if (exact && (this.count !== null || !hasLongerPrefix)) {
      if (exact.keys.length === 1 && ["f", "t", "F", "T"].includes(exact.keys[0])) {
        this.pending = [];
        this.pendingCharBinding = exact;
        return true;
      }

      const currentCount = this.count;
      this.pending = [];
      this.count = null;
      return exact.run(view, undefined, currentCount ?? undefined);
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
        const currentCount = this.count;
        this.count = null;
        const handled = pendingBinding.run(view, undefined, currentCount ?? undefined);
        if (handled) {
          return this.handle(mode, key, view);
        }
      }
    }

    const single = bindings.find(binding => binding.keys.length === 1 && binding.keys[0] === key);
    if (single) {
      const hasLongerPrefixForSingle = bindings.some(binding => isPrefix([key], binding.keys) && binding.keys.length > 1);
      if (this.count !== null || !hasLongerPrefixForSingle) {
        if (["f", "t", "F", "T"].includes(single.keys[0])) {
          this.pendingCharBinding = single;
          return true;
        }

        const currentCount = this.count;
        this.pending = [];
        this.count = null;
        return single.run(view, undefined, currentCount ?? undefined);
      }
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
