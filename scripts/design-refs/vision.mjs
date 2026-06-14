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
