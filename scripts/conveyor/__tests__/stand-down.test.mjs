/**
 * @file scripts/conveyor/__tests__/stand-down.test.mjs
 * @description Pins the durable STAND-DOWN marker (WE #3296) — the record that tells "a fixer proved the fix
 *   wrong and stood down" apart from "a fixer died".
 *
 *   This is cause 3 of #3296, the sharpest of its six. The fix-agent brief's two escalation exits are CORRECT
 *   behaviour — an agent that cannot safely make a judgment must not guess — and before this file they wrote
 *   NOTHING durable: the PR kept `review:changes`, no comment was posted, and the one-line return went to a
 *   calling session that then exited. On the PR itself the two cases were byte-identical, so any reconciler
 *   reading that PR re-dispatches the refusal forever.
 *
 *   THE MARKER IS THE WHOLE MECHANISM, so it is pinned three ways: the marker line itself (changing it orphans
 *   every existing record), the round trip (what `buildStandDownComment` writes is what `countStandDownComments`
 *   reads), and — the half that would otherwise rot — that the BRIEF'S TWO EXITS ACTUALLY CALL IT. A script
 *   nothing invokes is the #3095 defect arriving by a different door, and prose is exactly where that rot is
 *   invisible.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  STAND_DOWN_MARKER, STAND_DOWN_REASONS, countStandDownComments, buildStandDownComment,
} from '../stand-down.mjs';
import { REARM_COMMENT_MARKER } from '../rearm-review.mjs';
import { CI_HEAL_COMMENT_MARKER } from '../ci-heal-mark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIEF = resolve(HERE, '../../../skills-src/conveyor/fix-agent-brief.md');

describe('the marker — single-sourced, and distinct from its two siblings (#3296)', () => {
  it('build and count share ONE marker, so posting and counting can never drift', () => {
    expect(buildStandDownComment().split('\n')[0]).toBe(STAND_DOWN_MARKER);
    expect(countStandDownComments([{ body: buildStandDownComment() }])).toBe(1);
  });

  it('does NOT cross-count with the re-arm (#2643) or CI-heal (#2666) markers', () => {
    // Three durable counts read the same comment thread. If any two shared a prefix, a burned PR would read as
    // stood down, or a stood-down PR would read as re-armed — and each is a different wrong dispatch.
    const thread = [{ body: REARM_COMMENT_MARKER }, { body: CI_HEAL_COMMENT_MARKER }, { body: buildStandDownComment() }];
    expect(countStandDownComments(thread)).toBe(1);
    expect(STAND_DOWN_MARKER).not.toBe(REARM_COMMENT_MARKER);
    expect(STAND_DOWN_MARKER.startsWith(REARM_COMMENT_MARKER)).toBe(false);
    expect(STAND_DOWN_MARKER.startsWith(CI_HEAL_COMMENT_MARKER)).toBe(false);
  });

  it('counts only a LEADING marker line — a human quoting it in a reply never inflates the count', () => {
    expect(countStandDownComments([{ body: `> ${STAND_DOWN_MARKER}\n\nI'll take it.` }])).toBe(0);
    expect(countStandDownComments([{ body: `  ${STAND_DOWN_MARKER}\n…` }])).toBe(1); // leading whitespace is fine
  });

  it('tolerates the shapes `gh` and its callers actually produce', () => {
    expect(countStandDownComments(null)).toBe(0);
    expect(countStandDownComments(undefined)).toBe(0);
    expect(countStandDownComments([])).toBe(0);
    expect(countStandDownComments('not an array')).toBe(0);
    expect(countStandDownComments([STAND_DOWN_MARKER])).toBe(1);   // bare strings
    expect(countStandDownComments([{ body: null }, {}])).toBe(0);
  });
});

describe('the comment body — a marker, not a burial (#3296)', () => {
  it('names each of the brief\'s real escalation exits', () => {
    for (const [reason, clause] of Object.entries(STAND_DOWN_REASONS)) {
      expect(buildStandDownComment({ reason })).toContain(clause);
    }
  });

  it('an unknown reason still produces a valid, countable record rather than throwing', () => {
    const body = buildStandDownComment({ reason: 'something-new' });
    expect(body.split('\n')[0]).toBe(STAND_DOWN_MARKER);
    expect(countStandDownComments([{ body }])).toBe(1);
  });

  it('says the loop has stopped AND that a person is the intended exit', () => {
    // `stood-down` is terminal for the RECONCILER, not for a human. If the comment did not say so, the marker
    // would become a way to bury a PR — a worse defect than the one it fixes.
    const body = buildStandDownComment({ reason: 'needs-judgment' });
    expect(body).toMatch(/human is the intended next step/i);
    expect(body).toMatch(/will NOT try this PR again/i);
    expect(body).toMatch(/delete this comment/i);
  });

  it('records that NOTHING was changed on the PR — no label swap, no re-arm, no push', () => {
    const body = buildStandDownComment({ reason: 'gate-red' });
    expect(body).toMatch(/no label was changed/i);
    expect(body).toMatch(/not re-armed/i);
  });
});

describe('the fix-agent brief actually CALLS it — the half that would otherwise rot (#3296)', () => {
  const brief = readFileSync(BRIEF, 'utf8');
  const lines = brief.split('\n');
  /** The line numbers of every `stand-down.mjs` invocation in the brief. */
  const callLines = lines
    .map((l, i) => (l.includes('stand-down.mjs') ? i + 1 : 0))
    .filter(Boolean);

  it('invokes `scripts/conveyor/stand-down.mjs` at least twice — once per escalation exit', () => {
    expect(callLines.length).toBeGreaterThanOrEqual(2);
  });

  it('the AMBIGUOUS-FINDING exit calls it before returning (brief §2)', () => {
    // The exit that says "do NOT guess — leave the PR review:changes (do not re-arm) and RETURN
    // `fix escalated (finding needs human judgment)`". Correct, and silent until now.
    const exitAt = lines.findIndex((l) => l.includes('fix escalated (finding needs human judgment)')) + 1;
    expect(exitAt).toBeGreaterThan(0);
    expect(callLines.some((n) => Math.abs(n - exitAt) <= 12)).toBe(true);
  });

  it('the RED-GATE exit calls it before returning (brief §4)', () => {
    // "A red gate is a hard stop: leave the PR review:changes (do NOT re-arm) and RETURN `fix gate-red`."
    const exitAt = lines.findIndex((l) => l.includes('fix gate-red')) + 1;
    expect(exitAt).toBeGreaterThan(0);
    expect(callLines.some((n) => Math.abs(n - exitAt) <= 12)).toBe(true);
  });

  it('every `--reason=` the brief passes is a reason this script knows', () => {
    // A brief that passes a reason the script does not carry silently degrades to the generic clause; the
    // durable record then says less than the agent knew.
    const reasons = [...brief.matchAll(/stand-down\.mjs[^\n]*--reason=([a-z-]+)/g)].map((m) => m[1]);
    expect(reasons.length).toBeGreaterThanOrEqual(2);
    for (const r of reasons) expect(Object.keys(STAND_DOWN_REASONS)).toContain(r);
  });

  it('still tells the agent NOT to re-arm at an escalation — the marker is not a hand-back', () => {
    expect(brief).toMatch(/do \*\*not\*\* re-arm/i);   // markdown emphasis and all — the instruction is unchanged
  });
});
