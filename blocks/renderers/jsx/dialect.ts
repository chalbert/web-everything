/**
 * JSX authoring dialect — a *soft* dev-preference (the first one to ship; see #150 / #235).
 *
 * The JSX adapter is a dialect adapter: `class`/`for`/`onclick` is the baked-in HTML-mirror dialect,
 * with React's `className`/`htmlFor`/`onClick` tolerated as aliases. This module exposes that choice
 * as a configurable *preference* governing CODEGEN (which spelling `htmlToJsx` emits), while BOTH
 * spellings stay accepted on INPUT (`jsxToHtml` normalizes either back to canonical HTML).
 *
 * It is a soft preference, not a protocol: violating it offends a convention, it does not break
 * interop. Default is `html` (HTML-mirror, native-first) — opt into `react` explicitly.
 *
 * Report: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
 */

export type JsxDialect = 'html' | 'react';

/** Native-first default — the HTML-mirror dialect. */
export const DEFAULT_DIALECT: JsxDialect = 'html';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Multi-word DOM event name (the part after `on`) → its React camelCase suffix. A *production* `react`
 * dialect must emit React's real handler names, and the single-letter `cap()` only capitalizes the first
 * letter — so `onmouseover` would wrongly become `onMouseover` (React: `onMouseOver`) and `onkeydown`
 * `onKeydown` (`onKeyDown`). Single-word events (`click`/`input`/`focus`/`copy`…) round-trip fine through
 * `cap()` and are NOT listed here. `dblclick`→`DoubleClick` is the one true *rename* (React spells it
 * out, so a plain lowercase reverse can't recover `dblclick`); every other entry is pure word-boundary
 * casing. The reverse map below is derived from this one so the round-trip stays exact.
 */
const REACT_EVENT_SUFFIX: Record<string, string> = {
  // mouse
  mousedown: 'MouseDown', mouseup: 'MouseUp', mousemove: 'MouseMove', mouseover: 'MouseOver',
  mouseout: 'MouseOut', mouseenter: 'MouseEnter', mouseleave: 'MouseLeave',
  dblclick: 'DoubleClick', contextmenu: 'ContextMenu',
  // keyboard
  keydown: 'KeyDown', keyup: 'KeyUp', keypress: 'KeyPress',
  // pointer
  pointerdown: 'PointerDown', pointerup: 'PointerUp', pointermove: 'PointerMove',
  pointerover: 'PointerOver', pointerout: 'PointerOut', pointerenter: 'PointerEnter',
  pointerleave: 'PointerLeave', pointercancel: 'PointerCancel',
  gotpointercapture: 'GotPointerCapture', lostpointercapture: 'LostPointerCapture',
  // touch
  touchstart: 'TouchStart', touchend: 'TouchEnd', touchmove: 'TouchMove', touchcancel: 'TouchCancel',
  // drag
  dragstart: 'DragStart', dragend: 'DragEnd', dragenter: 'DragEnter', dragleave: 'DragLeave',
  dragover: 'DragOver',
  // focus (the raw DOM bubbling pair; map literally)
  focusin: 'FocusIn', focusout: 'FocusOut',
  // composition (IME)
  compositionstart: 'CompositionStart', compositionend: 'CompositionEnd',
  compositionupdate: 'CompositionUpdate',
  // animation / transition
  animationstart: 'AnimationStart', animationend: 'AnimationEnd',
  animationiteration: 'AnimationIteration', transitionend: 'TransitionEnd',
};

/** React prop name → canonical (lowercase) DOM event name, derived from `REACT_EVENT_SUFFIX` so the
 * reverse of any renamed/multi-word event (notably `onDoubleClick`→`ondblclick`) round-trips exactly. */
const REACT_PROP_TO_DOM_EVENT: Record<string, string> = Object.fromEntries(
  Object.entries(REACT_EVENT_SUFFIX).map(([dom, suffix]) => ['on' + suffix, 'on' + dom])
);

/**
 * Canonical HTML attribute name → React prop name (the non-identity renames; every other name is
 * identity). The three families #235 names: `class`→`className`, `for`→`htmlFor`, and inline event
 * handlers `on<event>`→`on<Event>` — single-word events via a first-letter cap (`onclick`→`onClick`),
 * multi-word events via the canonical `REACT_EVENT_SUFFIX` table (`onmouseover`→`onMouseOver`).
 */
export function toReactPropName(name: string): string {
  if (name === 'class') return 'className';
  if (name === 'for') return 'htmlFor';
  const ev = /^on([a-z]+)$/.exec(name);
  if (ev) return 'on' + (REACT_EVENT_SUFFIX[ev[1]] ?? cap(ev[1]));
  return name;
}

/** React prop name → canonical HTML attribute name (the reverse; used to ingest the `react` dialect). */
export function toHtmlAttrName(name: string): string {
  if (name === 'className') return 'class';
  if (name === 'htmlFor') return 'for';
  if (REACT_PROP_TO_DOM_EVENT[name]) return REACT_PROP_TO_DOM_EVENT[name];
  const ev = /^on([A-Z][a-zA-Z]*)$/.exec(name);
  if (ev) return name.toLowerCase();
  return name;
}

/** Apply a dialect to an attribute name in the CODEGEN direction (HTML → JSX). `html` is identity. */
export function applyDialect(name: string, dialect: JsxDialect): string {
  return dialect === 'react' ? toReactPropName(name) : name;
}
