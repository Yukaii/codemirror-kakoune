export interface KakrcConfig {
  normalMappings: Map<string, string[]>;
  insertMappings: Map<string, string[]>;
  userModes: Map<string, Map<string, string[]>>;
  namedRegisters: Map<string, string>;
  options: Map<string, string>;
}

export function normalizeTrigger(trigger: string): string {
  const lower = trigger.toLowerCase();
  if (lower === "<esc>") return "<Esc>";
  if (lower === "<enter>" || lower === "<ret>") return "<Enter>";
  if (lower === "<tab>") return "<Tab>";
  if (lower === "<space>") return "<Space>";
  if (lower === "<backspace>") return "<Backspace>";
  if (lower === "<left>") return "<Left>";
  if (lower === "<right>") return "<Right>";
  if (lower === "<up>") return "<Up>";
  if (lower === "<down>") return "<Down>";
  if (lower.startsWith("<a-")) return `<A-${trigger.slice(3, -1)}>`;
  if (lower.startsWith("<c-")) return `<C-${trigger.slice(3, -1)}>`;
  return trigger;
}

export function tokenizeKakrcKeys(text: string): string[] {
  const tokens: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\n" || ch === "\r") {
      continue;
    }

    if (ch === "<") {
      const end = text.indexOf(">", i + 1);
      if (end > i + 1) {
        const token = text.slice(i, end + 1);
        tokens.push(normalizeTrigger(token));
        i = end;
        continue;
      }
    }

    tokens.push(ch);
  }

  return tokens;
}

function cleanQuote(val: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith("%{") && trimmed.endsWith("%}")) {
    return trimmed.slice(2, -2);
  }
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseKakrc(script: string): KakrcConfig {
  const normalMappings = new Map<string, string[]>();
  const insertMappings = new Map<string, string[]>();
  const userModes = new Map<string, Map<string, string[]>>();
  const namedRegisters = new Map<string, string>();
  const options = new Map<string, string>();

  if (!script) {
    return { normalMappings, insertMappings, userModes, namedRegisters, options };
  }

  const lines = script.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // declare-user-mode <name>
    const userModeDecl = line.match(/^declare-user-mode\s+(\S+)$/);
    if (userModeDecl) {
      const mode = userModeDecl[1];
      if (!userModes.has(mode)) {
        userModes.set(mode, new Map());
      }
      continue;
    }

    // set-register <reg> <val> / reg <reg> <val>
    const regMatch = line.match(/^(?:set-register|reg)\s+(\S+)\s+(.+)$/);
    if (regMatch) {
      namedRegisters.set(regMatch[1], cleanQuote(regMatch[2]));
      continue;
    }

    // set-option global <name> <val>
    const optMatch = line.match(/^(?:set-option|set)\s+(?:global\s+)?(\S+)\s+(.+)$/);
    if (optMatch) {
      options.set(optMatch[1], cleanQuote(optMatch[2]));
      continue;
    }

    // map [global] <mode> <trigger> <expansion>
    const mapMatch = line.match(/^map\s+(?:global\s+)?(\S+)\s+(\S+)\s+(.+)$/);
    if (mapMatch) {
      const mode = mapMatch[1].toLowerCase();
      const trigger = normalizeTrigger(mapMatch[2]);
      const rawVal = cleanQuote(mapMatch[3]);
      const expansion = tokenizeKakrcKeys(rawVal);

      if (mode === "normal" || mode === "select") {
        normalMappings.set(trigger, expansion);
      } else if (mode === "insert") {
        insertMappings.set(trigger, expansion);
      } else {
        if (!userModes.has(mode)) {
          userModes.set(mode, new Map());
        }
        userModes.get(mode)!.set(trigger, expansion);
      }
      continue;
    }
  }

  return { normalMappings, insertMappings, userModes, namedRegisters, options };
}
