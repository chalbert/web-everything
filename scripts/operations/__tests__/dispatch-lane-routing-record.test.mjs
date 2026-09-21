/**
 * @file dispatch-lane-routing-record.test.mjs — #3717: the provider is COMPUTED before the spawn, and both
 *   halves of the decision land in the durable run record.
 *
 * WHAT THIS FILE PROVES, in the order the card's "Done when" asks for it:
 *
 *   1. **THE DERIVATION GATES THE SPAWN.** A dispatch whose `taskType` cannot be derived from the dispatch
 *      itself is a NON-DISPATCH with the derivation's own reason — not a dispatch routed on
 *      `provider-routing.mjs#selectProvider`'s silent `bugfix` default. This is the operator's acceptance
 *      test ("no model judgment anywhere between the dispatch kind and the chosen provider") in executable
 *      form: the only way to reach a provider is through the table.
 *   2. **`routed` AND `executed` BOTH LAND, AND A MISMATCH IS PRESERVED.** The sink writes the provider the
 *      criteria chose and the provider that actually ran. They differ whenever the router picks a non-Claude
 *      provider, because no Codex/Gemini provider port exists (#3443, #3658) — and that difference is the
 *      whole measurable output of this card.
 *   3. **THE OVERRIDE IS EXPLICIT AND RECORDED, OR IT IS REFUSED.** An override with no reason is refused; a
 *      complete one appears in the record with its reason beside the route the router would have taken.
 *   4. **SUPERVISION IS RECORDED, NOT ENFORCED** — until #3690 is ratified. Enforcement exists, off by
 *      default, behind one switch, and the default path is byte-identical to before.
 *
 * REAL MECHANISM WHERE THE SEAM IS IO (#2949): the run record assertions drive the REAL engine, the REAL
 * effect executor and the REAL `createDispatchSinks` sink over an in-memory run store, so what is asserted is
 * the record the executor actually writes. Only the two genuine process boundaries — the tick read and the
 * agent spawn — are injected, exactly as `./dispatch-lane.test.mjs` states in its own header.
 */

import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { DISPATCH_LANE_OP, DISPATCH_EFFECT, dispatchLaneOperation, shapeDispatchRead } from '../dispatch-lane.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import {
  EXECUTABLE_PROVIDER, decideDispatchRoute, estimatedLocForSize, supervisionEnforcementFrom, supervisionHold,
  SUPERVISION_ENFORCEMENT_ENV,
} from '../../lib/dispatch-contracts.mjs';

const NOW = '2026-09-21T10:00:00.000Z';
const BRIEF = '# brief\nitem {{ITEM_NUM}} spec {{ITEM_SPEC_PATH}} lane {{LANE}} slug {{SESSION_SLUG}} scope {{SCOPE}} base {{DELIVERY_BASE}}\n';
/** The repair kinds fill a different token set (`BRIEF_REQUIRED_BY_KIND.fix` / `.ci-heal`). */
const REPAIR_BRIEF = '# brief\nitem {{ITEM_NUM}} pr {{PR_NUM}} ref {{LANE_REF}} lane {{LANE}} slug {{SESSION_SLUG}} scope {{SCOPE}} {{ATTRIBUTION_KIND}} {{ATTRIBUTION_NUM}}\n';
const CI_HEAL_BRIEF = '# brief\nitem {{ITEM_NUM}} pr {{PR_NUM}} ref {{LANE_REF}} lane {{LANE}} slug {{SESSION_SLUG}} scope {{SCOPE}} why {{REASON}}\n';
/** `prepare`/`prepare-decision`/`investigate` fill the same five names and never `{{DELIVERY_BASE}}`. */
const AUTHORING_BRIEF = '# brief\nitem {{ITEM_NUM}} spec {{ITEM_SPEC_PATH}} lane {{LANE}} slug {{SESSION_SLUG}} scope {{SCOPE}}\n';
/** A `claude --bg` confirmation line whose short handle actually parses (lower-case hex, as the CLI prints). */
const BG_STDOUT = 'backgrounded · 1ae0905c · conveyor-3717\n';
/** A root that is not lane-shaped — `assertNotALaneCheckout` refuses those, and this suite is not about it. */
const PRIMARY = '/primary/webeverything';

/** A routing record as the io shell computes one, for the fixtures below. */
function route(over = {}) {
  return decideDispatchRoute({
    kind: 'build', cause: null, scopePaths: ['we:scripts/operations/example.mjs'], size: 3, ...over,
  }, { scorecards: over.scorecards ?? [], enforceSupervision: over.enforceSupervision === true });
}

function tickRead(over = {}) {
  const launchKind = over.launchKind ?? 'build';
  const repairs = launchKind === 'fix' || launchKind === 'ci-heal';
  return {
    resolvedNum: '3717',
    launch: { num: '3717', lane: 8, ...(repairs ? { pr: 4242, reason: 'ci-red' } : {}) },
    laneRef: repairs ? 'lane/3717' : null,
    launchKind,
    suppressed: null,
    item: { num: '3717', slug: 'route', specPath: 'backlog/3717-route.md', scope: ['we:scripts/operations/example.mjs'], size: 3 },
    briefTemplate: launchKind === 'ci-heal' ? CI_HEAL_BRIEF
      : repairs ? REPAIR_BRIEF
        : launchKind === 'build' ? BRIEF : AUTHORING_BRIEF,
    nextState: { tick: 1, buildGuards: [] },
    dispatchedGuard: { num: '3717', lane: 8, spawnedTick: 0 },
    statusLine: 'conveyor · 1 building',
    notes: [],
    droppedBookkeepingKeys: [],
    inFlightDispatches: { runs: [], unreadable: 0, livenessSource: 'not-needed' },
    bookkeepingSource: 'file',
    observedAt: NOW,
    routing: route({ kind: launchKind }),
    ...over,
  };
}

/** Drive the REAL engine over this operation to its first suspend. */
function runTo(read) {
  const registry = createRegistry();
  registry.register(dispatchLaneOperation({ readTick: () => read }));
  const run = advanceWhileRunning(startRun({ op: DISPATCH_LANE_OP, id: 'run-3717', input: { num: '3717' }, registry }), { registry });
  return { run, registry };
}

/** Apply the pending dispatch through the REAL sink, with only the spawn injected. */
function applyThroughSink(run, { routing }) {
  const store = createMemoryRunStore();
  store.write(run);
  const sinks = createDispatchSinks({
    root: PRIMARY,
    // Every registered kind forced onto the agent path, so the assertion is about the RECORD, not about which
    // wrapper a kind happens to have.
    modes: { build: 'agent', prepare: 'agent', fix: 'agent', 'ci-heal': 'agent', 'prepare-decision': 'agent' },
    spawnAgent: () => BG_STDOUT,
    now: () => new Date(NOW),
  });
  const payload = run.effects[0].payload;
  return { sinks, payload: { ...payload, routing: routing ?? payload.routing }, store };
}

describe('1. the derivation gates the spawn', () => {
  it('the pure derivation refusal IS the hold, and it is unreachable today because every kind is on the table', () => {
    // The refusal branch in `shapeDispatchRead` cannot be reached by a real dispatch: every member of
    // `LAUNCH_KINDS` maps to a taskType or a role (asserted in `../../lib/__tests__/dispatch-task-type.test.mjs`),
    // and the two dispatches that would refuse — an unknown kind, an unscoped build — are already refused
    // EARLIER by this same function (`LAUNCH_KINDS.includes` and the `no \`scope:\`` guard). That is the
    // desired state, not a gap: the gate exists so a kind added later cannot reach a provider without a row.
    expect(() => shapeDispatchRead(tickRead({ launchKind: 'transmogrify' }), { num: '3717', expectedWithinMinutes: 45 }))
      .toThrow(/unknown `launchKind`/);
    expect(() => shapeDispatchRead(tickRead({ item: { num: '3717', slug: 'route', specPath: 'backlog/3717-route.md', scope: [] } }), { num: '3717', expectedWithinMinutes: 45 }))
      .toThrow(/has no `scope:`/);
  });

  it('a route the io shell REFUSED holds the dispatch with the refusal, not with a default provider', () => {
    const refused = route({ providerOverride: 'codex' }); // an override with no reason
    expect(refused.outcome).toBe('refused');
    const read = shapeDispatchRead(tickRead({ routing: refused }), { num: '3717', expectedWithinMinutes: 45 });
    expect(read.dispatching).toBe(false);
    expect(read.holdReason).toContain('no mechanically computed dispatch route');
    expect(read.holdReason).toContain('override-reason');
    expect(read.routing.routed).toBeNull();
  });

  it('every launch kind the operation dispatches gets past the derivation', () => {
    for (const launchKind of ['build', 'fix', 'ci-heal', 'prepare', 'prepare-decision', 'investigate']) {
      const read = shapeDispatchRead(tickRead({ launchKind }), { num: '3717', expectedWithinMinutes: 45 });
      expect(read.dispatching, launchKind).toBe(true);
    }
  });

  it('the derived taskType rides the verdict and the effect payload, computed in the PURE half', () => {
    const { run } = runTo(tickRead());
    expect(run.verdict.taskType).toBe('build-new-feature');
    expect(run.effects[0].payload.taskType).toBe('build-new-feature');
    // a `fix` derives a different one from the same item, because the KIND decides
    const { run: fixRun } = runTo(tickRead({ launchKind: 'fix', routing: route({ kind: 'fix' }) }));
    expect(fixRun.verdict.taskType).toBe('bugfix');
  });

  it('a read with no routing record at all still dispatches, with the provider decision recorded as absent', () => {
    // Every hand-built fixture is in this state; the record says `null` rather than inventing a provider.
    const { run } = runTo(tickRead({ routing: undefined }));
    expect(run.verdict.dispatching).toBe(true);
    expect(run.verdict.routing).toBeNull();
    expect(run.verdict.taskType).toBe('build-new-feature');
  });
});

describe('2. routed and executed both land in the run record', () => {
  it('writes the routed provider, the executed provider, the taskType and the supervision level', async () => {
    const { run } = runTo(tickRead());
    const { sinks, payload } = applyThroughSink(run, {});
    const result = await sinks[DISPATCH_EFFECT](payload);
    expect(result.dispatch).toMatchObject({
      routedProvider: 'claude',
      executedProvider: EXECUTABLE_PROVIDER,
      routedTaskType: 'build-new-feature',
      supervisionLevel: 'full',
      supervisionEnforced: false,
      providerOverride: null,
    });
  });

  it('PRESERVES a mismatch — a non-Claude route executed by the Claude port stays visible as both halves', async () => {
    // The router reaches a non-Claude recommendation only with clean verified trials; an explicit override is
    // the other way, and it is the one a test can state without inventing trial history it does not have.
    const routed = route({ providerOverride: 'codex', overrideReason: 'operator trial of the codex port' });
    expect(routed.routed).toBe('codex');
    expect(routed.executed).toBe('claude');
    const { run } = runTo(tickRead({ routing: routed }));
    const { sinks, payload } = applyThroughSink(run, {});
    const result = await sinks[DISPATCH_EFFECT](payload);
    expect(result.dispatch.routedProvider).toBe('codex');
    expect(result.dispatch.executedProvider).toBe('claude');
    expect(result.dispatch.routedProvider).not.toBe(result.dispatch.executedProvider);
  });

  it('the whole decision survives into the DURABLE record the executor writes, not just the sink result', async () => {
    const { run } = runTo(tickRead());
    const store = createMemoryRunStore();
    store.write(run);
    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes: { build: 'agent', prepare: 'agent', fix: 'agent', 'ci-heal': 'agent', 'prepare-decision': 'agent' },
      spawnAgent: () => BG_STDOUT,
      now: () => new Date(NOW),
    });
    const outcome = await applyPendingEffects(run, { store, sinks: { [DISPATCH_EFFECT]: sinks[DISPATCH_EFFECT] } });
    const saved = outcome.run;
    const effect = saved.effects.find((e) => e.type === DISPATCH_EFFECT);
    // the decision rode the payload, so the record says what was routed even before the sink answered
    expect(effect.payload.routing.routed).toBe('claude');
    expect(effect.payload.routing.taskType).toBe('build-new-feature');
    expect(effect.payload.routing.auditTrail.some((a) => a.criterion === 'task-type-derivation')).toBe(true);
    // and the executor's own answer — the routed/executed pair — is on the effect, not only in the payload
    expect(effect.dispatch).toMatchObject({ routedProvider: 'claude', executedProvider: EXECUTABLE_PROVIDER });
  });
});

describe('3. the override is explicit, reasoned and recorded — or refused', () => {
  it('refuses an override with no reason, and a reason with no override', () => {
    expect(route({ providerOverride: 'codex' }).refusal).toContain('override-reason');
    expect(route({ overrideReason: 'because' }).refusal).toContain('provider-override');
  });

  it('refuses an override naming a provider that is not one', () => {
    expect(route({ providerOverride: 'skynet', overrideReason: 'why not' }).refusal).toContain('skynet');
  });

  it('records a complete override with its reason, beside what the router itself said', () => {
    const routed = route({ providerOverride: 'gemini', overrideReason: 'operator trial #3717' });
    expect(routed.override).toEqual({ provider: 'gemini', reason: 'operator trial #3717' });
    const entry = routed.auditTrail.find((a) => a.criterion === 'provider-override');
    expect(entry.result).toBe('gemini');
    expect(entry.dataConsulted).toContain('router said claude');
    expect(entry.reasoning).toBe('operator trial #3717');
  });
});

describe('4. supervision is recorded, not enforced, until #3690 is ratified', () => {
  it('is OFF by default and reads its switch from data, never from the ambient environment', () => {
    expect(supervisionEnforcementFrom({})).toBe(false);
    expect(supervisionEnforcementFrom({ [SUPERVISION_ENFORCEMENT_ENV]: '' })).toBe(false);
    expect(supervisionEnforcementFrom({ [SUPERVISION_ENFORCEMENT_ENV]: '1' })).toBe(true);
    expect(supervisionEnforcementFrom({ [SUPERVISION_ENFORCEMENT_ENV]: 'TRUE' })).toBe(true);
    expect(supervisionEnforcementFrom({ [SUPERVISION_ENFORCEMENT_ENV]: 'off' })).toBe(false);
  });

  it('THROWS on a typo rather than silently disabling the gate', () => {
    expect(() => supervisionEnforcementFrom({ [SUPERVISION_ENFORCEMENT_ENV]: 'ture' })).toThrow(/must be 1\/true\/on/);
  });

  it('holds nothing while off, and holds a full-supervision dispatch with no supervisor while on', () => {
    const full = { supervision: 'full' };
    expect(supervisionHold(full, { enforce: false })).toBeNull();
    expect(supervisionHold(full, { enforce: true })).toContain('names no supervisor');
    expect(supervisionHold({ supervision: 'spot-check' }, { enforce: true })).toBeNull();
    expect(supervisionHold({ supervision: 'full', supervisor: { provider: 'claude' } }, { enforce: true })).toBeNull();
  });

  it('with the switch ON, the dispatch path holds — and with it off the same dispatch goes', () => {
    const enforced = route({ enforceSupervision: true });
    expect(enforced.supervisionHold).toBeTruthy();
    const held = shapeDispatchRead(tickRead({ routing: enforced }), { num: '3717', expectedWithinMinutes: 45 });
    expect(held.dispatching).toBe(false);
    expect(held.holdReason).toContain('supervision gate');

    const recorded = route();
    expect(recorded.supervisionHold).toBeNull();
    expect(recorded.supervision).toBe('full');
    expect(shapeDispatchRead(tickRead({ routing: recorded }), { num: '3717', expectedWithinMinutes: 45 }).dispatching).toBe(true);
  });
});

describe('the estimated-LOC read overstates rather than understates an unsized card', () => {
  it('uses the card\'s own size when it has one', () => {
    expect(estimatedLocForSize(3)).toEqual({ estimatedLoc: 150, sized: true });
    expect(estimatedLocForSize('5')).toEqual({ estimatedLoc: 300, sized: true });
  });

  it('reads an absent or unknown size as the LARGEST band — outside every proven envelope', () => {
    for (const size of [undefined, null, '', 0, 7, 'big', {}]) {
      const got = estimatedLocForSize(size);
      expect(got.sized).toBe(false);
      expect(got.estimatedLoc).toBe(900);
    }
  });

  it('an unsized card still routes, and the record says the size was not the card\'s', () => {
    const unsized = route({ size: null });
    expect(unsized.outcome).toBe('routed');
    expect(unsized.sized).toBe(false);
    expect(unsized.auditTrail.find((a) => a.criterion === 'estimated-loc').reasoning).toContain('largest band');
  });
});
