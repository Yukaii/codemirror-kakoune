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
    case "Semicolon": return shift ? ":" : ";";
    case "Equal": return shift ? "+" : "=";
    case "Comma": return shift ? "<" : ",";
    case "Minus": return shift ? "_" : "-";
    case "Period": return shift ? ">" : ".";
    case "Slash": return shift ? "?" : "/";
    case "Backquote": return shift ? "~" : "`";
    case "BracketLeft": return shift ? "{" : "[";
    case "BracketRight": return shift ? "}" : "]";
    case "Quote": return shift ? "\"" : "'";
    case "Backslash": return shift ? "|" : "\\";
    default: return null;
  }
}

const modifierOnlyKeys = new Set([
  "Shift", "Control", "Alt", "Meta", "OS", "CapsLock", "NumLock", "ScrollLock"
]);

export function normalizeKeyStroke(event: KeyboardEvent): string | null {
  if (event.isComposing) return null;

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
    if (mapped !== null) key = mapped;
    const base = key.length === 1 ? key.toLowerCase() : key;
    if (modifierOnlyKeys.has(base)) return null;
    return `<${modifiers.join("-")}-${base}>`;
  }

  if (modifierOnlyKeys.has(key)) return null;

  switch (key) {
    case "Escape": return "<Esc>";
    case "Tab": return "<Tab>";
    case "Enter": return "<Enter>";
    case "Backspace": return "<Backspace>";
    case "Delete": return "<Delete>";
    case " ": return "<Space>";
    case "ArrowLeft": return "<Left>";
    case "ArrowRight": return "<Right>";
    case "ArrowUp": return "<Up>";
    case "ArrowDown": return "<Down>";
    case "Home": return "<Home>";
    case "End": return "<End>";
    case "PageUp": return "<PageUp>";
    case "PageDown": return "<PageDown>";
    default: return key;
  }
}

export function normalizeCm5Key(key: string): string {
  const parts = key.split("-");
  const base = parts.pop() ?? "";
  const modifiers: string[] = [];

  for (const modifier of parts) {
    switch (modifier.toLowerCase()) {
      case "ctrl":
      case "control":
        modifiers.push("C");
        break;
      case "alt":
        modifiers.push("A");
        break;
      case "shift":
        modifiers.push("S");
        break;
      case "cmd":
      case "meta":
        modifiers.push("M");
        break;
      default:
        return key;
    }
  }

  const names: Record<string, string> = {
    esc: "<Esc>", escape: "<Esc>", enter: "<Enter>", return: "<Enter>",
    tab: "<Tab>", backspace: "<Backspace>", delete: "<Delete>", space: "<Space>",
    left: "<Left>", right: "<Right>", up: "<Up>", down: "<Down>",
    home: "<Home>", end: "<End>", pageup: "<PageUp>", pagedown: "<PageDown>"
  };
  const named = names[base.toLowerCase()];
  const normalizedBase = named ? named.slice(1, -1) : base.length === 1 ? base.toLowerCase() : base;

  if (modifiers.length === 0) {
    return named ?? (base.length === 1 ? base : `<${normalizedBase}>`);
  }
  if (modifiers.length === 1 && modifiers[0] === "C" && base === "[") {
    return "<Esc>";
  }
  return `<${modifiers.join("-")}-${normalizedBase}>`;
}

export function normalizeCm5Keys(keys: string | string[]): string[] {
  return (Array.isArray(keys) ? keys : keys.trim().split(/\s+/))
    .filter(key => key.length > 0)
    .map(normalizeCm5Key);
}
