/**
 * @file dispatch-lane.test.mjs — the effect that STARTS rather than completes (#3037, under epic #3029).
 *
 * WHAT THIS FILE IS FOR. #3037's acceptance has two clauses, and the tests are grouped to match them:
 *
 *   1. **A lane is dispatched with the SAME holds and bookkeeping as the current tick.** The proof is
 *      structural, not statistical: the operation reads `decisions.spawnBuilds` and nothing else, `lane` is
 *      not an input field at all, and a `num` the core SUPPRESSED comes back as a non-dispatch carrying the
 *      guard's own reason. There is no path from a caller to a lane the core did not assign.
 *   2. **The launched agent's handle is recorded on the run.** Asserted here at the effect-entry level; the
 *      cross-process half — a second `node` that never saw the dispatch reading the handle off disk — is
 *      `./dispatch-crosses-processes.test.mjs`.
 *
 * NOTHING HERE SPAWNS AN AGENT, and that is the point of the injected `spawnAgent`: the argv is asserted
 * exactly (it is the contract with the `claude` CLI), and no `claude` process is ever started by the suite.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { importGraph } from './import-graph.mjs';
import { releaseSessionForNum } from '../../conveyor/tick-core.mjs';
import { normNum } from '../../conveyor/queue-store.mjs';
import { advance, advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects, inFlightEntries, isInFlightResult } from '../effect-executor.mjs';
import { observeRun } from '../effect-observer.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { OPERATIONS, resolveOperation } from '../run.mjs';
import {
  BRIEF_PLACEHOLDERS,
  DEFAULT_EXPECTED_WITHIN_MINUTES,
  DISPATCH_EFFECT,
  DISPATCH_HOLD_GRACE_MINUTES,
  DISPATCH_LANE_OP,
  canonicalPlaceholder,
  dispatchLaneOperation,
  dispatchStillHolds,
  fillBrief,
  sessionSlugFor,
  shapeDispatchRead,
} from '../dispatch-lane.mjs';
import {
  AGENT_ARGS_ENV,
  LISTING_GRACE_MS,
  agentArgsFromEnv,
  assertNotALaneCheckout,
  briefPath,
  buildAgentArgv,
  createDispatchObservers,
  createDispatchSinks,
  forwardableBookkeeping,
  inFlightDispatchesFor,
  isPreSpawnRefusal,
  readTick,
} from '../dispatch-lane-io.mjs';

const OPS_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * The cwd a dispatch is legitimately made from — a PRIMARY checkout. Stated explicitly rather than defaulted,
 * because the default (`REPO_ROOT`, resolved by script location) is a lane clone whenever the suite itself runs
 * in one, and the sink refuses to dispatch from a lane.
 */
const PRIMARY = '/primary/webeverything';

/** A brief template with every placeholder the operation fills, and nothing else. */
const BRIEF = [
  '# brief for #{{ITEM_NUM}}',
  'spec: {{ITEM_SPEC_PATH}}',
  'lane: {{LANE}}',
  'session: {{SESSION_SLUG}}',
  'scope: {{SCOPE}}',
].join('\n');

/** One tick read as the io shell returns it — already selected for the asked num. */
function tickRead(overrides = {}) {
  return {
    resolvedNum: '3037',
    launch: { num: '3037', lane: 8 },
    suppressed: null,
    item: { num: '3037', slug: 'declare-dispatch', specPath: 'backlog/3037-declare-dispatch.md', scope: ['we:scripts/operations/'] },
    briefTemplate: BRIEF,
    nextState: { tick: 1, buildGuards: [{ num: '3037', lane: 8, spawnedTick: 0 }, { num: '4000', lane: 9, spawnedTick: 0 }] },
    dispatchedGuard: { num: '3037', lane: 8, spawnedTick: 0 },
    statusLine: 'conveyor · 1 building · 0 preparing',
    notes: [],
    droppedBookkeepingKeys: [],
    inFlightDispatches: { runs: [], unreadable: 0 },
    bookkeepingSource: 'file',
    // WHEN the read was taken. The double-dispatch guard ages out against this, and the declaration is pure —
    // so the instant arrives as data. `NOW` is 10:00 and every in-flight fixture below is dated relative to it.
    observedAt: NOW,
    ...overrides,
  };
}

/** The instant every aging assertion is read against. */
const NOW = '2026-08-13T10:00:00.000Z';
/** An in-flight dispatch record summary, as `inFlightDispatchesFor` returns one. */
function inFlightRun(over = {}) {
  return { runId: 'dispatch-lane-abc', key: 'run-x#2#0', handle: 'sess-1', startedAt: '2026-08-13T09:30:00.000Z', expectedBy: '2026-08-13T11:00:00.000Z', ...over };
}
/** `at` shifted by minutes, as an ISO string. */
function isoPlus(at, minutes) {
  return new Date(Date.parse(at) + minutes * 60_000).toISOString();
}

/** A registry holding only this operation, built over a stub reader. */
function registryFor(read = tickRead()) {
  const registry = createRegistry();
  const declaration = dispatchLaneOperation({ readTick: () => (typeof read === 'function' ? read() : read) });
  registry.register(declaration);
  return { registry, declaration };
}

/** Drive a run to its first suspend (or completion). */
function runTo(read = tickRead(), input = { num: '3037' }) {
  const { registry } = registryFor(read);
  const run = advanceWhileRunning(startRun({ op: DISPATCH_LANE_OP, id: 'run-dispatch', input, registry }), { registry });
  return { run, registry };
}

// ── 1. the declaration is registered, and it reaches nothing ────────────────────────────────────────────────

describe('the operation is callable at all', () => {
  it('is in the OPERATIONS table — an unregistered declaration is the defect `gate-health` shipped with', () => {
    expect(Object.keys(OPERATIONS)).toContain(DISPATCH_LANE_OP);
    expect(resolveOperation(DISPATCH_LANE_OP).declaration.name).toBe(DISPATCH_LANE_OP);
  });

  it('binds a sink for the one effect type it declares — a dispatch with no sink refuses the whole step', () => {
    expect(Object.keys(resolveOperation(DISPATCH_LANE_OP).sinks)).toEqual([DISPATCH_EFFECT]);
  });

  it('the DECLARATION module reaches nothing that can act — no `node:` specifier, no package', () => {
    // The same technique the engine and the read-only operations use. This operation is NOT read-only (it has
    // an effect step), so the http-adapter suite does not cover it; the property is asserted here instead,
    // because "the spawner lives in the io shell" is otherwise only a claim in a comment.
    expect(importGraph(resolvePath(OPS_DIR, 'dispatch-lane.mjs')).external).toEqual([]);
  });
});

// ── 2. clause 1 — the holds are the tick core's, and a caller cannot reach around them ──────────────────────

describe('the lane comes from the tick core or nowhere', () => {
  it('does not declare a `lane` input — a caller cannot ask for one', () => {
    const { declaration } = registryFor();
    expect(Object.keys(declaration.input).sort()).toEqual(['bookkeepingFile', 'expectedWithinMinutes', 'num']);
    expect(declaration.input.num.type).toBe('string'); // an id may be a `xNNNNNN` hash, never only a number
    expect(declaration.input.expectedWithinMinutes.default).toBe(DEFAULT_EXPECTED_WITHIN_MINUTES);
  });

  it('dispatches the lane the core assigned', () => {
    const { run } = runTo(tickRead({ launch: { num: '3037', lane: 12 } }));
    expect(run.verdict).toMatchObject({ dispatching: true, lane: 12, sessionSlug: 'conveyor-3037' });
    expect(run.effects).toHaveLength(1);
    expect(run.effects[0].payload.lane).toBe(12);
  });

  it('a num SUPPRESSED by the in-flight guard is a non-dispatch carrying the guard\'s reason, not a launch', () => {
    const { run, registry } = runTo(tickRead({ launch: null, suppressed: { num: '3037', lane: 8, by: 'lane' } }));
    expect(run.verdict.dispatching).toBe(false);
    expect(run.verdict.reason).toMatch(/in-flight build guard/);
    expect(run.verdict.reason).toMatch(/lane 8 is held/);
    // ZERO effects → the run COMPLETES rather than parking. A tick where every item is held must not leave a
    // suspended record behind for the waker to poll forever.
    expect(run.effects).toEqual([]);
    expect(runStatus(run, { registry })).toBe('complete');
  });

  it('a num the core never cleared says so plainly', () => {
    const { run } = runTo(tickRead({ launch: null }));
    expect(run.verdict.dispatching).toBe(false);
    expect(run.verdict.reason).toMatch(/not in `decisions\.spawnBuilds`/);
  });

  it('records THIS dispatch\'s guard separately from the whole tick\'s, which describes work it did not do', () => {
    const { run } = runTo();
    // `planTick` records a guard per PLANNED spawn — here two, for #3037 and a sibling #4000 on lane 9. This
    // operation started one agent, so only one guard is earned. A caller that carried `tickNextState` forward
    // would hold #4000's lane for the whole TTL against a dispatch that never happened.
    expect(run.findings.read.dispatchedGuard).toEqual({ num: '3037', lane: 8, spawnedTick: 0 });
    expect(run.findings.read.tickNextState.buildGuards).toHaveLength(2);
    expect(run.findings.read.nextState).toBeUndefined(); // the name that invited the mistake is gone
    expect(run.verdict.guardsFrom).toBe('file');
  });

  it('reports a guard-LESS read on the verdict rather than passing it off as a guarded one', () => {
    const { run } = runTo(tickRead({ bookkeepingSource: 'none' }));
    expect(run.verdict.guardsFrom).toBe('none');
  });

  it('reports which of the caller\'s OWN settings the read did not honour, on the verdict', () => {
    // Dropping `config` is not purely conservative — a caller running a LONGER `buildTtlTicks` silently gets
    // the shipped default — so the drop has to be visible where the decision is read, not only in a comment.
    const { run } = runTo(tickRead({ droppedBookkeepingKeys: ['config', 'signals'] }));
    expect(run.verdict.droppedBookkeeping).toEqual(['config', 'signals']);
  });

  it('REFUSES a second dispatch while one of its own is still in flight for the item', () => {
    // The tick core's build guard lives in the caller's session bookkeeping, which defaults to empty here, and
    // the LANE is leased by the agent seconds after it starts — so two back-to-back invocations would get the
    // same cleared row and put two agents in one clone. The run store is what remembers the first one.
    const { run, registry } = runTo(tickRead({
      inFlightDispatches: { runs: [inFlightRun()], unreadable: 0 },
    }));
    expect(run.verdict.dispatching).toBe(false);
    expect(run.verdict.reason).toMatch(/already has a dispatch in flight/);
    expect(run.verdict.reason).toMatch(/dispatch-lane-abc/);
    expect(run.effects).toEqual([]);
    expect(runStatus(run, { registry })).toBe('complete');
    // …and it wins over a launch the core cleared, which is the whole point: the core cannot see this.
    expect(run.findings.read.lane).toBeNull();
    // The hold NAMES the way out, because there is one now — a hold whose only remedy is hand-written node is
    // how one completed dispatch used to lock an item out for the life of the runs directory.
    expect(run.verdict.reason).toMatch(/wake\.mjs --resolve=/);
  });

  // ── PR #1211 review, F1 (BLOCKER) — the guard must not be a permanent per-item lockout ─────────────────────
  //
  // The observer can never answer `succeeded`, `unresolved` writes nothing, and run records are never pruned.
  // Composed with a guard that held on ANY in-flight record, that made this operation single-use per item: the
  // conveyor's own loop (dispatch → PR → review bounces → re-dispatch) could never run through it.

  it('DISPATCHES AGAIN once an in-flight record is past its deadline — the guard ages out, it does not wedge', () => {
    // Same record as the refusal above, read 31 minutes past `expectedBy` + the grace margin. If the guard
    // still held here, one completed dispatch would lock #3037 out of ever dispatching again.
    const stale = inFlightRun({ expectedBy: isoPlus(NOW, -(DISPATCH_HOLD_GRACE_MINUTES + 1)) });
    const { run } = runTo(tickRead({ inFlightDispatches: { runs: [stale], unreadable: 0 } }));
    expect(run.verdict.dispatching).toBe(true);
    expect(run.effects).toHaveLength(1);
    // …and it is not silent about what it went past: the record is still `in-flight` on disk.
    expect(run.verdict.agedOutDispatches).toEqual(['dispatch-lane-abc']);
    expect(run.verdict.reason).toMatch(/aged-out in-flight dispatch record/);
  });

  it('a record still INSIDE its deadline plus the grace margin holds, and one past it does not', () => {
    // The window the guard exists for is the spawn→claim race, which is minutes wide. This is the boundary,
    // asserted on both sides so neither the deadline nor the margin can be dropped for free.
    const entry = { expectedBy: NOW, startedAt: isoPlus(NOW, -90) };
    expect(dispatchStillHolds(entry, isoPlus(NOW, DISPATCH_HOLD_GRACE_MINUTES - 1))).toBe(true);
    expect(dispatchStillHolds(entry, isoPlus(NOW, DISPATCH_HOLD_GRACE_MINUTES + 1))).toBe(false);
    // A handle-less INDETERMINATE entry never got an `expectedBy`; its deadline is reconstructed from
    // `startedAt` and the same estimate, so it ages out too rather than holding the item forever.
    const noDeadline = { expectedBy: null, startedAt: NOW };
    expect(dispatchStillHolds(noDeadline, isoPlus(NOW, DEFAULT_EXPECTED_WITHIN_MINUTES + DISPATCH_HOLD_GRACE_MINUTES - 1))).toBe(true);
    expect(dispatchStillHolds(noDeadline, isoPlus(NOW, DEFAULT_EXPECTED_WITHIN_MINUTES + DISPATCH_HOLD_GRACE_MINUTES + 1))).toBe(false);
    // FAIL-CLOSED on a date it cannot read: a wrong "aged out" is two agents in one clone, a wrong "still
    // holding" is a refusal an operator can see.
    expect(dispatchStillHolds({ expectedBy: null, startedAt: null }, NOW)).toBe(true);
    expect(dispatchStillHolds(entry, 'not a date')).toBe(true);
  });

  it('holds on the LIVE record even when a stale sibling exists — aging is per record, not per item', () => {
    const { run, registry } = runTo(tickRead({
      inFlightDispatches: {
        runs: [inFlightRun({ runId: 'stale-1', expectedBy: isoPlus(NOW, -120) }), inFlightRun({ runId: 'live-1' })],
        unreadable: 0,
      },
    }));
    expect(run.verdict.dispatching).toBe(false);
    expect(run.verdict.reason).toMatch(/live-1/);
    expect(run.verdict.reason).not.toMatch(/stale-1/);
    expect(run.verdict.agedOutDispatches).toEqual(['stale-1']);
    expect(runStatus(run, { registry })).toBe('complete');
  });

  // ── PR #1211 review, F4 — a claim wider than the code: the partial-guard count was read and dropped ────────

  it('SURFACES a partial double-dispatch guard on the verdict — an unreadable run record is not a clean zero', () => {
    // `inFlightDispatchesFor` skips a corrupt record rather than wedging every dispatch. That trade is only
    // acceptable if the caller can SEE it, and the guard's failure mode (two agents in one lane clone) is the
    // last thing that should degrade silently.
    const { run } = runTo(tickRead({ inFlightDispatches: { runs: [], unreadable: 2 } }));
    expect(run.verdict.dispatching).toBe(true);
    expect(run.verdict.unreadableRunRecords).toBe(2);
    // …and on a HOLD too, which is the exit that used to drop it as well.
    const held = runTo(tickRead({ inFlightDispatches: { runs: [inFlightRun()], unreadable: 3 } })).run;
    expect(held.verdict.dispatching).toBe(false);
    expect(held.verdict.unreadableRunRecords).toBe(3);
    // A complete guard says so with a number, not with an absent field.
    expect(runTo().run.verdict.unreadableRunRecords).toBe(0);
  });

  it('refuses a cleared item the core assigned no lane, rather than dispatching without one', () => {
    expect(() => runTo(tickRead({ launch: { num: '3037', lane: null } }))).toThrow(/assigned it no lane/);
  });

  it('refuses an unscoped item — an empty scope declares a lane that owns no paths', () => {
    const read = tickRead();
    expect(() => shapeDispatchRead({ ...read, item: { ...read.item, scope: [] } }, { num: '3037' }))
      .toThrow(/no `scope:`/);
  });

  it('refuses when no backlog file resolved — the brief needs the spec path', () => {
    expect(() => shapeDispatchRead({ ...tickRead(), item: null }, { num: '3037' })).toThrow(/no backlog file resolved/);
  });

  it('refuses a reader that answers with something other than a tick read', () => {
    expect(() => shapeDispatchRead(null, { num: '3037' })).toThrow(/not a tick read/);
    expect(() => shapeDispatchRead({ resolvedNum: '' }, { num: '3037' })).toThrow(/could not resolve/);
  });
});

// ── 3. the brief is FILLED, and a half-filled one never leaves the building ─────────────────────────────────

describe('filling the delivery brief', () => {
  const VALUES = { ITEM_NUM: '3037', ITEM_SPEC_PATH: 'backlog/3037-x.md', LANE: 8, SESSION_SLUG: 'conveyor-3037', SCOPE: 'we:a,we:b' };

  it('substitutes all five placeholders and leaves the prose alone', () => {
    const { prompt, unknownTokens } = fillBrief(BRIEF, VALUES);
    expect(prompt).toContain('# brief for #3037');
    expect(prompt).toContain('lane: 8');
    expect(prompt).toContain('scope: we:a,we:b');
    expect(prompt).not.toMatch(/\{\{/);
    expect(unknownTokens).toEqual([]);
  });

  it('FILLS THE REAL BRIEF ON DISK — the one file the whole operation depends on', () => {
    // THE TEST THIS FILE SHIPPED WITHOUT, and the defect it would have caught immediately: every other test
    // uses a synthetic five-token template, so a leftover-token REFUSAL that fired on the real brief's own
    // prose (`{{PLACEHOLDERS}}` / `{{LIKE_THIS}}`, both documentation) passed 40 green tests while making
    // every real dispatch throw. A stub template cannot stand in for the contract with a real file.
    const { prompt, unknownTokens } = fillBrief(readFileSync(briefPath(), 'utf8'), VALUES);
    expect(prompt).toContain('--lane=8');
    expect(prompt).toContain('--session=conveyor-3037');
    expect(prompt).toContain('--scope=we:a,we:b');
    expect(prompt).toContain('backlog/3037-x.md');
    // Not one of the five remains; the two the template talks ABOUT are reported, never fatal.
    for (const name of ['ITEM_NUM', 'ITEM_SPEC_PATH', 'LANE', 'SESSION_SLUG', 'SCOPE']) {
      expect(prompt).not.toContain(`{{${name}}}`);
    }
    expect(unknownTokens).toEqual(['{{LIKE_THIS}}', '{{PLACEHOLDERS}}']);
  });

  it('REPORTS an unknown token instead of refusing — the cost of a stray token is one confusing line', () => {
    const { prompt, unknownTokens } = fillBrief(`${BRIEF}\nmodel: {{MODEL}}`, VALUES);
    expect(unknownTokens).toEqual(['{{MODEL}}']);
    expect(prompt).toContain('model: {{MODEL}}');
  });

  it('cannot re-expand a token that arrived inside a VALUE', () => {
    // The allowlist has no `{` or `}`, so a value can never carry a token in the first place. The one-pass
    // substitution is the second line of defence and is deliberately NOT asserted here: with braces forbidden
    // there is no input that distinguishes one pass from a substitute-per-placeholder loop, and an assertion
    // that passes under both would be decorative. This is the reachable half.
    expect(() => fillBrief(BRIEF, { ...VALUES, ITEM_SPEC_PATH: 'backlog/{{SCOPE}}.md' })).toThrow(/cannot carry/);
  });

  it('refuses a value carrying shell metacharacters — the brief pastes SCOPE unquoted into a command', () => {
    expect(() => fillBrief(BRIEF, { ...VALUES, SCOPE: 'we:a;rm -rf /' })).toThrow(/cannot carry\s+safely/);
    expect(() => fillBrief(BRIEF, { ...VALUES, SCOPE: 'we:a`whoami`' })).toThrow(/cannot carry/);
    expect(() => fillBrief(BRIEF, { ...VALUES, ITEM_NUM: '3037\nrm -rf /' })).toThrow(/cannot carry/);
  });

  it('refuses an empty template and a blank value rather than dispatching a hollow brief', () => {
    expect(() => fillBrief('   ', {})).toThrow(/template is empty/);
    // ASSERT THE DISTINCT MESSAGE, not the token (PR #1211 review, F7). The first cut matched `/{{ITEM_NUM}}/`,
    // which the ALLOWLIST refusal's message also contains — so deleting the missing/blank branch entirely left
    // this green on the wrong error. The gap that hid behind it is real: `undefined` stringifies to the word
    // `'undefined'`, which PASSES `BRIEF_VALUE_RE`, so without this branch a missing value fills the brief with
    // the literal text `undefined` and nothing complains.
    expect(() => fillBrief(BRIEF, { ...VALUES, ITEM_NUM: '' })).toThrow(/no value for the brief placeholder \{\{ITEM_NUM\}\}/);
    expect(() => fillBrief(BRIEF, { ...VALUES, LANE: undefined })).toThrow(/no value for the brief placeholder \{\{LANE\}\}/);
    expect(() => fillBrief(BRIEF, { ...VALUES, SCOPE: null })).toThrow(/no value for the brief placeholder \{\{SCOPE\}\}/);
    expect(() => fillBrief(BRIEF, { ...VALUES, SESSION_SLUG: '   ' })).toThrow(/no value for the brief placeholder/);
    // …and the two refusals stay distinguishable, which is what the weak assertion could not tell.
    expect(() => fillBrief(BRIEF, { ...VALUES, SCOPE: 'we:a;rm -rf /' })).toThrow(/cannot carry/);
  });

  // ── PR #1211 review, F3 / F7 — the PROPERTY, not the input that happened to fail ───────────────────────────
  //
  // THE PROPERTY: no placeholder of this operation's own may reach a dispatched agent unsubstituted, in ANY
  // spelling — and the refusal must NAME which one. The round-1 fix (report leftovers instead of refusing) was
  // over-broad: its scan matched only `{{EXACT_UPPER}}`, so a near-miss was neither substituted nor reported,
  // and the regression test written for it was shaped to the one input that had failed.

  it('REFUSES every near-miss spelling of every placeholder, and names the one it meant', () => {
    // Table-driven over all five names × the spellings a human typo actually produces. Any one of these
    // reaching an agent is the failure: `export LANE_SESSION={{ SESSION_SLUG }}` leases under a bogus session
    // name that `pr-watch --release-session conveyor-<num>` never releases — a stranded lease.
    const variant = (name) => [`{{ ${name} }}`, `{{${name.toLowerCase()}}}`, `{{${name.replace(/_/g, '-')}}}`, `{{  ${name}}}`]
      // A name with no underscore (`LANE`, `SCOPE`) dashes to ITSELF — that is the correct spelling, not a typo.
      .filter((t) => t !== `{{${name}}}`);
    for (const name of BRIEF_PLACEHOLDERS) {
      for (const token of variant(name)) {
        const template = `${BRIEF}\ntypo: ${token}`;
        expect(() => fillBrief(template, VALUES), `${token} must be refused`).toThrow(/MISSPELLED placeholder/);
        // NAMES WHICH ONE — matched on the `(meaning …)` clause, not anywhere in the message: the refusal also
        // lists all five correct spellings, so a laxer pattern would pass for the wrong placeholder.
        expect(() => fillBrief(template, VALUES), `${token} must name {{${name}}}`).toThrow(new RegExp(`meaning \\{\\{${name}\\}\\}`));
      }
    }
    // The canonicalizer that decides "is this a misspelling OF one of ours" is the whole discrimination.
    expect(canonicalPlaceholder(' item-num ')).toBe('ITEM_NUM');
    expect(canonicalPlaceholder('LIKE_THIS')).toBeNull();
  });

  it('a token naming NOTHING we fill is still only reported — the round-1 fix is not undone', () => {
    // The correction must not re-break what it corrects: the real brief's own prose carries two tokens that
    // name no placeholder, and refusing those refused EVERY dispatch of EVERY item.
    const { prompt, unknownTokens } = fillBrief(`${BRIEF}\nmodel: {{ MODEL }}\nsee {{LIKE_THIS}}`, VALUES);
    expect(unknownTokens).toEqual(['{{ MODEL }}', '{{LIKE_THIS}}']);
    expect(prompt).toContain('model: {{ MODEL }}');
  });

  it('THE REAL BRIEF: mangling any one of its five tokens is refused, and a filled one carries none of them', () => {
    // The property asserted against the file on disk, one mutation at a time — this is the shape the round-1
    // regression test should have had. Its `toEqual` on `unknownTokens` passed with `{{SESSION_SLUG}}` typo'd
    // to `{{ SESSION_SLUG }}`, because the typo produced no unknown token at all.
    const real = readFileSync(briefPath(), 'utf8');
    for (const name of BRIEF_PLACEHOLDERS) {
      expect(real, `the brief must actually use {{${name}}}`).toContain(`{{${name}}}`);
      const typod = real.replace(`{{${name}}}`, `{{ ${name} }}`);
      expect(() => fillBrief(typod, VALUES), `a typo'd {{${name}}} must not reach an agent`).toThrow(/MISSPELLED placeholder/);
    }
    // And the clean fill leaves NO token of ours behind, in any spelling.
    const { prompt } = fillBrief(real, VALUES);
    for (const [, name] of prompt.matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)) {
      expect(canonicalPlaceholder(name), `${name} survived the fill`).toBeNull();
    }
  });

  it('the session slug agrees with the tick core\'s OWN releaseSessionForNum, imported not retyped', () => {
    // The first cut of this test hand-typed `'conveyor-3037'` on both sides while claiming to guard agreement
    // with the core — two literals cannot diverge, so it guarded nothing. The real risk is that the merge
    // watcher releases a session slug the agent never leased, and the lease strands.
    for (const num of ['3037', 'x0t9923', '42']) {
      expect(sessionSlugFor(num)).toBe(releaseSessionForNum(num, new Map()));
    }
    // THE RESIDUAL, pinned rather than papered over: the dispatcher slugs the NORMALIZED id while `armWatchers`
    // slugs the PR row's RAW one, so a zero-padded spelling would diverge. No id in this repo is padded (the
    // backlog numbers items plainly), which is why this is a pin and not a fix — but if one ever is, the lease
    // this dispatch takes is not the one the watcher releases.
    expect(sessionSlugFor(normNum('0042'))).not.toBe(releaseSessionForNum('0042', new Map()));
  });

  it('the filled brief rides the effect payload, so the record says what was dispatched', () => {
    const { run } = runTo();
    expect(run.effects[0].payload.prompt).toContain('lane: 8');
    expect(run.effects[0].payload.prompt).toContain('session: conveyor-3037');
    expect(run.effects[0].payload.prompt).toContain('scope: we:scripts/operations/');
  });
});

// ── 4. clause 2 — the effect STARTS work, and the handle is recorded ────────────────────────────────────────

describe('the declared effect is a dispatch', () => {
  it('declares exactly one effect, `dispatch: true` and NOT idempotent', () => {
    const { run, registry } = runTo();
    expect(runStatus(run, { registry })).toBe('awaiting-effect');
    expect(run.effects).toHaveLength(1);
    expect(run.effects[0]).toMatchObject({ type: DISPATCH_EFFECT, dispatch: true, idempotent: false, status: 'declared' });
  });

  it('records the handle and the deadline the sink reports, and STAYS suspended', async () => {
    const { run, registry } = runTo();
    const store = createMemoryRunStore();
    const sinks = createDispatchSinks({
      root: PRIMARY,
      spawnAgent: () => '',
      mintSessionId: () => '11111111-2222-3333-4444-555555555555',
      now: () => new Date('2026-08-13T10:00:00.000Z'),
    });
    const outcome = await applyPendingEffects(run, { sinks, store });
    const entry = outcome.run.effects[0];
    expect(entry.status).toBe('in-flight');
    expect(entry.handle).toBe('11111111-2222-3333-4444-555555555555');
    expect(entry.expectedBy).toBe('2026-08-13T11:30:00.000Z'); // 90 minutes, the declared default
    expect(entry.startedAt).toBeTruthy();
    expect(outcome.inFlight).toEqual([entry.key]);
    // The run does NOT advance past a step whose work is still going.
    expect(advance(outcome.run, { registry })).toEqual(outcome.run);
    // `running` vs `overdue` is read against an injected instant — inside the deadline it is healthy work.
    expect(inFlightEntries(outcome.run, '2026-08-13T10:30:00.000Z').running.map((e) => e.key)).toEqual([entry.key]);
    expect(inFlightEntries(outcome.run, '2026-08-13T12:00:00.000Z').overdue.map((e) => e.key)).toEqual([entry.key]);
  });

  it('a REPLAY does not start a second agent on the same lane', async () => {
    const { run } = runTo();
    const store = createMemoryRunStore();
    let spawns = 0;
    const sinks = createDispatchSinks({ root: PRIMARY, spawnAgent: () => { spawns += 1; return ''; }, mintSessionId: () => 'sess-a1' });
    const first = await applyPendingEffects(run, { sinks, store });
    const second = await applyPendingEffects(first.run, { sinks, store });
    expect(spawns).toBe(1);
    expect(second.inFlight).toEqual([first.run.effects[0].key]);
    expect(second.run.effects[0].handle).toBe('sess-a1');
  });

  it('honours a caller\'s own expectedWithinMinutes', async () => {
    const { run } = runTo(tickRead(), { num: '3037', expectedWithinMinutes: 15 });
    const store = createMemoryRunStore();
    const sinks = createDispatchSinks({
      root: PRIMARY, spawnAgent: () => '', mintSessionId: () => 'sess-b2', now: () => new Date('2026-08-13T10:00:00.000Z'),
    });
    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.run.effects[0].expectedBy).toBe('2026-08-13T10:15:00.000Z');
  });
});

// ── 5. the sink's argv IS the contract with the CLI ─────────────────────────────────────────────────────────

describe('what the sink actually runs', () => {
  const payload = { num: '3037', sessionSlug: 'conveyor-3037', prompt: '# build #3037' };

  it('pins the handle with --session-id instead of racing to discover it', () => {
    expect(buildAgentArgv({ sessionId: 'sess-c3', payload })).toEqual([
      '--bg', '--session-id', 'sess-c3', '-n', 'conveyor-3037', '# build #3037',
    ]);
  });

  it('REFUSES a brief beginning with a dash — position alone does not stop a parser reading it as a flag', () => {
    expect(() => buildAgentArgv({ sessionId: 'sess-c3', payload: { ...payload, prompt: '--bare and hostile' } }))
      .toThrow(/begins with `-`/);
  });

  it('forwards the operator\'s extra flags ahead of the prompt', () => {
    const argv = buildAgentArgv({ sessionId: 'sess-c3', payload, extraArgs: ['--model', 'sonnet'] });
    expect(argv[argv.length - 1]).toBe(payload.prompt);
    expect(argv.slice(-3, -1)).toEqual(['--model', 'sonnet']);
  });

  it('bakes in no permission flag — widening every agent is the operator\'s call, not this file\'s', () => {
    expect(buildAgentArgv({ sessionId: 'sess-c3', payload }).join(' ')).not.toMatch(/permission|dangerous/i);
    expect(agentArgsFromEnv({})).toEqual([]);
  });

  it('but the knob is REACHABLE from the environment, and a malformed one is refused not ignored', () => {
    expect(agentArgsFromEnv({ [AGENT_ARGS_ENV]: '["--permission-mode","acceptEdits"]' }))
      .toEqual(['--permission-mode', 'acceptEdits']);
    // Silently ignoring this is how an operator believes a flag is set that never was.
    expect(() => agentArgsFromEnv({ [AGENT_ARGS_ENV]: '--permission-mode acceptEdits' })).toThrow(/JSON array/);
    expect(() => agentArgsFromEnv({ [AGENT_ARGS_ENV]: '[1,2]' })).toThrow(/JSON array/);
  });

  it('refuses to dispatch from inside a lane clone — the agent\'s first act is to acquire a lane', async () => {
    expect(() => assertNotALaneCheckout('/x/.lanes/web-everything/lane-8')).toThrow(/refusing to start/);
    expect(() => assertNotALaneCheckout('/x/workspace/webeverything')).not.toThrow();
    // …and it is `notApplied`, so the entry is `failed` (retriable) rather than an unknown outcome.
    const { run } = runTo();
    const store = createMemoryRunStore();
    const sinks = createDispatchSinks({ root: '/x/.lanes/web-everything/lane-8', spawnAgent: () => '' });
    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.run.effects[0].status).toBe('failed');
  });

  it('refuses an empty prompt', () => {
    expect(() => buildAgentArgv({ sessionId: 'sess-c3', payload: { prompt: '  ' } })).toThrow(/empty prompt/);
  });

  it('a missing binary PROVES nothing started → `failed`, which is retried', async () => {
    const { run } = runTo();
    const store = createMemoryRunStore();
    const sinks = createDispatchSinks({
      root: PRIMARY,
      spawnAgent: () => { throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }); },
    });
    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(isPreSpawnRefusal({ code: 'ENOENT' })).toBe(true);
    expect(outcome.run.effects[0].status).toBe('failed');
  });

  it('any OTHER failure is INDETERMINATE — in-flight with no handle, refused on replay', async () => {
    const { run } = runTo();
    const store = createMemoryRunStore();
    const sinks = createDispatchSinks({ root: PRIMARY, spawnAgent: () => { throw new Error('exit 1'); } });
    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.run.effects[0]).toMatchObject({ status: 'in-flight', handle: null });
    // Reported as `unknown`, never `running` — and the replay guard refuses it rather than double-dispatching.
    expect(inFlightEntries(outcome.run).unknown).toHaveLength(1);
    await expect(applyPendingEffects(outcome.run, { sinks, store })).rejects.toThrow(/NO handle/);
  });

  it('the sink returns a real in-flight marker, not a look-alike', async () => {
    const sinks = createDispatchSinks({ root: PRIMARY, spawnAgent: () => '', mintSessionId: () => 'sess-d4' });
    expect(isInFlightResult(await sinks[DISPATCH_EFFECT]({ prompt: 'p', sessionSlug: 's', num: '1' }))).toBe(true);
  });
});

// ── 6. the observer answers liveness, and refuses to invent an outcome ──────────────────────────────────────

describe('observing a dispatched agent', () => {
  const entry = { key: 'k', type: DISPATCH_EFFECT, handle: 'sess-live', startedAt: '2026-08-13T10:00:00.000Z' };
  const later = () => new Date('2026-08-13T11:00:00.000Z');

  it('a listed session is `running`', async () => {
    const observers = createDispatchObservers({ listAgents: () => [{ sessionId: 'sess-live', kind: 'background' }], now: later });
    expect(await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' })).toMatchObject({ status: 'running' });
  });

  it('a session that is GONE is `unresolved` — never `succeeded`, because liveness is not an outcome', async () => {
    const observers = createDispatchObservers({ listAgents: () => [{ sessionId: 'someone-else' }], now: later });
    const answer = await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' });
    expect(answer.status).toBe('unresolved');
    expect(answer.error).toMatch(/liveness and not outcome/);
  });

  it('a session too young to be listed yet is still `running` — `--bg` returns before the listing settles', async () => {
    const observers = createDispatchObservers({
      listAgents: () => [],
      now: () => new Date(Date.parse(entry.startedAt) + LISTING_GRACE_MS - 1000),
    });
    expect(await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' })).toMatchObject({ status: 'running' });
  });

  it('an `unresolved` answer WRITES NOTHING — the entry stays in-flight and is reported for a person', async () => {
    const run = {
      v: 1, id: 'run-obs', op: DISPATCH_LANE_OP, input: {}, cursor: 2, findings: {}, verdict: null, pending: null,
      effects: [{
        key: 'run-obs#2#0', stepIndex: 2, step: 'dispatch', index: 0, type: DISPATCH_EFFECT,
        payload: {}, idempotent: false, dispatch: true, status: 'in-flight', handle: 'sess-live',
        startedAt: '2026-08-13T10:00:00.000Z', expectedBy: null, result: null, error: null,
      }],
    };
    const observers = createDispatchObservers({ listAgents: () => [], now: later });
    const out = await observeRun(run, { observers, now: later() });
    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toHaveLength(1);
    expect(out.run.effects[0].status).toBe('in-flight');
  });

  it('reads the session list ONCE per pass, however many entries it is asked about', async () => {
    // The read sits synchronously inside a waker pass that touches every parked run; one subprocess per entry
    // would multiply a slow `claude` by the size of the store.
    let calls = 0;
    const observers = createDispatchObservers({ listAgents: () => { calls += 1; return [{ sessionId: 'sess-live' }]; }, now: later });
    await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' });
    await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' });
    expect(calls).toBe(1);
  });

  it('does NOT memoize a failed read — a transient fault must not poison the rest of the pass', async () => {
    let calls = 0;
    const observers = createDispatchObservers({
      listAgents: () => { calls += 1; if (calls === 1) throw new Error('claude timed out'); return [{ sessionId: 'sess-live' }]; },
      now: later,
    });
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' })).rejects.toThrow(/timed out/);
    expect(await observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' })).toMatchObject({ status: 'running' });
  });

  it('refuses a listing that is not an array rather than reading it as "gone"', async () => {
    const observers = createDispatchObservers({ listAgents: () => ({}), now: later });
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'sess-live' })).rejects.toThrow(/did not return an array/);
  });
});

// ── 7. the reader shells the tick core, and nothing else ────────────────────────────────────────────────────

describe('the tick reader', () => {
  const TICK = {
    decisions: {
      spawnBuilds: [{ num: 3037, lane: 8 }, { num: 42, lane: 9 }],
      suppressedBuilds: [{ num: '0042', lane: 3, by: 'num' }],
      statusLine: 'conveyor · 2 building',
      notes: [{ kind: 'build-ttl', text: '⚠ #99 never claimed' }],
    },
    nextState: { tick: 4 },
  };
  const bindings = {
    runNode: () => JSON.stringify(TICK),
    readText: () => BRIEF,
    loadItems: () => [{ num: '3037', slug: 'declare-dispatch', scope: ['we:scripts/operations/'] }],
  };

  it('selects this item\'s launch with the tick\'s OWN normalizer, so `#042` and `42` are one item', () => {
    const out = readTick({ num: '#42', ...bindings });
    expect(out.resolvedNum).toBe('42');
    expect(out.launch).toEqual({ num: 42, lane: 9 });
    // …and the same normalizer finds the suppression row spelled with a padded id.
    expect(readTick({ num: '42', ...bindings, runNode: () => JSON.stringify({ decisions: { suppressedBuilds: TICK.decisions.suppressedBuilds } }) }).suppressed)
      .toEqual({ num: '0042', lane: 3, by: 'num' });
  });

  it('reports `bookkeepingSource: none` when no bookkeeping file is named, and pipes `{}` to the core', () => {
    let piped = null;
    const out = readTick({ num: '3037', ...bindings, runNode: (_argv, opts) => { piped = opts.input; return JSON.stringify(TICK); } });
    expect(piped).toBe('{}');
    expect(out.bookkeepingSource).toBe('none');
  });

  it('pipes the caller\'s live bookkeeping to the core when one is named', () => {
    let piped = null;
    const out = readTick({
      num: '3037', ...bindings, bookkeepingFile: '/tmp/bk.json',
      readText: (p) => (p === '/tmp/bk.json' ? '{"bookkeeping":{"tick":3}}' : BRIEF),
      runNode: (_argv, opts) => { piped = opts.input; return JSON.stringify(TICK); },
    });
    expect(piped).toBe('{"bookkeeping":{"tick":3}}');
    expect(out.bookkeepingSource).toBe('file');
    expect(out.nextState).toEqual({ tick: 4 });
  });

  it('DROPS the policy knobs a bookkeeping file can smuggle — config and signals never reach the core', () => {
    // `tick-core`'s shell reads `config` (buildTtlTicks, fixRetryCap, …) and `signals.returnedBuildNums`
    // (which retires live build guards) off the same STDIN. Forwarding the file verbatim would let whoever
    // writes it dial the very holds this operation exists to inherit: `{"config":{"buildTtlTicks":0}}` retires
    // every build guard on the spot and clears a lane that already has an agent on it.
    const forwarded = forwardableBookkeeping('{"bookkeeping":{"tick":3},"config":{"buildTtlTicks":0},"signals":{"returnedBuildNums":["3037"]}}');
    expect(JSON.parse(forwarded.stdin)).toEqual({ bookkeeping: { tick: 3 } });
    expect(forwarded.dropped.sort()).toEqual(['config', 'signals']);
  });

  it('accepts a BARE bookkeeping map too — `nextState` is exactly that shape', () => {
    const forwarded = forwardableBookkeeping('{"tick":3,"buildGuards":[]}');
    expect(JSON.parse(forwarded.stdin)).toEqual({ bookkeeping: { tick: 3, buildGuards: [] } });
    expect(forwarded.dropped).toEqual([]);
  });

  it('refuses an unreadable bookkeeping file rather than dispatching guard-less while claiming otherwise', () => {
    expect(() => forwardableBookkeeping('not json')).toThrow(/not parseable JSON/);
    expect(() => forwardableBookkeeping('[]')).toThrow(/must hold a JSON object/);
  });

  it('does not claim to have dropped what it actually forwarded — a malformed wrapper is a bare map', () => {
    // `{"bookkeeping": 3}` is not a wrapper, so the whole object IS the map and `config` was NOT dropped.
    // Deriving the report independently of the branch made it say otherwise.
    const forwarded = forwardableBookkeeping('{"bookkeeping":3,"config":{"buildTtlTicks":0}}');
    expect(forwarded.dropped).toEqual([]);
    expect(JSON.parse(forwarded.stdin).bookkeeping.config).toEqual({ buildTtlTicks: 0 });
  });

  it('STAMPS the instant the read was taken — the pure half ages its guard against this and has no clock', () => {
    // Without it nothing ever ages out and one completed dispatch locks its item out forever (review F1). The
    // declaration is pure by construction, so the clock can only arrive as data on the read.
    const out = readTick({ num: '3037', ...bindings, now: () => new Date('2026-08-13T10:00:00.000Z') });
    expect(out.observedAt).toBe('2026-08-13T10:00:00.000Z');
    // …and the DEFAULT is the real clock, not a null that would silently disable the aging in production.
    const live = Date.parse(readTick({ num: '3037', ...bindings }).observedAt);
    expect(Math.abs(live - Date.now())).toBeLessThan(60_000);
  });

  it('finds this operation\'s own in-flight dispatches in the run store, and survives one corrupt record', () => {
    const record = (id, num, status) => ({
      id,
      effects: [{
        key: `${id}#2#0`, type: DISPATCH_EFFECT, status, handle: 'sess-x',
        startedAt: '2026-08-13T09:00:00.000Z', expectedBy: '2026-08-13T10:30:00.000Z', payload: { num },
      }],
    });
    const store = {
      list: () => ['a', 'b', 'c', 'd'],
      read: (id) => {
        if (id === 'a') return record('a', 3037, 'in-flight');
        if (id === 'b') return record('b', '0042', 'in-flight'); // a different item, padded spelling
        if (id === 'c') return record('c', 3037, 'applied'); // settled — not in flight
        throw new Error('refusing to read run d — corrupt');
      },
    };
    const out = inFlightDispatchesFor('3037', { store });
    expect(out.runs.map((r) => r.runId)).toEqual(['a']);
    // THE DEADLINE RIDES EACH ROW. It is what `dispatchStillHolds` ages against; dropped, every hold falls back
    // to `startedAt` + the 90-minute estimate and outlives its real window by an hour and a half.
    expect(out.runs[0]).toMatchObject({ startedAt: '2026-08-13T09:00:00.000Z', expectedBy: '2026-08-13T10:30:00.000Z' });
    // Fail-soft per record: one corrupt file must not wedge every dispatch, but the caller is told the guard
    // was partial rather than being handed a confident empty answer.
    expect(out.unreadable).toBe(1);
  });

  it('resolves the item\'s spec path and repo-qualified scope from the canonical loader', () => {
    expect(readTick({ num: '3037', ...bindings }).item).toEqual({
      num: '3037', slug: 'declare-dispatch', specPath: 'backlog/3037-declare-dispatch.md', scope: ['we:scripts/operations/'],
    });
  });

  it('a tick that cannot be read is a refusal, never an empty plan that would look like "nothing to dispatch"', () => {
    expect(() => readTick({ num: '3037', ...bindings, runNode: () => { throw new Error('conveyor-state failed'); } }))
      .toThrow(/could not read the conveyor tick/);
  });

  it('refuses an id that normalizes to nothing', () => {
    expect(() => readTick({ num: '  ', ...bindings })).toThrow(/must be an item id/);
  });
});
