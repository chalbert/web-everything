/**
 * @file review-policy.conformance.test.mjs — the CONFORMANCE SUITE for the review-escalation policy contract (#2566).
 *
 * WHAT THIS PROVES, AND WHY IT IS THE OTHER HALF OF THE CONTRACT.
 * `review-policy.contract.json` declares the policy as DATA (thresholds, reason families/clearance, the
 * disposition decision table). `review-policy.mjs` is its executable form. The DERIVATION CODE
 * (`review-escalation.mjs` scoreEscalation, `review-core.mjs` deriveReviewDisposition) is a SEPARATE, hand-written
 * realization of that same policy. This suite proves the code CONFORMS to the contract — over the full input
 * space, not one worked example — so that:
 *
 *   • a diff to the CONTRACT is a spec change (it lands on the trust-chain policy tier → review:human), and
 *   • an implementation change that keeps THIS suite green is agent-clearable: a behaviour-preserving refactor of
 *     the branches conforms; a change to what they DO diverges from the contract and turns this suite red, which
 *     forces the author to also edit the contract (→ human). That is the spec-based-programming gate (#2564,
 *     first instance #2563 Fork 1) made mechanical.
 *
 * THE THIRD STATE (#xonzpym). #2839 relaxed the reason-token pin from set equality to directional containment, so
 * a spec PR may land ahead of its impl PR. That legalized an entry DECLARED in the contract, ABSENT from the code,
 * and UNMARKED — which passed here, in the suite whose whole job is to be the deterministic backstop. The `todo` +
 * `owedTo` marker makes that state a declaration instead of an accident, and this suite now enforces it in both
 * directions: an unmarked gap FAILS, and a STALE marker (marked `todo`, actually implemented) FAILS too — the half
 * `test.todo` itself never checks, since a passing todo is only ever reported as a note.
 *
 * SELF-REFERENCE (load-bearing). This file's basename is registered on the trust-chain policy tier
 * (`../gate-config.mjs`), so weakening a conformance assertion here is itself a human-gated spec change — you
 * cannot quietly relax the bridge to make an impl diff pass. Do not do that; if the contract is genuinely wrong,
 * change the CONTRACT (a deliberate, human-reviewed spec edit), not this suite.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  REVIEW_POLICY,
  POLICY_THRESHOLDS,
  POLICY_IMPLEMENTED_REASON_TOKENS,
  POLICY_DECLARED_REASON_TOKENS,
  POLICY_TODO_REASON_TOKENS,
  POLICY_TODO_OWED_TO,
  POLICY_TODO_MARKER,
  POLICY_REASONS_BY_FAMILY,
  POLICY_HUMAN_SENSITIVITY_REASONS,
  POLICY_CARE_JURY,
  POLICY_CARE_BAND_NAMES,
  POLICY_DISPOSITION,
  POLICY_DISPOSITION_OVERRIDABLE_KEYS,
  POLICY_LAND_MODE,
  derivePolicyDisposition,
  resolveDispositionConfig,
  validateContract,
  partitionReasons,
  unresolvedReasonMessage,
} from '../review-policy.mjs';
import { DEFAULT_THRESHOLDS, CARE_LEVELS, CARE_LEVEL_ORDER } from '../review-escalation.mjs';
import { REVIEW_REASONS, deriveReviewDisposition, REVIEW_DISPOSITIONS, canonicalizeReason } from '../review-core.mjs';
import { panelRigorForCareLevel, PANEL_LENSES } from '../jury-core.mjs';

/**
 * The backlog item ids that are still LIVE — any status other than resolved/dropped — keyed by both the landed
 * `NNN` number and the in-flight `bornAs`/filename hash (#2288), since an `owedTo` may cite either. Mirrors
 * `collectOpenItemIds` in we:scripts/lib/validate-rules-anchors.cjs (#2844); the rule that consumes it takes the
 * predicate injected, so the rule itself stays fixture-testable without the real board.
 * @returns {Set<string>}
 */
function openBacklogItemIds() {
  const backlogDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backlog');
  const open = new Set();
  for (const name of readdirSync(backlogDir)) {
    if (!name.endsWith('.md')) continue;
    const fm = (readFileSync(join(backlogDir, name), 'utf8').match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
    const status = (fm.match(/^status:\s*["']?([\w-]+)/m) || [])[1];
    if (!status || status === 'resolved' || status === 'dropped') continue;
    const id = (name.match(/^(\w+)-/) || [])[1];
    if (id) open.add(id);
    const born = (fm.match(/^bornAs:\s*["']?([\w-]+)/m) || [])[1];
    if (born) open.add(born);
  }
  return open;
}

/** The contract's LIVE reason entries — every declared reason MINUS the ones marked not-yet-implemented. Any
 *  assertion that hands a token to the impl (or to the oracle) must draw from here: a `todo` entry is inert
 *  vocabulary with no code behind it, so feeding one to a derivation is a test bug, not a conformance failure. */
const liveReasons = () => REVIEW_POLICY.reasons.filter((r) => r.todo !== true);

/** Every non-empty subset of `items` (the powerset minus the empty set), as arrays — deterministic, no random. */
function nonEmptyPowerset(items) {
  const all = items.reduce((sets, item) => sets.concat(sets.map((s) => [...s, item])), [[]]);
  return all.filter((s) => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// STATIC CONFORMANCE — the contract loads, is well-formed, and its vocabulary matches the impl's token enum.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('static conformance — contract shape + vocabulary', () => {
  it('the contract loaded and is frozen (a validated, immutable spec)', () => {
    expect(Object.isFrozen(REVIEW_POLICY)).toBe(true);
    expect(REVIEW_POLICY.contract).toBe('review-escalation-policy');
  });

  it('every contract reason carries prose (schema skeleton + first-class prose layer, #2564)', () => {
    for (const r of REVIEW_POLICY.reasons) {
      expect(typeof r.description).toBe('string');
      expect(r.description.trim().length).toBeGreaterThan(0);
    }
    expect(REVIEW_POLICY.disposition.description.trim().length).toBeGreaterThan(0);
  });

  // #2839 ENABLEMENT, then #xonzpym's correction of it. This pin used to be exact set equality, and that is what
  // made the ratified "principle and impl land in separate PRs" rule unenforceable: a change needing a new reason
  // token had to move the CONTRACT (a spec file, human-gated) and the CODE ENUM (derivation code) in ONE commit,
  // or the suite went red in between. So spec and impl were welded together by their own conformance test. #2839
  // replaced equality with DIRECTIONAL CONTAINMENT — code may never outrun the spec, the spec may outrun the code.
  //
  // WHAT THAT COST, MEASURED RATHER THAN ARGUED. Containment made a THIRD state legal: an entry declared in the
  // contract, absent from the code, and UNMARKED. Injecting such a phantom token reddened exactly ONE assertion —
  // the DECORATED-map pin further down — whose message reads "the decorated map does not silently miss a reason".
  // An author following that message adds the one-line decorated fixture it asks for, and the suite goes fully
  // GREEN with the token still unimplemented. The backstop's own error message was directions around it.
  //
  // THE CORRECTION. Equality comes back, but modulo an EXPLICIT marker: an entry may declare itself not-yet-built
  // with `todo: true` + `owedTo: "<open item>"` (the contract's `todoMarker` block; the same honest-escape shape
  // #2844 gives the invariant catalogue). Three defect classes, each its own row, each its own test below:
  //   1. UNDECLARED      — a code token the contract never declared. The #2839 safety half, UNCHANGED in strength.
  //   2. UNMARKED-ABSENT — declared, absent from the code, no marker. This is what silently passed; now it FAILS.
  //   3. STALE-TODO      — marked `todo` but the code HAS implemented it. `test.todo` never catches this (a passing
  //      todo is reported as a note, never a defect), so the marker would otherwise outlive its work forever.
  // A `todo` entry with a live `owedTo` and no code is the one legal gap — #2839's relaxation, now declared.

  /**
   * The todo-aware pin as a PURE rule over synthetic inputs, so each row can be proven independently of today's
   * real vocabulary. This matters: the live contract and enum are currently equal with zero todo entries, so
   * asserting only against them would pass whatever the rule was — equality, containment, and this rule are
   * indistinguishable there. Only fixtures can tell them apart.
   * @param {Array<{token: string, todo?: boolean}>} contractEntries
   * @param {string[]} codeTokens
   * @returns {{undeclared: string[], unmarkedAbsent: string[], staleTodo: string[]}}
   */
  function conformanceDefects(contractEntries, codeTokens) {
    const code = new Set(codeTokens);
    const declared = new Set(contractEntries.map((e) => e.token));
    return {
      undeclared: [...code].filter((t) => !declared.has(t)).sort(),
      unmarkedAbsent: contractEntries.filter((e) => e.todo !== true && !code.has(e.token)).map((e) => e.token).sort(),
      staleTodo: contractEntries.filter((e) => e.todo === true && code.has(e.token)).map((e) => e.token).sort(),
    };
  }
  const NONE = { undeclared: [], unmarkedAbsent: [], staleTodo: [] };

  // ── the LIVE pin ────────────────────────────────────────────────────────────────────────────────────────────
  it('the real contract and REVIEW_REASONS agree on all three rows (no undeclared, no unmarked gap, no stale todo)', () => {
    expect(conformanceDefects([...REVIEW_POLICY.reasons], Object.values(REVIEW_REASONS))).toEqual(NONE);
  });

  // ── row 1: the #2839 safety half, unchanged ─────────────────────────────────────────────────────────────────
  it('UNDECLARED — a code token the contract never declared still FAILS (code may never outrun the spec)', () => {
    const d = conformanceDefects([{ token: 'a' }, { token: 'b' }], ['a', 'b', 'rogue']);
    expect(d.undeclared).toEqual(['rogue']);
  });

  // ── row 2: the state that passed silently ───────────────────────────────────────────────────────────────────
  it('UNMARKED-ABSENT — declared, absent from the code, and unmarked FAILS (the #2839 blind spot, closed)', () => {
    // Before the marker this was the invisible third state: the spec claims a reason the gate can never fire.
    const d = conformanceDefects([{ token: 'a' }, { token: 'phantom' }], ['a']);
    expect(d.unmarkedAbsent).toEqual(['phantom']);
    // And it is the MARKER that distinguishes it — nothing else about the entry differs.
    expect(conformanceDefects([{ token: 'a' }, { token: 'phantom', todo: true }], ['a'])).toEqual(NONE);
  });

  // ── row 3: the stale marker `test.todo` cannot catch ────────────────────────────────────────────────────────
  it('STALE-TODO — marked `todo` but actually IMPLEMENTED FAILS (the half test.todo never checks)', () => {
    // The impl PR landed and nobody dropped the marker. `test.todo` would report this as a passing note forever;
    // here it is a defect, so the marker must be removed in the same PR that lands the code.
    const d = conformanceDefects([{ token: 'a' }, { token: 'shipped', todo: true }], ['a', 'shipped']);
    expect(d.staleTodo).toEqual(['shipped']);
  });

  // ── the legal gap ───────────────────────────────────────────────────────────────────────────────────────────
  it('a `todo` entry the code has not implemented PASSES — #2839\'s spec-ahead-of-impl split, now declared', () => {
    expect(conformanceDefects([{ token: 'a' }, { token: 'b' }, { token: 'owed', todo: true }], ['a', 'b'])).toEqual(NONE);
  });

  it('the three rows are independent — a contract can trip all of them at once and each is reported', () => {
    // A one-sided rule that collapsed the rows into a single boolean would pass the cases above; this pins that
    // each defect is surfaced on its own, so a fix for one never masks another.
    const d = conformanceDefects(
      [{ token: 'phantom' }, { token: 'shipped', todo: true }, { token: 'ok' }],
      ['ok', 'shipped', 'rogue'],
    );
    expect(d).toEqual({ undeclared: ['rogue'], unmarkedAbsent: ['phantom'], staleTodo: ['shipped'] });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// TODO-MARKER CONFORMANCE — the marker's SHAPE is enforced at load, and its `owedTo` names a LIVE debt.
// The marker is only worth having if it cannot be worn loosely: `todo` without an `owedTo` is the free pass it
// exists to prevent, and an `owedTo` pointing at a resolved item is "we shipped the item and built nothing" —
// the drift, not the exit from it. Both are proven against fixtures, because zero entries carry the marker today.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('todo-marker conformance — the marker cannot be worn loosely (#xonzpym)', () => {
  /** A minimal well-formed contract, with `reasons` swapped for the fixture under test. */
  const contractWithReasons = (reasons) => ({ ...structuredClone(REVIEW_POLICY), reasons });
  const REASON = { family: 'sensitivity', clearance: 'agent', description: 'fixture prose' };

  it('the todoMarker block loaded, is frozen, carries prose, and declares where the marker is legal', () => {
    expect(Object.isFrozen(POLICY_TODO_MARKER)).toBe(true);
    expect(POLICY_TODO_MARKER.description.trim().length).toBeGreaterThan(0);
    expect([...POLICY_TODO_MARKER.appliesTo]).toEqual(['reasons']);
  });

  it('a well-formed marked entry LOADS (the marker is usable, not merely declared)', () => {
    expect(() => validateContract(contractWithReasons([{ token: 'owed', ...REASON, todo: true, owedTo: 'x1a2b3c' }]))).not.toThrow();
    expect(() => validateContract(contractWithReasons([{ token: 'owed', ...REASON, todo: true, owedTo: '#2839' }]))).not.toThrow();
  });

  it('`todo` WITHOUT `owedTo` is REFUSED at load — a todo entry is debt, not a free pass', () => {
    expect(() => validateContract(contractWithReasons([{ token: 'owed', ...REASON, todo: true }])))
      .toThrow(/marked todo but has no owedTo/);
  });

  it('`owedTo` WITHOUT `todo` is REFUSED — an implemented entry that claims to owe work is a stale pointer', () => {
    expect(() => validateContract(contractWithReasons([{ token: 'a', ...REASON, owedTo: '2839' }])))
      .toThrow(/not marked todo/);
  });

  it('`todo: false` is REFUSED — "implemented" has exactly one spelling, the absent field', () => {
    expect(() => validateContract(contractWithReasons([{ token: 'a', ...REASON, todo: false, owedTo: '2839' }])))
      .toThrow(/must be the literal true/);
  });

  it('an `owedTo` that is not a backlog item reference is REFUSED', () => {
    for (const bad of ['', 'soon', 'see the epic', '12', 'xNOTAHASH']) {
      expect(() => validateContract(contractWithReasons([{ token: 'a', ...REASON, todo: true, owedTo: bad }])))
        .toThrow(/owedTo must name a backlog item/);
    }
  });

  it('todoMarker.appliesTo is itself validated — an unknown section, an empty list, or a duplicate is REFUSED', () => {
    // `appliesTo` is the DATA answer to "where may an entry declare itself unbuilt?", so a typo there must be a
    // load error, not a marker that silently governs nothing.
    const withAppliesTo = (appliesTo) => {
      const c = contractWithReasons([{ token: 'a', ...REASON }]);
      c.todoMarker = { ...c.todoMarker, appliesTo };
      return () => validateContract(c);
    };
    expect(withAppliesTo(['resons'])).toThrow(/unknown section "resons"/);
    expect(withAppliesTo(['thresholds'])).toThrow(/unknown section "thresholds"/);
    expect(withAppliesTo([])).toThrow(/must be a non-empty array/);
    expect(withAppliesTo(['reasons', 'reasons'])).toThrow(/duplicates/);
    expect(withAppliesTo(['reasons'])).not.toThrow();
  });

  // The OPEN-ness of an owedTo is not knowable inside review-policy.mjs (a trust-chain leaf that imports only
  // fs/path), so the rule lives here as a pure predicate over an injected `isOpenItem` — the same split #2844
  // uses. Fixtures prove the rule; the live sweep below applies it to the real contract.
  const staleOwedTo = (reasons, isOpenItem) => reasons
    .filter((r) => r.todo === true && !isOpenItem(String(r.owedTo).replace(/^#/, '')))
    .map((r) => r.token).sort();

  it('an owedTo naming an OPEN item passes; one naming a resolved/absent item FAILS', () => {
    const isOpen = (id) => id === '2839';
    expect(staleOwedTo([{ token: 'a', todo: true, owedTo: '#2839' }], isOpen)).toEqual([]);
    expect(staleOwedTo([{ token: 'a', todo: true, owedTo: '#0001' }], isOpen)).toEqual(['a']);
  });

  it('every `todo` entry in the REAL contract owes an item that is still OPEN', () => {
    const open = openBacklogItemIds();
    expect(open.size).toBeGreaterThan(10); // the reader actually found the board — a silent empty set would pass vacuously
    expect(staleOwedTo([...REVIEW_POLICY.reasons], (id) => open.has(id))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// TODO-INERTNESS — a `todo` entry reserves vocabulary and NOTHING ELSE. It must never reach runtime
// classification: not the token list the impl canonicalizes against, not the family groups, not the
// human-clearance set. These are PARTITION LAWS over whatever the contract happens to hold, so they stay
// meaningful the day a real todo entry is added — unlike an assertion about today's (empty) todo set.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('todo inertness — a not-yet-implemented entry can never affect a disposition (#xonzpym)', () => {
  it('the declared vocabulary partitions EXACTLY into implemented + todo (nothing lost, nothing double-counted)', () => {
    expect([...POLICY_IMPLEMENTED_REASON_TOKENS, ...POLICY_TODO_REASON_TOKENS].sort())
      .toEqual([...POLICY_DECLARED_REASON_TOKENS].sort());
    const impl = new Set(POLICY_IMPLEMENTED_REASON_TOKENS);
    expect(POLICY_TODO_REASON_TOKENS.filter((t) => impl.has(t))).toEqual([]);
  });

  it('no todo token leaks into the family groups or the human-clearance set the impl imports', () => {
    const todo = new Set(POLICY_TODO_REASON_TOKENS);
    const leaked = [
      ...POLICY_REASONS_BY_FAMILY.sensitivity,
      ...POLICY_REASONS_BY_FAMILY.deadlock,
      ...POLICY_HUMAN_SENSITIVITY_REASONS,
    ].filter((t) => todo.has(t));
    expect(leaked).toEqual([]);
  });

  it('every todo token carries its owedTo in the derived map (the debt is addressable, not just flagged)', () => {
    for (const token of POLICY_TODO_REASON_TOKENS) {
      expect(POLICY_TODO_OWED_TO[token]).toMatch(/^(?:\d{3,}|x[0-9a-z]{6,8})$/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THRESHOLD CONFORMANCE — the impl's thresholds ARE the contract's values (single source of truth). A flip in
// the contract necessarily moves DEFAULT_THRESHOLDS; nothing else can.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('threshold conformance — DEFAULT_THRESHOLDS is sourced from the contract', () => {
  it('DEFAULT_THRESHOLDS deep-equals the contract threshold values', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      diffLines: REVIEW_POLICY.thresholds.diffLines.value,
    });
    expect(POLICY_THRESHOLDS).toEqual(DEFAULT_THRESHOLDS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DISPOSITION CONFORMANCE — the CORE bridge. Over the ENTIRE powerset of reason tokens, the hand-written
// imperative branches of deriveReviewDisposition produce EXACTLY the outcome the contract's executable table
// (derivePolicyDisposition) computes. Any divergence — a mis-ordered branch, a wrong autoLand, a dropped
// precedence rule — fails here, on the specific reason set that exposes it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('disposition conformance — deriveReviewDisposition realizes the contract table over the full input space', () => {
  const tokens = [...POLICY_IMPLEMENTED_REASON_TOKENS];

  it('every single reason token: impl outcome === contract-oracle outcome', () => {
    for (const token of tokens) {
      expect(deriveReviewDisposition({ reason: token })).toEqual(derivePolicyDisposition({ reason: token }));
    }
  });

  it('every non-empty COMBINATION of reasons (strictest-wins): impl === contract-oracle', () => {
    for (const subset of nonEmptyPowerset(tokens)) {
      expect(deriveReviewDisposition({ reasons: subset })).toEqual(derivePolicyDisposition({ reasons: subset }));
    }
  });

  it('the contract-oracle itself is exhaustive — no reason set falls through the precedence table', () => {
    for (const subset of nonEmptyPowerset(tokens)) {
      const d = derivePolicyDisposition({ reasons: subset });
      expect(['converge', 'human']).toContain(d.mode);
      expect(typeof d.autoLand).toBe('boolean');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DECORATED-STRING CONFORMANCE — the drain carries DECORATED reason strings (from scoreEscalation), not bare
// tokens; the impl canonicalizes them before deriving. This proves canonicalization + derivation together still
// land on the contract's outcome for each reason's real decorated form.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('decorated-string conformance — the drain\'s real reason strings derive the contract outcome', () => {
  // One representative decorated string per token, in the exact shape scoreEscalation emits.
  const DECORATED = {
    [REVIEW_REASONS.GATE_SELF]: 'gate-self (scripts/lib/gate-config.mjs) — declarative leash, human review required',
    [REVIEW_REASONS.GATE_DERIVATION]: 'gate-derivation (scripts/lib/review-escalation.mjs) — gate derivation code, independent committee review',
    [REVIEW_REASONS.STATUTE]: 'statute (docs/agent/platform-decisions.md) — human review required',
    [REVIEW_REASONS.BLAST_RADIUS]: 'blast-radius (scripts/foo.mjs, scripts/bar.mjs)',
    [REVIEW_REASONS.SIZE]: 'size (1080 ≥ 400 changed lines)',
    [REVIEW_REASONS.DISMISSED_FINDINGS]: 'dismissed-findings (2 pre-PR review finding(s) the lane dismissed)',
    [REVIEW_REASONS.CROSS_REPO]: 'cross-repo impl+WE couple',
    [REVIEW_REASONS.NON_CONVERGENCE]: 'non-convergence',
    [REVIEW_REASONS.MANDATE_CONFLICT]: 'mandate-conflict',
  };

  it('covers every token (the decorated map does not silently miss a reason)', () => {
    expect(Object.keys(DECORATED).sort()).toEqual([...POLICY_IMPLEMENTED_REASON_TOKENS].sort());
  });

  it('each decorated reason derives the SAME disposition as its bare contract token', () => {
    for (const [token, decorated] of Object.entries(DECORATED)) {
      expect(deriveReviewDisposition({ reason: decorated })).toEqual(derivePolicyDisposition({ reason: token }));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The contract's disposition outcomes match the ratified policy tokens (a guard that the CONTRACT itself still
// encodes the #2445 two-tier flip: deadlock ⇒ human, gate-self/statute ⇒ converge-no-autoland, else auto-land).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// CARE→JURY CONFORMANCE (#2633) — the care→jury table is the DATA form of the bands hardcoded today in
// jury-core.mjs panelRigorForCareLevel. This is the same "contract single-sources the impl" bridge the
// threshold block enforces: the contract declares the bands, and the impl must realize EXACTLY them. A re-tune
// of the contract that jury-core does not (yet) mirror fails here, on the band that diverged — so "the policy
// changed" stays a deterministic diff to the contract, and the two can never silently drift apart.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('care→jury conformance — the contract table single-sources jury-core panelRigorForCareLevel bands', () => {
  it('the care→jury table loaded, is frozen, and carries prose (schema skeleton + prose layer, #2564)', () => {
    expect(Object.isFrozen(POLICY_CARE_JURY)).toBe(true);
    expect(POLICY_CARE_JURY.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_CARE_JURY.rosterTimingMode.description.trim().length).toBeGreaterThan(0);
    for (const name of POLICY_CARE_BAND_NAMES) {
      expect(POLICY_CARE_JURY.bands[name].description.trim().length).toBeGreaterThan(0);
    }
  });

  it('the contract band names EXACTLY match the CARE_LEVELS enum, in least→most order (no vocabulary drift)', () => {
    expect(POLICY_CARE_BAND_NAMES).toEqual([...CARE_LEVEL_ORDER]);
    expect([...POLICY_CARE_BAND_NAMES].sort()).toEqual(Object.values(CARE_LEVELS).sort());
    expect(Object.keys(POLICY_CARE_JURY.bands).sort()).toEqual(Object.values(CARE_LEVELS).sort());
  });

  it('the roster-timing mode (knob #4) is a valid, single value', () => {
    expect(['up-front', 'incremental']).toContain(POLICY_CARE_JURY.rosterTimingMode.value);
  });

  it('every band lens is drawn from the real PANEL_LENSES set (no lens the panel cannot fan out)', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      for (const lens of POLICY_CARE_JURY.bands[name].lenses) {
        expect(PANEL_LENSES).toContain(lens);
      }
    }
  });

  it('each band conforms to panelRigorForCareLevel: lenses, jurorsPerLens, and roundCap===rounds match the impl', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      const band = POLICY_CARE_JURY.bands[name];
      const rigor = panelRigorForCareLevel(name);
      expect(band.lenses).toEqual(rigor.lenses);
      expect(band.jurorsPerLens).toBe(rigor.jurorsPerLens);
      expect(band.roundCap).toBe(rigor.rounds);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DISPOSITION-CONFIG CONFORMANCE (#2651, FF3 filled in) — the disposition knobs the #2633 shape reserved room for
// are now concrete: per-lens weights, a dissent threshold, resolutionMode, plus the per-decision override allow-list.
// This is CONFIG-only (the judge is #2652), so conformance here is STATIC: the block loads well-formed, its values
// are in range, the override allow-list is exactly the three knobs, and resolveDispositionConfig merges the three
// precedence layers (decision > band > global) as the contract prose declares. It also guards that #2651 was purely
// ADDITIVE — every #2633 band's rigor is UNCHANGED (that invariant is the "edit, not a migration" claim made real).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('disposition-config conformance — the FF3 knobs load, validate, and merge by precedence (#2651)', () => {
  it('the disposition block loaded, is frozen, and carries prose on every knob (schema + prose layer, #2564)', () => {
    expect(Object.isFrozen(POLICY_DISPOSITION)).toBe(true);
    expect(POLICY_DISPOSITION.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_DISPOSITION.lensWeights.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_DISPOSITION.dissentThreshold.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_DISPOSITION.resolutionMode.description.trim().length).toBeGreaterThan(0);
    expect(POLICY_DISPOSITION.override.description.trim().length).toBeGreaterThan(0);
  });

  it('the three global knob values are in their declared domains', () => {
    expect(POLICY_DISPOSITION.lensWeights.default).toBeGreaterThanOrEqual(0);
    expect(POLICY_DISPOSITION.dissentThreshold.value).toBeGreaterThanOrEqual(0);
    expect(POLICY_DISPOSITION.dissentThreshold.value).toBeLessThanOrEqual(1);
    expect(['accept-best', 'present-unless-all-agree']).toContain(POLICY_DISPOSITION.resolutionMode.value);
  });

  it('the per-decision override allow-list is EXACTLY the three disposition knobs (knob 4 bounds the override)', () => {
    expect([...POLICY_DISPOSITION_OVERRIDABLE_KEYS].sort()).toEqual(
      ['dissentThreshold', 'lensWeights', 'resolutionMode'],
    );
    expect([...POLICY_DISPOSITION.override.overridableKeys].sort()).toEqual([...POLICY_DISPOSITION_OVERRIDABLE_KEYS].sort());
  });

  it('every lens named in the global weight map is a real panel lens (no weight for a lens that never runs)', () => {
    for (const lens of Object.keys(POLICY_DISPOSITION.lensWeights.values)) {
      expect(PANEL_LENSES).toContain(lens);
    }
  });

  it('resolveDispositionConfig with no args returns the global defaults', () => {
    const g = resolveDispositionConfig();
    expect(g.dissentThreshold).toBe(POLICY_DISPOSITION.dissentThreshold.value);
    expect(g.resolutionMode).toBe(POLICY_DISPOSITION.resolutionMode.value);
    expect(g.lensWeights.default).toBe(POLICY_DISPOSITION.lensWeights.default);
    expect(g.lensWeights.values).toEqual(POLICY_DISPOSITION.lensWeights.values);
  });

  // landMode (#2675) — the GLOBAL auto-land operating mode. Carries prose, is a valid mode, DEFAULTS to shadow,
  // and is GLOBAL-only: absent from the override allow-list and identical across every band / any override.
  it('the landMode knob carries prose and its value is one of shadow | enforce', () => {
    expect(POLICY_DISPOSITION.landMode.description.trim().length).toBeGreaterThan(0);
    expect(['shadow', 'enforce']).toContain(POLICY_DISPOSITION.landMode.value);
  });

  it('landMode DEFAULTS to shadow (the ratified default until a separate flip ruling, #2675)', () => {
    expect(POLICY_DISPOSITION.landMode.value).toBe('shadow');
    expect(POLICY_LAND_MODE).toBe('shadow');
  });

  it('landMode is GLOBAL-only — never overridable and constant across bands', () => {
    // NOT in the per-decision override allow-list (a system-wide stance, not a per-PR knob).
    expect([...POLICY_DISPOSITION_OVERRIDABLE_KEYS]).not.toContain('landMode');
    // resolveDispositionConfig surfaces the same global landMode regardless of band or override.
    expect(resolveDispositionConfig().landMode).toBe(POLICY_LAND_MODE);
    for (const name of POLICY_CARE_BAND_NAMES) {
      expect(resolveDispositionConfig({ band: name }).landMode).toBe(POLICY_LAND_MODE);
    }
    expect(resolveDispositionConfig({ override: { resolutionMode: 'accept-best' } }).landMode).toBe(POLICY_LAND_MODE);
  });

  it('a per-decision override wins over the global default (decision > global)', () => {
    const r = resolveDispositionConfig({
      override: { dissentThreshold: 0.5, resolutionMode: 'accept-best', lensWeights: { security: 3 } },
    });
    expect(r.dissentThreshold).toBe(0.5);
    expect(r.resolutionMode).toBe('accept-best');
    expect(r.lensWeights.values.security).toBe(3);
  });

  it('an override naming a key outside the allow-list is rejected (the boundary is enforced)', () => {
    expect(() => resolveDispositionConfig({ override: { roundCap: 9 } })).toThrow(/not overridable/);
  });

  it('an override whose VALUES break the declared domains is rejected (runtime boundary fails loud)', () => {
    expect(() => resolveDispositionConfig({ override: { dissentThreshold: 5 } })).toThrow(/invalid override/);
    expect(() => resolveDispositionConfig({ override: { resolutionMode: 'garbage' } })).toThrow(/invalid override/);
    expect(() => resolveDispositionConfig({ override: { lensWeights: { correctness: -3 } } })).toThrow(/invalid override/);
    expect(() => resolveDispositionConfig({ override: { lensWeights: { boguslens: 2 } } })).toThrow(/invalid override/);
  });

  it('resolving against every real care band succeeds (band layer never throws on a valid band)', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      const r = resolveDispositionConfig({ band: name });
      expect(['accept-best', 'present-unless-all-agree']).toContain(r.resolutionMode);
    }
    expect(() => resolveDispositionConfig({ band: 'nope' })).toThrow(/unknown care band/);
  });

  it('#2651 was purely ADDITIVE — every #2633 band rigor is unchanged (edit, not a migration)', () => {
    for (const name of POLICY_CARE_BAND_NAMES) {
      const band = POLICY_CARE_JURY.bands[name];
      const rigor = panelRigorForCareLevel(name);
      expect(band.lenses).toEqual(rigor.lenses);
      expect(band.jurorsPerLens).toBe(rigor.jurorsPerLens);
      expect(band.roundCap).toBe(rigor.rounds);
    }
  });
});

// These three walk the contract's reason entries DIRECTLY (not POLICY_IMPLEMENTED_REASON_TOKENS), so they must apply the same
// todo partition the derived constants do — `liveReasons()`, never `REVIEW_POLICY.reasons`. A `todo` entry is
// inert: it is absent from the oracle's lookup map, so handing one to derivePolicyDisposition throws
// "declared NOT YET IMPLEMENTED" and these tests would fail on a contract that is perfectly well-formed. That is
// a test bug, not a conformance failure — and it is exactly the trap a raw `.reasons` walk falls into.
describe('the contract encodes the ratified two-tier flip (#2445)', () => {
  it('deadlock reasons ⇒ human, never auto-land', () => {
    for (const token of liveReasons().filter((r) => r.family === 'deadlock').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.HUMAN, autoLand: false });
    }
  });
  it('human-clearance sensitivity reasons (gate-self/statute) ⇒ converge, never auto-land', () => {
    for (const token of liveReasons().filter((r) => r.family === 'sensitivity' && r.clearance === 'human').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
    }
  });
  it('agent-clearance sensitivity reasons ⇒ converge, auto-land', () => {
    for (const token of liveReasons().filter((r) => r.family === 'sensitivity' && r.clearance === 'agent').map((r) => r.token)) {
      expect(derivePolicyDisposition({ reason: token })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE MARKER, END TO END, ON A CONTRACT THAT ACTUALLY CARRIES ONE (#xonzpym). Everything above proves the RULE;
// zero real entries are marked `todo` today, so the derived constants and the oracle's todo path are never
// exercised by the live contract. That is the classic way a marker ships broken: the gate is green because the
// feature is unused. So load the module against a SYNTHETIC contract that does carry a todo reason, and drive the
// whole pipeline — validation, the partition, the family groups, and the oracle's refusal — against it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the derivation itself, on reasons that really carry a `todo` (#xonzpym)', () => {
  const OWED = { token: 'owed-reason', family: 'sensitivity', clearance: 'agent', description: 'fixture prose', todo: true, owedTo: '#xonzpym' };
  const LIVE = { token: 'live-reason', family: 'sensitivity', clearance: 'agent', description: 'fixture prose' };

  it('partitionReasons splits live from todo and strips the owedTo\'s leading #', () => {
    const { live, todoOwedTo } = partitionReasons([LIVE, OWED]);
    expect(live.map((r) => r.token)).toEqual(['live-reason']);
    expect([...todoOwedTo]).toEqual([['owed-reason', 'xonzpym']]);
  });

  it('partitionReasons is what every derived constant is built from — the live contract round-trips through it', () => {
    // Pins the wiring, not just the helper: if a constant were ever rebuilt off the raw `.reasons` again, this
    // equality is what notices.
    const { live, todoOwedTo } = partitionReasons([...REVIEW_POLICY.reasons]);
    expect(live.map((r) => r.token)).toEqual([...POLICY_IMPLEMENTED_REASON_TOKENS]);
    expect([...todoOwedTo.keys()]).toEqual([...POLICY_TODO_REASON_TOKENS]);
    expect(Object.fromEntries(todoOwedTo)).toEqual({ ...POLICY_TODO_OWED_TO });
  });

  it('a todo reason is INERT — the partition keeps it out of the live set that becomes the impl vocabulary', () => {
    // The failure mode worth pinning: a todo entry reaching classification and being treated as a matching
    // agent-clearance sensitivity reason, which would flip a human gate to auto-land.
    const { live } = partitionReasons([...REVIEW_POLICY.reasons, OWED]);
    expect(live.map((r) => r.token)).not.toContain('owed-reason');
    expect(live.map((r) => r.token)).toEqual([...POLICY_IMPLEMENTED_REASON_TOKENS]);
  });

  it('the oracle names the item that owes an unbuilt reason, and keeps "unknown" distinct from "unbuilt"', () => {
    const { todoOwedTo } = partitionReasons([LIVE, OWED]);
    // Unbuilt: say who owes it. "unknown reason" would send the reader hunting for a typo that isn't there.
    expect(unresolvedReasonMessage(['owed-reason'], todoOwedTo))
      .toMatch(/declared NOT YET IMPLEMENTED.*owed-reason \(owedTo #xonzpym\)/);
    // Genuinely unknown: the original message, unchanged.
    expect(unresolvedReasonMessage(['typo-reason'], todoOwedTo)).toMatch(/^derivePolicyDisposition: unknown reason\(s\): typo-reason$/);
  });

  it('the message is TOTAL — a typo alongside an unbuilt reason is reported, never swallowed by it', () => {
    // The lossy version filtered `unresolved` down to the owed set and reported only that, so a real typo
    // vanished whenever a todo token happened to sit beside it. Both groups must survive, in one message.
    const { todoOwedTo } = partitionReasons([LIVE, OWED]);
    const mixed = unresolvedReasonMessage(['typo-reason', 'owed-reason'], todoOwedTo);
    // The unbuilt one still LEADS (it is the more actionable diagnosis — it names who owes the work)…
    expect(mixed).toMatch(/declared NOT YET IMPLEMENTED.*owed-reason \(owedTo #xonzpym\)/);
    // …and the typo is still there, in the unknown group, spelled out by name.
    expect(mixed).toMatch(/unknown reason\(s\): typo-reason/);
    // Every input token appears in the output, whichever group it belongs to — no silent drops, any order.
    const many = unresolvedReasonMessage(['typo-one', 'owed-reason', 'typo-two'], todoOwedTo);
    for (const token of ['typo-one', 'owed-reason', 'typo-two']) expect(many).toContain(token);
    expect(many).toMatch(/unknown reason\(s\): typo-one, typo-two/);
  });

  it('the live oracle still rejects an unknown token with the plain message (no todo entries today)', () => {
    expect(() => derivePolicyDisposition({ reason: 'no-such-reason' })).toThrow(/unknown reason\(s\): no-such-reason/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE CANONICALIZATION VOCABULARY BINDING (#xonzpym). review-core.mjs canonicalizes every decorated reason
// string against ONE token list, and there are now two lists to choose from that are interchangeable by shape:
// POLICY_IMPLEMENTED_REASON_TOKENS (safe) and POLICY_DECLARED_REASON_TOKENS (unsafe). Nothing else in this suite
// can tell them apart — every other pin ITERATES the implemented set, so it never sees the divergence, and
// review-core.mjs is `tier: policy, leash: code`, i.e. a green suite is what clears an edit to it. So the
// binding is pinned HERE, twice over: at source level (arms today, on any swap) and behaviourally (drives the
// REAL matcher over both vocabularies against a contract that carries a todo entry, and shows what the wrong
// one costs). This block is the reason the swap cannot ride in on a green suite.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('review-core canonicalizes against the IMPLEMENTED vocabulary, never the declared one (#xonzpym)', () => {
  const CORE_SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'review-core.mjs'), 'utf8');
  const OWED = { token: 'owed-reason', family: 'sensitivity', clearance: 'agent', description: 'fixture prose', todo: true, owedTo: '#xonzpym' };

  it('ALL_REASON_TOKENS is bound to POLICY_IMPLEMENTED_REASON_TOKENS, at source', () => {
    expect(CORE_SRC).toMatch(/^const ALL_REASON_TOKENS = POLICY_IMPLEMENTED_REASON_TOKENS;$/m);
  });

  it('review-core does not so much as import the DECLARED vocabulary', () => {
    // Import-level, not just use-level: the unsafe set must not even be in scope in the file that classifies.
    // Comment lines may NAME it (they explain why it is the wrong choice); no line of CODE may mention it.
    const codeMentions = CORE_SRC.split('\n')
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
      .filter((line) => line.includes('POLICY_DECLARED_REASON_TOKENS'));
    expect(codeMentions).toEqual([]);
  });

  it('the counterfactual, on a contract that really carries a todo entry: declared vocab resolves what implemented vocab refuses', () => {
    const declared = [...REVIEW_POLICY.reasons, OWED].map((r) => r.token);
    const implemented = partitionReasons([...REVIEW_POLICY.reasons, OWED]).live.map((r) => r.token);
    expect(declared).toContain('owed-reason');
    expect(implemented).not.toContain('owed-reason');

    // The decorated form the drain would actually carry for such a reason.
    const decorated = 'owed-reason (scripts/lib/gate-config.mjs) — human review required';
    // As shipped: unrecognized ⇒ deriveReviewDisposition throws. Fail-closed.
    expect(canonicalizeReason(decorated, implemented)).toBeNull();
    // Wired to the declared set: it resolves…
    expect(canonicalizeReason(decorated, declared)).toBe('owed-reason');
    // …and because a todo token is (correctly) in NEITHER family group nor the human-clearance set, it then
    // falls through BOTH precedence branches to the permissive default — a silent AUTO-LAND of an unbuilt,
    // human-review-shaped reason. That is the whole cost of the swap, stated as an assertion.
    expect(POLICY_REASONS_BY_FAMILY.deadlock).not.toContain('owed-reason');
    expect(POLICY_HUMAN_SENSITIVITY_REASONS).not.toContain('owed-reason');
  });

  it('the safe direction is what production does: a real decorated reason still canonicalizes with the default vocabulary', () => {
    // Guards the counterfactual above from passing vacuously (e.g. if the matcher stopped matching anything).
    expect(canonicalizeReason('gate-self (scripts/lib/gate-config.mjs) — human review required')).toBe(REVIEW_REASONS.GATE_SELF);
    expect(canonicalizeReason('owed-reason (scripts/lib/gate-config.mjs) — human review required')).toBeNull();
  });
});
