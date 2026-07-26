/**
 * @file auto-land-seam.test.mjs — proof of the #2675 SEAM that ACTS on a clean auto-dispose intent, defaulting to
 *   SHADOW mode. Covers: the pure `decideAutoLand` decider (shadow = observe-only, no write; enforce = write the
 *   accept swap; keep-parked = never landed in EITHER mode; a refused/malformed swap fails closed; an unknown mode
 *   normalizes to shadow); the thin `applyAutoLand` applier (emits the observation always; invokes the writer ONLY
 *   on apply; catches a write error → fail-closed, landed:false, never throws); and the end-to-end `runAutoLandSeam`
 *   (a clean ledger under the DEFAULT config observes-only in shadow, writes in enforce, and a red-refuted/gate-self
 *   ledger is never landed). Pure core + injected writer — no real gh/network I/O.
 */
import { describe, it, expect, vi } from 'vitest';
import { decideAutoLand, applyAutoLand, runAutoLandSeam, buildSetLabelArgs, LAND_MODES } from '../auto-land-seam.mjs';
import { decideDispositionLabel, LAND_ACTIONS } from '../disposition-land-seam.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { REVIEW_LABELS } from '../review-escalation.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';

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
    const plan = decideAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.SHADOW });
    expect(CLEAR_INTENT.action).toBe(LAND_ACTIONS.CLEAR); // precondition — the ledger did auto-dispose
    expect(plan.mode).toBe(LAND_MODES.SHADOW);
    expect(plan.apply).toBe(false);
    expect(plan.setLabel).toBeNull();
    expect(plan.observation).toMatch(/SHADOW/);
    expect(plan.observation).toMatch(/WOULD/i);
  });

  it('an UNKNOWN / absent mode normalizes to shadow — auto-landing is never enabled by accident (fail-closed)', () => {
    for (const mode of [undefined, null, '', 'ENFORCE', 'enforced', 'on', 'true']) {
      const plan = decideAutoLand({ intent: CLEAR_INTENT, mode });
      expect(plan.mode).toBe(LAND_MODES.SHADOW);
      expect(plan.apply).toBe(false);
    }
  });
});

describe('decideAutoLand — ENFORCE: a clean auto-dispose writes review:accepted', () => {
  it('a clean CLEAR intent in enforce yields apply:true + the accept swap', () => {
    const plan = decideAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE });
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
    const res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.SHADOW, pr: 7, repo: 'o/r' }, { writeAccept, log });
    expect(res.landed).toBe(false);
    expect(writeAccept).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/SHADOW/));
  });

  it('enforce: invokes the writer once with the PR + repo, returns landed:true', () => {
    const writeAccept = vi.fn();
    const log = vi.fn();
    const res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r' }, { writeAccept, log });
    expect(res.landed).toBe(true);
    expect(writeAccept).toHaveBeenCalledTimes(1);
    expect(writeAccept).toHaveBeenCalledWith(expect.objectContaining({ pr: 7, repo: 'o/r' }));
  });

  it('enforce + a writer that THROWS → fail-closed: landed:false, an error, and NEVER throws', () => {
    const writeAccept = vi.fn(() => { throw new Error('gh pr edit failed: INVARIANT 2'); });
    const log = vi.fn();
    let res;
    expect(() => { res = applyAutoLand({ intent: CLEAR_INTENT, mode: LAND_MODES.ENFORCE, pr: 7, repo: 'o/r' }, { writeAccept, log }); }).not.toThrow();
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
    const res = runAutoLandSeam({ ledger: cleanDiverseLedger(), pr: 9, repo: 'o/r' }, { writeAccept, log: () => {} });
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
