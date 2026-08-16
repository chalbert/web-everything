/**
 * @file claim.test.mjs — the is-the-engine-too-heavy probe's declaration (#3034, under epic #3029).
 *
 * WHAT THIS FILE COVERS, matching the card's Done-when:
 *   - the three previously-untested IO-backed guards (queued / prepare-held / dirty-file), each refusing with
 *     the SAME text `we:scripts/backlog.mjs`'s old inline guard block used to `die()` with, and each overridden
 *     by `--force`;
 *   - the ownership invariant (`status: open` required) still refuses via `applyTransition`, not re-derived;
 *   - the full `read → plan → write` run through the engine + effect executor, with a stub reader/sink — no
 *     `fs`, no `git`;
 *   - a `write` effect replayed after a SIMULATED crash between `pending` and `applied` produces byte-identical
 *     output and does not double-apply (mirrors `effect-executor.test.mjs`'s own partial-failure discipline).
 */

import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import {
  CLAIM_EFFECT,
  CLAIM_OP,
  claimOperation,
  planClaim,
  shapeClaimRead,
} from '../claim.mjs';

/** A `readClaimContext` result for a claimable, open, undisturbed item — the happy-path baseline every test
 *  overrides from. */
function claimContext(overrides = {}) {
  return {
    found: true,
    abs: '/repo/backlog/042-example.md',
    rel: 'backlog/042-example.md',
    id: '042',
    status: 'open',
    content: '---\nkind: task\nsize: 1\nstatus: open\ndateOpened: "2026-08-01"\n---\n\n# Example\n',
    queued: false,
    held: false,
    heldBy: null,
    dirty: false,
    today: '2026-08-16',
    ...overrides,
  };
}

describe('shapeClaimRead', () => {
  it('refuses a raw reader result the io shell could not resolve to a file', () => {
    expect(() => shapeClaimRead({ found: false }, { ref: '042' })).toThrow(/no backlog item resolves/);
  });

  it('normalizes a found context into the read finding', () => {
    const read = shapeClaimRead(claimContext(), { ref: '042' });
    expect(read).toMatchObject({
      abs: '/repo/backlog/042-example.md',
      rel: 'backlog/042-example.md',
      id: '042',
      queued: false,
      held: false,
      heldBy: null,
      dirty: false,
    });
  });

  it('throws on a malformed (non-object) reader result rather than silently treating it as not-found', () => {
    expect(() => shapeClaimRead(null, { ref: '042' })).toThrow(/not a claim context/);
  });
});

describe('planClaim — the three IO-backed guards, replayed in we:scripts/backlog.mjs\'s own order', () => {
  it('refuses a QUEUED item with the exact ready-to-merge message', () => {
    const read = shapeClaimRead(claimContext({ queued: true }), { ref: '042' });
    expect(() => planClaim(read, { force: false })).toThrow(
      '#042 is queued (ready-to-merge, #2138 Fork 4) — a lane is pushed and waiting for the drain; it is not '
      + 'claimable. The drain unqueues it at landing; pass --force only to deliberately steal a stuck queue entry.',
    );
  });

  it('refuses a PREPARE-HELD item, naming the holder when known', () => {
    const read = shapeClaimRead(claimContext({ held: true, heldBy: 'session-a' }), { ref: '042' });
    expect(() => planClaim(read, { force: false })).toThrow(
      '#042 is prepare-held by session-a (#2219 (b) flow) — a session is preparing it in a lane; it is not '
      + 'claimable until the prepare-hold is released (`backlog.mjs prepare-release 042`). Pass --force only to '
      + 'deliberately steal a stuck hold.',
    );
  });

  it('refuses a PREPARE-HELD item with no recorded holder, omitting the "by X" clause', () => {
    const read = shapeClaimRead(claimContext({ held: true, heldBy: null }), { ref: '042' });
    expect(() => planClaim(read, { force: false })).toThrow(/^#042 is prepare-held \(#2219/);
  });

  it('refuses a DIRTY (uncommitted) item — the claim-first guard', () => {
    const read = shapeClaimRead(claimContext({ dirty: true }), { ref: '042' });
    expect(() => planClaim(read, { force: false })).toThrow(
      '#042 — backlog/042-example.md has uncommitted edits; a claim must be the first action on an item '
      + '(ground / edit / present AFTER claiming, next turn). Commit, stash, or revert those edits and re-claim '
      + '— or pass --force if this is deliberate (e.g. a freshly-scaffolded item).',
    );
  });

  it('--force overrides all three guards at once', () => {
    const read = shapeClaimRead(claimContext({ queued: true, held: true, heldBy: 'x', dirty: true }), { ref: '042' });
    const verdict = planClaim(read, { force: true });
    expect(verdict.claiming).toBe(true);
    expect(verdict.content).toContain('status: active');
  });

  it('still refuses on the ownership invariant (status must be "open") even with --force', () => {
    const read = shapeClaimRead(claimContext({ status: 'active', content: claimContext().content.replace('status: open', 'status: active') }), { ref: '042' });
    expect(() => planClaim(read, { force: true })).toThrow(/#042 — status is "active", expected "open"/);
  });

  it('claims to "active" by default and stamps dateStarted', () => {
    const read = shapeClaimRead(claimContext(), { ref: '042' });
    const verdict = planClaim(read, {});
    expect(verdict.claimedStatus).toBe('active');
    expect(verdict.content).toContain('status: active');
    expect(verdict.content).toContain('dateStarted: "2026-08-16"');
  });

  it('claims to "preparing" when as=preparing', () => {
    const read = shapeClaimRead(claimContext(), { ref: '042' });
    const verdict = planClaim(read, { as: 'preparing' });
    expect(verdict.claimedStatus).toBe('preparing');
    expect(verdict.content).toContain('status: preparing');
  });
});

describe('claimOperation — the full read → plan → write run', () => {
  /** Build an isolated registry + a run driven to `awaiting-effect`, off a stub reader. */
  function atWriteStep({ ref = '042', as, force, context = claimContext() } = {}) {
    const registry = createRegistry();
    const declaration = claimOperation({ readClaimContext: () => context });
    registry.register(declaration);
    let run = startRun({ op: CLAIM_OP, id: 'run-claim-1', input: { ref, ...(as ? { as } : {}), ...(force !== undefined ? { force } : {}) }, registry });
    run = advanceWhileRunning(run, { registry });
    expect(runStatus(run, { registry })).toBe('awaiting-effect');
    return { registry, run };
  }

  it('declares exactly one CLAIM_EFFECT carrying the spliced content', () => {
    const { run } = atWriteStep();
    const pending = run.effects.filter((e) => e.status !== 'applied');
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe(CLAIM_EFFECT);
    expect(pending[0].idempotent).toBe(true);
    expect(pending[0].payload.content).toContain('status: active');
    expect(pending[0].payload.abs).toBe('/repo/backlog/042-example.md');
  });

  it('applies through a sink and completes, and the verdict carries the claimed status', async () => {
    const { registry, run } = atWriteStep();
    const store = createMemoryRunStore();
    store.write(run);
    const writes = [];
    const sinks = { [CLAIM_EFFECT]: async (payload) => { writes.push(payload); return { abs: payload.abs }; } };
    const { run: afterApply } = await applyPendingEffects(run, { sinks, store });
    const complete = advanceWhileRunning(afterApply, { registry });
    expect(runStatus(complete, { registry })).toBe('complete');
    expect(complete.verdict.claiming).toBe(true);
    expect(complete.verdict.claimedStatus).toBe('active');
    expect(writes).toHaveLength(1);
    expect(writes[0].content).toContain('status: active');
  });

  it('a run whose guard refused never reaches the write step at all', () => {
    expect(() => atWriteStep({ context: claimContext({ queued: true }) })).toThrow(/is queued/);
  });

  it('replay after a simulated crash between pending and applied re-applies the SAME idempotent effect and '
    + 'produces byte-identical output, without a structural double-write', async () => {
    const { run } = atWriteStep();
    const store = createMemoryRunStore();
    store.write(run);
    const writes = [];
    const sinks = { [CLAIM_EFFECT]: async (payload) => { writes.push(payload.content); return { abs: payload.abs }; } };

    // First apply — lands normally.
    const first = await applyPendingEffects(run, { sinks, store });
    expect(first.applied).toHaveLength(1);
    const appliedEntry = first.run.effects.find((e) => e.type === CLAIM_EFFECT);
    expect(appliedEntry.status).toBe('applied');

    // SIMULATE a crash that landed the write but never recorded `applied` — the exact window
    // `we:scripts/operations/effect-executor.mjs`'s header calls INDETERMINATE. Roll the entry back to
    // `pending` by hand and replay.
    const crashed = { ...first.run, effects: first.run.effects.map((e) => (e.key === appliedEntry.key ? { ...e, status: 'pending' } : e)) };
    store.write(crashed);
    const replay = await applyPendingEffects(crashed, { sinks, store });

    expect(replay.applied).toHaveLength(1); // idempotent: true licenses the re-apply, not a refusal.
    expect(writes).toHaveLength(2); // the sink WAS called twice — this is what "idempotent" buys, not a skip.
    expect(writes[0]).toBe(writes[1]); // byte-identical output on both attempts.
    expect(replay.run.effects.find((e) => e.type === CLAIM_EFFECT).status).toBe('applied');
  });

  it('a genuinely SECOND apply after the entry already reads `applied` skips the sink entirely (no double-apply '
    + 'in the ordinary, non-crash replay path)', async () => {
    const { run } = atWriteStep();
    const store = createMemoryRunStore();
    store.write(run);
    let calls = 0;
    const sinks = { [CLAIM_EFFECT]: async (payload) => { calls += 1; return { abs: payload.abs }; } };
    const first = await applyPendingEffects(run, { sinks, store });
    expect(first.applied).toHaveLength(1);
    // `run.pending` is still the `write` effect step here — `applyPendingEffects` only ever mutates the
    // `effects` array; resolving `pending` itself needs a further `advance()`, which this test deliberately
    // skips so it can replay the SAME pending effect step a second time.
    const second = await applyPendingEffects(first.run, { sinks, store });
    expect(calls).toBe(1); // the sink was NOT called again — the entry already read `applied`.
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
  });
});

describe('claimOperation — construction guards', () => {
  it('refuses to build without an injected reader', () => {
    expect(() => claimOperation({})).toThrow(/needs a `readClaimContext/);
  });
});
