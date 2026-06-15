/**
 * @file blocks/renderers/upgrader/analyzers/legacyWebComponent.ts
 * @description Reference analyzer — backlog #094, the MVP's ONE source path.
 *
 * Lifts a legacy *vanilla* custom element (a `class … extends HTMLElement` that sets its markup via
 * `innerHTML` and registers with `customElements.define`) into the neutral `ComponentIR`. It is a
 * **deterministic, no-model-key** provider — the reference implementation of the analyzer contract,
 * proving the swap point is real WITHOUT requiring an AI key (the BYO-AI provider is just another
 * `register()` for the messier input this heuristic deliberately doesn't attempt).
 *
 * Scope is honest about being a subset: it reads the tag, the shadow mode, and the template string
 * from the common "set innerHTML in connectedCallback/constructor" shape. Anything it cannot extract
 * is a thrown error (the orchestrator surfaces it as a diagnostic), never a silent guess — the same
 * "flag, don't fake" rule as the rest of the pipeline.
 */
import type { CustomAnalyzer, ComponentIR, SourceInput, CustomAnalyzerRegistry } from '../upgraderEngine';
import type { ShadowMode } from '../../component/declarativeComponent';

const DEFINE_RE = /customElements\s*\.\s*define\s*\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]*)['"]/;
const SHADOW_RE = /attachShadow\s*\(\s*\{[^}]*mode\s*:\s*['"](open|closed)['"]/;
// `<target>.innerHTML = <delimited string>` — captures the opening delimiter so we can find its match.
const INNERHTML_RE = /\.innerHTML\s*=\s*(`|'|")/;

/** Read a delimited string literal starting at the opening quote/backtick, honouring `\` escapes. */
function readStringLiteral(src: string, openIndex: number): string | null {
  const delim = src[openIndex];
  let out = '';
  for (let i = openIndex + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      out += src[i + 1] ?? '';
      i++;
      continue;
    }
    if (ch === delim) return out;
    out += ch;
  }
  return null; // unterminated
}

/**
 * Heuristically detect whether `code` looks like a legacy vanilla web component — used by the
 * registry to route. Cheap signal: it both defines a custom element and assigns innerHTML somewhere.
 */
function looksLikeWebComponent(code: string): boolean {
  return DEFINE_RE.test(code) && /\.innerHTML\s*=/.test(code);
}

/**
 * Conservative intent inference (#189): populate `ir.intents` from high-confidence, deterministic
 * signals in the lifted markup. "Flag, don't fake" — each rule needs an unambiguous pattern, prefers
 * **omission over a shaky guess**, and only emits intents that actually resolve in the standard (a
 * non-existent id would fail the verify gate). Every inference is also surfaced as a note. Richer,
 * fuzzier inference is the BYO-AI provider's job (#188); these are the few deterministic wins worth
 * shipping keyless, so the IR's `intents` field is exercised end-to-end.
 *
 * Scans the lifted `template` (markup) and, for guards that live outside markup, the full `code`.
 */
function inferIntents(template: string, code: string): { intents: string[]; notes: string[] } {
  const intents: string[] = [];
  const notes: string[] = [];

  // selection — a listbox that marks a chosen option. BOTH signals are required: `role="listbox"`
  // alone could be a non-selectable list, so `aria-selected` is what pins it to the selection intent.
  if (/role\s*=\s*["']listbox["']/i.test(template) && /\baria-selected\b/i.test(template)) {
    intents.push('selection');
    notes.push('inferred intent "selection" from role="listbox" + aria-selected.');
  }

  // motion — a reduced-motion guard means the component expresses motion it offers to tone down. The
  // guard can be in a `<style>` block (markup) or a `matchMedia` call (code), so scan both.
  if (/prefers-reduced-motion/i.test(`${template}\n${code}`)) {
    intents.push('motion');
    notes.push('inferred intent "motion" from a prefers-reduced-motion guard.');
  }

  // disclosure — a toggle control (aria-expanded) paired with a collapsible region carrying the bare
  // `hidden` attribute. BOTH signals are required: aria-expanded alone could be a combobox/menu button,
  // and a lone `hidden` is just hidden content, so the pair is what pins it to the show/hide disclosure
  // pattern (#008). The `hidden` match is anchored to a leading boundary so it never fires on the
  // unrelated `aria-hidden` attribute.
  if (/\baria-expanded\b/i.test(template) && /(?:^|[\s"'])hidden(?:[\s=>/]|$)/i.test(template)) {
    intents.push('disclosure');
    notes.push('inferred intent "disclosure" from aria-expanded + hidden (toggled show/hide).');
  }

  return { intents, notes };
}

function analyze(input: SourceInput): ComponentIR {
  const code = input.code ?? '';
  const notes: string[] = [];

  const defineMatch = DEFINE_RE.exec(code);
  if (!defineMatch) throw new Error('no customElements.define(...) call with a valid tag name found.');
  const name = defineMatch[1];

  const shadowMatch = SHADOW_RE.exec(code);
  // none = light DOM (innerHTML on the element itself); open/closed = a shadow root was attached.
  const shadow: ShadowMode = shadowMatch ? (shadowMatch[1] as ShadowMode) : 'none';
  if (shadow === 'closed') {
    // A closed root is opaque to the conformance check (can't read it back) — keep, but flag.
    notes.push('source used a closed shadow root; the upgraded component keeps shadow="closed" (not introspectable).');
  }

  const htmlMatch = INNERHTML_RE.exec(code);
  if (!htmlMatch) throw new Error('no `…innerHTML = "…"` template assignment found to lift as the template.');
  const template = readStringLiteral(code, htmlMatch.index + htmlMatch[0].length - 1);
  if (template === null) throw new Error('the innerHTML template string is unterminated.');
  if (/\$\{/.test(template)) {
    // A template literal with interpolation is dynamic — beyond this reference subset.
    throw new Error('the template uses `${…}` interpolation (dynamic) — beyond the reference analyzer; a model provider handles this.');
  }

  notes.push(
    shadow === 'none'
      ? 'lifted from a light-DOM innerHTML assignment → shadow="none".'
      : `lifted from a ${shadow} shadow-root innerHTML assignment → shadow="${shadow}".`,
  );

  const cleanTemplate = template.trim();
  const { intents, notes: intentNotes } = inferIntents(cleanTemplate, code);
  notes.push(...intentNotes);

  return { name, shadow, template: cleanTemplate, intents, notes };
}

/** The reference analyzer instance — `id` shows in diagnostics + the playground badge. */
export const legacyWebComponentAnalyzer: CustomAnalyzer = {
  id: 'reference:legacy-web-component',
  handles: (input) =>
    input.language === 'web-component' || (input.language == null && input.code != null && looksLikeWebComponent(input.code)),
  analyze,
};

/**
 * Inject the reference provider(s) into a registry — the upgrader's analogue of the MaaS delivery
 * layer registering its esbuild compiler. The engine core imports no analyzer; callers (the demo,
 * the unit suite, a CLI) call this once. A BYO-AI provider would be a sibling `registry.register(…)`.
 */
export function registerReferenceAnalyzers(registry: CustomAnalyzerRegistry): void {
  registry.register(legacyWebComponentAnalyzer);
}
