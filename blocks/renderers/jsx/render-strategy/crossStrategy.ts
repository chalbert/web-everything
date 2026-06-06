/**
 * crossStrategy — the Axis-2 lowering / lifting compiler (backlog #078).
 *
 * Spec:   /projects/webcomponents/#render-strategy-lowering
 * Report: reports/2026-06-06-render-strategy-axis.md (§4 — the correspondence contract)
 *
 * Where `htmlToJsx` / `jsxToHtml` convert *spelling* within one strategy (declarative-static),
 * this converts *across* strategies: the **vdom** dialect (JS control-flow — `.map()`, `&&`)
 * ⇄ the **declarative-static** dialect (directives — `<template is="for-each|if">`).
 *
 *   lower:  vdom JSX  →  declarative-static     (lower JS control-flow into directives)
 *   lift:   declarative-static  →  vdom JSX     (lift directives back into JS)
 *
 * ## The correspondence (report §4)
 *   {EXPR.map(A => BODY)}            ⇄  <template is="for-each" items="EXPR" item="A">BODY</template>
 *   {COND && BODY} / {COND ? B : null}  ⇄  <template is="if" condition="COND">BODY</template>
 *   onEVENT={namedFn}               ⇄  on:EVENT="namedFn($event)"     (named handlers only)
 *   {expr}  (eager, text position)  ⇄  {{ expr }}  (reactive path)    ⛔ LOSSY round-trip
 *
 * ## The one hard (lossy) boundary
 * Eager `{expr}` and reactive `{{ expr }}` look interchangeable but mean opposite things, and
 * the declarative side has TWO spellings of a reactive value (`{{ x }}` text and `bind-text="x"`
 * attribute). So a round-trip across this boundary is NOT guaranteed. The compiler never corrupts
 * silently: it canonicalises (`{{ }}` text, never `bind-text`, on the way back from vdom) and
 * RAISES A DIAGNOSTIC (`result.lossy === true`) whenever it crosses the boundary. See the
 * failing-by-design test in renderStrategy.crossStrategy.test.ts.
 *
 * ## POC scope (documented limitations)
 *  - Pattern-based (no full JS/JSX parser), like `jsxToHtml`. Targets the canonical shapes above.
 *  - `.map` / `&&` bodies are single elements (possibly nested); comma/await/complex expressions
 *    in the iterable or condition are out of scope.
 *  - Interpolation is converted in TEXT position (`>{x}<`); attribute expressions (`class={x}`)
 *    are out of scope (kept verbatim).
 *  - The explicit `item="A"` alias on the declarative side is this compiler's reversible canonical;
 *    reconciling it with the For-Each block's item-relative `data-bind` form is a follow-up (#078 notes).
 */

export interface Diagnostic {
  /** Stable rule id, e.g. `eager-vs-reactive-interpolation`. */
  rule: string;
  /** Human-readable explanation. */
  message: string;
  /** The offending source fragment. */
  fragment: string;
}

export interface ConversionResult {
  /** The converted source. */
  code: string;
  /** True when the conversion crossed a non-round-trippable boundary (see diagnostics). */
  lossy: boolean;
  /** What was lossy and why — never empty when `lossy` is true. */
  diagnostics: Diagnostic[];
}

/** Strip one balanced pair of wrapping parens, if present. */
function unwrapParens(s: string): string {
  const t = s.trim();
  if (t.startsWith('(') && t.endsWith(')')) return t.slice(1, -1).trim();
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// lower: vdom JSX → declarative-static
// ─────────────────────────────────────────────────────────────────────────────

/** `onEVENT={namedFn}` → `on:EVENT="namedFn($event)"`; inline closures are lossy (dropped). */
function lowerEvents(src: string, diags: Diagnostic[]): string {
  return src.replace(
    /\son([a-zA-Z]+)=\{\s*([^{}]+?)\s*\}/g,
    (whole, evt: string, handler: string) => {
      const named = handler.trim();
      if (/^[\w$.]+$/.test(named)) {
        return ` on:${evt.toLowerCase()}="${named}($event)"`;
      }
      // inline closure / expression — no string-behavior form, cannot reverse
      diags.push({
        rule: 'inline-closure-handler',
        message: `on${evt}={…} is an inline handler with no declarative string form; dropped.`,
        fragment: whole.trim(),
      });
      return '';
    }
  );
}

/** Lower a single `{EXPR.map(A => BODY)}` occurrence to a for-each template. */
function lowerMaps(src: string): string {
  const re = /\{\s*([\w.$]+)\.map\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*([\s\S]*?)\s*\)\s*\}/g;
  return src.replace(re, (_whole, items: string, alias: string, rawBody: string) => {
    let body = unwrapParens(rawBody);
    // Pull an optional `key={alias.K}` off the body's root element → key="K".
    let keyAttr = '';
    body = body.replace(
      new RegExp(`\\s+key=\\{\\s*${alias}\\.([\\w$]+)\\s*\\}`),
      (_m, k: string) => {
        keyAttr = ` key="${k}"`;
        return '';
      }
    );
    const open = `<template is="for-each" items="${items}" item="${alias}"${keyAttr}>`;
    return `${open}${lowerMaps(body)}</template>`;
  });
}

/** Lower `{COND && BODY}` and `{COND ? BODY : null}` to an if template. */
function lowerConditionals(src: string): string {
  // logical-and form
  src = src.replace(
    /\{\s*([^{}?]+?)\s*&&\s*(<[\s\S]*?>(?:[\s\S]*?<\/[\w-]+>)?|<[\w-][^<>]*\/>)\s*\}/g,
    (_w, cond: string, body: string) =>
      `<template is="if" condition="${cond.trim()}">${body.trim()}</template>`
  );
  // ternary-with-null-else form
  src = src.replace(
    /\{\s*([^{}?]+?)\s*\?\s*([\s\S]*?)\s*:\s*null\s*\}/g,
    (_w, cond: string, body: string) =>
      `<template is="if" condition="${cond.trim()}">${unwrapParens(body)}</template>`
  );
  return src;
}

/** Eager text interpolation `>{expr}<` → reactive `{{ expr }}` (the lossy boundary). */
function lowerInterpolation(src: string, diags: Diagnostic[]): string {
  return src.replace(/(?<![={])\{\s*([^{}]+?)\s*\}(?!\})/g, (_w, expr: string) => {
    diags.push({
      rule: 'eager-vs-reactive-interpolation',
      message: `eager {${expr.trim()}} lowered to reactive {{ ${expr.trim()} }}; evaluation semantics change — round-trip not guaranteed.`,
      fragment: `{${expr.trim()}}`,
    });
    return `{{ ${expr.trim()} }}`;
  });
}

/**
 * Lower vdom JSX into the declarative-static dialect.
 */
export function lower(vdom: string): ConversionResult {
  const diagnostics: Diagnostic[] = [];
  let s = vdom.trim();
  s = lowerEvents(s, diagnostics);
  s = lowerMaps(s);
  s = lowerConditionals(s);
  s = lowerInterpolation(s, diagnostics);
  return { code: s, lossy: diagnostics.length > 0, diagnostics };
}

// ─────────────────────────────────────────────────────────────────────────────
// lift: declarative-static → vdom JSX
// ─────────────────────────────────────────────────────────────────────────────

/** `<template is="for-each" items="E" item="A" [key="K"]>BODY</template>` → `{E.map(A => BODY)}`. */
function liftForEach(src: string): string {
  const re =
    /<template\s+is="for-each"\s+items="([^"]+)"\s+item="([\w$]+)"(?:\s+key="([\w$]+)")?\s*>([\s\S]*?)<\/template>/g;
  return src.replace(re, (_w, items: string, alias: string, key: string | undefined, body: string) => {
    let inner = liftForEach(body).trim();
    if (key) {
      // re-attach key on the body's root element as key={alias.K}
      inner = inner.replace(/^(\s*<[\w-]+)/, `$1 key={${alias}.${key}}`);
    }
    return `{${items}.map(${alias} => ${inner})}`;
  });
}

/** `<template is="if" condition="C">BODY</template>` → `{C && BODY}`. */
function liftConditionals(src: string): string {
  return src.replace(
    /<template\s+is="if"\s+condition="([^"]+)"\s*>([\s\S]*?)<\/template>/g,
    (_w, cond: string, body: string) => `{${cond} && ${body.trim()}}`
  );
}

/** `on:EVENT="fn($event)"` → `onEVENT={fn}` (named handlers). */
function liftEvents(src: string): string {
  return src.replace(
    /\son:([a-zA-Z]+)="([\w$.]+)\(\$event\)"/g,
    (_w, evt: string, fn: string) => ` on${evt.toLowerCase()}={${fn}}`
  );
}

/** Reactive `{{ expr }}` text → eager `{expr}`. Textually clean for the bare form. */
function liftInterpolation(src: string): string {
  return src.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_w, expr: string) => `{${expr.trim()}}`);
}

/**
 * The `bind-text="x"` attribute form (reactive, row 10) is a SECOND declarative spelling of a
 * reactive value. Lifting it to vdom collapses it onto eager `{x}` — and lowering back yields
 * `{{ x }}` text, never `bind-text`, so the round-trip is broken BY DESIGN. Flagged lossy.
 */
function liftBindText(src: string, diags: Diagnostic[]): string {
  return src.replace(
    /<([\w-]+)([^>]*?)\sbind-text="([^"]+)"([^>]*?)>\s*<\/\1>/g,
    (_w, tag: string, pre: string, expr: string, post: string) => {
      diags.push({
        rule: 'bind-text-collapses-to-eager',
        message: `bind-text="${expr}" (reactive attribute) lifted to eager {${expr}}; lowering back yields {{ ${expr} }} text, not bind-text — round-trip broken by design.`,
        fragment: `bind-text="${expr}"`,
      });
      return `<${tag}${pre}${post}>{${expr}}</${tag}>`;
    }
  );
}

/**
 * Lift the declarative-static dialect back into vdom JSX.
 */
export function lift(declarative: string): ConversionResult {
  const diagnostics: Diagnostic[] = [];
  let s = declarative.trim();
  s = liftForEach(s);
  s = liftConditionals(s);
  s = liftBindText(s, diagnostics);
  s = liftEvents(s);
  s = liftInterpolation(s);
  return { code: s, lossy: diagnostics.length > 0, diagnostics };
}

export default { lower, lift };
