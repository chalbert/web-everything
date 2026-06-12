/**
 * eventHandlerForm — the event-handler DISPLAY-FORM axis for the JSX adapter (#324).
 *
 * A second presentation axis, orthogonal to the html|react name dialect (./dialect). A single NAMED
 * handler has two spellings of the same behavior:
 *
 *   - string behavior  (canonical, reversible):   on:click="inc($event)"   ← what htmlToJsx emits
 *   - function prop     (convenience, type-checked): onclick={inc}
 *
 * Ratified in #051 Fork 1: the function prop is JSX's ergonomic, type-checked draw and the ecosystem
 * majority, but only the string behavior serializes to HTML, so the string form stays the reversible
 * canonical target. This toggle "just chooses which form is shown" — it is NOT a new protocol, only a
 * display preference layered over the same canonical source.
 *
 * Asymmetry (the #325 rule): only a named handler has BOTH forms. An inline closure (`onclick={()=>…}`)
 * exists solely as a function prop — it has no string-behavior spelling — so the function→string
 * direction is jsxToHtml's `reverseEvents`, which flags such a closure lossy. This module owns the
 * other direction (string behavior → function prop), where every input is by construction a named,
 * round-trippable handler, so it is total and never lossy.
 */

/** Canonical string-behavior handler: `on:EVENT="NAME($event)"` where NAME is a bare identifier/path. */
const STRING_BEHAVIOR = /\son:([a-z]+)="([\w$.]+)\(\$event\)"/g;

/** Function-prop handler with a bare name: `onEVENT={NAME}` (closures are NOT matched — see below). */
const FUNCTION_PROP_NAMED = /\son([a-z]+)=\{\s*([\w$.]+)\s*\}/g;

/**
 * String behavior → function prop (`on:click="inc($event)"` → `onclick={inc}`). The convenience
 * display spelling. Only the canonical `NAME($event)` shape is rewritten; a string behavior with
 * literal args (`on:click="seek(42)"`) has no bare-name function-prop form and is left verbatim.
 * Emits the lowercase `html`-dialect name (`onclick`); the html|react name dialect, if also applied,
 * composes on top to yield `onClick` — the two axes stay orthogonal.
 */
export function toFunctionProp(jsx: string): string {
  return jsx.replace(STRING_BEHAVIOR, (_whole, evt: string, name: string) => ` on${evt}={${name}}`);
}

/**
 * Function prop (named) → string behavior (`onclick={inc}` → `on:click="inc($event)"`). The canonical
 * display spelling. NOTE: this rewrites only the round-trippable BARE-NAME form; an inline closure has
 * no string-behavior spelling and is intentionally NOT matched here — the lossy-aware conversion of a
 * closure lives in `jsxToHtml`'s `reverseEvents` (#325). Use this for display switching between two
 * already-named forms; use `jsxToHtmlWithDiagnostics` when a closure may be present and must be reported.
 */
export function toStringBehavior(jsx: string): string {
  return jsx.replace(FUNCTION_PROP_NAMED, (_whole, evt: string, name: string) => ` on:${evt}="${name}($event)"`);
}

/** The two display forms of an event handler (the #324 axis values). */
export type EventHandlerForm = 'string-behavior' | 'function-prop';

/** Native-first default — the canonical, reversible string behavior (what htmlToJsx emits). */
export const DEFAULT_EVENT_HANDLER_FORM: EventHandlerForm = 'string-behavior';

/** Render a canonical (string-behavior) JSX source in the requested handler form. `string-behavior` is identity. */
export function applyEventHandlerForm(jsx: string, form: EventHandlerForm): string {
  return form === 'function-prop' ? toFunctionProp(jsx) : jsx;
}
