import type { KakouneBinding, KakouneMode, WhichKeyItem } from "./types";

function sequenceKey(sequence: string[]): string {
  return sequence.join("\u0001");
}

function isPrefix(prefix: string[], candidate: string[]): boolean {
  if (prefix.length > candidate.length) return false;
  return prefix.every((part, index) => part === candidate[index]);
}

function isFindToCharKey(key: string): boolean {
  return key === "f" || key === "t" || key === "F" || key === "T" || /^<a-[ft]>$/i.test(key);
}

export class KakouneKeyProcessor<T> {
  private pending: string[] = [];
  private pendingCharBinding: KakouneBinding<T> | null = null;
  private count: number | null = null;

  constructor(private readonly bindings: Record<KakouneMode, KakouneBinding<T>[]>) {}

  reset(): void {
    this.pending = [];
    this.pendingCharBinding = null;
    this.count = null;
  }

  getPending(): string[] {
    return this.pending;
  }

  isWaitingForChar(): boolean {
    return this.pendingCharBinding !== null;
  }

  getPendingItems(mode: KakouneMode): WhichKeyItem[] {
    if (this.pendingCharBinding || this.pending.length === 0) return [];
    return this.bindings[mode]
      .filter(binding => isPrefix(this.pending, binding.keys) && binding.keys.length > this.pending.length)
      .map(binding => ({ keys: binding.keys, description: binding.description }));
  }

  handle(mode: KakouneMode, key: string, editor: T): boolean {
    if (key === "<Esc>") {
      this.reset();
      const escapeBinding = this.bindings[mode].find(binding => binding.keys.length === 1 && binding.keys[0] === "<Esc>");
      return escapeBinding ? escapeBinding.run(editor) : true;
    }

    if (this.pendingCharBinding) {
      const binding = this.pendingCharBinding;
      this.pendingCharBinding = null;
      const currentCount = this.count;
      this.count = null;
      return binding.run(editor, key, currentCount ?? undefined);
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
      if (exact.keys.length === 1 && isFindToCharKey(exact.keys[0])) {
        this.pending = [];
        this.pendingCharBinding = exact;
        return true;
      }
      const currentCount = this.count;
      this.pending = [];
      this.count = null;
      return exact.run(editor, undefined, currentCount ?? undefined);
    }

    if (hasLongerPrefix) {
      this.pending = nextSequence;
      return true;
    }

    this.pending = [];
    this.count = null;
    return false;
  }
}
