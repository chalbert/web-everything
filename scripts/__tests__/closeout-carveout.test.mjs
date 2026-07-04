/**
 * @file scripts/__tests__/closeout-carveout.test.mjs
 * @description Doc-invariant guard for the #2191 close-out carve-out. The behaviour change lives in a
 *   user-global skill (`closing-session`) that can't ride a WE PR, so the WE-repo deliverable — and this
 *   test — is the ratified rider in `docs/agent/platform-decisions.md#pr-flow-rollout-mechanism`: close-out is
 *   NOT a direct-`main` write path for edit work, and session-meta (agent-memory + claims.json-class local
 *   signals) is the ONE tightly-scoped sanctioned-direct carve-out. Locks the rule against silent drift/widening.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/agent/platform-decisions.md'),
  'utf8',
);
// The section body from the pr-flow-rollout anchor to the next `### ` heading.
const anchorIdx = DOC.indexOf('{#pr-flow-rollout-mechanism}');
const section = DOC.slice(anchorIdx, DOC.indexOf('\n### ', anchorIdx + 1));

describe('close-out carve-out rider (#2191) in pr-flow-rollout-mechanism', () => {
  it('exists under the pr-flow-rollout-mechanism anchor and cites #2191', () => {
    expect(anchorIdx).toBeGreaterThan(-1);
    expect(section).toMatch(/#2191/);
    expect(section).toMatch(/close-out is not a direct-`main` write path/i);
  });

  it('states that close-out auto-commit no-ops on already-PR\'d work and routes edit work via lane→PR', () => {
    expect(section).toMatch(/no-ops on already-PR'd\s+work/i);
    expect(section).toMatch(/lane→PR/);
  });

  it('scopes the sanctioned-direct carve-out to local signals ONLY; memory content rides a lane→PR', () => {
    // agent-memory content is NOT the carve-out — it lands via lane→PR (matches the closing-session skill).
    expect(section).toMatch(/agent-memory[\s\S]{0,80}lane→PR/i);
    expect(section).toMatch(/carve-out is\s+`claims\.json`-class \*local signals\* ONLY/i);
    // the carve-out must NOT widen beyond local signals
    expect(section).toMatch(/local signals only/i);
    expect(section).toMatch(/never widens to memory content,\s+source,\s+content,\s+or backlog/i);
  });
});
