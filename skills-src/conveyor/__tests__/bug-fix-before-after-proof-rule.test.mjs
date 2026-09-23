/**
 * @file skills-src/conveyor/__tests__/bug-fix-before-after-proof-rule.test.mjs
 * @description Grep-shaped proof (epic #3383) that every bug-fix brief — the conveyor fix agent repairing a
 *   `review:changes` bounce, AND a delivery agent building a bug-fix item from scratch — demands a LIVE
 *   before/after proof, not just a green gate: reproduce the bug red (a test, plus a real-surface probe where
 *   observable), fix it, re-confirm green/fixed, and put the trimmed evidence where a reviewer can see it.
 *
 *   Operator instruction, 2026-09-23 (epic #3383): "make sure the agent that fix bugs actually test it so we
 *   know it works." Same style as `edit-not-bash-rewrite-rule.test.mjs` — these are markdown prompt templates,
 *   not executable code, so the proof is textual (a grep over the brief's own wording).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');

describe('fix-agent-brief.md step 2 — reproduce the finding BEFORE touching code', () => {
  const text = read('../fix-agent-brief.md');
  const step2 = text.match(/^### 2\. [^\n]*\n([\s\S]*?)(?=^### 3\. )/m)[1];

  it('requires a failing test reproducing the reviewer\'s stated reason, shown red', () => {
    expect(step2).toMatch(/Reproduce it before you touch any code/);
    expect(step2).toMatch(/FAILS for the exact reason the reviewer\s*\nnamed/);
  });

  it('requires a real-surface probe when the finding is observable there', () => {
    expect(step2).toMatch(/CLI dry-run, a read-only query, a\s*\npage render/);
  });

  it('requires an explicit statement when reproduction is genuinely impossible — never a silent claim of fixed', () => {
    expect(step2).toMatch(/If you genuinely cannot\s*\nreproduce the finding/);
    expect(step2).toMatch(/Never claim the\s*\nfix works without having reproduced it/);
  });
});

describe('fix-agent-brief.md step 4 — a green gate is re-checked against the SAME reproduction', () => {
  const text = read('../fix-agent-brief.md');
  const step4 = text.match(/^### 4\. [^\n]*\n([\s\S]*?)(?=^### 5\. )/m)[1];

  it('states a green gate alone does not prove the finding is fixed', () => {
    expect(step4).toMatch(/does not, by itself, prove the reviewer's finding is actually fixed/);
  });

  it('requires re-running the same step-2 test and the same real-surface probe', () => {
    expect(step4).toMatch(/Re-run the SAME test from step 2/);
    expect(step4).toMatch(/re-run that SAME probe and confirm it now shows the fixed behavior/);
  });
});

describe('fix-agent-brief.md step 6 — the before/after evidence is posted as a PR comment before re-arming', () => {
  const text = read('../fix-agent-brief.md');
  const step6 = text.match(/^### 6\. [^\n]*\n([\s\S]*?)(?=^### 7\. )/m)[1];

  it('requires posting the trimmed red-then-green evidence as a durable PR comment', () => {
    expect(step6).toMatch(/Post the before\/after proof as a PR comment before re-arming/);
    expect(step6).toMatch(/gh pr comment \{\{PR_NUM\}\} --repo \{\{REPO\}\} --body-file <evidence-file>/);
  });

  it('sequences the evidence comment before step 7\'s re-arm', () => {
    expect(step6).toMatch(/Do this before step 7's re-arm/);
  });
});

describe('fix-agent-brief.md guardrails — the proof requirement is restated as a non-negotiable', () => {
  const text = read('../fix-agent-brief.md');
  const guardrails = text.slice(text.indexOf('## Guardrails'));

  it('names reproduce-red / re-confirm-green / post-evidence as a guardrail', () => {
    expect(guardrails).toMatch(/Prove it, don't just gate it/);
  });
});

describe('delivery-agent-brief.md step 4 — a bug-fix item owes the same live proof', () => {
  const text = read('../delivery-agent-brief.md');
  const step4 = text.match(/^### 4\. [^\n]*\n([\s\S]*?)(?=^### 5\. )/m)[1];

  it('requires reproducing the bug red before fixing, referencing the fix-agent brief\'s own discipline', () => {
    expect(step4).toMatch(/Fixing a bug\? Reproduce it before you fix it/);
    expect(step4).toMatch(/fix-agent-brief\.md/);
  });

  it('requires the real-surface probe and the after-fix re-confirmation', () => {
    expect(step4).toMatch(/on a\s*\n {2}real surface \(a CLI dry-run, a read-only query, a page render\)/);
    expect(step4).toMatch(/After the fix, the same test is green and the same probe shows the fixed behavior/);
  });

  it('requires the trimmed evidence in the PR body, and an explicit non-repro statement otherwise', () => {
    expect(step4).toMatch(/Put the trimmed\s*\n {2}red-then-green evidence in the PR body/);
    expect(step4).toMatch(/never claim "fixed" without one/);
  });
});
