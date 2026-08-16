# kakoune-core

Framework-agnostic Kakoune engine used by the CodeMirror 6 and CodeMirror 5 adapters.

The engine owns key processing, document/selection math, portable commands,
and framework-neutral select/split prompt handling through
`KakounePromptController`.
Editors implement `EditorHost` and keep prompt rendering and other
framework-specific features in their adapters.
