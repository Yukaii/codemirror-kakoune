export function detectCM6(element: HTMLElement): HTMLElement | null {
  if (element.classList.contains("cm-content") || element.closest(".cm-content")) {
    return (element.closest(".cm-editor") || element.closest(".cm-content") || element) as HTMLElement;
  }
  const editor = element.closest(".cm-editor");
  if (editor) return editor as HTMLElement;
  return null;
}
