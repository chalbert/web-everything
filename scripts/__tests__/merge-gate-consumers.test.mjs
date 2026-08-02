/**
 * merge-gate-consumers.test.mjs — the #2820 CLASS GUARD (round-2 introspection directive).
 *
 * The round-2 review: rounds 1–2 fixed the merge-decision-gate sites the author REMEMBERED, but a FIFTH slipped
 * (the review-label mint set), because the guard added pinned the `reviewHeld` PREDICATE's meaning without
 * enumerating its CONSUMERS. This guard closes the class the way `verdict-totality` did for the VERDICTS enum:
 * it DISCOVERS every merge-decision gate in `merge-ai-prs.mjs` from source and fails on any that neither considers
 * `reviewHeld` nor carries an `@merge-gate-exempt <reason>` marker — so a NEW unguarded site (a hypothetical 6th)
 * cannot slip past a stale hand list.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkMergeGateConsumers, MERGE_GATE_EXEMPT_MARKER } from '../lib/merge-gate-totality.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MERGE_AI_PRS = join(here, '..', 'merge-ai-prs.mjs');

describe('#2820 class guard — every merge-decision gate in merge-ai-prs.mjs accounts for reviewHeld', () => {
  const source = readFileSync(MERGE_AI_PRS, 'utf8');

  it('the REAL merge-ai-prs.mjs passes: every merge-decision gate is covered (reviewHeld) or exempted (with a reason)', () => {
    const { errors, sites } = checkMergeGateConsumers(source);
    // Zero errors — this is the invariant. If it fails, the message names the offending line + what to do.
    expect(errors).toEqual([]);
    // And it actually DISCOVERED gates (not a no-op pattern that matched nothing): several sites, of both kinds.
    expect(sites.length).toBeGreaterThanOrEqual(6);
    expect(sites.some((s) => s.marker === 'reviewHeld')).toBe(true);
    expect(sites.some((s) => s.marker === 'exempt')).toBe(true);
    // Every exempt site carries a non-empty reason (a bare marker is itself an error, asserted below on a fixture).
    for (const s of sites.filter((x) => x.marker === 'exempt')) expect(s.reason).toBeTruthy();
  });

  it('the mint set (the 5th site) is COVERED — proves the required-change-1 fix is in place and the guard sees it', () => {
    const { sites } = checkMergeGateConsumers(source);
    // The mint set is the `escalationRepos` filter; after the fix it reads `... || v.reviewHeld`, so the guard
    // classifies it `reviewHeld`. Locate it by its source line to pin the exact site, not just "some line".
    const mintLine = source.split('\n').findIndex((l) => l.includes('const escalationRepos = new Set(')) + 1;
    expect(mintLine).toBeGreaterThan(0);
    const mintSite = sites.find((s) => s.line === mintLine);
    expect(mintSite).toBeTruthy();
    expect(mintSite.marker).toBe('reviewHeld');
  });

  // THE KEY PROOF the reviewer demanded — the guard catches a NEW unguarded site, not a hand list. Inject a 6th
  // merge-decision gate with neither reviewHeld nor a marker and assert it is flagged with an actionable message.
  it('CATCHES a NEW unguarded merge-decision gate (a hypothetical 6th site) — the class is closed, not hand-listed', () => {
    const withNewSite = source.replace(
      'const toMerge = verdicts.filter((v) => v.decision === \'merge\')',
      'const sneaky = verdicts.filter((v) => v.decision === \'merge\').map((v) => v.repo);\n  const toMerge = verdicts.filter((v) => v.decision === \'merge\')',
    );
    // Sanity: the injection actually landed (else the test proves nothing).
    expect(withNewSite).not.toBe(source);
    const { errors } = checkMergeGateConsumers(withNewSite);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /const sneaky/.test(e) || /neither considers `reviewHeld`/.test(e))).toBe(true);
  });

  // Fixture-level unit checks of the three outcomes, so the mechanism is pinned independent of the real file.
  it('flags an unmarked, uncovered gate', () => {
    const { errors } = checkMergeGateConsumers(`for (const v of x) { if (v.decision !== 'merge') continue; }`);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/neither considers `reviewHeld`/);
  });

  it('passes a gate that considers reviewHeld inline', () => {
    const { errors, sites } = checkMergeGateConsumers(`if (v.decision !== 'merge' && !v.reviewHeld) continue;`);
    expect(errors).toEqual([]);
    expect(sites[0].marker).toBe('reviewHeld');
  });

  it('passes a gate exempted WITH a reason (trailing marker)', () => {
    const { errors, sites } = checkMergeGateConsumers(`const m = xs.filter((v) => v.decision === 'merge'); // ${MERGE_GATE_EXEMPT_MARKER} the final merge set must exclude held PRs`);
    expect(errors).toEqual([]);
    expect(sites[0].marker).toBe('exempt');
    expect(sites[0].reason).toBe('the final merge set must exclude held PRs');
  });

  it('passes a gate exempted via the comment block ABOVE it', () => {
    const src = [
      `// ${MERGE_GATE_EXEMPT_MARKER} downgrade-only backstop; a held PR is already skip`,
      `if (v.decision !== 'merge') continue;`,
    ].join('\n');
    expect(checkMergeGateConsumers(src).errors).toEqual([]);
  });

  it('ERRORS on a bare exempt marker with no reason', () => {
    const { errors } = checkMergeGateConsumers(`const m = xs.filter((v) => v.decision === 'merge'); // ${MERGE_GATE_EXEMPT_MARKER}`);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/bare/);
  });

  it('does NOT treat a merge-decision expression that appears only inside a COMMENT as a gate site', () => {
    const { errors, sites } = checkMergeGateConsumers(`// leave v.decision === 'merge' → falls through to the land cascade\nconst y = 1;`);
    expect(errors).toEqual([]);
    expect(sites).toEqual([]);
  });
});
