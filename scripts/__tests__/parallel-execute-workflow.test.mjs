/**
 * @file scripts/__tests__/parallel-execute-workflow.test.mjs
 * @description Structural-invariant guard for the parallel /workflow orchestrator
 *   (`.claude/skills/batch-backlog-items/parallel-execute.workflow.js`). The script runs in the Workflow JS
 *   sandbox (top-level `await`/`return`, injected `agent`/`parallel`/`phase`/`log` globals), so it is NOT an
 *   importable module — these assertions read its SOURCE TEXT and lock the #2215 invariant in place: the
 *   producer publishes NEW items via an IN-LANE scaffold that rides the lane's PR, never a scaffold+direct-push
 *   to `main` (the #2203 primary-write the strict lock forbids).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/batch-backlog-items/parallel-execute.workflow.js'),
  'utf8',
);

describe('parallel-execute workflow — #2215 in-lane new-item scaffold', () => {
  it('has a SCAFFOLD-IN-LANE path that scaffolds a seeded item in its own clone (born active+owned)', () => {
    expect(SRC).toMatch(/SCAFFOLD-IN-LANE/);
    expect(SRC).toMatch(/backlog\.mjs scaffold --kind=/);
    expect(SRC).toMatch(/--session=\$\{batchSlug\}/); // --session → born active+owned (#670), the claim rides it
  });

  it('branches on a per-item `seed` (new item) vs an existing claimed item', () => {
    expect(SRC).toMatch(/const seed = it\.seed/);
    // the existing-item path still claims-in-lane
    expect(SRC).toMatch(/CLAIM-IN-LANE/);
    expect(SRC).toMatch(/backlog\.mjs claim \$\{it\.num\}/);
  });

  it('names lane refs by a num-independent key so a seeded item (no NNN yet) still gets a stable ref', () => {
    expect(SRC).toMatch(/function laneKeyOf\(it\)/);
    expect(SRC).toMatch(/function laneRefFor\(it\)/);
    expect(SRC).toMatch(/new-\$\{it\.slug\}/); // the seeded key
  });

  it('documents that a seeded item is NEVER scaffolded on main (rides the lane PR) — the #2215 fix', () => {
    expect(SRC).toMatch(/#2215/);
    expect(SRC).toMatch(/NEVER scaffolded[\s\S]{0,40}on main/);
  });

  it('preserves the producer contract: zero commits to main, never merges/pushes main', () => {
    // The producer prompt still forbids a direct push to main — the seed path must not reintroduce one.
    expect(SRC).toMatch(/NEVER push main/);
    expect(SRC).toMatch(/ZERO commits to\s+main/);
    // no scaffold-then-push-to-main pattern (the #2203 footgun): a `scaffold` must never be followed by a push
    // to a main ref in the same instruction.
    expect(SRC).not.toMatch(/scaffold[\s\S]{0,120}push\s+origin\s+(HEAD:)?(refs\/heads\/)?main\b/);
  });
});

describe('parallel-execute workflow — #2429 self-excluding pr-land wait', () => {
  it('prescribes waiting on pr-land via the background-completion notification, not a hand-rolled poll', () => {
    expect(SRC).toMatch(/#2429/);
    // DoD option 1: the wait is the harness resuming the lane on the background task's completion.
    expect(SRC).toMatch(/run_in_background/);
    expect(SRC).toMatch(/completion notification/i);
  });

  it('bans a self-matching process-poll wait on pr-land (the #2429 hang)', () => {
    // The banned construct: `kill -0 $(pgrep -f "pr-land …")` — pgrep matches the waiter's OWN shell (the ref
    // string is in its argv), so `kill -0` never fails and the loop idles to the Monitor timeout. The lane body
    // must never emit this. We match the command-substitution self-match form, which is absent from the prose
    // that documents the ban.
    expect(SRC).not.toMatch(/kill\s+-0\s+\$\(\s*pgrep/);
    expect(SRC).not.toMatch(/pgrep\s+-f\s+["'][^"'\n]*pr-land/);
  });
});

describe('parallel-execute workflow — #2478/#2216 Finalize label reconcile', () => {
  it('collects every OPEN PR a lane left labelled:false into a reconcile set', () => {
    expect(SRC).toMatch(/#2478/);
    expect(SRC).toMatch(/#2216/);
    expect(SRC).toMatch(/const toReconcile\s*=/);
    // detection: an opened PR (has a pr number) the lane could NOT label (labelled:false / unknown)
    expect(SRC).toMatch(/p\.pr\s*&&\s*!p\.labelled/);
  });

  it('has a Finalize label-reconcile agent step that labels the now-green ones via pr-land --label-on-green', () => {
    expect(SRC).toMatch(/finalize:label-reconcile/);
    expect(SRC).toMatch(/LABEL RECONCILE/);
    // it uses the pure-producer label path (labels, never merges) — not a merge/drain
    expect(SRC).toMatch(/--label-on-green/);
  });

  it('keeps Finalize a pure producer — the reconcile never merges, integrates, or launches a drain', () => {
    // the reconcile prompt must forbid the landing ops (the #2183 producer contract holds through the fix)
    expect(SRC).toMatch(/Do NOT merge, do NOT integrate, do NOT launch a drain/);
  });

  it('carries a still-unlabelled (not-green) PR as a definite carried-for-label outcome for /resume — never a silent drop', () => {
    expect(SRC).toMatch(/carried-for-label/);
    expect(SRC).toMatch(/const carriedForLabel\s*=/);
    // both outcomes ride out in the return object so /resume can pick up the strand
    expect(SRC).toMatch(/reconciledLabels,/);
    expect(SRC).toMatch(/carriedForLabel,/);
  });

  it('#984 finding 4 — a DELIBERATELY-held PR (p.held) is NOT collected for reconcile (never re-labelled)', () => {
    // The detection excludes a held strand: re-running pr-land on it would re-add the go-ahead the hold stripped
    // (a held↔ready flip-flop) and record a false carried-for-label. `held` is the signal distinct from labelApplied:false.
    expect(SRC).toMatch(/p\.pr\s*&&\s*!p\.labelled\s*&&\s*!p\.held/);
    // the per-PR schema carries the `held` field, and the lane is told to set it from pr-land's JSON `held:true`
    expect(SRC).toMatch(/held:\s*\{\s*type:\s*'boolean'/);
    expect(SRC).toMatch(/held:true/);
  });

  it('#984 minor 5 — a held PR is SURFACED in Finalize (never a silent drop / silent liveness-reconcile opt-out)', () => {
    // Held PRs are excluded from the reconcile, so without a visibility line the operator gets no signal a strand is
    // waiting on their review — and a mis-set held:true would silently opt a stranded PR out of the reconcile unseen.
    expect(SRC).toMatch(/heldStrands\s*=/);
    expect(SRC).toMatch(/p\.pr\s*&&\s*p\.held/);         // collected
    expect(SRC).toMatch(/Held for review/);              // logged
  });
});
