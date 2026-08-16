export type {
  KakouneMode,
  SelectionRange,
  LineInfo,
  WhichKeyItem,
  KakouneBinding,
  EditorHost
} from "./types";
export { isEmptyRange, rangeFrom, rangeTo } from "./types";
export {
  clamp,
  isWordChar,
  getCharClass,
  isAtWordEnd,
  isAtWordStart,
  moveWordForwardRange,
  moveWordBackwardRange,
  moveWordEndRange,
  lineColumnPos
} from "./document";
export { KakouneKeyProcessor } from "./processor";
export { normalizeKeyStroke, normalizeCm5Key, normalizeCm5Keys } from "./normalize";
export {
  portableCommands,
  setMode,
  moveLeft,
  moveRight,
  moveDown,
  moveUp,
  extendLeft,
  extendRight,
  extendDown,
  extendUp,
  selectWordForward,
  selectWordBackward,
  selectWordEnd,
  extendWordForward,
  extendWordBackward,
  extendWordEnd,
  moveLineStart,
  moveLineEnd,
  extendLineStart,
  extendLineEnd,
  extendToLine,
  extendDocumentStart,
  extendDocumentEnd,
  jumpDocumentStart,
  jumpDocumentEnd,
  selectLine,
  deleteSelection,
  yankSelection,
  undoEdit,
  redoEdit,
  enterInsert,
  enterInsertLineStart,
  enterInsertLineEnd,
  openLineBelow,
  openLineAbove,
  changeSelection
} from "./commands";
