import { Decoration, drawSelection, EditorView } from "@codemirror/view";
import { EditorState, type Extension, type Range } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { search } from "@codemirror/search";
import {
  kakouneInitialModeFacet,
  kakouneStateField,
  kakouneWhichKeyFacet,
  kakouneGotoFileFacet,
  kakouneGotoBufferFacet,
  kakounePipeFacet,
  kakouneExecuteCommandFacet,
  kakouneSelectionTypeField,
  type KakouneMode,
  type KakouneOptions,
  type KakouneState
} from "./state";
import { KakouneKeyProcessor, normalizeKeyStroke } from "./keys";
import {
  buildKakouneCommands,
  commitSearchPrompt,
  deleteSearchPromptChar,
  cancelSearchPrompt,
  commitPipePrompt,
  deletePipePromptChar,
  cancelPipePrompt,
  handlePipePromptKey,
  handleSearchPromptKey,
  commitSelectPrompt,
  deleteSelectPromptChar,
  cancelSelectPrompt,
  handleSelectPromptKey,
  commitSplitPrompt,
  deleteSplitPromptChar,
  cancelSplitPrompt,
  handleSplitPromptKey
} from "./commands";

export type {
  KakouneMode,
  KakouneOptions,
  KakouneState,
  WhichKeyCallback,
  WhichKeyItem,
  KakouneFindKind,
  KakouneLastSelect,
  GotoFileCallback,
  GotoBufferCallback,
  PipeCallbackParams,
  PipeCallback,
  ExecuteCommandCallback
} from "./state";
export {
  kakouneStateField,
  kakouneInitialModeFacet,
  setKakouneModeEffect,
  setKakouneNamedRegistersEffect,
  setKakouneSelectionHistoryEffect,
  setKakouneLastSelectEffect,
  setKakouneSearchPromptEffect,
  setKakouneSearchSelectionEffect,
  setKakouneSelectPromptEffect,
  setKakouneSelectSelectionEffect,
  setKakouneSplitPromptEffect,
  setKakouneSplitSelectionEffect,
  kakouneWhichKeyFacet,
  kakouneGotoFileFacet,
  kakouneGotoBufferFacet,
  kakounePipeFacet,
  kakouneExecuteCommandFacet,
  kakouneSelectionTypeField,
  setKakouneSelectionTypeEffect
} from "./state";
export { normalizeKeyStroke, normalizeCm5Key, normalizeCm5Keys, KakouneKeyProcessor } from "./keys";
export { Cm6Adapter, withAdapter } from "./adapter";
export {
  buildKakouneCommands,
  commitSearchPrompt,
  deleteSearchPromptChar,
  cancelSearchPrompt,
  handleSearchPromptKey,
  commitSelectPrompt,
  deleteSelectPromptChar,
  cancelSelectPrompt,
  handleSelectPromptKey,
  commitSplitPrompt,
  deleteSplitPromptChar,
  cancelSplitPrompt,
  handleSplitPromptKey,
  gotoFile,
  extendGotoFile,
  gotoLastBuffer,
  extendGotoLastBuffer,
  gotoBufferEnd,
  extendGotoBufferEnd,
  kakouneCommands
} from "./commands";

function createKakouneHandler(processor: KakouneKeyProcessor) {
  return EditorView.domEventHandlers({
    beforeinput(event, view) {
      const state = view.state.field(kakouneStateField);
      // Block all direct text input in select mode and during any prompt
      if (
        state.mode !== "insert" ||
        state.searchPrompt !== null ||
        state.selectPrompt !== null ||
        state.splitPrompt !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      return false;
    },
    keydown(event, view) {
      const key = normalizeKeyStroke(event);
      if (!key) {
        return false;
      }

      const state = view.state.field(kakouneStateField);

      if (state.searchPrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handleSearchPromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      if (state.selectPrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handleSelectPromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      if (state.splitPrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handleSplitPromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      if (state.pipePrompt !== null) {
        if (key === "<Enter>" || key === "<Backspace>" || key === "<Esc>") {
          return false;
        }
        const handledPrompt = handlePipePromptKey(view, key);
        if (handledPrompt) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      if (key === "<Esc>") {
        return false;
      }

      const mode = state.mode;

      if (mode === "insert") {
        if (key !== "<A-;>" && !processor.hasInsertMapping(key)) {
          return false;
        }
      }

      const handled = processor.handle(mode, key, view);

      const whichKeyCallback = view.state.facet(kakouneWhichKeyFacet);
      if (whichKeyCallback) {
        whichKeyCallback(
          processor.getPending(),
          processor.getPendingItems(mode),
          processor.isWaitingForChar()
        );
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }

      if (mode !== "insert") {
        // Swallow single printable character keys and special keys like Enter/Backspace
        // to prevent text insertion or deletion in select mode.
        if (key.length === 1 || key === "<Enter>" || key === "<Backspace>") {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      return false;
    }
  });
}

const kakouneEditorAttributes = EditorView.editorAttributes.of(view => {
  const kakouneState = view.state.field(kakouneStateField, false);
  const mode = kakouneState ? kakouneState.mode : "select";
  return { "data-kakoune-mode": mode };
});

const kakouneLineCursor = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.updateCursor(view);
    }

    update(update: ViewUpdate): void {
      const selectionTypeChanged = update.startState.field(kakouneSelectionTypeField) !==
        update.state.field(kakouneSelectionTypeField);
      if (update.selectionSet || update.docChanged || selectionTypeChanged) {
        this.updateCursor(update.view);
      }
    }

    destroy(): void {
      this.view?.dom.classList.remove("cm-line-selection");
    }

    private view?: EditorView;

    private updateCursor(view: EditorView): void {
      this.view = view;
      const isLine = view.state.field(kakouneSelectionTypeField) === "line";
      view.dom.classList.toggle("cm-line-selection", isLine);
    }
  }
);

const kakouneSelectionMark = Decoration.mark({
  class: "cm-selectionBackground cm-kakoune-selection"
});

const kakouneSelectionDecorations = EditorView.decorations.compute(
  ["selection"],
  state => {
    const decorations: Range<Decoration>[] = [];
    for (const selection of state.selection.ranges) {
      if (!selection.empty) {
        decorations.push(kakouneSelectionMark.range(selection.from, selection.to));
      }
    }
    return Decoration.set(decorations);
  }
);

const kakouneBaseTheme = EditorView.baseTheme({
  "&[data-kakoune-mode='select'] .cm-cursor, &[data-kakoune-mode='select'] .cm-cursor-primary, &[data-kakoune-mode='select'] .cm-cursor-secondary": {
    borderLeft: "1ch solid var(--color-accent, var(--caret-color, currentColor))",
    opacity: "0.7",
    marginLeft: "0"
  },
  "&[data-kakoune-mode='insert'] .cm-cursor, &[data-kakoune-mode='insert'] .cm-cursor-primary": {
    borderLeft: "1.5px solid var(--caret-color, currentColor)"
  },
  "& .cm-selectionLayer > .cm-selectionBackground": {
    display: "none"
  }
});

/**
 * Creates a CodeMirror extension that enables Kakoune-style modal editing.
 *
 * @param options - Configuration options for initial mode and which-key callback.
 * @returns A CodeMirror {@link Extension} array to include in your editor state.
 *
 * @example
 * ```ts
 * import { EditorView } from "@codemirror/view";
 * import { EditorState } from "@codemirror/state";
 * import { kakoune } from "codemirror-kakoune";
 *
 * const view = new EditorView({
 *   state: EditorState.create({
 *     doc: "Hello, world!",
 *     extensions: [kakoune()]
 *   })
 * });
 * ```
 */
export function kakoune(options: KakouneOptions = {}): Extension {
  const initialMode = options.initialMode ?? "select";
  const processor = new KakouneKeyProcessor(buildKakouneCommands());

  const extensions: Extension[] = [
    kakouneInitialModeFacet.of(initialMode),
    kakouneStateField,
    kakouneSelectionTypeField,
    EditorState.allowMultipleSelections.of(true),
    history(),
    drawSelection(),
    kakouneEditorAttributes,
    kakouneLineCursor,
    kakouneSelectionDecorations,
    kakouneBaseTheme,
    Prec.highest(
      keymap.of([
        {
          key: "Enter",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt !== null) {
              return commitSearchPrompt(view);
            }
            if (state.selectPrompt !== null) {
              return commitSelectPrompt(view);
            }
            if (state.splitPrompt !== null) {
              return commitSplitPrompt(view);
            }
            if (state.pipePrompt !== null) {
              return commitPipePrompt(view);
            }

            // Swallow Enter in select mode so the default keymap doesn't insert a newline
            return state.mode !== "insert";
          }
        },
        {
          key: "Backspace",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt !== null) {
              return deleteSearchPromptChar(view);
            }
            if (state.selectPrompt !== null) {
              return deleteSelectPromptChar(view);
            }
            if (state.splitPrompt !== null) {
              return deleteSplitPromptChar(view);
            }
            if (state.pipePrompt !== null) {
              return deletePipePromptChar(view);
            }

            // Swallow Backspace in select mode so the default keymap doesn't delete
            return state.mode !== "insert";
          }
        },
        {
          key: "Escape",
          run(view) {
            const state = view.state.field(kakouneStateField);
            if (state.searchPrompt !== null) {
              return cancelSearchPrompt(view);
            }
            if (state.selectPrompt !== null) {
              return cancelSelectPrompt(view);
            }
            if (state.splitPrompt !== null) {
              return cancelSplitPrompt(view);
            }
            if (state.pipePrompt !== null) {
              return cancelPipePrompt(view);
            }

            processor.handle(state.mode, "<Esc>", view);
            const whichKeyCallback = view.state.facet(kakouneWhichKeyFacet);
            if (whichKeyCallback) {
              const currentMode = view.state.field(kakouneStateField).mode;
              whichKeyCallback(
                processor.getPending(),
                processor.getPendingItems(currentMode),
                processor.isWaitingForChar()
              );
            }
            return true;
          }
        }
      ])
    ),
    search(),
    createKakouneHandler(processor)
  ];

  if (options.onWhichKey) {
    extensions.push(kakouneWhichKeyFacet.of(options.onWhichKey));
  }
  if (options.onGotoFile) {
    extensions.push(kakouneGotoFileFacet.of(options.onGotoFile));
  }
  if (options.onGotoBuffer) {
    extensions.push(kakouneGotoBufferFacet.of(options.onGotoBuffer));
  }
  if (options.onPipe) {
    extensions.push(kakounePipeFacet.of(options.onPipe));
  }
  if (options.onExecuteCommand) {
    extensions.push(kakouneExecuteCommandFacet.of(options.onExecuteCommand));
  }

  return extensions;
}

/** Retrieves the current Kakoune state from an editor state. */
export function getKakouneState(state: EditorState): KakouneState {
  return state.field(kakouneStateField);
}

/** Checks whether the editor is currently in the given Kakoune mode. */
export function isKakouneMode(state: EditorState, mode: KakouneMode): boolean {
  return state.field(kakouneStateField).mode === mode;
}
