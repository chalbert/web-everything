/**
 * @file pr-status.test.mjs — #xewnork: did a check actually RUN on the head that is there now?
 *
 * THE PROPERTY UNDER TEST IS THAT `unchecked` NEVER SOFTENS. Every other state is easy; this one is the
 * reason the file exists. PRs #1510 and #1511 sat for twelve hours holding zero check runs while a `checking`
 * label asserted otherwise, and every plausible bug here — folding empty into `pending`, treating a skipped
 * suite as green, reading a superseded commit's marks — turns that stall back into something that looks
 * normal. So the tests below are mostly about refusing to be reassured.
 */
import { describe, it, expect } from 'vitest';

import {
  prStatusOperation, reduceCheckState, labelDisagreements, shapeReadFinding, assessPrs,
  PR_STATUS_OP, CHECK_STATES, LABEL_CLAIMS, FAILING_CONCLUSIONS,
} from '../pr-status.mjs';
import { listArgv, checksArgv, parseJsonLines, labelNames, createPrReader, LIST_LIMIT } from '../pr-status-io.mjs';

const done = (conclusion, name = 'test') => ({ name, status: 'completed', conclusion });
const running = (name = 'test') => ({ name, status: 'in_progress', conclusion: null });

describe('reduceCheckState — the empty list is the whole point', () => {
  it('reports `unchecked` for zero check runs, and says why', () => {
    // The live case. `total_count: 0` for twelve hours on two PRs, read by everyone as "still building".
    const r = reduceCheckState([]);
    expect(r.state).toBe('unchecked');
    expect(r.why).toMatch(/no check run exists for this head/);
    expect(r.counts.total).toBe(0);
  });

  it('does NOT fold `unchecked` into `pending` — they are different facts', () => {
    expect(reduceCheckState([]).state).not.toBe('pending');
    expect(reduceCheckState([running()]).state).toBe('pending');
  });

  it('a completed check with NO readable conclusion is unchecked, never green', () => {
    // Absence of evidence is not evidence of absence — the same line `verify` draws around `unrun`.
    for (const c of [null, '', 'something_new']) {
      expect(reduceCheckState([done(c)]).state).toBe('unchecked');
    }
  });

  it('a suite that only skipped gated nothing, so it is unchecked', () => {
    expect(reduceCheckState([done('skipped'), done('neutral')]).state).toBe('unchecked');
  });

  it('green requires at least one check that actually succeeded', () => {
    expect(reduceCheckState([done('success')]).state).toBe('green');
    expect(reduceCheckState([done('success'), done('skipped')]).state).toBe('green');
  });

  it('pending outranks failure outranks success — a caller acts on the worst thing still true', () => {
    // One job still running is not green however many siblings passed.
    expect(reduceCheckState([done('success'), done('failure'), running()]).state).toBe('pending');
    expect(reduceCheckState([done('success'), done('failure')]).state).toBe('red');
    expect(reduceCheckState([done('success'), done('success')]).state).toBe('green');
  });

  it('treats every failing conclusion as red, not just `failure`', () => {
    for (const c of ['failure', 'timed_out', 'cancelled', 'action_required', 'stale']) {
      expect(reduceCheckState([done(c)]).state).toBe('red');
    }
  });

  it('only ever answers with a declared state', () => {
    const inputs = [[], [running()], [done('success')], [done('failure')], [done('skipped')], [done(null)]];
    for (const i of inputs) expect(CHECK_STATES).toContain(reduceCheckState(i).state);
  });
});

describe('labelDisagreements — the pair that made a stall look normal', () => {
  it('flags `checking` beside zero check runs', () => {
    const d = labelDisagreements({ labels: ['checking'], state: 'unchecked' });
    expect(d).toHaveLength(1);
    expect(d[0].why).toMatch(/DO NOT EXIST for this head/);
  });

  it('flags `ready-to-merge` on anything but green — the drain acts on that label', () => {
    for (const state of ['unchecked', 'red', 'pending']) {
      expect(labelDisagreements({ labels: ['ready-to-merge'], state })).toHaveLength(1);
    }
    expect(labelDisagreements({ labels: ['ready-to-merge'], state: 'green' })).toEqual([]);
  });

  it('says nothing when the label agrees', () => {
    // Without this, "always flag" passes both tests above.
    expect(labelDisagreements({ labels: ['checking'], state: 'pending' })).toEqual([]);
    expect(labelDisagreements({ labels: ['checking'], state: 'green' })).toEqual([]);
  });

  it('judges ONLY labels that make a claim about checks', () => {
    // A `review:*` label claims something about a REVIEW. Reporting it here would be this operation
    // answering a question it does not own (#2644).
    expect(labelDisagreements({ labels: ['review:pending', 'review:accepted', 'lane'], state: 'unchecked' })).toEqual([]);
    expect(Object.keys(LABEL_CLAIMS).sort()).toEqual(['checking', 'ready-to-merge']);
  });
});

describe('shapeReadFinding — an unreadable result is not "no open PRs"', () => {
  it('refuses a non-list result rather than reporting an empty repo', () => {
    for (const raw of [null, {}, { prs: 'nope' }]) {
      expect(() => shapeReadFinding(raw)).toThrow(/must return .*prs/);
    }
  });

  it('refuses a PR with no headSha — every state here is a claim about one commit', () => {
    expect(() => shapeReadFinding({ prs: [{ number: 1, headSha: '' }] })).toThrow(/no `headSha`/);
  });

  it('refuses a PR with no usable number', () => {
    expect(() => shapeReadFinding({ prs: [{ headSha: 'abc' }] })).toThrow(/no usable `number`/);
  });

  it('accepts a genuinely empty open-PR list — that IS an answer', () => {
    expect(shapeReadFinding({ repo: 'o/r', prs: [] })).toEqual({ repo: 'o/r', prs: [], truncated: false });
  });
});

describe('assessPrs — what a caller should look at, worst-understood first', () => {
  const pr = (number, checks, labels = []) => ({ number, headSha: `${number}aaaaaaa`, title: 't', labels, mergeable: 'mergeable', checks });

  it('orders blocking as unchecked → red → label-disagrees', () => {
    // A PR nothing has checked outranks one whose checks failed: the failure is at least known, and someone
    // can act on it. The silently unchecked one is what costs twelve hours.
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', prs: [
      pr(2, [done('failure')]),
      pr(1, []),
      pr(3, [done('success')], ['ready-to-merge']),
    ] }));
    expect(v.blocking.map((b) => b.why)).toEqual(['unchecked', 'red']);
    expect(v.blocking[0].pr).toBe(1);
  });

  it('counts each state, and reports the head sha beside the finding', () => {
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', prs: [pr(1, []), pr(2, [done('success')]), pr(3, [running()])] }));
    expect({ open: v.open, green: v.green, pending: v.pending, red: v.red, unchecked: v.unchecked })
      .toEqual({ open: 3, green: 1, pending: 1, red: 0, unchecked: 1 });
    expect(v.blocking[0].detail).toMatch(/^1aaaaaaa/);
  });

  it('reproduces the #1510/#1511 shape end to end', () => {
    // `checking` beside zero runs: the state is unchecked AND the label is called out, because either alone
    // is what let this read as normal.
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', prs: [pr(1510, [], ['checking', 'review:accepted'])] }));
    expect(v.prs[0].state).toBe('unchecked');
    expect(v.blocking.map((b) => b.why)).toEqual(['unchecked', 'label-disagrees']);
  });

  it('marks an empty repo explicitly rather than leaving silence to be read as green', () => {
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', prs: [] }));
    expect(v.noOpenPrs).toBe(true);
    expect(v.blocking).toEqual([]);
  });

  it('a fully green repo blocks on nothing', () => {
    // The positive that stops "always block" passing everything above.
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', prs: [pr(1, [done('success')]), pr(2, [done('success')], ['ready-to-merge'])] }));
    expect(v.blocking).toEqual([]);
    expect(v.noOpenPrs).toBeUndefined();
  });
});

describe('the io shell', () => {
  it('asks for headRefOid — without it every PR is unassessable', () => {
    expect(listArgv({ repo: 'o/r' }).join(' ')).toContain('headRefOid');
    expect(listArgv({ repo: 'o/r', pr: 7 })).toEqual(
      ['pr', 'view', '7', '--repo', 'o/r', '--json', 'number,title,labels,mergeable,headRefOid'],
    );
  });

  it('keys checks to the SHA, not the PR number', () => {
    // `gh pr checks <n>` will report a run recorded against a SUPERSEDED commit — the exact reading that let
    // two PRs display green marks belonging to commits that were no longer their heads.
    const argv = checksArgv({ repo: 'o/r', sha: 'deadbeef' });
    expect(argv.join(' ')).toContain('repos/o/r/commits/deadbeef/check-runs');
    expect(argv.join(' ')).not.toMatch(/pr checks/);
  });

  it('parses newline-delimited json, and reads a blank stream as zero checks', () => {
    expect(parseJsonLines('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseJsonLines('')).toEqual([]);
  });

  it('normalizes gh label objects and bare strings alike', () => {
    expect(labelNames([{ name: 'checking' }, 'lane', { name: '' }, null])).toEqual(['checking', 'lane']);
  });

  it('THROWS when the check fetch fails instead of yielding an empty list', () => {
    // The most important line in the io shell. An empty check list is read as `unchecked` — a real,
    // actionable alarm — so a network error that produced one would manufacture the very finding this
    // operation exists to raise, and a false `unchecked` teaches people to ignore a true one.
    const read = createPrReader({ run: (_bin, argv) => {
      if (argv[0] === 'pr') return JSON.stringify([{ number: 1, title: 't', labels: [], mergeable: 'MERGEABLE', headRefOid: 'abc123' }]);
      throw new Error('gh: network unreachable');
    } });
    expect(() => read({ repo: 'o/r' })).toThrow(/network unreachable/);
  });

  it('reads a PR and its head-keyed checks through one injected runner', () => {
    const seen = [];
    const read = createPrReader({ run: (_bin, argv) => {
      seen.push(argv.join(' '));
      if (argv[0] === 'pr') return JSON.stringify([{ number: 9, title: 't', labels: [{ name: 'checking' }], mergeable: 'MERGEABLE', headRefOid: 'abc123' }]);
      return '{"name":"test","status":"completed","conclusion":"success"}\n';
    } });
    const out = read({ repo: 'o/r' });
    expect(out.prs[0]).toMatchObject({ number: 9, headSha: 'abc123', labels: ['checking'], mergeable: 'mergeable' });
    expect(seen[1]).toContain('commits/abc123/check-runs');
  });
});

// ── THE TWO CARVE-OUTS PR #1521's JUROR CONFIRMED ────────────────────────────────────────────────────────
describe('startup_failure is a check that RAN and failed (#1521 juror)', () => {
  it('reports red, not unchecked', () => {
    // Omitting it sent this case to `unreadable`, which reports `unchecked`. The direction matters: `red`
    // says "someone broke something, go look"; `unchecked` says "nothing has been asked yet". A broken
    // workflow file yields `startup_failure` on EVERY run, so the whole PR would have read as never checked
    // rather than as reliably failing.
    expect(reduceCheckState([done('startup_failure')]).state).toBe('red');
    expect(FAILING_CONCLUSIONS).toContain('startup_failure');
  });

  it('still refuses to guess at a conclusion it genuinely does not know', () => {
    // The list must not become a catch-all: an unrecognised value is still `unchecked`, never `red` and
    // never `green`. Widening it to "anything that is not success" would be the opposite error.
    expect(reduceCheckState([done('a_conclusion_github_adds_in_2027')]).state).toBe('unchecked');
  });
});

describe('the list cap is REPORTED, not silent (#1521 juror)', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ number: i + 1, title: 't', labels: [], mergeable: 'MERGEABLE', headRefOid: `sha${i}` }));
  const readerFor = (n) => createPrReader({ run: (_bin, argv) => (argv[0] === 'pr' ? JSON.stringify(rows(n)) : '') });

  it('marks a FULL listing as truncated — the honest answer is "I cannot tell"', () => {
    // This operation exists so silence does not read as absence, and the first cut silently dropped every PR
    // past the 100th from a report whose whole purpose is noticing a PR nobody is looking at. `gh` does not
    // say whether more existed, so neither may this.
    expect(readerFor(LIST_LIMIT)({ repo: 'o/r' }).truncated).toBe(true);
  });

  it('does NOT cry truncation on a short listing', () => {
    // Without this, "always truncated" passes the test above and the flag means nothing.
    expect(readerFor(3)({ repo: 'o/r' }).truncated).toBe(false);
  });

  it('never marks a single-PR read as truncated — there was nothing to cap', () => {
    const read = createPrReader({ run: (_bin, argv) => (argv[0] === 'pr' ? JSON.stringify(rows(1)[0]) : '') });
    expect(read({ repo: 'o/r', pr: 1 }).truncated).toBe(false);
  });

  it('carries truncation into the verdict, where a caller will see it', () => {
    // A flag the reader sets and the verdict drops is the same silence one layer along.
    const v = assessPrs(shapeReadFinding({ repo: 'o/r', truncated: true, prs: [] }));
    expect(v.truncated).toBe(true);
    expect(assessPrs(shapeReadFinding({ repo: 'o/r', prs: [] })).truncated).toBeUndefined();
  });

  it('asks for the raised limit', () => {
    expect(listArgv({ repo: 'o/r' })).toContain(String(LIST_LIMIT));
  });
});

describe('the declaration', () => {
  it('derives its command line and refuses a missing reader', () => {
    expect(() => prStatusOperation({})).toThrow(/needs a `readPrs\(\)` reader/);
    const decl = prStatusOperation({ readPrs: () => ({ repo: 'o/r', prs: [] }) });
    expect(decl.name).toBe(PR_STATUS_OP);
    expect(Object.keys(decl.input)).toEqual(['repo', 'pr']);
    expect(decl.input.repo.required).toBe(true);
  });

  it('is READ-ONLY — both steps are compute, so no effect exists for a sink to apply', () => {
    const decl = prStatusOperation({ readPrs: () => ({ repo: 'o/r', prs: [] }) });
    expect(decl.steps.map((s) => s.step.kind)).toEqual(['compute', 'compute']);
  });

  it('the `read` step threads BOTH inputs into the reader, and declares both reads', () => {
    // The engine projects only declared reads, so a field missing from `reads` arrives `undefined` however
    // the caller called it — PR #1516's round-1 finding, pinned here in advance.
    let seen = null;
    const decl = prStatusOperation({ readPrs: (a) => { seen = a; return { repo: 'o/r', prs: [] }; } });
    const readStep = decl.steps.find((s) => s.name === 'read').step;
    for (const r of ['input.repo', 'input.pr']) expect(readStep.reads).toContain(r);
    readStep.fn({ input: { repo: 'o/r', pr: 42 } });
    expect(seen).toEqual({ repo: 'o/r', pr: 42 });
  });
});
