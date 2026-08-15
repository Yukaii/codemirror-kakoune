import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  kakouneStateField,
  setKakouneNamedRegistersEffect,
  setKakounePipePromptEffect,
  setKakouneReplaceInsertAnchorsEffect,
  setKakouneSelectionRepeatCountEffect,
  type KakouneMode,
  type WhichKeyItem
} from "./state";

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

  // Ctrl+[ maps to Escape (Vim/Kakoune convention)
  if (event.code === "BracketLeft" && event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
    return "<Esc>";
  }

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

function isFindToCharKey(key: string): boolean {
  return (
    key === "f" ||
    key === "t" ||
    key === "F" ||
    key === "T" ||
    /^<a-[ft]>$/i.test(key)
  );
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

function tokenizeSimpleKeys(text: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "<") {
      const end = text.indexOf(">", i + 1);
      if (end > i + 1) {
        tokens.push(text.slice(i, end + 1));
        i = end;
        continue;
      }
    }
    tokens.push(ch);
  }
  return tokens;
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
  private lastInsertKeys: string[] = [];
  private currentInsertKeys: string[] = [];
  private handleDepth = 0;
  private replayingInsert = false;
  private temporaryNormal = false;
  private temporaryNormalSelection: Array<{ anchor: number; head: number }> | null = null;
  private commandPrompt: string | null = null;
  private insertMappings = new Map<string, string[]>();
  private userModes = new Map<string, Map<string, string[]>>();
  private activeUserMode: { name: string; lock: boolean } | null = null;
  private pendingRegister: string | null = null;

  private normalMappings = new Map<string, string[]>();

  constructor(private readonly bindings: Record<KakouneMode, KakouneBinding[]>) {}

  setNormalMappings(mappings: Map<string, string[]>): void {
    this.normalMappings = mappings;
  }

  private macroRecordingRegister: string | null = null;
  private macroKeys: string[] = [];

  setUserModes(modes: Map<string, Map<string, string[]>>): void {
    this.userModes = modes;
  }

  beginTemporaryNormal(): void {
    this.temporaryNormal = true;
  }

  private restoreTemporaryNormalSelection(view: EditorView): void {
    if (!this.temporaryNormalSelection) {
      return;
    }

    view.dispatch({
      selection: EditorSelection.create(
        this.temporaryNormalSelection.map(range => EditorSelection.range(range.anchor, range.head)),
        0
      ),
      scrollIntoView: true
    });
    this.temporaryNormalSelection = null;
  }

  setInsertMappings(mappings: Map<string, string[]>): void {
    this.insertMappings = mappings;
  }

  hasInsertMapping(key: string): boolean {
    return this.insertMappings.has(key);
  }

  private shouldRecordKey(mode: KakouneMode): boolean {
    return !this.replayingInsert && (mode === "insert" || this.temporaryNormal || this.commandPrompt !== null);
  }

  private recordKey(key: string): void {
    if (key === "<Esc>") {
      return;
    }
    this.currentInsertKeys.push(key);
  }

  private finalizeInsertSession(): void {
    if (this.currentInsertKeys.length > 0) {
      this.lastInsertKeys = this.currentInsertKeys.slice();
      this.currentInsertKeys = [];
    }
  }

  private insertText(view: EditorView, text: string, preserveReplaceAnchors = false): boolean {
    const kakoune = view.state.field(kakouneStateField);
    if (kakoune.replaceInsertAnchors) {
      const anchors = kakoune.replaceInsertAnchors;
      const insertions = anchors.map(() => text);
      return applySequentialInserts(view, anchors, insertions, preserveReplaceAnchors);
    }

    const repeatCount = Math.max(1, kakoune.selectionRepeatCount);
    const insertText = text.repeat(repeatCount);
    const result = view.state.changeByRange(range => ({
      changes: { from: range.head, insert: insertText },
      range: EditorSelection.cursor(range.head + insertText.length)
    }));
    view.dispatch({ ...result, scrollIntoView: true });
    return true;
  }

  private enterCommandPrompt(): boolean {
    this.commandPrompt = "";
    return true;
  }

  private commitCommandPrompt(view: EditorView): boolean {
    const prompt = this.commandPrompt;
    this.commandPrompt = null;
    if (prompt === null) {
      return true;
    }

    if (prompt.startsWith("execute-keys ")) {
      const payload = prompt.slice("execute-keys ".length);
      this.temporaryNormal = false;
      for (const key of tokenizeSimpleKeys(payload)) {
        this.handle("insert", key, view);
      }
    } else if (prompt.startsWith("enter-user-mode")) {
      const payload = prompt.slice("enter-user-mode".length).trim();
      const args = payload.length > 0 ? payload.split(/\s+/) : [];
      const isLock = args[0] === "-lock";
      const modeName = isLock ? args[1] : args[0];
      if (modeName) {
        this.activeUserMode = { name: modeName, lock: isLock };
      }
    }

    this.temporaryNormal = false;
    return true;
  }

  private clearTemporaryNormalIfDone(): void {
    if (this.temporaryNormal && this.commandPrompt === null && this.pending.length === 0 && this.pendingCharBinding === null) {
      this.temporaryNormal = false;
    }
  }

  private handleCommandPromptKey(view: EditorView, key: string): boolean {
    if (key === "<Esc>") {
      this.commandPrompt = null;
      this.temporaryNormal = false;
      return true;
    }

    if (key === "<Enter>") {
      return this.commitCommandPrompt(view);
    }

    if (key === "<Backspace>") {
      if (this.commandPrompt === null) {
        return true;
      }
      this.commandPrompt = this.commandPrompt.slice(0, -1);
      return true;
    }

    if (key === "<Space>") {
      this.commandPrompt += " ";
      return true;
    }

    if (key.length === 1) {
      this.commandPrompt += key;
      return true;
    }

    return true;
  }

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

  handle(mode: KakouneMode, key: string, view: EditorView): boolean {
    return this.processKey(mode, key, view, true);
  }

  private processKey(mode: KakouneMode, key: string, view: EditorView, recordKey: boolean): boolean {
    if (this.commandPrompt !== null) {
      return this.handleCommandPromptKey(view, key);
    }

    if (mode === "insert") {
      const insertMapping = this.insertMappings.get(key);
      if (insertMapping) {
        for (const mappedKey of insertMapping) {
          this.processKey("insert", mappedKey, view, true);
        }
        this.clearTemporaryNormalIfDone();
        return true;
      }
    }

    if (recordKey && this.shouldRecordKey(mode)) {
      this.recordKey(key);
    }

    if (this.macroRecordingRegister !== null && key !== "Q") {
      this.macroKeys.push(key);
    }

    if (key === "<Esc>") {
      this.reset();
      this.activeUserMode = null;
      if (mode === "insert") {
        this.finalizeInsertSession();
      }
      this.temporaryNormal = false;
      const bindings = this.bindings[mode];
      const escapeBinding = bindings.find(binding => binding.keys.length === 1 && binding.keys[0] === "<Esc>");
      if (escapeBinding) {
        return escapeBinding.run(view, undefined, undefined);
      }

      view.dispatch({ effects: setKakouneSelectionRepeatCountEffect.of(1) });
      return true;
    }

    if (key === "<Esc>") {
      this.reset();
      this.activeUserMode = null;
      if (mode === "insert") {
        this.finalizeInsertSession();
      }
      this.temporaryNormal = false;
      const bindings = this.bindings[mode];
      const escapeBinding = bindings.find(binding => binding.keys.length === 1 && binding.keys[0] === "<Esc>");
      if (escapeBinding) {
        return escapeBinding.run(view, undefined, undefined);
      }

      view.dispatch({ effects: setKakouneSelectionRepeatCountEffect.of(1) });
      return true;
    }

    const effectiveMode = this.temporaryNormal && mode === "insert" ? "select" : mode;

    if (this.activeUserMode) {
      const modeConfig = this.userModes.get(this.activeUserMode.name);
      const mapped = modeConfig?.get(key);
      const activeName = this.activeUserMode.name;
      const isLock = this.activeUserMode.lock;

      if (!isLock) {
        this.activeUserMode = null;
      }

      if (mapped) {
        // Temporarily clear activeUserMode during re-entrancy so executed keys don't trigger user mode
        this.activeUserMode = null;
        for (const mappedKey of mapped) {
          const currentMode = view.state.field(kakouneStateField).mode;
          this.handle(currentMode, mappedKey, view);
        }
        if (isLock) {
          this.activeUserMode = { name: activeName, lock: true };
        }
        return true;
      }
      return false;
    }

    if (effectiveMode === "select") {
      const normalMapping = this.normalMappings.get(key);
      if (normalMapping) {
        for (const mappedKey of normalMapping) {
          this.handle("select", mappedKey, view);
        }
        this.clearTemporaryNormalIfDone();
        return true;
      }
    }

    if (effectiveMode === "select" && key === "." && this.lastInsertKeys.length > 0) {
      this.replayingInsert = true;
      try {
        for (const replayKey of this.lastInsertKeys) {
          this.processKey("insert", replayKey, view, false);
        }
      } finally {
        this.replayingInsert = false;
      }
      this.clearTemporaryNormalIfDone();
      return true;
    }

    if (mode === "insert" && key === "<A-;>") {
      this.temporaryNormal = true;
      return true;
    }

    if (effectiveMode === "select" && key === ":") {
      return this.enterCommandPrompt();
    }

    if (effectiveMode === "select" && key === '"' && this.pending.length === 0) {
      this.pendingCharBinding = {
        keys: ['"'],
        run: (_currentView, arg) => {
          if (!arg) return false;
          this.pendingRegister = arg;
          return true;
        }
      };
      return true;
    }

    if (effectiveMode === "select" && key === "r" && this.pending.length === 0) {
      this.pendingCharBinding = {
        keys: ["r"],
        run: (currentView, arg) => {
          if (!arg) {
            return false;
          }

          currentView.dispatch({
            changes: currentView.state.changeByRange(range => {
              const from = Math.min(range.from, range.to);
              const to = range.empty ? Math.min(currentView.state.doc.length, from + 1) : Math.max(range.from, range.to);
              return {
                changes: { from, to, insert: arg },
                range: EditorSelection.cursor(from + arg.length)
              };
            }).changes
          });
          return true;
        }
      };
      return true;
    }

    if (effectiveMode === "select" && key === "Q" && this.pending.length === 0) {
      if (this.macroRecordingRegister !== null) {
        // Stop recording and save to named register
        const regName = this.macroRecordingRegister;
        this.macroRecordingRegister = null;
        const keysStr = this.macroKeys.map(k => k === "<Esc>" ? "<esc>" : k === "<Enter>" ? "<ret>" : k).join("");
        this.macroKeys = [];
        const namedRegs = new Map(view.state.field(kakouneStateField).namedRegisters);
        namedRegs.set(regName, keysStr);
        view.dispatch({ effects: setKakouneNamedRegistersEffect.of(namedRegs) });
        return true;
      }
      // Start recording macro to default register @
      this.macroRecordingRegister = "@";
      this.macroKeys = [];
      return true;
    }

    if (effectiveMode === "select" && key === "q" && this.pending.length === 0) {
      const namedRegs = view.state.field(kakouneStateField).namedRegisters;
      const macroStr = namedRegs.get("@");
      if (macroStr) {
        for (const token of tokenizeSimpleKeys(macroStr)) {
          const curMode = view.state.field(kakouneStateField).mode;
          this.handle(curMode, token, view);
        }
        return true;
      }
    }

    if (effectiveMode === "select" && key === "+") {
      const repeatCount = view.state.field(kakouneStateField).selectionRepeatCount;
      view.dispatch({ effects: setKakouneSelectionRepeatCountEffect.of(repeatCount + 1) });
      return true;
    }

    if (effectiveMode === "insert" && key === "<C-r>") {
      this.pendingCharBinding = {
        keys: ["<C-r>"],
        run: (currentView, arg) => {
          if (!arg) {
            return false;
          }

          const kakoune = currentView.state.field(kakouneStateField);
          const register = arg === '"'
            ? kakoune.register
            : (kakoune.namedRegisters.get(arg) ?? (arg === "@" ? kakoune.namedRegisters.get("@") ?? "" : ""));
          if (!register) {
            return true;
          }

          const insertions = arg === '"' && kakoune.registerSelections ? kakoune.registerSelections : [register];
          if (insertions.length === 0) {
            return true;
          }

          const anchors = kakoune.replaceInsertAnchors ?? currentView.state.selection.ranges.map(range => range.head);
          return applySequentialInserts(currentView, anchors, insertions, true);
        }
      };
      return true;
    }

    if (this.pendingCharBinding) {
      const binding = this.pendingCharBinding;
      this.pendingCharBinding = null;

      if (key === "<Esc>") {
        return true;
      }

      const currentCount = this.count;
      this.count = null;
      const handled = binding.run(view, key, currentCount ?? undefined);
      this.clearTemporaryNormalIfDone();
      return handled;
    }

    if (effectiveMode === "insert" && key.length === 1 && !key.startsWith("<")) {
      this.insertText(view, key, true);
      this.clearTemporaryNormalIfDone();
      return true;
    }

    if (effectiveMode === "select" && this.pending.length === 0 && /^[0-9]$/.test(key)) {
      if (key !== "0" || this.count !== null) {
        this.count = (this.count ?? 0) * 10 + Number.parseInt(key, 10);
        return true;
      }
    }

    const bindings = this.bindings[effectiveMode];
    const nextSequence = [...this.pending, key];
    const exact = bindings.find(binding => sequenceKey(binding.keys) === sequenceKey(nextSequence));
    const hasLongerPrefix = bindings.some(binding => isPrefix(nextSequence, binding.keys) && binding.keys.length > nextSequence.length);

    if (exact && (this.count !== null || !hasLongerPrefix)) {
      if (exact.keys.length === 1 && isFindToCharKey(exact.keys[0])) {
        this.pending = [];
        this.pendingCharBinding = exact;
        return true;
      }

      if (exact.keys.length === 1 && (exact.keys[0] === "|" || exact.keys[0] === "<A-|>")) {
        const reg = this.pendingRegister;
        this.pendingRegister = null;
        const mode = exact.keys[0] === "|" ? "pipe" : "pipe-to";
        view.dispatch({ effects: setKakounePipePromptEffect.of({ text: "", mode, register: reg ?? undefined }) });
        this.pending = [];
        return true;
      }

      const currentCount = this.count;
      this.pending = [];
      this.count = null;
      const handled = exact.run(view, undefined, currentCount ?? undefined);
      if (handled && this.temporaryNormal && mode === "insert") {
        this.temporaryNormal = false;
        this.restoreTemporaryNormalSelection(view);
      }
      this.clearTemporaryNormalIfDone();
      return handled;
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
          if (this.temporaryNormal && mode === "insert") {
            this.temporaryNormal = false;
            this.restoreTemporaryNormalSelection(view);
          }
          const result = this.processKey(effectiveMode, key, view, recordKey);
          this.clearTemporaryNormalIfDone();
          return result;
        }
      }
    }

    const single = bindings.find(binding => binding.keys.length === 1 && binding.keys[0] === key);
    if (single) {
      const hasLongerPrefixForSingle = bindings.some(binding => isPrefix([key], binding.keys) && binding.keys.length > 1);
      if (this.count !== null || !hasLongerPrefixForSingle) {
        if (isFindToCharKey(single.keys[0])) {
          this.pendingCharBinding = single;
          return true;
        }

        const currentCount = this.count;
        this.pending = [];
        this.count = null;
        const handled = single.run(view, undefined, currentCount ?? undefined);
        if (handled && this.temporaryNormal && mode === "insert") {
          this.temporaryNormal = false;
          this.restoreTemporaryNormalSelection(view);
        }
        this.clearTemporaryNormalIfDone();
        return handled;
      }
    }

    const singleHasPrefix = bindings.some(binding => isPrefix([key], binding.keys) && binding.keys.length > 1);
    if (singleHasPrefix) {
      this.pending = [key];
      return true;
    }

    this.pending = [];
    this.clearTemporaryNormalIfDone();
    return false;
  }
}

function applySequentialInserts(view: EditorView, positions: number[], inserts: string[], preserveReplaceAnchors: boolean): boolean {
  if (positions.length === 0 || inserts.length === 0) {
    return false;
  }

  const changes: Array<{ from: number; insert: string }> = [];
  const nextPositions: number[] = [];
  let delta = 0;

  for (let i = 0; i < positions.length; i += 1) {
    const insert = inserts[Math.min(i, inserts.length - 1)];
    const from = positions[i];
    changes.push({ from, insert });
    nextPositions.push(from + delta + insert.length);
    delta += insert.length;
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(nextPositions.map(position => EditorSelection.range(position, position)), 0),
    effects: preserveReplaceAnchors ? [setKakouneReplaceInsertAnchorsEffect.of(nextPositions)] : []
  });

  return true;
}
