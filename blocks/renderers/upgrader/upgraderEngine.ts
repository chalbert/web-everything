/**
 * @file blocks/renderers/upgrader/upgraderEngine.ts
 * @description AI upgrader engine — backlog #094, MVP walking skeleton.
 *
 * The *inverse front door* of Module-as-a-Service (#081): MaaS takes one authored `<component>` and
 * serves it in any form; the upgrader takes EXISTING/legacy code and lifts it ONTO the standard. The
 * pipeline is the shared shape every AI tool in the #097 menu reuses:
 *
 *     input adapter  →  neutral structure (IR)  →  verify-gated generation
 *     (analyzer)         (ComponentIR)              (declarative <component> + the verify gate)
 *
 * Two design rules carried from #086/#089:
 *   1. **AI is a swappable provider, not architecture — and this is a DEVTOOLS seam, not a runtime one.**
 *      The analyzer (legacy code → IR) is a registry-backed provider with a stable contract, but it is
 *      NOT the same kind of seam as the runtime standard registries `CustomCompilerRegistry` (#081) and
 *      `CustomRenderStrategyRegistry` (#052): those are injected into so a *running app/standard* can
 *      consult them at render time. The upgrader's analyzer is consulted *once, by a tool, at
 *      author/migration time* — pure devtools (#191 reframe). So a devtools takes its providers as
 *      **explicit input**, not from a global mutable singleton: `upgrade()` requires the caller to pass
 *      the `CustomAnalyzerRegistry` it should resolve against. This core imports no analyzer; a
 *      deterministic reference provider OR a BYO-key model provider is registered into a registry the
 *      caller owns and hands in.
 *   2. **Generation reuses the existing core, never a parallel one.** The IR lowers to a declarative
 *      `<component>` definition — the exact text MaaS `serve()` consumes — so the upgraded output is
 *      provably the same entity the /adapters/ demos document. No second generator to drift.
 *
 * The **verify gate is the moat** (the #089 "propose-and-verify" edge): generic AI emits *plausible*
 * code; this only OFFERS output that re-parses, round-trips without drift, and references real intents.
 * Un-verified output is returned for inspection but never presented as trusted (`offered: false`).
 */
import { type ShadowMode, parseDefinition } from '../component/declarativeComponent';

// ── Neutral structure (the analyzer↔generator contract) ────────────────────────
//
// Expressed in the standard's OWN `<component>` vocabulary (name/shadow/template) rather than a
// bespoke IR, so generation is a lookup, not a translation guess (#086 open decision, resolved).

export interface ComponentIR {
  /** Custom-element tag — lowercase, hyphenated (web-component naming). */
  name: string;
  /** Encapsulation, mapped 1:1 onto the `<component shadow>` attribute. */
  shadow: ShadowMode;
  /** The render source — template HTML in the standard's declarative form. */
  template: string;
  /** WE intents the source was observed to express (e.g. `disclosure`). Conformance-checked by verify. */
  intents?: string[];
  /** Analyzer remarks — what was inferred, what was dropped. Surfaced, never silent. */
  notes?: string[];
}

// ── Input adapter / analyzer provider seam (swappable AI) ───────────────────────

export interface SourceInput {
  /** The existing/legacy code to upgrade. */
  code: string;
  /** Source dialect hint — the input-adapter kind. MVP reference path: `web-component`. */
  language?: string;
}

export interface CustomAnalyzer {
  /** Stable provider id (shown in diagnostics + the playground). */
  id: string;
  /** Does this provider claim `input`? The registry routes to the first that does. */
  handles(input: SourceInput): boolean;
  /**
   * Existing code → neutral structure. May be async — a real model provider does a network call;
   * the reference provider is synchronous. Throw (with a clear message) on input outside its subset;
   * `upgrade()` turns that into a diagnostic, the seam where a smarter provider takes over.
   */
  analyze(input: SourceInput): ComponentIR | Promise<ComponentIR>;
}

/**
 * Ordered analyzer registry — the devtools' provider bag, constructed and owned by the **caller** and
 * handed into `upgrade()`. Empty by default → a request with no matching provider is flagged, never
 * faked. First registered provider that `handles()` the input wins, so a specialised provider can be
 * unshifted ahead later. There is deliberately NO shared singleton instance of this: a devtools seam
 * takes its providers as explicit input, so each tool/test constructs its own (see the class doc-comment).
 */
export class CustomAnalyzerRegistry {
  #providers: CustomAnalyzer[] = [];

  register(analyzer: CustomAnalyzer): this {
    // Replace-by-id so re-registering the same provider (e.g. across HMR) doesn't stack duplicates.
    this.#providers = this.#providers.filter((p) => p.id !== analyzer.id);
    this.#providers.push(analyzer);
    return this;
  }
  resolve(input: SourceInput): CustomAnalyzer | null {
    return this.#providers.find((p) => p.handles(input)) ?? null;
  }
  ids(): string[] {
    return this.#providers.map((p) => p.id);
  }
  has(): boolean {
    return this.#providers.length > 0;
  }
}

// No module-global registry instance: a devtools seam injects its providers. Callers build a
// `new CustomAnalyzerRegistry()`, `registerReferenceAnalyzers`/`registerFrameworkAnalyzers` (or a
// BYO-AI provider) into it, and pass it as `upgrade(input, { registry })`.

// ── Generator (reuse the existing core — emit the declarative form) ─────────────

const indent = (html: string): string =>
  html
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join('\n');

/**
 * IR → a declarative `<component>` definition. This is the SAME text MaaS `serve()` consumes, so the
 * upgraded output feeds the existing transform core directly — every other form (wc-class, jsx,
 * functional) is then one `serve(definition, { form })` away, with no parallel generator.
 */
export function generateComponentSource(ir: ComponentIR): string {
  const attrs = `name="${ir.name}" shadow="${ir.shadow}"`;
  return `<component ${attrs}>\n${indent(ir.template)}\n</component>`;
}

// ── Verify gate (the moat — only offer checked output) ──────────────────────────

export interface VerifyOptions {
  /** Intent ids the standard knows (from intents.json). Omit to skip the conformance check. */
  knownIntents?: Set<string>;
}

export interface VerifyResult {
  ok: boolean;
  /** Per-check outcome, for a transparent badge (not just a boolean). */
  checks: { id: string; ok: boolean; detail: string }[];
  diagnostics: string[];
}

/** Normalise HTML through a DOM round-trip so a fidelity compare is whitespace/quoting-insensitive. */
function normalizeHtml(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.innerHTML.trim();
}

/**
 * Is the generated definition trustworthy? Three checks, all transparent:
 *   1. **parses**   — re-`parseDefinition`s cleanly (it's a valid `<component>`).
 *   2. **fidelity** — the re-parsed template + name + shadow equal the analyzed IR (generation
 *      introduced no drift from what the analyzer actually saw).
 *   3. **intents**  — every referenced intent resolves in the standard (skipped if `knownIntents` absent).
 */
export function verifyUpgrade(ir: ComponentIR, generated: string, opts: VerifyOptions = {}): VerifyResult {
  const checks: VerifyResult['checks'] = [];
  const diagnostics: string[] = [];

  let parsed: ReturnType<typeof parseDefinition> | null = null;
  try {
    parsed = parseDefinition(generated);
    checks.push({ id: 'parses', ok: true, detail: `re-parsed as <${parsed.name}>` });
  } catch (e) {
    checks.push({ id: 'parses', ok: false, detail: (e as Error).message });
    diagnostics.push(`generated source does not parse: ${(e as Error).message}`);
  }

  if (parsed) {
    const nameOk = parsed.name === ir.name;
    const shadowOk = parsed.shadow === ir.shadow;
    const templateOk = normalizeHtml(parsed.templateHTML) === normalizeHtml(ir.template);
    const fidelityOk = nameOk && shadowOk && templateOk;
    const drift = [
      nameOk ? '' : `name (${parsed.name} ≠ ${ir.name})`,
      shadowOk ? '' : `shadow (${parsed.shadow} ≠ ${ir.shadow})`,
      templateOk ? '' : 'template',
    ].filter(Boolean);
    checks.push({
      id: 'fidelity',
      ok: fidelityOk,
      detail: fidelityOk ? 'round-trips to the analyzed structure' : `drift in ${drift.join(', ')}`,
    });
    if (!fidelityOk) diagnostics.push(`generation drifted from the analyzed structure: ${drift.join(', ')}`);
  }

  // Intent conformance — only when the caller supplied the standard's known set.
  const referenced = ir.intents ?? [];
  if (opts.knownIntents && referenced.length) {
    const unknown = referenced.filter((id) => !opts.knownIntents!.has(id));
    const ok = unknown.length === 0;
    checks.push({
      id: 'intents',
      ok,
      detail: ok ? `${referenced.length} intent(s) resolve` : `unknown intent(s): ${unknown.join(', ')}`,
    });
    if (!ok) diagnostics.push(`references intent(s) not in the standard: ${unknown.join(', ')}`);
  }

  return { ok: checks.length > 0 && checks.every((c) => c.ok), checks, diagnostics };
}

// ── Orchestrator (analyze → generate → verify-gate) ─────────────────────────────

export interface UpgradeOptions extends VerifyOptions {
  /**
   * Registry holding the analyzer providers to resolve against. **Required** — this is a devtools seam,
   * so the caller owns and injects the providers; there is no global default to fall back to.
   */
  registry: CustomAnalyzerRegistry;
}

export interface UpgradeResult {
  /** The neutral structure the analyzer produced (null if no provider matched / it threw). */
  ir: ComponentIR | null;
  /** The declarative `<component>` source (null if there was no IR to generate from). */
  generated: string | null;
  verify: VerifyResult;
  /** The gate: TRUE only when verify passed. Un-verified output is shown but never trusted. */
  offered: boolean;
  /** Id of the analyzer that ran (for the badge). */
  analyzerId: string | null;
  diagnostics: string[];
}

const emptyVerify = (): VerifyResult => ({ ok: false, checks: [], diagnostics: [] });

/**
 * Upgrade `input` to standard-compliant output, gated by verify. Never throws on bad input — an
 * unmatched provider or an analyzer error becomes a diagnostic with `offered: false`, so callers get
 * a structured "couldn't, because…" rather than an exception.
 */
export async function upgrade(input: SourceInput, opts: UpgradeOptions): Promise<UpgradeResult> {
  const { registry } = opts;
  const analyzer = registry.resolve(input);
  if (!analyzer) {
    const known = registry.ids();
    const why = registry.has()
      ? `no registered analyzer handles language="${input.language ?? '(unset)'}" (have: ${known.join(', ')})`
      : 'the injected registry has no analyzer — registerReferenceAnalyzers(registry) or register a BYO-AI provider before calling upgrade()';
    return { ir: null, generated: null, verify: emptyVerify(), offered: false, analyzerId: null, diagnostics: [why] };
  }

  let ir: ComponentIR;
  try {
    ir = await analyzer.analyze(input);
  } catch (e) {
    return {
      ir: null,
      generated: null,
      verify: emptyVerify(),
      offered: false,
      analyzerId: analyzer.id,
      diagnostics: [`analyzer "${analyzer.id}" could not analyze this input: ${(e as Error).message}`],
    };
  }

  const generated = generateComponentSource(ir);
  const verify = verifyUpgrade(ir, generated, opts);
  return {
    ir,
    generated,
    verify,
    offered: verify.ok,
    analyzerId: analyzer.id,
    diagnostics: [...(ir.notes ?? []), ...verify.diagnostics],
  };
}
