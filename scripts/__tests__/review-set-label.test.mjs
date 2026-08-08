/**
 * @file review-set-label.test.mjs — proof of the PURE `decideSetLabel` (#2470, increment 2). The `gh` calls are
 *   the I/O boundary (the CLI's concern); the verdict → label-swap decision — including INVARIANT 2 (a
 *   review:human PR is never cleared to accepted here) — is decided in the pure decider and unit-tested here
 *   against fixtures, no network.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideSetLabel, presentRemoveLabels, buildVerdictComment, stripReviewedShaMarkers,
  runReviewLabelCli, projectVerdictCommentLength, REVIEW_LABEL_TARGETS, GH_COMMENT_MAX,
} from '../review-set-label.mjs';
import { parseReviewedSha } from '../lib/review-escalation.mjs';
import { REVIEW_LABELS } from '../lib/review-escalation.mjs';

const human = [{ name: REVIEW_LABELS.human }, { name: 'ready-to-merge' }];
const pending = [{ name: REVIEW_LABELS.pending }, { name: 'ready-to-merge' }];
const accepted = [{ name: REVIEW_LABELS.accepted }, { name: 'ready-to-merge' }];
const neither = [{ name: 'ready-to-merge' }];

describe('decideSetLabel — INVARIANT 2 (review:human is human-ceremony-only)', () => {
  it('REFUSES accepted on a review:human PR (gate-self reason, no swap)', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: human });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('gate-self: review:human is human-ceremony-only — clear via /review in a session');
    expect(d.addLabel).toBe('');
    expect(d.removeLabels).toEqual([]);
  });
});

describe('decideSetLabel — accepted', () => {
  it('on a review:pending PR: adds review:accepted, removes review:pending (and the always-requested changes)', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: pending });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.changes]);
  });

  it('with neither human nor pending: still allowed (no human gate), adds review:accepted', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: neither });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.changes]);
  });

  // #2974 — the bug: accepting a bounced-but-fixed PR left BOTH review:accepted and review:changes on it, and
  // three consumers (lane-resume.mjs#land, pr-watch.mjs's PARK_LABELS/isReadyToLand, status-board.mjs) read
  // review:changes raw with no accepted-first ordering, so a self-contradictory pair looked like a live bounce
  // to every one of them. Observed live on PR #1064: labels after --to=accepted were
  // [ready-to-merge, review:accepted, review:changes].
  it('accepting a PR carrying review:changes drops BOTH review:changes and review:pending — neither survives', () => {
    const changesAndPending = [{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.pending }, { name: 'ready-to-merge' }];
    const d = decideSetLabel({ to: 'accepted', currentLabels: changesAndPending });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    const finalLabels = presentRemoveLabels(d.removeLabels, changesAndPending);
    expect(finalLabels).toContain(REVIEW_LABELS.changes);
    expect(finalLabels).toContain(REVIEW_LABELS.pending);
    // Simulate the resulting label set the way the CLI would apply it: the PR's current labels, minus the
    // narrowed removals, plus the added label. Neither 'changes' nor 'pending' survives.
    const current = changesAndPending.map((l) => l.name);
    const after = new Set([...current.filter((n) => !finalLabels.includes(n)), d.addLabel]);
    expect(after.has(REVIEW_LABELS.changes)).toBe(false);
    expect(after.has(REVIEW_LABELS.pending)).toBe(false);
    expect(after.has(REVIEW_LABELS.accepted)).toBe(true);
  });

  // #2974 — presentRemoveLabels already narrows removeLabels to what the PR actually carries, so requesting
  // `changes` in the removal set unconditionally must never hand `gh pr edit --remove-label` an absent label.
  it('requesting review:changes removal on a PR that never carried it narrows to nothing extra (no absent-label error)', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: pending });
    const removals = presentRemoveLabels(d.removeLabels, pending);
    expect(removals).toEqual([REVIEW_LABELS.pending]);
    expect(removals).not.toContain(REVIEW_LABELS.changes);
  });

  // The sibling invariant this item explicitly protects: adding review:changes to accepted's removals must not
  // have touched INVARIANT 2 — accepted stays refused on a review:human PR, unconditionally.
  it('still REFUSES on a review:human PR — INVARIANT 2 is unmoved by the #2974 fix', () => {
    const humanChanges = [{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.changes }];
    const d = decideSetLabel({ to: 'accepted', currentLabels: humanChanges });
    expect(d.allowed).toBe(false);
    expect(d.removeLabels).toEqual([]);
  });

  // accepted must still never remove review:human even when it drops changes+pending.
  it('never removes review:human on a non-human accept path (there is none to remove, but pin the shape)', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: pending });
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
  });
});

// #2974 — TOTALITY over REVIEW_LABEL_TARGETS × every starting label combination the four labels can form. Two
// invariants must hold for EVERY (target, starting-set) pair, not just the fixtures above: (1) review:human is
// NEVER removed unless the target IS clear-human, and (2) review:accepted and review:changes never coexist in
// the RESULTING label set (simulated the way the CLI actually applies a swap: current labels, minus the
// removals narrowed to what's present, plus the added label). This is what actually pins "accepted never
// returns ok:true while leaving accepted and changes together" — over the whole space, not one fixture.
describe('decideSetLabel — totality over REVIEW_LABEL_TARGETS × starting label sets (#2974)', () => {
  const ALL = [REVIEW_LABELS.human, REVIEW_LABELS.pending, REVIEW_LABELS.accepted, REVIEW_LABELS.changes];
  // Every subset of the four review labels (16 combinations, incl. empty), each plus a non-review label that
  // must never be touched by any swap.
  const powerset = (arr) => arr.reduce((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);
  const startingSets = powerset(ALL).map((names) => [...names, 'ready-to-merge']);

  for (const to of REVIEW_LABEL_TARGETS) {
    for (const names of startingSets) {
      const label = `to='${to}' starting=[${names.join(',')}]`;
      it(`${label} — never leaves review:accepted and review:changes together, and never drops human unless clear-human`, () => {
        const currentLabels = names.map((name) => ({ name }));
        const d = decideSetLabel({ to, currentLabels });
        // Sanity: a non-review label is never named in a decision's removals, whether allowed or refused.
        expect(d.removeLabels).not.toContain('ready-to-merge');
        if (!d.allowed) {
          // A refusal changes nothing — the resulting set IS the starting set.
          if (names.includes(REVIEW_LABELS.human)) expect(names).toContain(REVIEW_LABELS.human);
          return;
        }
        const removals = presentRemoveLabels(d.removeLabels, currentLabels);
        const after = new Set([...names.filter((n) => !removals.includes(n)), d.addLabel]);
        // (1) review:human survives every allowed swap except clear-human.
        if (names.includes(REVIEW_LABELS.human) && to !== 'clear-human') {
          expect(after.has(REVIEW_LABELS.human)).toBe(true);
        }
        if (to === 'clear-human') {
          expect(after.has(REVIEW_LABELS.human)).toBe(false);
        }
        // (2) THE #2974 INVARIANT: accepted and changes never coexist in the resulting set.
        expect(after.has(REVIEW_LABELS.accepted) && after.has(REVIEW_LABELS.changes)).toBe(false);
      });
    }
  }
});

describe('decideSetLabel — changes (a bounce lands nothing)', () => {
  it('on a review:human PR: allowed, adds review:changes, does NOT remove review:human', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: human });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.changes);
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
  });

  it('on a review:pending PR: allowed, adds review:changes, removes review:pending', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: pending });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.changes);
    expect(d.removeLabels).toContain(REVIEW_LABELS.pending);
  });

  it('strips a stale review:accepted (a bounce must never leave the PR looking accepted)', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: accepted });
    expect(d.allowed).toBe(true);
    expect(d.removeLabels).toContain(REVIEW_LABELS.accepted);
    // review:human is never in the removal set, even on the changes path.
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
  });
});

describe('decideSetLabel — rearm (#2644, folded in from the conveyor decideRearm)', () => {
  const changes = [{ name: REVIEW_LABELS.changes }, { name: 'ready-to-merge' }];
  const humanChanges = [{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.changes }];

  it('re-arms a review:changes bounce → review:pending, dropping review:changes', () => {
    const d = decideSetLabel({ to: 'rearm', currentLabels: changes });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]);
    expect(d.keepsHuman).toBe(false);
  });

  it('NEVER emits review:accepted and NEVER removes review:human (the #2630 invariant)', () => {
    const d = decideSetLabel({ to: 'rearm', currentLabels: humanChanges });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.addLabel).not.toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]);
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
    expect(d.keepsHuman).toBe(true);
  });

  it('refuses (idempotent no-op) when there is no review:changes to re-arm', () => {
    expect(decideSetLabel({ to: 'rearm', currentLabels: pending }).allowed).toBe(false);
    expect(decideSetLabel({ to: 'rearm', currentLabels: human }).allowed).toBe(false);
    expect(decideSetLabel({ to: 'rearm', currentLabels: [] }).allowed).toBe(false);
  });
});

// #2895 — the gate-self clearance target. The pair of invariants that matter: `clear-human` is the ONLY target
// that removes review:human, and adding it must not have loosened `accepted` (which stays refused on gate-self).
describe('decideSetLabel — clear-human (#2895, the ONE target that drops review:human)', () => {
  it('clears a gate-self PR: adds accepted, drops human + pending, keepsHuman false', () => {
    const d = decideSetLabel({ to: 'clear-human', currentLabels: human });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toContain(REVIEW_LABELS.human);
    expect(d.keepsHuman).toBe(false);
  });

  it('also drops a live review:changes — a cleared PR must not still read as a bounce', () => {
    const d = decideSetLabel({ to: 'clear-human', currentLabels: [...human, { name: REVIEW_LABELS.changes }] });
    expect(presentRemoveLabels(d.removeLabels, [...human, { name: REVIEW_LABELS.changes }]))
      .toEqual([REVIEW_LABELS.human, REVIEW_LABELS.changes]);
  });

  it('REFUSES on a PR with no review:human — it is not a backdoor accept for an ordinary parked PR', () => {
    const d = decideSetLabel({ to: 'clear-human', currentLabels: pending });
    expect(d.allowed).toBe(false);
    expect(d.addLabel).toBe('');
    expect(d.reason).toMatch(/no review:human/);
  });

  // The regression that would matter most: adding this target must not have made `accepted` clearable.
  it('did NOT loosen INVARIANT 2 — accepted is still refused on the very same gate-self PR', () => {
    expect(decideSetLabel({ to: 'accepted', currentLabels: human }).allowed).toBe(false);
  });

});

// #2895 — the `clear-human` PRECONDITIONS, asserted behaviourally. Two separate things are pinned here and it
// matters that they are not confused:
//   • the `allowClearHuman` opt-in — an ACCIDENT guard. A caller that did not ask for the target gets a clean
//     refusal instead of stumbling into it. It is NOT a trust boundary: it is an ordinary parameter, so an
//     importer that wants it passes it, and #2895 accepted that when it deferred the unforgeable actor signal.
//   • the HONESTY TAX — `--actor` and `--reason` are mandatory, so a clearance nobody authorised takes a
//     fabricated name and a fabricated quote rather than a silent label add. This is the mitigation that
//     replaces the missing signal, so its refusals are load-bearing, not cosmetic.
// Both refuse through the `{"error":…}` JSON contract and BEFORE the first `gh` call, so no network, no mocking.
describe('runReviewLabelCli — the clear-human preconditions (#2895)', () => {
  const CFG = {
    defaultActor: 'test',
    usage: 'usage: test',
    buildComment: () => 'unused',
    successResult: (o) => ({ ok: true, ...o }),
    refusalResult: ({ decision }) => ({ error: decision.reason }),
  };

  /** Run the harness with stdout + process.exit captured. Returns the parsed JSON payload and the exit code. */
  function runCli(cfg) {
    const chunks = [];
    const realWrite = process.stdout.write.bind(process.stdout);
    const realExit = process.exit.bind(process);
    process.stdout.write = (s) => { chunks.push(String(s)); return true; };
    process.exit = (code) => { const e = new Error('process.exit'); e.exitCode = code; throw e; };
    let exitCode = null;
    let threw = null;
    try { runReviewLabelCli({ ...CFG, ...cfg }); }
    catch (e) { if (typeof e.exitCode === 'number') exitCode = e.exitCode; else threw = e; }
    finally { process.stdout.write = realWrite; process.exit = realExit; }
    if (threw) throw threw;
    return { exitCode, payload: JSON.parse(chunks.join('') || '{}') };
  }

  it('a caller that did not opt in REFUSES through the JSON contract, and reaches no gh call', () => {
    const { exitCode, payload } = runCli({ argv: ['1048', '--repo=o/n', '--to=clear-human'] });
    expect(exitCode).not.toBe(0);
    expect(payload.error).toMatch(/did not opt in/);
  });

  // m1 — a caller PINNING the target skipped the `!fixedTo &&`-guarded validation entirely in the first cut and
  // blew up with a TypeError after `gh pr view`. Every clear-human precondition is checked at the point of use.
  it('a caller PINNING fixedTo:clear-human refuses too — not a TypeError, and not after a gh mutation', () => {
    const { exitCode, payload } = runCli({ argv: ['1048', '--repo=o/n'], fixedTo: 'clear-human' });
    expect(exitCode).not.toBe(0);
    expect(payload.error).toMatch(/did not opt in/);
  });

  // THE HONESTY TAX, refusal 1 of 2. The default actor must NOT satisfy it: the record has to name whoever
  // asked, and 'loop-console operator' names nobody.
  it('REFUSES an opted-in clear-human with no --actor — the default actor is not an answer', () => {
    const { exitCode, payload } = runCli({
      argv: ['1048', '--repo=o/n', '--to=clear-human', '--reason=operator said accept 1048'],
      allowClearHuman: true,
    });
    expect(exitCode).not.toBe(0);
    expect(payload.error).toMatch(/requires an explicit --actor/);
  });

  // THE HONESTY TAX, refusal 2 of 2. A blank/whitespace reason is the same as none — otherwise `--reason=` is a
  // one-character way to satisfy the thing whose whole purpose is that it has to be written out.
  it('REFUSES an opted-in clear-human with no stated reason, including a whitespace-only one', () => {
    for (const reasonArg of [[], ['--reason='], ['--reason=   ']]) {
      const { exitCode, payload } = runCli({
        argv: ['1048', '--repo=o/n', '--to=clear-human', '--actor=Nicolas Gilbert', ...reasonArg],
        allowClearHuman: true,
      });
      expect(exitCode).not.toBe(0);
      expect(payload.error).toMatch(/requires --reason/);
    }
  });

  it('the ordinary targets are unaffected — the opt-in gates clear-human only', () => {
    const { payload } = runCli({ argv: ['1048', '--repo=o/n', '--to=nonsense'] });
    expect(payload.error).toMatch(/invalid --to — expected 'accepted' or 'changes'/);
  });
});

describe('presentRemoveLabels — intersect the decision removals with the labels actually present', () => {
  it('a removeLabel NOT in currentLabels is not passed through (never handed to gh)', () => {
    // changes wants to drop [pending, accepted], but the PR only carries pending → accepted must not survive.
    const d = decideSetLabel({ to: 'changes', currentLabels: pending });
    const removals = presentRemoveLabels(d.removeLabels, pending);
    expect(removals).toEqual([REVIEW_LABELS.pending]);
    expect(removals).not.toContain(REVIEW_LABELS.accepted);
  });

  it('keeps only present labels when both are carried', () => {
    const carries = [{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }];
    const d = decideSetLabel({ to: 'changes', currentLabels: carries });
    expect(presentRemoveLabels(d.removeLabels, carries)).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.accepted]);
  });

  it('never intersects review:human into the removals on a bounce', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: human });
    expect(presentRemoveLabels(d.removeLabels, human)).not.toContain(REVIEW_LABELS.human);
  });
});

describe('decideSetLabel — bad input', () => {
  it('throws on an unknown verdict', () => {
    expect(() => decideSetLabel({ to: 'merge', currentLabels: neither })).toThrow();
    expect(() => decideSetLabel({ to: undefined, currentLabels: neither })).toThrow();
  });
});

describe('buildVerdictComment — the stamp must survive the REAL reader (#2882/#2409)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';
  const OLDER = '0123456789abcdef0123456789abcdef01234567';
  // Round-trip through the actual consumer, never a string-position assertion. The first cut of #2882 asserted
  // `indexOf(SHA) < indexOf(older)` and passed while being WRONG: parseReviewedSha is last-match-wins, so the
  // leading stamp lost to a quoted marker. Verifying producer and consumer independently is what hid it.
  const readBack = (comment) => parseReviewedSha([{ body: comment }]);

  it('round-trips to the stamped sha even when the body quotes an OLDER marker', () => {
    const comment = buildVerdictComment({
      to: 'accepted', actor: 'op', headSha: SHA,
      body: `re-accepting; the prior round covered <!-- reviewed-sha: ${OLDER} -->, the head only moved by rebase`,
    });
    expect(readBack(comment)).toBe(SHA);
  });

  it('round-trips when the body quotes SEVERAL markers, including one at the very end', () => {
    const comment = buildVerdictComment({
      to: 'accepted', actor: 'op', headSha: SHA,
      body: `first <!-- reviewed-sha: ${OLDER} --> and last <!-- reviewed-sha: ${'a'.repeat(40)} -->`,
    });
    expect(readBack(comment)).toBe(SHA);
  });

  it('neutralises quoted markers but keeps them READABLE — the write-up still says what it meant', () => {
    const out = stripReviewedShaMarkers(`prior round: <!-- reviewed-sha: ${OLDER} -->`);
    expect(out).toContain(OLDER);
    expect(out).not.toContain('<!--');
  });

  it('reads back nothing on a changes verdict, even with a quoted marker in the body', () => {
    const comment = buildVerdictComment({
      to: 'changes', actor: 'op', headSha: SHA, body: `see <!-- reviewed-sha: ${OLDER} -->`,
    });
    expect(readBack(comment)).toBe(null);
    expect(comment).toContain('🔁 review — changes requested');
  });

  it('stamps nothing (never a garbage marker) when the head SHA is unavailable', () => {
    expect(readBack(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: '' }))).toBe(null);
    expect(readBack(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: 'not-a-sha' }))).toBe(null);
  });

  it('includes the caller body, and stays the one-liner when none is passed', () => {
    const withBody = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA, body: '## Findings\n1 major' });
    expect(withBody).toContain('## Findings');
    expect(readBack(withBody)).toBe(SHA);
    const bare = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA });
    expect(bare).toContain('Recorded by op via the Plateau Loop review console.');
    expect(readBack(bare)).toBe(SHA);
  });
});

// PR #1056 review, M2 — ENUM TOTALITY over the label-swap target set. The `GH_COMMENT_MAX` pre-flight exists to
// guarantee the durable comment can actually POST before the label swap is applied, because the failure mode is
// the worst one this module has: label applied, comment rejected, PR left `review:accepted` with NO
// `reviewed-sha` marker — and `acceptanceCoversHead` fails OPEN on a missing marker, silently disarming the
// staleness gate. The first cut projected `to: 'accepted'` only, so a `clear-human` comment (a longer heading
// plus its attribution) was under-counted and a body just under the cap walked straight into that state. This
// asserts the projection is an UPPER BOUND over EVERY target AND over the other unbounded argv inputs (`actor`,
// `reason`), so neither a new target nor a long free-text field can re-open the hole.
describe('projectVerdictCommentLength — total over REVIEW_LABEL_TARGETS (#1056 M2)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';
  const ACTOR = 'Nicolas Gilbert';
  const REASON = 'operator in-session: "accept 1048"';

  it('has at least one target it must cover, and covers the whole declared set', () => {
    expect(REVIEW_LABEL_TARGETS.length).toBeGreaterThan(0);
    expect(REVIEW_LABEL_TARGETS).toContain('clear-human');
  });

  for (const to of REVIEW_LABEL_TARGETS) {
    it(`projected >= actual for to='${to}' — the pre-flight can never under-count it`, () => {
      for (const body of ['', 'x', '## Findings\n\nsomething\n', 'y'.repeat(60000)]) {
        const actual = buildVerdictComment({ to, actor: ACTOR, headSha: SHA, body, reason: REASON }).length;
        expect(projectVerdictCommentLength({ body, actor: ACTOR, reason: REASON }))
          .toBeGreaterThanOrEqual(actual);
      }
    });
  }

  // The concrete regression: a body sized so `accepted` fits under the cap but `clear-human` does not. Under the
  // first cut this passed the pre-flight; it must now be rejected.
  it('rejects the band where accepted fits but clear-human does not — the exact M2 window', () => {
    const at = (to, n) => buildVerdictComment({
      to, actor: ACTOR, headSha: 'f'.repeat(40), body: 'y'.repeat(n), reason: REASON,
    });
    // Solve for the body that renders to exactly the cap as `accepted` (the chrome is a fixed additive amount,
    // so one correction step lands it exactly — asserted below rather than assumed).
    const guess = GH_COMMENT_MAX - at('accepted', 0).length;
    const n = guess - (at('accepted', guess).length - GH_COMMENT_MAX);
    expect(at('accepted', n).length).toBe(GH_COMMENT_MAX);
    expect(at('clear-human', n).length).toBeGreaterThan(GH_COMMENT_MAX);
    expect(projectVerdictCommentLength({ body: 'y'.repeat(n), actor: ACTOR, reason: REASON }))
      .toBeGreaterThan(GH_COMMENT_MAX);
  });

  // The second dimension the first cut missed: `--actor` and `--reason` are argv, so they are unbounded too. A
  // fixed-width placeholder in the projection would under-count exactly the same way the fixed target did.
  it('covers a long actor and a long reason — both are unbounded argv, not fixed-width chrome', () => {
    const body = 'y'.repeat(1000);
    const actor = 'a'.repeat(4000);
    const reason = 'r'.repeat(8000);
    const actual = buildVerdictComment({ to: 'clear-human', actor, headSha: SHA, body, reason }).length;
    expect(projectVerdictCommentLength({ body, actor, reason })).toBeGreaterThanOrEqual(actual);
    // and the short-input projection would have MISSED it — that is the whole point of passing them through.
    expect(projectVerdictCommentLength({ body })).toBeLessThan(actual);
  });
});

// #2895 — the honesty tax in the durable record itself. The comment is the only thing a future reader sees, so
// it must state what it proves and refuse to imply more. These are prose assertions on purpose: this is the
// exact class of over-claim that dogged PR #1046 for four rounds and #1056 for three.
describe('buildVerdictComment — a clear-human record must not over-claim (#2895)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';
  const render = (o) => buildVerdictComment({
    to: 'clear-human', actor: 'Nicolas Gilbert', headSha: SHA,
    reason: 'operator in-session: "accept 1048"', ...o,
  });

  it('quotes the stated reason verbatim and names the actor', () => {
    const c = render({});
    expect(c).toMatch(/Nicolas Gilbert/);
    expect(c).toMatch(/> operator in-session: "accept 1048"/);
  });

  it('says the sanctioned path was followed and explicitly NOT that a human followed it', () => {
    const c = render({});
    expect(c).toMatch(/does NOT prove: that a human performed/i);
    expect(c).toMatch(/free text and nothing verifies/i);
  });

  it('makes no unforgeability claim anywhere — no "cannot", no terminal confirmation, no structural barrier', () => {
    const c = render({ body: '## Findings\n\nall good\n' });
    expect(c).not.toMatch(/confirmed at a terminal/i);
    expect(c).not.toMatch(/no agent can/i);
    expect(c).not.toMatch(/unforgeable(?! actor signal)/i);
    expect(c).not.toMatch(/structural/i);
  });

  it('still stamps the reviewed-sha marker — the clearance IS an acceptance (#2409)', () => {
    expect(parseReviewedSha([{ body: render({}) }])).toBe(SHA);
  });
});

// PR #1057 review — WHERE the size guard is called, which is a different claim from whether the projection is
// correct. The projection above was already total (no target could be under-counted); the defect was that its ONE
// call site sat inside the CLI's `if (bodyFileArg)` branch, so `--reason` — a second unbounded free-text input,
// added later — walked around it whenever no `--body-file` was passed. Reproduced against a `gh` that enforces
// GitHub's cap: `gh pr edit` landed (review:human removed), `gh pr comment` was rejected, and the PR was left
// ACCEPTED with no `reviewed-sha` marker — the fail-OPEN state the pre-flight exists to prevent, made worse by
// `clear-human` then refusing to re-run ("nothing to clear"). Hermetic: a fake `gh` on PATH records every call,
// so "refused before any gh call" and "refused before the SWAP" are both observable rather than asserted.
describe('the GH_COMMENT_MAX guard is reachable-around by nothing (PR #1057)', () => {
  const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_CALL_LOG, a.slice(0, 2).join(' ') + '\\n');
if (a[0] === 'pr' && a[1] === 'view') {
  process.stdout.write(JSON.stringify({ labels: [{ name: 'review:human' }], headRefOid: 'f'.repeat(40) }));
  process.exit(0);
}
process.exit(0);
`;
  let shimDir;
  let logPath;

  beforeAll(() => {
    shimDir = mkdtempSync(join(tmpdir(), 'review-label-shim-'));
    writeFileSync(join(shimDir, 'gh'), FAKE_GH);
    chmodSync(join(shimDir, 'gh'), 0o755);
    logPath = join(shimDir, 'gh-calls.log');
  });
  afterAll(() => { try { rmSync(shimDir, { recursive: true, force: true }); } catch { /* best-effort */ } });

  const ghCalls = () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : []);
  beforeEach(() => { try { rmSync(logPath, { force: true }); } catch { /* first run */ } });

  // THE UNCOVERED BOUNDARY CASE: a long `--reason` and NO `--body-file`. Drives the REAL entrypoint, because the
  // hole was in the entrypoint's control flow — an in-process call to the harness would have missed it entirely.
  it('a long --reason with NO --body-file is refused, and reaches no gh call at all', () => {
    const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'review-set-label.mjs');
    // Under the cap on its own — GitHub only rejects the RENDERED comment, which adds the clear-human chrome.
    const reason = 'r'.repeat(65200);
    expect(reason.length).toBeLessThan(GH_COMMENT_MAX);
    const r = spawnSync('node', [script, '1048', '--repo=o/n', '--to=clear-human', '--actor=Nicolas Gilbert',
      `--reason=${reason}`], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}`, GH_CALL_LOG: logPath },
    });
    expect(r.status).not.toBe(0);
    const payload = JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop());
    expect(payload.error).toMatch(/--reason/);
    expect(payload.error).toMatch(new RegExp(`over GitHub's ${GH_COMMENT_MAX} limit`));
    expect(ghCalls()).toEqual([]);
  });

  // And the guard that makes it unskippable: the check on the RENDERED bytes inside the harness. No free-text
  // argv here at all, so an argv projection could not possibly catch this — an importer with its own
  // `buildComment` is exactly the call path the CLI-block-only guard left open.
  it('an importer whose buildComment renders over the cap is refused BEFORE the label swap', () => {
    const chunks = [];
    const realWrite = process.stdout.write.bind(process.stdout);
    const realExit = process.exit.bind(process);
    const realPath = process.env.PATH;
    process.env.PATH = `${shimDir}:${realPath}`;
    process.env.GH_CALL_LOG = logPath;
    process.stdout.write = (s) => { chunks.push(String(s)); return true; };
    process.exit = (code) => { const e = new Error('process.exit'); e.exitCode = code; throw e; };
    let exitCode = null;
    try {
      runReviewLabelCli({
        argv: ['1048', '--repo=o/n', '--to=clear-human', '--actor=op', '--reason=operator said clear it'],
        allowClearHuman: true,
        defaultActor: 'test',
        usage: 'usage: test',
        buildComment: () => 'z'.repeat(GH_COMMENT_MAX + 1),
        successResult: (o) => ({ ok: true, ...o }),
        refusalResult: ({ decision }) => ({ error: decision.reason }),
      });
    } catch (e) { if (typeof e.exitCode === 'number') exitCode = e.exitCode; else throw e; }
    finally {
      process.stdout.write = realWrite; process.exit = realExit; process.env.PATH = realPath;
      delete process.env.GH_CALL_LOG;
    }
    expect(exitCode).not.toBe(0);
    expect(JSON.parse(chunks.join('')).error).toMatch(/rendered comment is \d+ chars/);
    // It observed the PR (a read) and then stopped. #2979 moved the fingerprint's diff read off `gh pr diff`
    // onto `computeNetDiffText` (which shells `git`), so no `pr diff` appears in the gh log any more. What
    // matters to this guard is unchanged and still asserted: no MUTATION happened.
    expect(ghCalls()).toEqual(['pr view']);
    expect(ghCalls().some((c) => c === 'pr edit' || c === 'pr comment')).toBe(false);
  });
});

// PR #1056 review, round 4 / C3 — THE SUCCESS PATH. Every other CLI-level `clear-human` assertion in this file is
// a REFUSAL, and the recorded `gh` calls top out at `['pr view']` or `[]`. That is structurally the SAME defect as
// round 1's blocking B1 on this PR: *a refusal looks identical whether the gate works or is dead*, so a
// refusal-only suite cannot tell "clear-human is correctly wired" apart from "clear-human is unreachable". These
// tests drive the REAL entrypoint all the way THROUGH the impure half against a recording fake `gh` and assert the
// three things that actually have to land: the label swap, the attributed comment, and the `reviewed-sha` stamp.
// (`xsfp7k0` is the general rule this instantiates.) They double as the size pre-flight's missing NEGATIVE
// CONTROL: a body that FITS must be let through, or the guard above could pass its tests by refusing everything.
describe('clear-human drives the swap END-TO-END (#2895, PR #1056 C3)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';
  const ACTOR = 'Nicolas Gilbert';
  const REASON = 'operator in-session: "read the panel, clear 1048"';

  // Records the FULL argv of every call (not just the verb pair), flips the observed labels once `pr edit` has
  // run so the post-swap re-read is honest, and copies the posted `--body-file` out so the durable comment can be
  // read back through the real `parseReviewedSha`.
  const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_CALL_LOG, JSON.stringify(a) + '\\n');
if (a[0] === 'pr' && a[1] === 'view') {
  const labels = fs.existsSync(process.env.GH_EDIT_FLAG)
    ? [{ name: 'review:accepted' }, { name: 'ready-to-merge' }]
    : [{ name: 'review:human' }, { name: 'review:pending' }, { name: 'ready-to-merge' }];
  process.stdout.write(JSON.stringify({ labels, headRefOid: process.env.GH_HEAD_SHA }));
  process.exit(0);
}
if (a[0] === 'pr' && a[1] === 'edit') { fs.writeFileSync(process.env.GH_EDIT_FLAG, '1'); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'comment') {
  fs.writeFileSync(process.env.GH_COMMENT_BODY, fs.readFileSync(a[a.indexOf('--body-file') + 1], 'utf8'));
  process.exit(0);
}
process.exit(0);
`;

  const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'review-set-label.mjs');
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let dir;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'review-label-success-'));
    writeFileSync(join(dir, 'gh'), FAKE_GH);
    chmodSync(join(dir, 'gh'), 0o755);
  });
  afterAll(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });
  beforeEach(() => {
    for (const f of ['gh-calls.log', 'edited', 'comment.md']) {
      try { rmSync(join(dir, f), { force: true }); } catch { /* first run */ }
    }
  });

  const env = () => ({
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    GH_CALL_LOG: join(dir, 'gh-calls.log'),
    GH_EDIT_FLAG: join(dir, 'edited'),
    GH_COMMENT_BODY: join(dir, 'comment.md'),
    GH_HEAD_SHA: SHA,
  });
  /** Every recorded call as its full argv array. */
  const calls = () => (existsSync(join(dir, 'gh-calls.log'))
    ? readFileSync(join(dir, 'gh-calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : []);
  /** The values that FOLLOW each occurrence of `flag` in an argv array (adjacency, not mere presence). */
  const valuesOf = (argv, flag) => argv.flatMap((a, i) => (a === flag ? [argv[i + 1]] : []));
  const runClear = (extra) => spawnSync('node', [script, '1048', '--repo=o/n', '--to=clear-human',
    `--actor=${ACTOR}`, `--reason=${REASON}`, ...extra], { encoding: 'utf8', env: env() });

  it('returns ok:true and lands the label swap, the attributed comment and the reviewed-sha stamp', () => {
    const bodyPath = join(dir, 'findings.md');
    writeFileSync(bodyPath, '## Findings\n\nNo blocking issues; the panel reduced to accept.\n', 'utf8');
    const r = runClear([`--body-file=${bodyPath}`]);

    // 1. The payload is a SUCCESS, not a refusal — the assertion the whole suite was missing.
    expect(r.status).toBe(0);
    const payload = JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop());
    expect(payload).toMatchObject({ ok: true, pr: 1048, to: 'clear-human' });
    expect(payload.labels).toContain(REVIEW_LABELS.accepted);
    expect(payload.labels).not.toContain(REVIEW_LABELS.human);

    // 2. The swap that actually reached `gh`: accepted ADDED and human REMOVED, on one `pr edit`.
    const edit = calls().find((c) => c[0] === 'pr' && c[1] === 'edit');
    expect(edit).toBeDefined();
    expect(valuesOf(edit, '--add-label')).toEqual([REVIEW_LABELS.accepted]);
    expect(valuesOf(edit, '--remove-label')).toContain(REVIEW_LABELS.human);
    // The parked state goes too — a cleared PR must not still read as awaiting review.
    expect(valuesOf(edit, '--remove-label')).toContain(REVIEW_LABELS.pending);
    // `review:changes` was NOT on the PR, so `presentRemoveLabels` must have dropped it (gh errors on an absent
    // label), and the whole arc ran in order: observe → edit → comment → re-read.
    expect(valuesOf(edit, '--remove-label')).not.toContain(REVIEW_LABELS.changes);
    expect(calls().map((c) => c.slice(0, 2).join(' ')))
      // #2979 — the reviewed-diff read moved off `gh pr diff` onto `computeNetDiffText` (which shells `git`),
      // so the GH call sequence is back to what it was before #x169fqe. The mutation order (edit → comment) is
      // the property this assertion exists to pin, and it is unchanged throughout.
      .toEqual(['pr view', 'pr edit', 'pr comment', 'pr view']);

    // 3. The durable comment — the honesty tax as it is actually posted, not as the module describes it.
    const comment = readFileSync(join(dir, 'comment.md'), 'utf8');
    expect(comment).toContain(`Cleared by ${ACTOR} via \`review-set-label.mjs --to=clear-human\` (#2895).`);
    expect(comment).toContain(`> ${REASON}`);
    expect(comment).toContain('What it does NOT prove: that a human performed it.');
    expect(comment).toContain('## Findings');
    // A well-formed marker, proven through the REAL reader rather than a substring check.
    expect(parseReviewedSha([{ body: comment }])).toBe(SHA);
  });

  // THE NEGATIVE CONTROL for the size pre-flight (dropped, not replaced, when the ceremony block was deleted —
  // PR #1056 round 4). A guard that refuses everything passes every refusal test ever written; this pins the
  // other side at the exact boundary — the largest body that still renders under the cap must go THROUGH.
  it('lets a body that renders exactly AT the cap through — the size guard is not a blanket refusal', () => {
    const at = (body) => projectVerdictCommentLength({ body, actor: ACTOR, reason: REASON });
    const guess = GH_COMMENT_MAX - at('');
    const body = 'y'.repeat(guess - (at('y'.repeat(guess)) - GH_COMMENT_MAX));
    expect(at(body)).toBe(GH_COMMENT_MAX); // exactly at the cap, not one char under
    const bodyPath = join(dir, 'max-findings.md');
    writeFileSync(bodyPath, body, 'utf8');

    const r = runClear([`--body-file=${bodyPath}`]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop()).ok).toBe(true);
    expect(calls().map((c) => c.slice(0, 2).join(' '))).toContain('pr comment');
    expect(readFileSync(join(dir, 'comment.md'), 'utf8').length).toBeLessThanOrEqual(GH_COMMENT_MAX);
  });

  // PR #1056 review, C2 — the DOCUMENTED invocation, exercised as documented. `npm run <script>` writes its two
  // banner lines to STDOUT ahead of the payload, so the wrapper the skill hands the operator used to break the
  // module's stated contract (`{"ok":…}`/`{"error":…}` as the whole of stdout): an agent parsed stdout, threw on
  // a clearance that had in fact landed, and a naive retry then hit "nothing to clear" — reading like a second
  // failure. The class is "a package.json wrapper around a JSON-contract CLI is never exercised as documented".
  it('the documented `npm run --silent review:clear` wrapper puts ONLY JSON on stdout', () => {
    const r = spawnSync('npm', ['run', '--silent', 'review:clear', '--',
      '1048', '--repo=o/n', `--actor=${ACTOR}`], { cwd: repoRoot, encoding: 'utf8', env: env() });
    expect(r.status).not.toBe(0);
    // The WHOLE of stdout must parse — a banner line ahead of the payload is exactly what this catches.
    const payload = JSON.parse(r.stdout);
    expect(payload.error).toMatch(/requires --reason/);
    expect(calls()).toEqual([]); // refused before any gh call
  }, 60000);

  // …and the pin that keeps the DOC honest, which no amount of testing npm itself would give: if the skill ever
  // documents the wrapper without `--silent`, the banner problem is back and the test above stops covering it.
  it('the /review skill never documents the wrapper without --silent', () => {
    const skill = readFileSync(join(repoRoot, 'skills-src', 'review', 'SKILL.md'), 'utf8');
    for (const m of skill.matchAll(/npm run[^\n]*review:clear/g)) {
      expect(m[0]).toContain('--silent');
    }
  });
});
