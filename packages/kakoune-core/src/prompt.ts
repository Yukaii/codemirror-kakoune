import type { EditorHost, SelectionRange } from "./types";
import { rangeFrom, rangeTo } from "./types";

export type KakounePromptKind = "select" | "split";

export interface KakounePromptState {
  kind: KakounePromptKind;
  text: string;
}

interface ActivePrompt extends KakounePromptState {
  selections: SelectionRange[];
}

function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "gu");
  } catch {
    try {
      return new RegExp(pattern, "g");
    } catch {
      return null;
    }
  }
}

function sortRanges(ranges: SelectionRange[]): SelectionRange[] {
  return ranges.sort((left, right) => (
    rangeFrom(left) - rangeFrom(right) || rangeTo(left) - rangeTo(right)
  ));
}

export function selectRegexMatches(editor: EditorHost, pattern: string): boolean {
  if (!pattern) return false;
  const regex = compileRegex(pattern);
  if (!regex) return false;

  const doc = editor.getDoc();
  const matches: SelectionRange[] = [];
  for (const range of editor.getSelections()) {
    const from = rangeFrom(range);
    const to = rangeTo(range);
    const forward = range.anchor <= range.head;
    const text = doc.slice(from, to);
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      matches.push(forward ? { anchor: start, head: end } : { anchor: end, head: start });
      if (match[0].length === 0) regex.lastIndex += 1;
      if (regex.lastIndex > text.length) break;
    }
  }

  if (matches.length === 0) return false;
  editor.setSelections(sortRanges(matches), 0);
  return true;
}

export function splitSelectionsByRegex(editor: EditorHost, pattern: string): boolean {
  if (!pattern) return false;
  const regex = compileRegex(pattern);
  if (!regex) return false;

  const doc = editor.getDoc();
  const pieces: SelectionRange[] = [];
  for (const range of editor.getSelections()) {
    const from = rangeFrom(range);
    const to = rangeTo(range);
    const forward = range.anchor <= range.head;
    const text = doc.slice(from, to);
    let begin = 0;
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > begin) {
        const start = from + begin;
        const end = from + match.index;
        pieces.push(forward ? { anchor: start, head: end } : { anchor: end, head: start });
      }
      begin = match.index + match[0].length;
      if (match[0].length === 0) regex.lastIndex += 1;
      if (regex.lastIndex > text.length) break;
    }

    if (begin < text.length) {
      const start = from + begin;
      const end = from + text.length;
      pieces.push(forward ? { anchor: start, head: end } : { anchor: end, head: start });
    }
  }

  if (pieces.length === 0) return false;
  editor.setSelections(sortRanges(pieces), 0);
  return true;
}

export class KakounePromptController {
  private active: ActivePrompt | null = null;
  private error: string | null = null;

  open(kind: KakounePromptKind, editor: EditorHost): boolean {
    this.active = {
      kind,
      text: "",
      selections: editor.getSelections().map(range => ({ ...range }))
    };
    this.error = null;
    return true;
  }

  getState(): KakounePromptState | null {
    return this.active ? { kind: this.active.kind, text: this.active.text } : null;
  }

  getError(): string | null {
    return this.error;
  }

  isActive(): boolean {
    return this.active !== null;
  }

  cancel(editor: EditorHost): boolean {
    if (!this.active) return false;
    editor.setSelections(this.active.selections.map(range => ({ ...range })));
    this.active = null;
    this.error = null;
    return true;
  }

  commit(editor: EditorHost): boolean {
    if (!this.active) return false;
    const { kind, text } = this.active;
    const valid = compileRegex(text) !== null;
    const success = kind === "select"
      ? selectRegexMatches(editor, text)
      : splitSelectionsByRegex(editor, text);

    this.active = null;
    this.error = success
      ? null
      : !text
        ? `'${kind}': empty regex`
        : !valid
          ? `'${kind}': invalid regex "${text}"`
          : `'${kind}': nothing selected`;
    return true;
  }

  handleKey(editor: EditorHost, key: string): boolean {
    if (!this.active) return false;
    if (key === "<Esc>") return this.cancel(editor);
    if (key === "<Enter>") return this.commit(editor);

    this.error = null;
    if (key === "<Backspace>") {
      this.active.text = this.active.text.slice(0, -1);
    } else if (key === "<Space>") {
      this.active.text += " ";
    } else if (key.length === 1) {
      this.active.text += key;
    }
    return true;
  }
}
