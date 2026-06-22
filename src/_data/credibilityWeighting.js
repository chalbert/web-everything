// credibilityWeighting — the WE-owned META-SCHEMA + default flavor + computation function for ranking a
// curated corpus of external sources by authority. Graduates the ratified #1588 ruling
// (we:docs/agent/platform-decisions.md#credibility-weighting); first consumer is the design-knowledge
// intake program's #1586 ledger (designKnowledgeWatch.json), but the shape generalizes to ANY
// admitted-and-weighted source set.
//
// Three orthogonal axes are encoded here, exactly as ruled (#1588) — not re-decided downstream:
//   (1) Admission ⟂ weight is TWO-STAGE. `admit()` is a permissive provenance/content floor
//       (identifiable + traceable-to-origin + on-topic — NOT a quality bar); a low-credibility source is
//       admitted-but-downweighted, never excluded. `computeCredibilityWeight()` runs only for admitted
//       sources and is a SEPARATE scalar.
//   (2) Weight is GRADE-shaped: a baseline TIER from the source `kind` + a small, FIXED, NAMED, OPTIONAL
//       set of up/down modifiers. Every APPLIED modifier records a rationale + attribution (only
//       `staleness` is deterministic). A free per-source number is rejected (un-auditable); flat-tier-by-
//       type is the degenerate config (no modifiers), not a rival.
//   (3) Governance = config-extends-platform-default. THIS module is the frozen meta-schema + WE's default
//       flavor (the `*Default` exports). A project EXTENDS it (add kinds/modifiers, retune weights) — it
//       does not fork the spine. A nonzero floor on admitted sources (axis-1's guarantee mirrored) stops a
//       weight-to-zero from covertly re-excluding. Cross-project ABSOLUTE comparability is a non-goal;
//       intra-corpus ORDERING is the only contract.
//
// Pure config + one pure function — no I/O, deterministic (only `staleness` reads a caller-supplied `asOf`).

// (3) The frozen meta-schema spine: the kind enum + each kind's baseline tier weight (WE default flavor).
// Ordering is the contract (peer-reviewed > standard > guideline > book > blog); a project may retune the
// numbers or add kinds, but the meta-schema (the existence of a kind→baseline map) is the comparable spine.
const sourceKindDefault = {
  'peer-reviewed': 1.0, // controlled study / academic venue (e.g. a UIST/CHI paper)
  standard: 0.9, // a normative spec body (W3C/WHATWG/ISO)
  guideline: 0.75, // a vendor/industry practice guide (NN/g, Apple HIG, Material)
  book: 0.6, // a durable authored treatment
  blog: 0.4, // a practitioner post / trend article
};

// (2) The fixed, NAMED modifier vocabulary. Each carries a direction + a `delta` applied to the baseline.
// `deterministic: true` (only `staleness`) means it needs no human rationale — it is computed. Every OTHER
// applied modifier MUST supply a rationale + attribution (enforced by computeCredibilityWeight).
const weightModifierDefault = {
  // up — earn credibility
  'breadth-diversity': { direction: 'up', delta: 0.05, label: 'Broad / diverse evidence base' },
  'independent-replication': { direction: 'up', delta: 0.1, label: 'Findings independently replicated' },
  // down — erode it
  'narrow-sample': { direction: 'down', delta: 0.1, label: 'Narrow or non-representative sample' },
  'vendor-funded-bias': { direction: 'down', delta: 0.15, label: 'Vendor-funded / conflict-of-interest bias' },
  staleness: { direction: 'down', delta: 0.1, label: 'Stale (older than the freshness horizon)', deterministic: true },
};

// (1)+(3) A nonzero floor on an ADMITTED source — weight can be eroded but never to zero (which would
// covertly re-exclude, breaking axis-1's admitted-but-downweighted guarantee).
const weightFloorDefault = 0.05;

// Staleness horizon for the deterministic modifier: a source older than this (in years, from `asOf`) trips
// `staleness`. Part of the default flavor; a project may retune.
const stalenessHorizonYearsDefault = 8;

// (1) The admission floor — three named, permissive gates. `attributable`, NOT `credible`: this decides
// IN/OUT only; quality is the separate weight axis. A project may add gates but not remove the spine.
const admissionGateDefault = {
  identifiable: 'Has a nameable author/organisation (not anonymous).',
  traceable: 'Traceable to an origin (a stable URL / DOI / citation).',
  'on-topic': 'On-topic for the corpus being curated.',
};

/**
 * (1) The admission floor. Returns `{ admitted, failed }` — `failed` lists the gate ids a source misses.
 * A source carries booleans for each gate id (absent ⇒ treated as failing — admission is opt-in evidence).
 * Permissive by design: this is a provenance/content floor, NEVER a quality bar.
 */
function admit(source, { gates = admissionGateDefault } = {}) {
  const failed = Object.keys(gates).filter((g) => source[g] !== true);
  return { admitted: failed.length === 0, failed };
}

/**
 * (2) Compute the credibility weight of an ADMITTED source: baseline tier (from `kind`) + the sum of its
 * applied modifiers' deltas, clamped to `[floor, 1]`.
 *
 * `source.modifiers` is an optional array; each entry is `{ id, rationale?, attribution?, asOf?, date? }`.
 * Every applied modifier MUST carry a non-empty `rationale` + `attribution` — EXCEPT a `deterministic` one
 * (`staleness`), which is auto-applied iff the source's `date` is older than the freshness horizon from
 * `asOf`. A free per-source number has no path in here, by design (axis 2: auditable, not a magic number).
 *
 * Throws on an unknown `kind` or an unknown/under-justified modifier — a misconfigured source fails loudly
 * rather than silently scoring wrong.
 */
function computeCredibilityWeight(source, opts = {}) {
  const kinds = opts.sourceKinds || sourceKindDefault;
  const modifiers = opts.weightModifiers || weightModifierDefault;
  const floor = opts.floor != null ? opts.floor : weightFloorDefault;
  const horizon = opts.stalenessHorizonYears != null ? opts.stalenessHorizonYears : stalenessHorizonYearsDefault;

  const baseline = kinds[source.kind];
  if (baseline == null) throw new Error(`credibilityWeighting: unknown source kind "${source.kind}"`);

  let weight = baseline;
  const applied = [];
  for (const m of source.modifiers || []) {
    const def = modifiers[m.id];
    if (!def) throw new Error(`credibilityWeighting: unknown modifier "${m.id}"`);
    if (def.deterministic) {
      if (m.id === 'staleness') {
        // Deterministic: only apply if the source is actually stale (needs a date + an asOf reference).
        if (!m.date || m.asOf == null) continue;
        const ageYears = (new Date(m.asOf) - new Date(m.date)) / (365.25 * 24 * 3600 * 1000);
        if (ageYears < horizon) continue;
      }
    } else if (!String(m.rationale || '').trim() || !String(m.attribution || '').trim()) {
      throw new Error(`credibilityWeighting: modifier "${m.id}" needs a rationale + attribution (only "staleness" is deterministic)`);
    }
    weight += def.direction === 'up' ? def.delta : -def.delta;
    applied.push(m.id);
  }

  const clamped = Math.max(floor, Math.min(1, Number(weight.toFixed(4))));
  return { weight: clamped, baseline, applied };
}

module.exports = {
  // meta-schema spine + WE default flavor (a project extends these)
  sourceKindDefault,
  weightModifierDefault,
  admissionGateDefault,
  weightFloorDefault,
  stalenessHorizonYearsDefault,
  // computation
  admit,
  computeCredibilityWeight,
};
