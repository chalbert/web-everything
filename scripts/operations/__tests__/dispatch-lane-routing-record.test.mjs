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
 *   3. **THE OVERRIDE IS THE ITEM'S OWN MARKER, EXPLICIT AND RECORDED, OR IT IS REFUSED** (#3840, Fork 5 of
 *      #3801). `deliveryAgent:` with no `deliveryAgentReason:` is refused; a complete one is recorded BESIDE
 *      `routed` (which stays the criteria's choice) and supervised as its own triple. No process-wide
 *      environment variable reaches the router any more.
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
  EXECUTABLE_PROVIDER, DELIVERY_VENDOR_PROVIDERS, decideDispatchRoute, estimatedLocForSize, supervisionEnforcementFrom,
  supervisionHold, SUPERVISION_ENFORCEMENT_ENV,
} from '../../lib/dispatch-contracts.mjs';
import { DELIVERY_AGENT_PROVIDER_NAMES } from '../deliver-item-wrapper.mjs';
import { readTick } from '../dispatch-lane-io.mjs';

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

/** Trial history that makes the criteria route a `build` to codex, at `spot-check` (5 clean verified trials after one
 *  informative rework) — the same shape `dispatch-contracts-route.test.mjs` uses for `doc-fix`. */
const CODEX_TRIALS = [
  { provider: 'codex', model: 'gpt-5', taskType: 'build-new-feature', scoredAt: '2026-09-01T00:00:00Z', outcome: 'reworked', verifiedBy: 'independent-claude', findings: 'Corrected assertion' },
  ...Array.from({ length: 5 }, (_, i) => ({ provider: 'codex', model: 'gpt-5', taskType: 'build-new-feature', scoredAt: `2026-09-1${i}T00:00:00Z`, outcome: 'landed', verifiedBy: 'independent-claude', findings: null })),
];

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
    const refused = route({ deliveryAgent: 'codex' }); // a marker with no reason
    expect(refused.outcome).toBe('refused');
    const read = shapeDispatchRead(tickRead({ routing: refused }), { num: '3717', expectedWithinMinutes: 45 });
    expect(read.dispatching).toBe(false);
    expect(read.holdReason).toContain('no mechanically computed dispatch route');
    expect(read.holdReason).toContain('deliveryAgentReason');
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
    // The router reaches a non-Claude recommendation only with clean verified trials (#3840: the override no
    // longer manufactures a route — `routed` is the criteria's choice alone).
    const routed = route({ scorecards: CODEX_TRIALS });
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

describe('3. the override is the item\'s own marker, reasoned and recorded — or refused', () => {
  it('(a) refuses a `deliveryAgent:` marker with no `deliveryAgentReason:`, naming the missing field', () => {
    const refused = route({ deliveryAgent: 'codex' });
    expect(refused.outcome).toBe('refused');
    expect(refused.refusal).toContain('deliveryAgentReason');
    expect(refused.refusal).toContain('deliveryAgent: codex');
    // a blank reason is no reason
    expect(route({ deliveryAgent: 'codex', deliveryAgentReason: '   ' }).refusal).toContain('deliveryAgentReason');
  });

  it('refuses a reason with no marker, and a vendor that is not registered', () => {
    expect(route({ deliveryAgentReason: 'because' }).refusal).toContain('deliveryAgent:');
    const unknown = route({ deliveryAgent: 'antigravity', deliveryAgentReason: 'why not' });
    expect(unknown.refusal).toContain('antigravity');
    expect(unknown.refusal).toContain('claude-restricted, codex');
  });

  it('(b) keeps `routed` as the criteria\'s choice and records the override BESIDE it, in the rule-4 field names', () => {
    const routed = route({ deliveryAgent: 'codex', deliveryAgentReason: 'operator trial #3840' });
    expect(routed.outcome).toBe('routed');
    // no scorecards: the criteria chose Claude — the marker did NOT rewrite it
    expect(routed.routed).toBe('claude');
    expect(routed.override).toEqual({ requestedVendor: 'codex', executedVendor: 'codex', reason: 'operator trial #3840' });
    expect(routed.model).toBe(route().model);
    const entry = routed.auditTrail.find((a) => a.criterion === 'provider-override');
    expect(entry.result).toBe('codex');
    expect(entry.dataConsulted).toContain('criteria routed claude');
    expect(entry.reasoning).toBe('operator trial #3840');
  });

  it('the override rides onto the durable dispatch record beside routedProvider, which is still the criteria\'s', async () => {
    const routing = route({ deliveryAgent: 'codex', deliveryAgentReason: 'operator trial #3840' });
    const { run } = runTo(tickRead({ routing }));
    const { sinks, payload } = applyThroughSink(run, {});
    const result = await sinks[DISPATCH_EFFECT](payload);
    expect(result.dispatch.routedProvider).toBe('claude');
    expect(result.dispatch.providerOverride).toEqual({ requestedVendor: 'codex', executedVendor: 'codex', reason: 'operator trial #3840' });
  });

  it('(c) supervises an override as its OWN triple: routed at spot-check, override with no trials starts at full', () => {
    const plain = route({ scorecards: CODEX_TRIALS });
    expect(plain).toMatchObject({ routed: 'codex', model: 'gpt-5', supervision: 'spot-check' });
    // an override to a triple with NO trials (claude has none here) must not inherit codex's spot-check
    const overridden = route({ scorecards: CODEX_TRIALS, deliveryAgent: 'claude-restricted', deliveryAgentReason: 'pin to claude' });
    expect(overridden.routed).toBe('codex'); // still the criteria's choice
    expect(overridden.override.requestedVendor).toBe('claude-restricted');
    expect(overridden.supervision).toBe('full');
    expect(overridden.spotCheck).toBeNull();
    const entry = overridden.auditTrail.find((a) => a.criterion === 'override-supervision');
    expect(entry.result).toBe('full');
    expect(entry.dataConsulted).toContain('routed triple was spot-check');
  });

  it('an override onto the routed triple keeps that triple\'s own supervision (same provider, same model)', () => {
    const same = route({ scorecards: CODEX_TRIALS, deliveryAgent: 'codex', deliveryAgentReason: 'pin to codex' });
    expect(same.routed).toBe('codex');
    expect(same.supervision).toBe('spot-check');
  });

  it('a marker on a kind that does not honour it is neither recorded nor refused', () => {
    for (const kind of ['prepare', 'prepare-decision', 'investigate']) {
      const r = route({ kind, deliveryAgent: 'codex' }); // no reason — would be refused on a build
      expect(r.outcome, kind).toBe('role');
      expect(r.override, kind).toBeNull();
    }
  });

  it('never bypasses sizing: an override on an unsized card is still read as the largest band', () => {
    const r = route({ size: null, deliveryAgent: 'codex', deliveryAgentReason: 'operator trial' });
    expect(r.sized).toBe(false);
    expect(r.estimatedLoc).toBe(estimatedLocForSize(null).estimatedLoc);
  });

  it('the marker vocabulary is exactly the registered delivery vendors, so the two lists cannot drift', () => {
    expect(Object.keys(DELIVERY_VENDOR_PROVIDERS)).toEqual(DELIVERY_AGENT_PROVIDER_NAMES);
  });
});

describe('3b. #3840 — no process-wide environment variable reaches the routing decision', () => {
  const BLOCKS = { num: '3717', slug: 'route', specPath: 'backlog/3717-route.md', scope: ['we:scripts/operations/example.mjs'], size: 3 };
  const tick = JSON.stringify({ decisions: { spawnBuilds: [{ num: '3717', lane: 8 }] }, nextState: { tick: 1, buildGuards: [] } });
  const read = (env, marker) => {
    const saved = {};
    for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
    try {
      return readTick({
        num: '3717', root: PRIMARY,
        runNode: () => tick,
        readText: () => BRIEF,
        loadItems: () => [BLOCKS],
        listInFlightDispatches: () => ({ runs: [], unreadable: 0, livenessSource: 'not-needed' }),
        listAgents: () => [],
        recordLiveness: (s) => s,
        checkAlreadyDone: () => ({ done: false, pr: null, checked: true }),
        readScorecards: () => [],
        readDeliveryAgentOverride: () => marker,
        now: () => new Date(NOW),
      });
    } finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  };

  it('the retired variables change nothing: same routing record with and without them', () => {
    const clean = read({}, null);
    const polluted = read({ WE_DISPATCH_PROVIDER_OVERRIDE: 'codex', WE_DISPATCH_OVERRIDE_REASON: 'stale export', DELIVERY_AGENT_PROVIDER: 'codex' }, null);
    expect(clean.routing.outcome).toBe('routed');
    expect(polluted.routing).toEqual(clean.routing);
    expect(polluted.routing.override).toBeNull();
  });

  it('the io edge hands the item\'s marker to the router: read from the item, refused with no reason', () => {
    const refused = read({}, { deliveryAgent: 'codex', deliveryAgentReason: null });
    expect(refused.routing.outcome).toBe('refused');
    expect(refused.routing.refusal).toContain('deliveryAgentReason');
    const ok = read({}, { deliveryAgent: 'codex', deliveryAgentReason: 'operator trial' });
    expect(ok.routing.override).toEqual({ requestedVendor: 'codex', executedVendor: 'codex', reason: 'operator trial' });
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
