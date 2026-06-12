/**
 * jsxToHtml — JSX mirror-dialect source → canonical HTML.
 *
 * The reverse direction of the conversion adapter. Because the mirror dialect is near-identity with
 * HTML, this is a small set of string rewrites (no DOM needed):
 *
 *   - directive sugar       <For each="…">    → <template is="for-each" items="…"> (./directives)
 *   - fragment wrapper      <>…</>            → siblings (dropped)
 *   - aliases               className/htmlFor → class/for
 *   - event handler         onclick={inc}     → on:click="inc($event)" (named, round-trips) OR
 *                           onclick={()=>…}   → dropped + LOSSY diagnostic (closure, no string path — #325)
 *   - other expression prop name={…}          → dropped (no HTML representation, e.g. value={x})
 *   - self-closing tag      <x … />           → <x …> (void) or <x …></x> (non-void)
 *
 * Event handlers are the one expression prop with a reversible form. A NAMED handler (`onclick={inc}`)
 * round-trips, because the function name *is* the string path the injector resolves: it lowers to the
 * canonical string behavior `on:click="inc($event)"`. An INLINE CLOSURE (`onclick={() => …}`) has no
 * string path, so — per #051 Fork 2, mirroring crossStrategy.lowerEvents and the #245 string-survival
 * rule — it is flagged lossy rather than silently dropped. `jsxToHtml` returns just the code (the
 * established string API); callers that need the lossy signal use `jsxToHtmlWithDiagnostics`.
 *
 * POC scope: handles the mirror-dialect shapes the playground exercises. Expression props with
 * nested braces and exotic JSX are out of scope. See reports/2026-06-03-jsx-adapter-feature-mapping.md.
 */

import { desugar } from './directives';
// Type-only import (erased at compile time) — shares the conversion contract with crossStrategy
// without a runtime cycle (crossStrategy imports the jsxToHtml *value*).
import type { ConversionResult, Diagnostic } from './render-strategy/crossStrategy';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** A bare identifier / member path (`inc`, `obj.method`) — the only handler shape with a string path. */
const NAMED_HANDLER = /^[\w$.]+$/;

/**
 * Lower `on<event>={expr}` props to canonical string behavior, collecting a lossy diagnostic for any
 * inline closure. Mirrors crossStrategy.lowerEvents exactly (same regex, same `inline-closure-handler`
 * rule id) so the two reverse paths stay consistent. Matches `={…}` (expression) handlers only —
 * a `on:select="choose($event)"` string attribute already IS the canonical form and is left verbatim.
 */
function reverseEvents(src: string, diags: Diagnostic[]): string {
  return src.replace(
    /\son([a-zA-Z]+)=\{\s*([^{}]+?)\s*\}/g,
    (whole, evt: string, handler: string) => {
      const named = handler.trim();
      if (NAMED_HANDLER.test(named)) {
        // The name is the string path — round-trips to the canonical string behavior.
        return ` on:${evt.toLowerCase()}="${named}($event)"`;
      }
      // Inline closure / expression — no string-behavior form. Flag lossy; never silently drop (#325).
      diags.push({
        rule: 'inline-closure-handler',
        message: `on${evt}={…} is an inline closure with no declarative string form; cannot round-trip, flagged lossy and dropped.`,
        fragment: whole.trim(),
      });
      return '';
    }
  );
}

/**
 * The reverse transform with lossy diagnostics (#325). Named event handlers lower to the canonical
 * string behavior; inline closures are dropped and reported. `lossy` is true iff a closure was hit.
 */
export function jsxToHtmlWithDiagnostics(jsx: string): ConversionResult {
  const diagnostics: Diagnostic[] = [];

  // 0. lower directive sugar (<For>/<Show>/<Resource>) to the canonical <template is> form, so the
  //    rest of the pipeline (template passes through as identity HTML) emits the canonical directive.
  let s = desugar(jsx.trim());

  // 1. drop fragment wrappers
  s = s.replace(/<>\s*/g, '').replace(/\s*<\/>/g, '');

  // 2. aliases lower to canonical HTML names — the `react` dialect (#235) is accepted on input and
  //    normalized back to canonical HTML: className→class, htmlFor→for, on<Event>→on<event>.
  s = s
    .replace(/\bclassName=/g, 'class=')
    .replace(/\bhtmlFor=/g, 'for=')
    .replace(/\bon([A-Z][a-zA-Z]*)=/g, (_m, ev: string) => `on${ev.toLowerCase()}=`);

  // 3a. event handlers: named → on:event="name($event)"; inline closure → lossy diagnostic + drop (#325).
  s = reverseEvents(s, diagnostics);

  // 3b. drop the remaining expression props `name={…}` — they have no HTML representation (e.g. value={x}).
  s = s.replace(/\s+[\w:-]+=\{[^{}]*\}/g, '');

  // 4. expand self-closing tags to HTML form
  s = s.replace(/<([a-zA-Z][\w-]*)([^<>]*?)\s*\/>/g, (_m, tag: string, attrs: string) =>
    VOID_ELEMENTS.has(tag.toLowerCase()) ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`
  );

  return { code: s.trim(), lossy: diagnostics.length > 0, diagnostics };
}

/** Reverse transform, code only — the established string API. See {@link jsxToHtmlWithDiagnostics}. */
export function jsxToHtml(jsx: string): string {
  return jsxToHtmlWithDiagnostics(jsx).code;
}

export default jsxToHtml;
