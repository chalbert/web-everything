/**
 * jsxToHtml — JSX mirror-dialect source → canonical HTML.
 *
 * The reverse direction of the conversion adapter. Because the mirror dialect is near-identity with
 * HTML, this is a small set of string rewrites (no DOM needed):
 *
 *   - directive sugar       <For each="…">    → <template is="for-each" items="…"> (./directives)
 *   - fragment wrapper      <>…</>            → siblings (dropped)
 *   - aliases               className/htmlFor → class/for
 *   - expression props      name={…}          → dropped (no HTML representation — LOSSY, e.g. onclick={fn})
 *   - self-closing tag      <x … />           → <x …> (void) or <x …></x> (non-void)
 *
 * POC scope: handles the mirror-dialect shapes the playground exercises. Expression props with
 * nested braces and exotic JSX are out of scope. See reports/2026-06-03-jsx-adapter-feature-mapping.md.
 */

import { desugar } from './directives';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

export function jsxToHtml(jsx: string): string {
  // 0. lower directive sugar (<For>/<Show>/<Resource>) to the canonical <template is> form, so the
  //    rest of the pipeline (template passes through as identity HTML) emits the canonical directive.
  let s = desugar(jsx.trim());

  // 1. drop fragment wrappers
  s = s.replace(/<>\s*/g, '').replace(/\s*<\/>/g, '');

  // 2. aliases lower to canonical HTML names
  s = s.replace(/\bclassName=/g, 'class=').replace(/\bhtmlFor=/g, 'for=');

  // 3. drop expression / function props `name={…}` — they have no HTML representation (lossy)
  s = s.replace(/\s+[\w:-]+=\{[^{}]*\}/g, '');

  // 4. expand self-closing tags to HTML form
  s = s.replace(/<([a-zA-Z][\w-]*)([^<>]*?)\s*\/>/g, (_m, tag: string, attrs: string) =>
    VOID_ELEMENTS.has(tag.toLowerCase()) ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`
  );

  return s.trim();
}

export default jsxToHtml;
