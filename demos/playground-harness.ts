/**
 * Shared playground harness — the conformance machinery every playground reuses, in ONE source so
 * the subtle bits (DOM-equality that accounts for <template>.content, the window readiness flag an
 * E2E spec asserts) can't drift between demos. The chrome analogue of the shared mapping fixtures.
 *
 * Browser-only (uses isEqualNode / real DOM): demos run in the browser, so unlike the unit tests
 * this can rely on isEqualNode. See demo-workflow.md §3 and the coverage plan §#G.
 */

/** Parse canonical HTML into a <div> box (canonicalizes boolean attrs, quoting, whitespace). */
export function box(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d;
}

/** Wrap a live node in a <div> so single-root and multi-root compare uniformly. */
export function toBox(node: Node): HTMLElement {
  const d = document.createElement('div');
  d.appendChild(node.cloneNode(true));
  return d;
}

/** Serialize a rendered node to its produced HTML (handles elements, templates, fragments). */
export function producedHtml(node: Node): string {
  if (node instanceof HTMLTemplateElement) {
    const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${a.value}"`).join('');
    const inner = Array.from(node.content.childNodes)
      .map((n) => (n instanceof Element ? n.outerHTML : (n.textContent || '').trim()))
      .filter(Boolean)
      .join('\n  ');
    return `<template${attrs}>\n  ${inner}\n</template>`;
  }
  if (node instanceof Element) return node.outerHTML;
  if (node instanceof DocumentFragment) {
    return Array.from(node.childNodes)
      .map((n) => (n instanceof Element ? n.outerHTML : n.textContent || ''))
      .join('\n');
  }
  return node.textContent || '';
}

/**
 * Are two HTML strings structurally equal? isEqualNode is attribute-order-independent but skips
 * <template>.content, so nested template contents are compared explicitly.
 */
export function htmlEqual(a: string, b: string): boolean {
  return boxesEqual(box(a), box(b));
}

/**
 * DOM-equality conformance check: does the rendered tree equal the canonical HTML?
 */
export function domEqual(produced: Node, canonicalHtml: string): boolean {
  return boxesEqual(toBox(produced), box(canonicalHtml));
}

function boxesEqual(a: HTMLElement, b: HTMLElement): boolean {
  if (!a.isEqualNode(b)) return false;
  // isEqualNode skips <template>.content — compare each template's inert content explicitly.
  const aT = a.querySelectorAll('template');
  const bT = b.querySelectorAll('template');
  if (aT.length !== bT.length) return false;
  for (let i = 0; i < aT.length; i++) {
    if (!toBox(aT[i].content).isEqualNode(toBox(bT[i].content))) return false;
  }
  return true;
}

/** Expose readiness + pass count on window so an E2E spec can assert the playground rendered green. */
export function setPlaygroundReady(passCount: number): void {
  const w = window as unknown as { playgroundReady?: boolean; playgroundPass?: number };
  w.playgroundReady = true;
  w.playgroundPass = passCount;
}
