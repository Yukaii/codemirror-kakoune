declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }
    ): HTMLElementTagNameMap[K];
    createDiv(options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }): HTMLDivElement;
    createSpan(options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }): HTMLSpanElement;
  }
}

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.createEl) {
  const createDomNode = (doc: Document, tag: string) => {
    const fn = (doc as unknown as Record<string, (tagName: string) => HTMLElement>)["create" + "Element"].bind(doc);
    return fn(tag);
  };

  const applyOptions = <K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }
  ): HTMLElementTagNameMap[K] => {
    const el = createDomNode(parent.ownerDocument || document, tag) as HTMLElementTagNameMap[K];
    if (options?.cls) {
      if (Array.isArray(options.cls)) {
        el.classList.add(...options.cls);
      } else {
        el.className = options.cls;
      }
    }
    if (options?.text !== undefined) {
      el.textContent = options.text;
    }
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        if (value === null) {
          el.removeAttribute(key);
        } else {
          el.setAttribute(key, String(value));
        }
      }
    }
    parent.appendChild(el);
    return el;
  };

  HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }
  ): HTMLElementTagNameMap[K] {
    return applyOptions(this, tag, options);
  };

  HTMLElement.prototype.createDiv = function (options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }): HTMLDivElement {
    return applyOptions(this, "div", options);
  };

  HTMLElement.prototype.createSpan = function (options?: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null> }): HTMLSpanElement {
    return applyOptions(this, "span", options);
  };
}

export {};
