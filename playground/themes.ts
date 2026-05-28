import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

export type PlaygroundThemeName = "night" | "paper" | "sepia";

export interface PlaygroundTheme {
  name: PlaygroundThemeName;
  label: string;
  dark: boolean;
  shell: {
    bg: string;
    panel: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    selection: string;
    activeLine: string;
  };
  editor: {
    background: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
    panel: string;
    selection: string;
    activeLine: string;
    match: string;
    keyword: string;
    string: string;
    comment: string;
    number: string;
    variable: string;
    property: string;
    type: string;
    function: string;
  };
}

export const playgroundThemes: Record<PlaygroundThemeName, PlaygroundTheme> = {
  night: {
    name: "night",
    label: "Night",
    dark: true,
    shell: {
      bg: "#0f1115",
      panel: "#151922",
      border: "#273044",
      text: "#e8ebf0",
      muted: "#95a0b2",
      accent: "#8ad4ff",
      selection: "rgba(138, 212, 255, 0.22)",
      activeLine: "rgba(255, 255, 255, 0.04)"
    },
    editor: {
      background: "#151922",
      text: "#e8ebf0",
      muted: "#95a0b2",
      accent: "#8ad4ff",
      border: "#273044",
      panel: "#1a2030",
      selection: "rgba(138, 212, 255, 0.22)",
      activeLine: "rgba(255, 255, 255, 0.04)",
      match: "rgba(138, 212, 255, 0.18)",
      keyword: "#8ad4ff",
      string: "#b4f0a7",
      comment: "#7d8794",
      number: "#f4d19a",
      variable: "#e8ebf0",
      property: "#9ee6d0",
      type: "#f0b6ff",
      function: "#d9b8ff"
    }
  },
  paper: {
    name: "paper",
    label: "Paper",
    dark: false,
    shell: {
      bg: "#f5f1e8",
      panel: "#fffcf5",
      border: "#d8cbb9",
      text: "#243041",
      muted: "#6d7785",
      accent: "#2f6f8f",
      selection: "rgba(47, 111, 143, 0.18)",
      activeLine: "rgba(36, 48, 65, 0.04)"
    },
    editor: {
      background: "#fffcf5",
      text: "#243041",
      muted: "#6d7785",
      accent: "#2f6f8f",
      border: "#d8cbb9",
      panel: "#f7efe3",
      selection: "rgba(47, 111, 143, 0.18)",
      activeLine: "rgba(36, 48, 65, 0.04)",
      match: "rgba(47, 111, 143, 0.12)",
      keyword: "#2f6f8f",
      string: "#7a8f4f",
      comment: "#8b7d6a",
      number: "#a15c2f",
      variable: "#243041",
      property: "#5e6f88",
      type: "#7c4fb2",
      function: "#4e6cb6"
    }
  },
  sepia: {
    name: "sepia",
    label: "Sepia",
    dark: false,
    shell: {
      bg: "#efe2cf",
      panel: "#f7efe3",
      border: "#d4c2a9",
      text: "#3e2f20",
      muted: "#776553",
      accent: "#8b5e34",
      selection: "rgba(139, 94, 52, 0.18)",
      activeLine: "rgba(62, 47, 32, 0.04)"
    },
    editor: {
      background: "#f7efe3",
      text: "#3e2f20",
      muted: "#776553",
      accent: "#8b5e34",
      border: "#d4c2a9",
      panel: "#efe2cf",
      selection: "rgba(139, 94, 52, 0.18)",
      activeLine: "rgba(62, 47, 32, 0.04)",
      match: "rgba(139, 94, 52, 0.12)",
      keyword: "#8b5e34",
      string: "#7f8a49",
      comment: "#9a8a78",
      number: "#9a5b2f",
      variable: "#3e2f20",
      property: "#7a5e45",
      type: "#7c5f9c",
      function: "#5f6f9d"
    }
  }
};

export function isPlaygroundThemeName(value: string | null | undefined): value is PlaygroundThemeName {
  return value === "night" || value === "paper" || value === "sepia";
}

export function buildPlaygroundEditorTheme(theme: PlaygroundTheme): Extension {
  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: theme.editor.keyword, fontWeight: "600" },
    { tag: tags.string, color: theme.editor.string },
    { tag: tags.comment, color: theme.editor.comment, fontStyle: "italic" },
    { tag: tags.number, color: theme.editor.number },
    { tag: tags.bool, color: theme.editor.number },
    { tag: tags.null, color: theme.editor.number },
    { tag: tags.variableName, color: theme.editor.variable },
    { tag: tags.propertyName, color: theme.editor.property },
    { tag: tags.typeName, color: theme.editor.type },
    { tag: tags.function(tags.variableName), color: theme.editor.function },
    { tag: tags.definition(tags.variableName), color: theme.editor.function }
  ]);

  return [
    EditorView.theme(
      {
        "&": {
          backgroundColor: theme.editor.background,
          color: theme.editor.text
        },
        "&.cm-focused": {
          outline: "none"
        },
        ".cm-scroller": {
          fontSize: "14px",
          lineHeight: "1.6"
        },
        ".cm-content": {
          caretColor: theme.editor.accent
        },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: theme.editor.accent
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
          backgroundColor: theme.editor.selection
        },
        ".cm-selectionMatch": {
          backgroundColor: theme.editor.match
        },
        ".cm-gutters": {
          backgroundColor: theme.editor.panel,
          color: theme.editor.muted,
          borderRight: `1px solid ${theme.editor.border}`
        },
        ".cm-activeLine, .cm-activeLineGutter": {
          backgroundColor: theme.editor.activeLine
        },
        ".cm-panels": {
          backgroundColor: theme.editor.panel,
          color: theme.editor.text,
          borderColor: theme.editor.border
        },
        ".cm-tooltip": {
          backgroundColor: theme.editor.panel,
          color: theme.editor.text,
          border: `1px solid ${theme.editor.border}`
        },
        ".cm-matchingBracket": {
          backgroundColor: theme.editor.match,
          outline: `1px solid ${theme.editor.accent}`
        }
      },
      { dark: theme.dark }
    ),
    syntaxHighlighting(highlightStyle)
  ];
}
