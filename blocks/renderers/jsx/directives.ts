/**
 * directives — the JSX directive-sugar layer (backlog #070).
 *
 * Spec:   /adapters/jsx-adapter/ (feature mapping, rows 7–8)
 * Report: reports/2026-06-03-jsx-adapter-feature-mapping.md (§4 — directives)
 *
 * The mirror dialect canonicalises control-flow directives as the literal customized-built-in
 * `<template is="…">` element, because that is the one form JSX can both express AND reverse
 * (mapping-cases case 8). The prettier component spellings — `<For each>` / `<Show when>` /
 * `<Resource from>` — are **optional sugar**: an alternative *syntax spelling* of the SAME
 * directive, not a new runtime behaviour and not a rendering-strategy change (that is #052/#078).
 *
 * Everything here flows through ONE registry, so the three surfaces can never drift:
 *
 *   1. `desugar(src)`  — sugar JSX → canonical `<template is>` (used by `jsxToHtml`, so `<For>`
 *                        lowers to the canonical HTML directive form on the way to HTML).
 *   2. `sugarize(src)` — canonical `<template is>` → sugar JSX (the opt-in pretty post-pass a
 *                        UI sugar-toggle applies to `htmlToJsx` output; `htmlToJsx` itself stays
 *                        canonical so the row-7 contract is unchanged).
 *   3. `For` / `Show` / `Resource` — runtime directive components: authored `<For each="users">`
 *                        builds the SAME `<template is="for-each" items="users">` DOM the canonical
 *                        spelling builds (declarative-static / inert — the loop is not expanded here,
 *                        exactly as the canonical template isn't; that is Axis-2).
 *
 * POC scope (like `jsxToHtml` / `crossStrategy`): string-based, no full JSX parser. Sugar props are
 * the mirror dialect's **string attributes** (`each="users"`, the reversible form); expression props
 * (`each={users}`) are kept verbatim through the rename but their *values* are an Axis-2 concern.
 * Attribute values containing a literal `>` are out of scope.
 */

import jsx from './JSXRenderer';
import type { JSXChild, JSXProps } from './JSXRenderer';

/** One directive: a sugar component name ⇄ a canonical `is="…"` customized built-in. */
export interface DirectiveDef {
  /** JSX component name (capitalised → the factory sees a component identity). */
  sugar: string;
  /** Canonical customized-built-in name on `<template is="…">`. */
  is: string;
  /**
   * Sugar prop name → canonical attribute name. Renames are bidirectional and must be 1:1.
   * Props NOT listed here pass through unchanged (e.g. `key`, `item` on `<For>`), so adding an
   * attribute never needs a registry edit — only a *renamed* one does.
   */
  props: Record<string, string>;
}

/**
 * The directive registry — the single source of truth. A new directive is one entry here; all of
 * desugar / sugarize / the runtime components pick it up automatically. Names align with
 * `crossStrategy.ts` (#078): `is="for-each"` with `items`/`item`/`key`, and `is="if"` with
 * `condition`.
 */
export const directiveRegistry: DirectiveDef[] = [
  { sugar: 'For', is: 'for-each', props: { each: 'items' } },
  { sugar: 'Show', is: 'if', props: { when: 'condition' } },
  { sugar: 'Resource', is: 'resource', props: { from: 'from' } },
];

const bySugar = new Map(directiveRegistry.map((d) => [d.sugar, d]));
const byIs = new Map(directiveRegistry.map((d) => [d.is, d]));

/** sugar prop → canonical attr (identity for unlisted props). */
function toCanonicalName(def: DirectiveDef, name: string): string {
  return def.props[name] ?? name;
}
/** canonical attr → sugar prop (identity for unlisted attrs). */
function toSugarName(def: DirectiveDef, name: string): string {
  for (const [sugar, attr] of Object.entries(def.props)) if (attr === name) return sugar;
  return name;
}

// ─── string attribute parse / serialize (shared by desugar + sugarize) ───────────────

interface Attr {
  name: string;
  /** Raw value INCLUDING its quotes or braces (`"users"`, `'x'`, `{users}`), or undefined if bare. */
  value?: string;
}

/** Parse the inside of a start tag (`each="users" key="id"`). Tolerant of "/"-terminated tags. */
function parseAttrs(s: string): Attr[] {
  const re = /([\w:.-]+)(?:=("[^"]*"|'[^']*'|\{[^{}]*\}))?/g;
  const out: Attr[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push({ name: m[1], value: m[2] });
  return out;
}

function serializeAttrs(attrs: Attr[]): string {
  return attrs.map((a) => (a.value === undefined ? ` ${a.name}` : ` ${a.name}=${a.value}`)).join('');
}

/** Rename one attr-string from sugar→canonical (`rename=toCanonicalName`) or the inverse. */
function renameAttrs(def: DirectiveDef, attrStr: string, rename: (d: DirectiveDef, n: string) => string): string {
  return serializeAttrs(parseAttrs(attrStr).map((a) => ({ name: rename(def, a.name), value: a.value })));
}

// ─── desugar: sugar JSX → canonical <template is> ────────────────────────────────────

/**
 * Lower sugar components to the canonical `<template is="…">` form.
 * `<For each="users" key="id">B</For>` → `<template is="for-each" items="users" key="id">B</template>`.
 */
export function desugar(src: string): string {
  let s = src;
  for (const def of directiveRegistry) {
    // self-closing first, so the opening rule doesn't swallow the trailing "/"
    s = s.replace(new RegExp(`<${def.sugar}\\b([^>]*?)\\s*/>`, 'g'), (_m, attrs: string) =>
      `<template is="${def.is}"${renameAttrs(def, attrs, toCanonicalName)} />`
    );
    s = s.replace(new RegExp(`<${def.sugar}\\b([^>]*?)>`, 'g'), (_m, attrs: string) =>
      `<template is="${def.is}"${renameAttrs(def, attrs, toCanonicalName)}>`
    );
    s = s.replace(new RegExp(`</${def.sugar}>`, 'g'), '</template>');
  }
  return s;
}

// ─── sugarize: canonical <template is> → sugar JSX ───────────────────────────────────

/**
 * Raise canonical directive templates to their sugar spelling. Only `<template is="NAME">` whose
 * NAME is registered is rewritten; a plain inert `<template>` (no `is`, or an unknown `is`) is left
 * verbatim. Closing `</template>` tags are paired to their opener via a stack, so a directive
 * `</template>` becomes `</For>` while a plain one stays `</template>` (and nesting is honoured).
 */
export function sugarize(src: string): string {
  const re = /<(\/?)template\b([^>]*?)(\s*\/)?>/gi;
  const stack: string[] = [];
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out += src.slice(last, m.index);
    last = re.lastIndex;
    const closing = m[1] === '/';
    const attrStr = m[2] ?? '';
    const selfClosing = Boolean(m[3]);

    if (closing) {
      out += `</${stack.pop() ?? 'template'}>`;
      continue;
    }

    const isAttr = parseAttrs(attrStr).find((a) => a.name === 'is');
    const isVal = isAttr?.value?.replace(/^["']|["']$/g, '');
    const def = isVal ? byIs.get(isVal) : undefined;

    if (def) {
      const rest = parseAttrs(attrStr).filter((a) => a.name !== 'is');
      const sugarAttrs = serializeAttrs(rest.map((a) => ({ name: toSugarName(def, a.name), value: a.value })));
      out += `<${def.sugar}${sugarAttrs}${selfClosing ? ' /' : ''}>`;
      if (!selfClosing) stack.push(def.sugar);
    } else {
      out += m[0]; // plain / unknown template — leave exactly as authored
      if (!selfClosing) stack.push('template');
    }
  }
  out += src.slice(last);
  return out;
}

// ─── runtime directive components ────────────────────────────────────────────────────

/** A runtime directive component: tagged with `directiveIs` so the JSX factory delegates to it. */
export interface DirectiveComponent {
  (props: JSXProps | null, ...children: JSXChild[]): Node;
  /** The canonical `is="…"` this sugar builds — the factory's discriminator. */
  directiveIs: string;
}

function makeDirective(def: DirectiveDef): DirectiveComponent {
  const component = ((props: JSXProps | null, ...children: JSXChild[]): Node => {
    const { children: propChildren, ...rest } = props ?? {};
    const attrs: JSXProps = { is: def.is };
    for (const [name, value] of Object.entries(rest)) attrs[toCanonicalName(def, name)] = value;
    const kids = children.length ? children : propChildren != null ? [propChildren as JSXChild] : [];
    // Reuse the factory: 'template' + an `is` builds the customized built-in and routes children
    // into `.content` — so `<For>` produces byte-identical DOM to the canonical `<template is>`.
    return jsx.createElement('template', attrs, ...kids);
  }) as DirectiveComponent;
  component.directiveIs = def.is;
  return component;
}

export const For: DirectiveComponent = makeDirective(bySugar.get('For')!);
export const Show: DirectiveComponent = makeDirective(bySugar.get('Show')!);
export const Resource: DirectiveComponent = makeDirective(bySugar.get('Resource')!);

/** True when a JSX factory `type` is a registered directive component. */
export function isDirectiveComponent(type: unknown): type is DirectiveComponent {
  return typeof type === 'function' && typeof (type as { directiveIs?: unknown }).directiveIs === 'string';
}
