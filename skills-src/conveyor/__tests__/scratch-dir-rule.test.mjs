/**
 * @file skills-src/conveyor/__tests__/scratch-dir-rule.test.mjs
 * @description Grep-shaped proof (WE #3444) that a dispatched agent's standing identity and the two briefs
 *   built from it all tell it where scratch files belong. Four sessions independently wedged writing an
 *   ephemeral file (a commit-message file, a captured gate log) into their own harness-provided job-scratch
 *   directory (`~/.claude/jobs/<id>/tmp/`), which Claude Code can flag as a sensitive-file write and produce
 *   a permission prompt nobody is present to answer. These are markdown prompt templates, not executable
 *   code, so the proof is textual: each file must both name the job-scratch/`/tmp` hazard and direct scratch
 *   writes into the lane clone instead.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');

describe('dispatched-agent-system-prompt.md — the standing rule', () => {
  const text = read('../dispatched-agent-system-prompt.md');

  it('names the job-scratch directory (and /tmp) as a write hazard', () => {
    expect(text).toMatch(/job-scratch directory/);
    expect(text).toMatch(/`\/tmp`/);
    expect(text).toMatch(/~\/\.claude\/jobs\/<session-id>\/tmp\//);
  });

  it('directs ephemeral writes into the lane clone instead', () => {
    expect(text).toMatch(/lane clone you acquire in your own\s+first step/);
  });
});

describe('delivery-agent-brief.md — step 8 msgfile site', () => {
  const text = read('../delivery-agent-brief.md');

  it('points <msgfile> at the lane, not the job-scratch dir', () => {
    expect(text).toMatch(/<msgfile> MUST live inside \$LANE/);
    expect(text).toMatch(/~\/\.claude\/jobs\/<id>\/tmp\//);
  });
});

describe('review-agent-brief.md — the review-side twin of the rule', () => {
  const text = read('../../review/review-agent-brief.md');

  it('states the same job-scratch/tmp rule directly in its own prose', () => {
    expect(text).toMatch(/job-scratch directory/);
    expect(text).toMatch(/`\/tmp`/);
    expect(text).toMatch(/does not pass `systemPromptFile`/);
  });

  it('directs ephemeral writes into the lane clone acquired in step 1', () => {
    expect(text).toMatch(/inside the lane clone you acquire in step 1/);
  });
});
