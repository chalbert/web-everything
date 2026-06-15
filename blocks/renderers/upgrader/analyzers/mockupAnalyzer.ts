/**
 * @file blocks/renderers/upgrader/analyzers/mockupAnalyzer.ts
 * @description Mockup input adapter — backlog #086, the design-to-code front door on the #094 pipeline.
 *
 * #094 lifts EXISTING CODE onto the standard. #086 adds a second *input adapter* to that exact same
 * pipeline: a UI **mockup** (static image, Figma frame, or interactive prototype) → the SAME neutral
 * `ComponentIR` → the SAME verify-gated `<component>` generation. There is NO parallel engine and NO
 * parallel generator — only one more `handles()`-routed `CustomAnalyzer` on the existing
 * `CustomAnalyzerRegistry`, lowering through `generateComponentSource` + `verifyUpgrade` unchanged.
 *
 * The two non-negotiables (#086):
 *   1. **AI-tool independence.** Mockup analysis (vision → structure) is a swappable
 *      {@link CustomVisionProvider} behind the registry, with a stable contract — any model/tool that
 *      meets it drops in. No provider name appears in the core.
 *   2. **Vision is a Plateau SERVICE, consumed as a no-leakage client (#475 ruling).** The vision
 *      *impl capability* never lives in the standard; the provider is a thin client whose ONLY output
 *      that reaches the standard is the neutral `ComponentIR` (and the verified `<component>`). The
 *      same `customVisionProvider` seam #475/#396 share. Until the Plateau service ships, the
 *      deterministic {@link createReferenceVisionProvider} stands in — keyless, offline, CI-safe —
 *      exactly as #094's reference analyzer stands in for the BYO-AI model provider.
 *
 * The verify gate is unchanged and does the trusting: a provider that hallucinates structure fails the
 * engine's parse / fidelity / intent checks and is never offered (`offered: false`).
 */
import type {
  CustomAnalyzer,
  ComponentIR,
  SourceInput,
  MockupSource,
  CustomAnalyzerRegistry,
} from '../upgraderEngine';
import { parseModelIR } from './modelComponent';

// ── The swappable vision provider seam (a no-leakage Plateau-service client) ─────

export interface VisionProviderOptions {
  /** Standard intents the provider may reference (it must use ONLY these). */
  knownIntents?: readonly string[];
}

export interface CustomVisionProvider {
  /** Provider id — flows into the analyzer id + diagnostics (e.g. `vision:plateau`, `vision:reference`). */
  id: string;
  /**
   * Mockup → neutral `ComponentIR`. May call the Plateau vision service over the network (the real
   * client) or be a deterministic stand-in (the reference provider). Throw with a clear message on a
   * transport/auth failure or un-analysable input — `upgrade()` turns that into a `vision:`-tagged
   * diagnostic. The provider is the ONLY place the vision impl lives; nothing about it leaks into the
   * engine or the standard beyond this neutral return.
   */
  describe(mockup: MockupSource, opts?: VisionProviderOptions): ComponentIR | Promise<ComponentIR>;
}

// ── The analyzer (one more provider on the existing registry) ────────────────────

export function mockupAnalyzer(provider: CustomVisionProvider, opts: VisionProviderOptions = {}): CustomAnalyzer {
  return {
    id: `mockup:${provider.id}`,
    // Route on an explicit `mockup` payload, or the `language: 'mockup'` hint. A code input never matches.
    handles: (input: SourceInput) => input.mockup != null || input.language === 'mockup',
    analyze: async (input: SourceInput): Promise<ComponentIR> => {
      if (!input.mockup) throw new Error('mockup analyzer requires a `mockup` input (image | figma | prototype).');
      return provider.describe(input.mockup, opts);
    },
  };
}

/**
 * Register the mockup analyzer into a caller-owned registry — the #086 analogue of
 * `registerReferenceAnalyzers`. The caller injects the vision provider (a Plateau-service client or the
 * reference stand-in), keeping the devtools-provider discipline: providers are explicit input, never a
 * global singleton.
 */
export function registerMockupAnalyzer(
  registry: CustomAnalyzerRegistry,
  provider: CustomVisionProvider,
  opts: VisionProviderOptions = {},
): void {
  registry.register(mockupAnalyzer(provider, opts));
}

// ── Reference vision provider — the deterministic stand-in (no service, no key) ──
//
// Until the Plateau vision service (#475/#480) ships, this keyless provider proves the seam + the whole
// mockup → IR → generated → verify pipeline end-to-end, offline and in CI. It does NOT do real vision:
// it derives a coherent neutral structure deterministically from the mockup's `kind` + `description`
// annotations, inferring intents from high-confidence keywords ("flag, don't fake" — omit when unsure).
// A real provider replaces it with no engine change.

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'for', 'to', 'panel', 'component', 'ui']);

/**
 * Collapse inter-tag whitespace to a canonical form — the same normalization the framework analyzers
 * apply. Without it, the indentation `generateComponentSource` adds would make the verify gate's
 * fidelity round-trip drift on otherwise-identical structure.
 */
const canonical = (html: string): string => html.replace(/>\s+</g, '><').trim();

/** Slugify a description into a valid (hyphenated) custom-element tag; fall back to a stable default. */
function tagFromDescription(description: string | undefined): string {
  const words = (description ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .slice(0, 2);
  const slug = words.join('-').replace(/^-+|-+$/g, '');
  // A custom-element tag MUST contain a hyphen; prefix to guarantee it and to namespace the origin.
  return slug ? `mockup-${slug}` : 'mockup-surface';
}

/** Deterministic, high-confidence intent inference from the annotation text (same discipline as #094). */
function inferIntentsFromText(text: string, known?: readonly string[]): { intents: string[]; markup: string; notes: string[] } {
  const t = text.toLowerCase();
  const intents: string[] = [];
  const notes: string[] = [];
  const regions: string[] = [];
  const allow = (id: string) => !known || known.includes(id);

  if (/\b(expand|collapse|toggle|accordion|show\/hide|disclosure)\b/.test(t) && allow('disclosure')) {
    intents.push('disclosure');
    notes.push('inferred intent "disclosure" from an expand/collapse annotation.');
    regions.push('<button type="button" aria-expanded="false">Details</button>\n<div hidden>Disclosure region</div>');
  }
  if (/\b(select|choose|option|list ?box|picker)\b/.test(t) && allow('selection')) {
    intents.push('selection');
    notes.push('inferred intent "selection" from a select/choose annotation.');
    regions.push('<ul role="listbox"><li role="option" aria-selected="true">Option</li></ul>');
  }
  if (/\b(animate|animation|transition|motion)\b/.test(t) && allow('motion')) {
    intents.push('motion');
    notes.push('inferred intent "motion" from an animation annotation.');
    regions.push('<style>@media (prefers-reduced-motion: reduce) { * { animation: none; } }</style>\n<div class="animated">Animated region</div>');
  }

  return { intents, markup: regions.join('\n'), notes };
}

/**
 * The deterministic reference {@link CustomVisionProvider}. Builds a coherent neutral `ComponentIR`
 * from the mockup's annotations — proving the input adapter + pipeline without any model key or service.
 */
export function createReferenceVisionProvider(): CustomVisionProvider {
  return {
    id: 'reference',
    describe(mockup, opts) {
      const description = mockup.description ?? '';
      const name = tagFromDescription(description);
      const { intents, markup, notes } = inferIntentsFromText(description, opts?.knownIntents);
      const heading = description.trim() || `${mockup.kind} mockup`;
      const template = canonical(
        [
          `<section aria-label="${heading.replace(/"/g, '&quot;')}">`,
          `<h2>${heading.replace(/[<>]/g, '')}</h2>`,
          markup || '<slot></slot>',
          `</section>`,
        ].join('\n'),
      );
      return {
        name,
        shadow: 'none',
        template,
        intents,
        notes: [
          `lifted from a ${mockup.kind} mockup (${mockup.ref}) by the deterministic reference vision provider — a stand-in until the Plateau vision service (#475) ships; not real vision.`,
          ...notes,
        ],
      };
    },
  };
}

// ── Real provider: a thin no-leakage Plateau vision-service client (BYO endpoint) ─
//
// The reference real {@link CustomVisionProvider}: POST the mockup reference to the Plateau vision
// service and validate the returned neutral structure before the engine trusts it. The vision impl
// lives entirely in Plateau; only the validated `ComponentIR` crosses back (no-leakage, #475). Intended
// for Node/CI (keep the endpoint/key server-side); a different service/SDK implementing this same
// interface drops in unchanged.

export interface PlateauVisionOptions {
  /** The Plateau vision-service endpoint (the analyze route). */
  endpoint: string;
  /** BYO key for the service, if it requires one. Never bundled. */
  apiKey?: string;
}

export function createPlateauVisionProvider(opts: PlateauVisionOptions): CustomVisionProvider {
  return {
    id: 'plateau',
    async describe(mockup, providerOpts) {
      const res = await fetch(opts.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify({ mockup, knownIntents: providerOpts?.knownIntents ?? [] }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Plateau vision service ${res.status}: ${detail.slice(0, 300)}`);
      }
      // The service returns the neutral IR as JSON; validate its shape before the engine trusts it
      // (the same guard the model path uses) so a malformed service response is a clean diagnostic.
      return parseModelIR(await res.text());
    },
  };
}

/**
 * A scripted {@link CustomVisionProvider} — `responder(mockup)` returns a canned `ComponentIR` (or its
 * JSON). Exercises the seam + verify gate (including hallucination cases) WITHOUT a service, so tests
 * and the playground run the exact same pipeline a real provider would.
 */
export function createScriptedVisionProvider(
  responder: (mockup: MockupSource) => ComponentIR | string,
  id = 'scripted',
): CustomVisionProvider {
  return {
    id,
    describe(mockup) {
      const out = responder(mockup);
      return typeof out === 'string' ? parseModelIR(out) : out;
    },
  };
}
