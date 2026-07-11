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
