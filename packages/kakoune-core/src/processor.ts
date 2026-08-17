import type { KakouneBinding, KakouneMode, WhichKeyItem } from "./types";
import { parseKakrc, tokenizeKakrcKeys, type KakrcConfig } from "./kakrc";

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

  private normalMappings = new Map<string, string[]>();
  private insertMappings = new Map<string, string[]>();
  private userModes = new Map<string, Map<string, string[]>>();
  private activeUserMode: { name: string; lock: boolean } | null = null;

  constructor(private readonly bindings: Record<KakouneMode, KakouneBinding<T>[]>) {}

  loadKakrc(script: string): KakrcConfig {
    const config = parseKakrc(script);
    this.setNormalMappings(config.normalMappings);
    this.setInsertMappings(config.insertMappings);
    this.setUserModes(config.userModes);
    return config;
  }

  setNormalMappings(mappings: Map<string, string[]>): void {
    this.normalMappings = mappings;
  }

  setInsertMappings(mappings: Map<string, string[]>): void {
    this.insertMappings = mappings;
  }

  setUserModes(modes: Map<string, Map<string, string[]>>): void {
    this.userModes = modes;
  }

  hasInsertMapping(key: string): boolean {
    return this.insertMappings.has(key);
  }

  enterUserMode(name: string, lock = false): void {
    this.activeUserMode = { name, lock };
  }

  reset(): void {
    this.pending = [];
    this.pendingCharBinding = null;
    this.count = null;
    this.activeUserMode = null;
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

    // User mode active
    if (this.activeUserMode) {
      const modeConfig = this.userModes.get(this.activeUserMode.name);
      const mapped = modeConfig?.get(key);
      const activeName = this.activeUserMode.name;
      const isLock = this.activeUserMode.lock;

      if (!isLock) {
        this.activeUserMode = null;
      }

      if (mapped) {
        this.activeUserMode = null;
        for (const mappedKey of mapped) {
          this.handle(mode, mappedKey, editor);
        }
        if (isLock) {
          this.activeUserMode = { name: activeName, lock: true };
        }
        return true;
      }
      return false;
    }

    // Insert mode remapping
    if (mode === "insert") {
      const insertMapping = this.insertMappings.get(key);
      if (insertMapping) {
        for (const mappedKey of insertMapping) {
          this.handle("insert", mappedKey, editor);
        }
        return true;
      }
    }

    // Normal mode remapping
    if (mode === "select" && this.pending.length === 0) {
      const normalMapping = this.normalMappings.get(key);
      if (normalMapping) {
        for (const mappedKey of normalMapping) {
          this.handle("select", mappedKey, editor);
        }
        return true;
      }
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
