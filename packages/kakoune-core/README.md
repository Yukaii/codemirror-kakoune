# kakoune-core

Framework-agnostic Kakoune engine used by the CodeMirror 6 and CodeMirror 5 adapters.

The engine owns key processing, document/selection math, and portable commands.
Editors implement `EditorHost` and keep prompts, rendering, and framework-specific features in their adapters.
