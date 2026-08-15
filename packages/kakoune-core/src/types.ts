export type KakouneMode = "select" | "insert";

export interface SelectionRange {
  anchor: number;
  head: number;
}

export interface LineInfo {
  from: number;
  to: number;
  number: number;
  text: string;
}

export interface WhichKeyItem {
  keys: string[];
  description?: string;
}

export interface KakouneBinding<T = EditorHost> {
  keys: string[];
  run(editor: T, arg?: string, count?: number): boolean;
  description?: string;
}

export interface EditorHost {
  getMode(): KakouneMode;
  setMode(mode: KakouneMode): void;
  getDoc(): string;
  getDocLength(): number;
  getLineCount(): number;
  lineAt(pos: number): LineInfo;
  line(number: number): LineInfo;
  getSelections(): SelectionRange[];
  setSelections(ranges: SelectionRange[], mainIndex?: number): void;
  replaceRange(from: number, to: number, text: string): void;
  undo(): void;
  redo(): void;
  getRegister(): string;
  setRegister(text: string): void;
}

export function isEmptyRange(range: SelectionRange): boolean {
  return range.anchor === range.head;
}

export function rangeFrom(range: SelectionRange): number {
  return Math.min(range.anchor, range.head);
}

export function rangeTo(range: SelectionRange): number {
  return Math.max(range.anchor, range.head);
}
