/**
 * @file auto-land-seam.test.mjs — proof of the #2675 SEAM that ACTS on a clean auto-dispose intent, defaulting to
 *   SHADOW mode. Covers: the pure `decideAutoLand` decider (shadow = observe-only, no write; enforce = write the
 *   accept swap; keep-parked = never landed in EITHER mode; a refused/malformed swap fails closed; an unknown mode
 *   normalizes to shadow); the thin `applyAutoLand` applier (emits the observation always; invokes the writer ONLY
 *   on apply; catches a write error → fail-closed, landed:false, never throws); and the end-to-end `runAutoLandSeam`
 *   (a clean ledger under the DEFAULT config observes-only in shadow, writes in enforce, and a red-refuted/gate-self
 *   ledger is never landed). Pure core + injected writer — no real gh/network I/O.
 *
 *   #2844 — SAFETY RAIL 4, the SELF-CLEAR refusal, is proved ADVERSARIALLY and through the REAL seam: the
 *   `applyAutoLand` / `runAutoLandSeam` cases below drive an author trying to clear its own verdict all the way
 *   to the injected label writer and assert the writer is NEVER reached. A predicate-only assertion on
 *   `decideClearerIndependence` would not have caught a seam that computed the verdict and then wrote anyway,
 *   which is exactly how a sibling bug shipped; the decider cases here are supplementary, not the proof.
 */
import { describe, it, expect, vi } from 'vitest';
import { decideAutoLand, applyAutoLand, runAutoLandSeam, buildSetLabelArgs, LAND_MODES } from '../auto-land-seam.mjs';
import { decideDispositionLabel, LAND_ACTIONS } from '../disposition-land-seam.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { REVIEW_LABELS } from '../review-escalation.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';
import { INDEPENDENCE } from '../review-independence.mjs';

// --- #2844 actor fixtures --------------------------------------------------------------------------------------
// Two DISTINCT harness session ids: the actor that opened the PR, and an independent actor clearing it. Every
// case that expects a WRITE must pass both — a clear with no provable independence is refused (SAFETY RAIL 4).
const AUTHOR = 'session-author-3f9c';
const REVIEWER = 'session-reviewer-a71b';
/** The independence-satisfying pair, spread into a seam call that is expected to reach the accept write. */
const INDEPENDENT = { authorId: AUTHOR, clearerId: REVIEWER };
/** The ADVERSARIAL pair — the author wearing the reviewer hat, clearing its own verdict. */
const SELF = { authorId: AUTHOR, clearerId: AUTHOR };

// --- ledger builders (mirrors disposition-land-seam.test.mjs) --------------------------------------------------
const CHARTER = 'judge';
function rosterEvent(jurors, round = 0) { return { type: 'roster-picked', round, jurors }; }
function verdictEvent(jurorId, verdict, round = 0) { return { type: 'verdict', round, jurorId, verdict }; }

/** A ledger with ONE juror per lens (thin — a red-judge thin-jury refute ground), each returning `verdict`. */
function singleJurorLedger(lenses, verdict = VERDICTS.ACCEPT) {
  const jurors = lenses.map((lens) => ({ id: `${lens}#1`, lens, charter: CHARTER }));
  return [rosterEvent(jurors), ...lenses.map((lens) => verdictEvent(`${lens}#1`, verdict))];
}

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting — the clean-winner auto-dispose case. */
function cleanDiverseLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, VERDICTS.ACCEPT));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

const DEFAULT_CONFIG = resolveDispositionConfig(); // landMode: shadow (the ratified default)
const CLEAR_INTENT = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
const PARKED_INTENT = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { gateSelf: true } });

describe('LAND_MODES enum', () => {
  it('names exactly the two modes, frozen', () => {
    expect(LAND_MODES).toEqual({ SHADOW: 'shadow', ENFORCE: 'enforce' });
    expect(Object.isFrozen(LAND_MODES)).toBe(true);
  });
});

describe('decideAutoLand — SHADOW (the default): observe a clean auto-dispose, write NOTHING', () => {
  it('a clean CLEAR intent in shadow yields apply:false + a WOULD-write observation', () => {
    const plan = decideAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.SHADOW, ...INDEPENDENT });
    expect(CLEAR_INTENT.action).toBe(LAND_ACTIONS.CLEAR); // precondition — the ledger did auto-dispose
    expect(plan.mode).toBe(LAND_MODES.SHADOW);
    expect(plan.apply).toBe(false);
    expect(plan.setLabel).toBeNull();
    expect(plan.observation).toMatch(/SHADOW/);
    expect(plan.observation).toMatch(/WOULD/i);
  });

  it('an UNKNOWN / absent mode normalizes to shadow — auto-landing is never enabled by accident (fail-closed)', () => {
    for (const mode of [undefined, null, '', 'ENFORCE', 'enforced', 'on', 'true']) {
      const plan = decideAutoLand({ intent: CLEAR_INTENT, mode, ...INDEPENDENT });
      expect(plan.mode).toBe(LAND_MODES.SHADOW);
      expect(plan.apply).toBe(false);
    }
  });
});

describe('decideAutoLand — ENFORCE: a clean auto-dispose writes review:accepted', () => {
  it('a clean CLEAR intent in enforce yields apply:true + the accept swap', () => {
    const plan = decideAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, ...INDEPENDENT });
    expect(plan.mode).toBe(LAND_MODES.ENFORCE);
    expect(plan.apply).toBe(true);
    expect(plan.setLabel).toBe(CLEAR_INTENT.setLabel);
    expect(plan.setLabel.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(plan.observation).toMatch(/ENFORCE/);
  });
});

describe('decideAutoLand — safety rail: a KEEP-PARKED intent is NEVER landed, in EITHER mode', () => {
  it('gate-self (keep-parked) never applies, in shadow OR enforce', () => {
    expect(PARKED_INTENT.action).toBe(LAND_ACTIONS.KEEP_PARKED); // precondition
    for (const mode of [LAND_MODES.SHADOW, LAND_MODES.ENFORCE]) {
      const plan = decideAutoLand({ intent: PARKED_INTENT, mode });
      expect(plan.apply).toBe(false);
      expect(plan.setLabel).toBeNull();
      expect(plan.observation).toMatch(/keep-parked/);
    }
  });

  it('a red-REFUTED thin-jury auto-dispose is kept parked upstream → never landed even in enforce', () => {
    const intent = decideDispositionLabel({ ledger: singleJurorLedger(MANDATORY_LENSES), config: DEFAULT_CONFIG });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(decideAutoLand({ intent, mode: LAND_MODES.ENFORCE }).apply).toBe(false);
  });
});

describe('decideAutoLand — fail-closed on a bad / refused intent', () => {
  it('a malformed intent yields observe-only, never a write (even in enforce)', () => {
    for (const bad of [undefined, null, {}, { action: 42 }]) {
      const plan = decideAutoLand({ intent: bad, mode: LAND_MODES.ENFORCE });
      expect(plan.apply).toBe(false);
    }
  });

  it('a CLEAR intent whose accept swap is not allowed is refused (fail-closed) even in enforce', () => {
    const refused = { action: LAND_ACTIONS.CLEAR, reason: 'x', setLabel: { allowed: false, addLabel: '', removeLabels: [] } };
    const plan = decideAutoLand({ intent: refused, mode: LAND_MODES.ENFORCE });
    expect(plan.apply).toBe(false);
    expect(plan.reason).toBe('refused-accept');
  });

  it('a CLEAR intent whose swap adds the WRONG label (not review:accepted) is refused, even in enforce', () => {
    const wrong = { action: LAND_ACTIONS.CLEAR, reason: 'x', setLabel: { allowed: true, addLabel: REVIEW_LABELS.human, removeLabels: [] } };
    expect(decideAutoLand({ intent: wrong, mode: LAND_MODES.ENFORCE }).apply).toBe(false);
  });
});

describe('applyAutoLand — the thin applier emits the observation + acts only on apply', () => {
  it('shadow: logs the observation, invokes the writer NOT at all, returns landed:false', () => {
    const writeAccept = vi.fn();
    const log = vi.fn();
    const res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.SHADOW, pr: 7, repo: 'o/r', ...INDEPENDENT }, { writeAccept, log });
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/SHADOW/));
  });

  it('enforce: invokes the writer once with the PR + repo, returns landed:true', () => {
    const writeAccept = vi.fn();
    const log = vi.fn();
    const res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r', ...INDEPENDENT }, { writeAccept, log });
    expect(res.landed).toBe(true);
    expect(writeAccept).toHaveBeenCalledTimes(1);
    expect(writeAccept).toHaveBeenCalledWith(expect.objectContaining({ pr: 7, repo: 'o/r' }));
  });

  it('enforce + a writer that THROWS → fail-closed: landed:false, an error, and NEVER throws', () => {
    const writeAccept = vi.fn(() => { throw new Error('gh pr edit failed: INVARIANT 2'); });
    const log = vi.fn();
    let res;
    expect(() => { res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r', ...INDEPENDENT }, { writeAccept, log }); }).not.toThrow();
    expect(res.landed).toBe(false);
    expect(res.error).toMatch(/INVARIANT 2/);
  });

  it('keep-parked: never invokes the writer, even in enforce', () => {
    const writeAccept = vi.fn();
    const res = applyAutoLand({ intent: PARKED_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r' }, { writeAccept, log: () => {} });
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
  });
});

// ── #2844 · SAFETY RAIL 4 — the land seam REFUSES a self-cleared verdict ────────────────────────────────────────
// THE DECISIVE PROOF IS ADVERSARIAL AND GOES THROUGH THE REAL SEAM. Each case drives an author attempting to
// clear its OWN verdict into `applyAutoLand` / `runAutoLandSeam` — the same appliers the drain uses, with the
// real intent from the real disposition judge — and asserts the INJECTED LABEL WRITER IS NEVER INVOKED. Asserting
// only that a predicate returns false would pass even against a seam that computed the refusal and then wrote
// `review:accepted` regardless, which is the shape of bug this suite exists to exclude.
describe('#2844 — the land seam REFUSES a self-cleared verdict (adversarial, through the real seam)', () => {
  it('ADVERSARIAL: the author clearing its OWN clean verdict in ENFORCE never reaches the label writer', () => {
    const writeAccept = vi.fn();
    const log = vi.fn();
    // Precondition: this is a genuinely clean auto-dispose — the ONLY thing wrong is who is clearing it.
    expect(CLEAR_INTENT.action).toBe(LAND_ACTIONS.CLEAR);
    expect(CLEAR_INTENT.setLabel.allowed).toBe(true);

    const res = applyAutoLand(
      { intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r', ...SELF },
      { writeAccept, log },
    );

    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();     // the accept was never WRITTEN — the whole point
    expect(res.plan.apply).toBe(false);
    expect(res.plan.setLabel).toBeNull();
    expect(res.plan.reason).toContain(INDEPENDENCE.SELF_CLEAR);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/REFUSED/));
  });

  // `landMode` is GLOBAL-only (#2675 — `resolveDispositionConfig` refuses to merge it from a band/override), so
  // an ENFORCE end-to-end run drives the REAL judge on a REAL ledger and hands its intent to the REAL applier —
  // the same two calls `runAutoLandSeam` composes, with only the un-overridable mode supplied directly.
  const enforceEndToEnd = (ids) => {
    const writeAccept = vi.fn();
    const intent = decideDispositionLabel({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    const res = applyAutoLand(
      { intent, mode: LAND_MODES.ENFORCE, pr: 9, repo: 'o/r', ...ids },
      { writeAccept, log: () => {} },
    );
    return { intent, res, writeAccept };
  };

  it('ADVERSARIAL end-to-end: a clean LEDGER self-cleared in enforce is never landed', () => {
    const { intent, res, writeAccept } = enforceEndToEnd(SELF);
    // The JUDGE still says clear — the refusal is the seam's, layered on top of a clean disposition.
    expect(intent.action).toBe(LAND_ACTIONS.CLEAR);
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
    expect(res.plan.reason).toContain(INDEPENDENCE.SELF_CLEAR);
  });

  it('the same clean ledger cleared by a DIFFERENT actor in enforce DOES land — the rail is not a blanket refusal', () => {
    const { res, writeAccept } = enforceEndToEnd(INDEPENDENT);
    expect(res.landed).toBe(true);
    expect(writeAccept).toHaveBeenCalledTimes(1);
  });

  it('runAutoLandSeam under the DEFAULT (shadow) config records the self-clear refusal end-to-end', () => {
    const writeAccept = vi.fn();
    const res = runAutoLandSeam({ ledger: cleanDiverseLedger(), pr: 9, repo: 'o/r', ...SELF }, { writeAccept, log: () => {} });
    expect(res.intent.action).toBe(LAND_ACTIONS.CLEAR);
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
    expect(res.plan.reason).toContain(INDEPENDENCE.SELF_CLEAR);
  });

  it('FAIL-CLOSED: an UNPROVEN clearance (no author stamp, or no actor id) is refused just like a self-clear', () => {
    for (const [ids, status] of [
      [{ authorId: '', clearerId: REVIEWER }, INDEPENDENCE.UNKNOWN_AUTHOR],
      [{ authorId: AUTHOR, clearerId: '' }, INDEPENDENCE.UNKNOWN_CLEARER],
      [{}, INDEPENDENCE.UNKNOWN_CLEARER],
    ]) {
      const writeAccept = vi.fn();
      const res = applyAutoLand(
        // `clearerId: ''` is passed EXPLICITLY so the applier does not fall back to this test process's own
        // CLAUDE_CODE_SESSION_ID — the assertion must not depend on the harness the suite happens to run under.
        { intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r', clearerId: '', ...ids },
        { writeAccept, log: () => {} },
      );
      expect(res.landed).toBe(false);
      expect(writeAccept).not.toHaveBeenCalled();
      expect(res.plan.reason).toContain(status);
    }
  });

  it('SHADOW models the refusal too — a self-clear shadow line says REFUSED, never "WOULD write"', () => {
    // Shadow is the dry run of enforce. A shadow record claiming it WOULD write an accept that enforce would
    // refuse is false confidence, and the observation period exists to build real confidence.
    const plan = decideAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.SHADOW, ...SELF });
    expect(plan.apply).toBe(false);
    expect(plan.observation).toMatch(/REFUSED/);
    expect(plan.observation).not.toMatch(/WOULD write/);
  });

  it('the accept-swap refusal still wins over the independence refusal — reason ordering is stable', () => {
    // A malformed swap is a deeper failure than a self-clear; keeping `refused-accept` as the reported reason
    // means an operator reading the ledger sees the FIRST thing that was wrong, not the last ring to fire.
    const refused = { action: LAND_ACTIONS.CLEAR, reason: 'x', setLabel: { allowed: false, addLabel: '', removeLabels: [] } };
    expect(decideAutoLand({ intent: refused, mode: LAND_MODES.ENFORCE, ...SELF }).reason).toBe('refused-accept');
  });
});

describe('buildSetLabelArgs — the accept-write argv uses the =-joined flag form review-set-label.mjs parses', () => {
  it('emits the PR positional + =-joined --repo/--to/--actor (NOT space-separated, which the CLI would reject)', () => {
    const argv = buildSetLabelArgs({ pr: 42, repo: 'owner/name' });
    // The PR is a bare integer positional (the CLI matches the first /^\d+$/ arg).
    expect(argv[0]).toBe('42');
    // Every flag MUST be =-joined — the CLI parses only args.startsWith('--repo=') etc.
    expect(argv).toContain('--repo=owner/name');
    expect(argv).toContain('--to=accepted');
    expect(argv.some((a) => a.startsWith('--actor='))).toBe(true);
    // No bare space-separated flag token may appear (that form silently fails the CLI's validation).
    expect(argv).not.toContain('--repo');
    expect(argv).not.toContain('--to');
  });
});

describe('runAutoLandSeam — end-to-end (ledger → resolved config → intent → action)', () => {
  it('a clean ledger under the DEFAULT config (shadow) observes only — writes nothing', () => {
    const writeAccept = vi.fn();
    const res = runAutoLandSeam({ ledger: cleanDiverseLedger(), pr: 9, repo: 'o/r', ...INDEPENDENT }, { writeAccept, log: () => {} });
    expect(res.intent.action).toBe(LAND_ACTIONS.CLEAR);
    expect(res.landed).toBe(false); // shadow default
    expect(writeAccept).not.toHaveBeenCalled();
  });

  it('a gate-self ledger is never landed (safety rail) even were the mode enforce', () => {
    const writeAccept = vi.fn();
    const res = runAutoLandSeam({ ledger: cleanDiverseLedger(), signals: { gateSelf: true }, pr: 9, repo: 'o/r' }, { writeAccept, log: () => {} });
    expect(res.intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
  });

  it('a review:human PR is never laundered to accepted — the clean ledger is kept parked (INVARIANT 2)', () => {
    const writeAccept = vi.fn();
    const res = runAutoLandSeam({ ledger: cleanDiverseLedger(), currentLabels: [REVIEW_LABELS.human], pr: 9, repo: 'o/r' }, { writeAccept, log: () => {} });
    expect(res.intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
  });

  it('a bad band/override throw is caught at the outer boundary — fail-closed, never escapes (INVARIANT 4)', () => {
    const writeAccept = vi.fn();
    let res;
    expect(() => {
      res = runAutoLandSeam({ ledger: cleanDiverseLedger(), band: 'nope', pr: 9, repo: 'o/r' }, { writeAccept, log: () => {} });
    }).not.toThrow();
    expect(res.landed).toBe(false);
    expect(res.error).toMatch(/care band/);
    expect(writeAccept).not.toHaveBeenCalled();
  });
});
