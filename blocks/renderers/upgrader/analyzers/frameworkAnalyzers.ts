/**
 * @file blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts
 * @description Additional deterministic input adapters — backlog #190.
 *
 * The #094 MVP shipped ONE source path (legacy vanilla web component → `ComponentIR`). The engine was
 * built so a new source dialect is **a new analyzer registration, not a pipeline change**: the registry
 * routes by `handles(input)` and every analyzer emits the same `ComponentIR`. This module adds three
 * more deterministic adapters behind that same seam, for the frameworks teams most want to lift off:
 *
 *   - **React** function component (JSX returning a single tree) — leans on the repo's `jsxToHtml`.
 *   - **Lit** element (`render()` returning an `html`…`` template) — shadow="open", like Lit's default.
 *   - **Vue** SFC (`<template>` block) — light DOM.
 *
 * Each is a deterministic, no-model-key provider bounded to a **tractable subset** — the same
 * "flag, don't fake" rule as the reference path: anything outside the subset (dynamic interpolation, a
 * name that can't yield a valid custom-element tag) is a thrown error the orchestrator surfaces as a
 * diagnostic, never a silent guess. The messier inputs are where the BYO-AI provider (#188) takes over.
 */
import type { CustomAnalyzer, ComponentIR, SourceInput, CustomAnalyzerRegistry } from '../upgraderEngine';
import { jsxToHtml } from '../../jsx/jsxToHtml';

// `customElements.define('tag', …)` or Lit's `@customElement('tag')` decorator — the tag source for
// dialects that ARE custom elements (Lit). Mirrors the reference analyzer's tag rule.
const DEFINE_RE = /customElements\s*\.\s*define\s*\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]*)['"]/;
const DECORATOR_RE = /@customElement\s*\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]*)['"]/;

/**
 * Derive a valid custom-element tag from a framework component identifier (`MyButton` → `my-button`).
 * Web-component naming REQUIRES a hyphen, so a single-word name (`Button`) can't yield a legal tag —
 * that's a thrown diagnostic ("flag, don't fake"), the seam where a smarter provider would ask.
 */
function toCustomElementTag(raw: string): string {
  const kebab = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!/^[a-z][a-z0-9-]*-[a-z0-9-]*$/.test(kebab)) {
    throw new Error(
      `cannot derive a valid custom-element tag from "${raw}" — a web-component name must contain a hyphen `
      + `(e.g. a multi-word PascalCase name like "MyButton" → "my-button").`,
    );
  }
  return kebab;
}

/**
 * Collapse insignificant inter-tag whitespace to a canonical single-line template. Framework sources
 * are authored with indentation (multi-line JSX / SFC `<template>`); left in place, that whitespace
 * becomes text nodes that the generator's re-indent shifts, tripping the verify gate's fidelity check.
 * The reference vanilla path only ever sees single-line innerHTML strings, so it never hit this — the
 * framework adapters normalise to the same canonical shape.
 */
function canonicalTemplate(html: string): string {
  return html.replace(/>\s+</g, '><').trim();
}

/** Throw if the lifted template still carries dialect-specific dynamic markers — the subset boundary. */
function rejectDynamic(template: string, markers: { pattern: RegExp; why: string }[]): void {
  for (const { pattern, why } of markers) {
    if (pattern.test(template)) {
      throw new Error(`${why} — beyond the reference subset; a model provider handles this.`);
    }
  }
}

// ── React function component ────────────────────────────────────────────────────

function looksLikeReact(code: string): boolean {
  // A JSX-returning function/arrow component, and NOT a custom-element/Lit source (those have their
  // own adapters). The `return <…>` (optionally parenthesised) is the cheap routing signal.
  if (/customElements\s*\.\s*define/.test(code) || /extends\s+LitElement/.test(code)) return false;
  const declaresComponent = /(?:function\s+[A-Z]|const\s+[A-Z][A-Za-z0-9]*\s*=)/.test(code);
  const returnsJsx = /return\s*\(?\s*</.test(code);
  return declaresComponent && returnsJsx;
}

function analyzeReact(input: SourceInput): ComponentIR {
  const { code } = input;
  const nameMatch = /(?:function\s+|const\s+)([A-Z][A-Za-z0-9]*)\s*[=(]/.exec(code);
  if (!nameMatch) throw new Error('no React component declaration (a capitalised function/const) found.');
  const name = toCustomElementTag(nameMatch[1]);

  const retIdx = code.search(/\breturn\b/);
  if (retIdx === -1) throw new Error('no `return` of a JSX tree found.');
  let jsx = code.slice(retIdx + 'return'.length).trim().replace(/^\(/, '').trim();
  const lastGt = jsx.lastIndexOf('>');
  if (!jsx.startsWith('<') || lastGt === -1) throw new Error('the component does not return a single JSX element.');
  jsx = jsx.slice(0, lastGt + 1);

  const template = canonicalTemplate(jsxToHtml(jsx));
  // jsxToHtml drops expression PROPS; an expression in a CHILD/text position (`{count}`) is dynamic and
  // survives as a literal `{…}` — reject it rather than emit broken markup.
  rejectDynamic(template, [{ pattern: /\{[^}]*\}/, why: 'the JSX has a dynamic `{…}` child/expression' }]);

  return {
    name,
    shadow: 'none',
    template,
    notes: [`lifted a React function component "${nameMatch[1]}" → <${name}> (light DOM via jsxToHtml).`],
  };
}

export const reactFunctionComponentAnalyzer: CustomAnalyzer = {
  id: 'reference:react-function-component',
  handles: (input) => input.language === 'react' || (input.language == null && looksLikeReact(input.code)),
  analyze: analyzeReact,
};

// ── Lit element ─────────────────────────────────────────────────────────────────

function looksLikeLit(code: string): boolean {
  return /extends\s+LitElement/.test(code) || (/@customElement\s*\(/.test(code) && /\bhtml\s*`/.test(code));
}

function analyzeLit(input: SourceInput): ComponentIR {
  const { code } = input;
  const name = (DEFINE_RE.exec(code) ?? DECORATOR_RE.exec(code))?.[1];
  if (!name) {
    throw new Error('no custom-element tag found (expected customElements.define(…) or @customElement(…)).');
  }

  const htmlMatch = /\bhtml\s*`([\s\S]*?)`/.exec(code);
  if (!htmlMatch) throw new Error('no `html`…`` template found in render().');
  // Reject interpolation BEFORE collapsing, so a `${…}` split across lines is still caught.
  rejectDynamic(htmlMatch[1], [{ pattern: /\$\{/, why: 'the html`` template uses `${…}` interpolation (dynamic)' }]);
  const template = canonicalTemplate(htmlMatch[1]);

  return {
    name,
    // Lit renders into a shadow root by default; the bounded subset assumes the default.
    shadow: 'open',
    template,
    notes: [`lifted a Lit element → <${name}> (shadow="open", the Lit default render root).`],
  };
}

export const litElementAnalyzer: CustomAnalyzer = {
  id: 'reference:lit-element',
  handles: (input) => input.language === 'lit' || (input.language == null && looksLikeLit(input.code)),
  analyze: analyzeLit,
};

// ── Vue single-file component ─────────────────────────────────────────────────────

function looksLikeVue(code: string): boolean {
  return /<template>/.test(code) && /<script/.test(code);
}

function analyzeVue(input: SourceInput): ComponentIR {
  const { code } = input;
  const templateMatch = /<template>([\s\S]*?)<\/template>/.exec(code);
  if (!templateMatch) throw new Error('no `<template>` block found in the SFC.');
  rejectDynamic(templateMatch[1], [
    { pattern: /\{\{/, why: 'the template uses `{{ … }}` interpolation (dynamic)' },
    { pattern: /(?:^|\s)(?:v-[a-z]|:[a-z]|@[a-z])/i, why: 'the template uses Vue directives (v-/:/@, dynamic)' },
  ]);
  const template = canonicalTemplate(templateMatch[1]);

  const nameMatch = /name\s*:\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/.exec(code);
  if (!nameMatch) throw new Error('the SFC has no explicit `name` option to derive a custom-element tag from.');
  const name = toCustomElementTag(nameMatch[1]);

  return {
    name,
    shadow: 'none',
    template,
    notes: [`lifted a Vue SFC "${nameMatch[1]}" → <${name}> (light DOM from the <template> block).`],
  };
}

export const vueSfcAnalyzer: CustomAnalyzer = {
  id: 'reference:vue-sfc',
  handles: (input) => input.language === 'vue' || (input.language == null && looksLikeVue(input.code)),
  analyze: analyzeVue,
};

// ── registration ─────────────────────────────────────────────────────────────────

/**
 * Inject the framework input adapters (#190) into a registry — siblings of the reference vanilla
 * analyzer (#094). The engine core imports no analyzer; callers register the dialects they want. Each
 * `handles()` is specific enough that registration order doesn't matter against the vanilla path (React
 * excludes custom-element/Lit sources; Lit requires LitElement/@customElement; Vue requires an SFC).
 */
export function registerFrameworkAnalyzers(registry: CustomAnalyzerRegistry): void {
  registry.register(reactFunctionComponentAnalyzer);
  registry.register(litElementAnalyzer);
  registry.register(vueSfcAnalyzer);
}
