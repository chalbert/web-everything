// design-refs/vision.mjs — the vision-gated capture-QC seam (backlog #480, ruling #475)
//
// This is the *thin, swappable vision client* the design-ref pipeline consumes to judge whether a
// captured frame is a clean application surface before corpus admission. Per the #475 ruling, vision
// is NEVER a standard — it is a service the WE corpus tooling consumes as a NO-LEAKAGE client:
//   - no vendor / provider name appears in this core (a provider is plugged in by name);
//   - only the *outputs* (a verdict) flow on; nothing here reaches any @webeverything published artifact;
//   - the interim provider calls a model directly, and is later repointed at the Plateau vision service.
//
// The core ships exactly one built-in provider — `manual` (a null provider that emits the `ungated`
// sentinel, i.e. "no vision ran", preserving the pre-vision pipeline behaviour). Real providers (a
// Claude/Gemini/etc. vision client, or the Plateau service client) register themselves from an external
// module pointed at by DESIGN_REFS_VISION_PROVIDER_MODULE — so this file stays vendor-free.

// ---- verdict taxonomy (Fork 3) ---------------------------------------------
// The six real-vision verdicts. `ungated` is a seventh *sentinel* meaning "no vision provider ran",
// kept distinct so an un-QC'd shot is never silently treated as vision-confirmed.
export const VERDICTS = Object.freeze(['app', 'obstructed', 'marketing', 'error', 'blank', 'non-app']);
export const UNGATED = 'ungated';

// Normalise whatever a provider returned into a known verdict. Unknown → `non-app` (the safe, quarantine
// side) so a buggy/hostile provider can never sneak junk into the corpus.
export function normalizeVerdict(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === UNGATED) return UNGATED;
  return VERDICTS.includes(v) ? v : 'non-app';
}

// ---- admission decision (pure) ---------------------------------------------
// Map a verdict to one of three actions. This is the heart of the gate and is deliberately pure so it
// can be unit-tested without a browser or a model.
//   admit      — write to the corpus
//   remediate  — try to clear an overlay and re-shoot (bounded), then re-decide
//   quarantine — record in needs-review.json, write nothing
export function decideAdmission(verdict) {
  const v = normalizeVerdict(verdict);
  if (v === 'app' || v === UNGATED) return 'admit';
  if (v === 'obstructed') return 'remediate';
  return 'quarantine';
}

// The reviewState an admitted shot carries, given the verdict that admitted it.
//   confirmed — a real provider said `app`
//   ungated   — no provider ran (the null/`manual` path)
export function reviewStateFor(verdict) {
  return normalizeVerdict(verdict) === UNGATED ? 'ungated' : 'confirmed';
}

// ---- codification (backlog #481, ruling #396) ------------------------------
// The SECOND method on the same shared vision client (#396 Fork 2): turn an admitted corpus shot into
// standards input. Per shot it fills only the *reliable* taxonomy facets + loose, lossy-OK pattern
// observations — never a formal neutral structure (that would couple to the unbuilt #086 and bake
// low-fidelity structure into the corpus). No-leakage holds: only these outputs reach the corpus
// sidecars; the formal standard-vocabulary expression lives at the reviewed promotion boundary (#481 F3).
export const CODIFICATION_FACETS = Object.freeze(['surface', 'productRegister', 'visualStyle', 'theme', 'layout']);

// Normalise a provider's codification result into a stable envelope. Facets are constrained to the
// reliable key set (unknown keys dropped) and coerced to a trimmed string or null; patterns are loose
// free-text observations (deduped). `ungated` marks "no codification provider ran" (the null/manual path).
export function normalizeCodification(raw) {
  const facets = {};
  for (const k of CODIFICATION_FACETS) {
    const v = raw?.facets?.[k];
    facets[k] = typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  const patterns = Array.isArray(raw?.patterns)
    ? [...new Set(raw.patterns.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean))]
    : [];
  return { facets, patterns, ungated: raw?.ungated === true };
}

// Validate + normalise a provider's codification response. A provider with no `analyzeForCodification`
// (or the null `manual` provider) yields the `ungated` envelope, so an un-codified shot is never
// silently treated as model-analysed — and the pass stays a no-op offline / in CI.
export async function analyzeForCodification(provider, input) {
  if (typeof provider?.analyzeForCodification !== 'function') {
    return { ...normalizeCodification({ ungated: true }), provider: provider?.name ?? 'manual' };
  }
  const raw = await provider.analyzeForCodification(input);
  return { ...normalizeCodification(raw), provider: provider.name };
}

// ---- rich output (Tier-2, backlog #1080 / epic #1073) ----------------------
// The THIRD method on the shared vision client — the Tier-2 rich-analysis envelope. Where
// `classifyCandidate` returns one closed-set verdict and `analyzeForCodification` fills the reliable
// facet vocabulary, a Tier-2 small VLM produces OPEN output a classifier cannot: a free-text
// description, loose tags, and localized element regions. This is the contract a Tier-2 provider
// (#1082) registers behind the same seam; the same no-leakage rule holds — only these outputs flow on,
// never the model. A region is `{ label, box }` where `box` is an OPTIONAL normalized bounding box
// `{ x, y, w, h }` in 0..1 (null when the model gave a label but no localization).

// Coerce one value to a number in [0,1], or null if it isn't a finite number.
function unitOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

// Normalise one region: a trimmed non-empty `label` (else the region is dropped by the caller) plus an
// optional fully-specified `box` (all four of x/y/w/h must be valid unit numbers, else box is null).
function normalizeRegion(raw) {
  const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
  if (!label) return null;
  const b = raw?.box;
  const box = b && typeof b === 'object'
    ? (() => {
        const x = unitOrNull(b.x), y = unitOrNull(b.y), w = unitOrNull(b.w), h = unitOrNull(b.h);
        return [x, y, w, h].every((n) => n !== null) ? { x, y, w, h } : null;
      })()
    : null;
  return { label, box };
}

// Normalise a provider's rich result into a stable envelope: a trimmed `description` (or null), deduped
// loose `tags`, and validated `regions`. `ungated` marks "no rich provider ran" (the null/manual path),
// kept distinct so an un-analysed shot is never silently treated as model-analysed.
export function normalizeRichOutput(raw) {
  const description = typeof raw?.description === 'string' && raw.description.trim() ? raw.description.trim() : null;
  const tags = Array.isArray(raw?.tags)
    ? [...new Set(raw.tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))]
    : [];
  const regions = Array.isArray(raw?.regions)
    ? raw.regions.map(normalizeRegion).filter(Boolean)
    : [];
  return { description, tags, regions, ungated: raw?.ungated === true };
}

// Validate + normalise a provider's rich response. A provider with no `analyzeRich` (or the null
// `manual` provider) yields the `ungated` envelope, so the pass is a safe no-op offline / in CI and an
// un-analysed shot is never mistaken for a Tier-2 result.
export async function analyzeRich(provider, input) {
  if (typeof provider?.analyzeRich !== 'function') {
    return { ...normalizeRichOutput({ ungated: true }), provider: provider?.name ?? 'manual' };
  }
  const raw = await provider.analyzeRich(input);
  return { ...normalizeRichOutput(raw), provider: provider.name };
}

// ---- provider registry (swap point) ----------------------------------------
// A provider is `{ name, async classifyCandidate(input) => { verdict, reasons? } }` where input is
// `{ url, pngBase64, dims, selectorState }`. Providers register by name; the pipeline selects one by
// name. No provider implementation lives here.
const registry = new Map();

export function registerVisionProvider(name, impl) {
  if (!name || typeof impl?.classifyCandidate !== 'function') {
    throw new Error(`registerVisionProvider(${name}): impl must have classifyCandidate()`);
  }
  registry.set(name, { name, ...impl });
}

export function getVisionProvider(name) {
  return registry.get(name) ?? null;
}

export function listVisionProviders() {
  return [...registry.keys()];
}

// The built-in null provider: no model, no network — emits the `ungated` sentinel so the pipeline
// behaves exactly as it did before vision existed. This is the default; it makes a real provider an
// opt-in (DESIGN_REFS_VISION_PROVIDER=<name>), and keeps `collect` runnable offline / in CI.
registerVisionProvider('manual', {
  async classifyCandidate() {
    return { verdict: UNGATED, reasons: ['no vision provider configured'] };
  },
  async analyzeForCodification() {
    return { ungated: true };
  },
  async analyzeRich() {
    return { ungated: true };
  },
});

// Which provider name the environment selects (default: the null provider).
export function selectedProviderName(env = process.env) {
  return env.DESIGN_REFS_VISION_PROVIDER || 'manual';
}

// True when a *real* (non-null) provider is selected — i.e. the vision gate should actually run.
export function visionEnabled(env = process.env) {
  return selectedProviderName(env) !== 'manual';
}

// Load an external provider module (it self-registers via registerVisionProvider). Vendor code lives
// there, never here — this is the no-leakage seam. Returns the selected provider, or the null provider.
export async function resolveVisionProvider(env = process.env) {
  const modPath = env.DESIGN_REFS_VISION_PROVIDER_MODULE;
  if (modPath && !getVisionProvider(selectedProviderName(env))) {
    await import(modPath); // expected to call registerVisionProvider(...)
  }
  return getVisionProvider(selectedProviderName(env)) ?? getVisionProvider('manual');
}

// Validate + normalise a provider's response into a stable verdict envelope.
export async function classifyCandidate(provider, input) {
  const raw = await provider.classifyCandidate(input);
  return {
    verdict: normalizeVerdict(raw?.verdict),
    reasons: Array.isArray(raw?.reasons) ? raw.reasons : [],
    provider: provider.name,
  };
}
