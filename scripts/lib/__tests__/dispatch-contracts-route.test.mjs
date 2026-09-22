import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as c from '../dispatch-contracts.mjs';

const profile = (extra = {}) => c.buildDispatchProfile({ taskType: 'doc-fix', estimatedLoc: 30, filesTouched: ['docs/readme.md'], acceptanceTestable: true, dependsOn: [], ...extra }).profile;
const card = (extra = {}) => ({ kind: 'story', size: 3, scope: ['src/example.js'], preparedDate: '2026-09-20', ...extra });
const record = (extra = {}) => ({ provider: 'codex', model: 'gpt-5', taskType: 'doc-fix', scoredAt: '2026-09-20T00:00:00Z', outcome: 'landed', verifiedBy: 'independent-claude', findings: null, subjectClass: 'work-agent', ...extra });
const history = () => [record({ scoredAt: '2026-09-01T00:00:00Z', outcome: 'reworked', findings: 'Corrected assertion' }), ...Array.from({ length: 5 }, (_, i) => record({ scoredAt: `2026-09-1${i}T00:00:00Z` }))];
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

describe('story routing', () => {
  it('routes cold builds to the fallback with a cheaper shadow', () => {
    expect(c.routeDispatch(profile(), { stage: 'story', kind: 'build' })).toMatchObject({ role: c.SUPERVISOR_ROLE, provider: 'claude', model: 'claude-opus-5', tier: 'opus', mode: 'acting', backend: 'claude-native', spotCheck: null, shadow: { provider: 'antigravity', mode: 'shadow' } });
  });
  it('retains existing non-build rungs and raises only for risk', () => {
    expect(c.STORY_KIND_RUNGS).toEqual({ prepare: 'sonnet', 'prepare-decision': 'opus', investigate: 'opus', fix: 'sonnet', 'ci-heal': 'sonnet' });
    for (const [kind, tier] of Object.entries(c.STORY_KIND_RUNGS)) {
      const out = c.routeDispatch(profile(), { stage: 'story', kind });
      expect(out).toMatchObject({ role: 'lane-agent', provider: 'claude', tier, model: c.CLAUDE_NATIVE_MODEL_BY_TIER[tier], supervision: 'full', alternateBackend: null });
      expect(out.auditTrail[0].criterion).toBe('story-kind-tier');
      expect(out.auditTrail.some((a) => a.criterion === 'trailing-clean-streak')).toBe(true);
      expect(c.routeDispatch(profile({ risk: 'high' }), { stage: 'story', kind }).tier).toBe('opus');
    }
  });
});

describe('task routing', () => {
  it('uses Claude fallback, including the router alternate backend', () => {
    expect(c.routeDispatch(profile(), { stage: 'task' })).toMatchObject({ role: 'task-agent', provider: 'claude', model: c.CLAUDE_NATIVE_MODEL_BY_TIER.haiku, tier: 'haiku', supervision: 'full', alternateBackend: null });
    expect(c.routeDispatch(profile({ estimatedLoc: 80 }), { stage: 'task' }).alternateBackend).toMatchObject({ tool: 'scripts/gemini-direct-task.mjs' });
    expect(c.routeDispatch(profile({ filesTouched: ['docs/agent/rules.md'] }), { stage: 'task', scorecards: history() })).toMatchObject({ provider: 'claude', tier: 'opus', alternateBackend: null });
  });
  it('keeps thin, unqualified history on both with full supervision', () => {
    const out = c.routeDispatch(profile(), { stage: 'task', scorecards: [record({ verifiedBy: 'other' }), record({ verifiedBy: 'other', model: 'gpt-6' })] });
    expect(out).toMatchObject({ provider: 'both', model: null, tier: null, supervision: 'full', alternateBackend: null });
    expect(out.auditTrail[0].criterion).toBe('both-supervision');
  });
  it('recovers the fit model by replaying fitness and records the actual provider', () => {
    for (const provider of ['gemini', 'antigravity']) {
      const out = c.routeDispatch(profile(), { stage: 'task', scorecards: [record({ provider, model: 'gemini-flash' })] });
      expect(out).toMatchObject({ provider, model: 'gemini-flash', tier: null, supervision: 'full' });
    }
    const out = c.routeDispatch(profile(), { stage: 'task', scorecards: [record({ model: 'bad-new', outcome: 'rejected' }), record({ model: 'good-old', scoredAt: '2026-09-01T00:00:00Z' })] });
    expect(out).toMatchObject({ provider: 'codex', model: 'good-old' });
    const mixed = [record({ provider: 'gemini', model: 'flash', scoredAt: '2026-09-01T00:00:00Z' }), record({ provider: 'antigravity', model: 'flash' })];
    expect(c.routeDispatch(profile(), { stage: 'task', scorecards: mixed }).provider).toBe('antigravity');
  });
  it('sorts missing timestamps last and honors Gemini cascade priority', () => {
    const rows = [record({ model: 'missing-date', scoredAt: undefined }), record({ model: 'dated' })];
    expect(c.routeDispatch(profile(), { stage: 'task', scorecards: rows }).model).toBe('dated');
    expect(c.routeDispatch(profile(), { stage: 'task', scorecards: [...rows, record({ provider: 'gemini', model: 'flash' })] }).provider).toBe('gemini');
  });
  it('raises graduated high-risk work back to full supervision, with own audit entries first', () => {
    expect(c.routeDispatch(profile(), { stage: 'task', scorecards: history() }).supervision).toBe('spot-check');
    const out = c.routeDispatch(profile({ risk: 'high' }), { stage: 'task', scorecards: history() });
    expect(out.supervision).toBe('full');
    expect(out.spotCheck).toBeNull();
  });
  it('returns byte-identical output for repeated, shuffled, key-reordered and frozen inputs', () => {
    const rows = [...history(), record({ model: 'another', handle: 'b' }), record({ model: 'another', handle: 'a' })];
    const p = freeze(profile()), frozen = freeze(rows);
    const before = JSON.stringify(frozen);
    const first = JSON.stringify(c.routeDispatch(p, { stage: 'task', scorecards: frozen }));
    expect(JSON.stringify(c.routeDispatch(p, { stage: 'task', scorecards: frozen }))).toBe(first);
    expect(JSON.stringify(c.routeDispatch(p, { stage: 'task', scorecards: { records: [...rows].reverse() } }))).toBe(first);
    const reorder = (x) => Object.fromEntries(Object.entries(x).reverse());
    expect(JSON.stringify(c.routeDispatch(reorder(p), { stage: 'task', scorecards: rows.map(reorder) }))).toBe(first);
    expect(JSON.stringify(frozen)).toBe(before);
  });
  it('ignores free text and cyclic irrelevant metadata', () => {
    const p = profile(); p.description = 'secret'; p.title = 'arbitrary'; p.metadata = p;
    const out = c.routeDispatch(p, { stage: 'task' });
    expect(JSON.stringify(out)).toBe(JSON.stringify(c.routeDispatch(profile(), { stage: 'task' })));
    expect(JSON.stringify(out)).not.toContain('secret');
  });
  it('fails closed with one audit entry per input error', () => {
    const out = c.routeDispatch({ ...profile(), risk: 'extreme' }, { stage: 'story', kind: 'unknown' });
    expect(out).toMatchObject({ role: 'refused', provider: null, model: null, tier: null, supervision: 'full', alternateBackend: null });
    expect(out.auditTrail).toHaveLength(2);
    for (const entry of out.auditTrail) expect(Object.keys(entry)).toEqual(['criterion', 'result', 'dataConsulted', 'reasoning']);
    for (const p of [null, [], 1, 'x']) expect(c.routeDispatch(p, { stage: 'task' }).role).toBe('refused');
    for (const options of [null, {}, { stage: 'unknown' }]) expect(c.routeDispatch(profile(), options).role).toBe('refused');
  });
});

// #3801 Fork 3 — the role path's interim tier: prepare/prepare-decision/investigate keep `routed: null` and no
// provider decision, but now record the STORY_KIND_RUNGS tier for their own authoring-role trust record.
describe('the role path\'s interim tier (#3801 Fork 3)', () => {
  const roleDispatch = (kind) => ({ kind, scopePaths: ['we:backlog/1.md'] });
  it('records the STORY_KIND_RUNGS tier for prepare, prepare-decision and investigate, with routed still null', () => {
    for (const kind of ['prepare', 'prepare-decision', 'investigate']) {
      const out = c.decideDispatchRoute(roleDispatch(kind));
      expect(out).toMatchObject({ outcome: 'role', role: kind, taskType: null, routed: null, model: null, tier: c.STORY_KIND_RUNGS[kind], supervision: 'full' });
    }
    expect(c.decideDispatchRoute(roleDispatch('prepare')).tier).toBe('sonnet');
    expect(c.decideDispatchRoute(roleDispatch('prepare-decision')).tier).toBe('opus');
    expect(c.decideDispatchRoute(roleDispatch('investigate')).tier).toBe('opus');
  });
  it('leaves review at tier: null — its subject key and positive control are the sibling slice', () => {
    expect(c.decideDispatchRoute(roleDispatch('review'))).toMatchObject({ outcome: 'role', role: 'review', routed: null, tier: null });
  });
});

// #3840 (Fork 5 of #3801) — the item's `deliveryAgent:` marker + required `deliveryAgentReason:` is the one override.
describe('the deliveryAgent marker override', () => {
  const dispatch = (extra = {}) => ({ kind: 'build', scopePaths: ['we:scripts/operations/example.mjs'], size: 3, ...extra });
  const trials = () => history().map((r) => ({ ...r, taskType: 'build-new-feature' }));
  it('refuses a marker with no reason, naming the field, and a reason with no marker', () => {
    expect(c.decideDispatchRoute(dispatch({ deliveryAgent: 'codex' })).refusal).toContain('deliveryAgentReason');
    expect(c.decideDispatchRoute(dispatch({ deliveryAgentReason: 'x' })).refusal).toContain('deliveryAgent:');
  });
  it('leaves routed as the criteria chose it and records the override beside it', () => {
    const plain = c.decideDispatchRoute(dispatch(), { scorecards: trials() });
    const over = c.decideDispatchRoute(dispatch({ deliveryAgent: 'claude-restricted', deliveryAgentReason: 'pin' }), { scorecards: trials() });
    expect(plain).toMatchObject({ routed: 'codex', supervision: 'spot-check' });
    expect(over).toMatchObject({ routed: 'codex', model: plain.model, override: { requestedVendor: 'claude-restricted', executedVendor: 'claude-restricted', reason: 'pin' } });
  });
  it('gives an override the supervision of its own triple: no trials means full, the routed spot-check is not inherited', () => {
    const over = c.decideDispatchRoute(dispatch({ deliveryAgent: 'claude-restricted', deliveryAgentReason: 'pin' }), { scorecards: trials() });
    expect(over.supervision).toBe('full');
    expect(over.spotCheck).toBeNull();
  });
});

// #3839 (Fork 4 field of #3801) — a task-only `estimatedLoc:` frontmatter field, distinct from a story's
// `size:` points, that `deriveDispatchProfile` reads for a task and refuses on any other kind.
describe('the task-only estimatedLoc field', () => {
  it('routes a task on its declared estimatedLoc and records sized: true, with no size required', () => {
    const out = c.deriveDispatchProfile(card({ kind: 'task', taskType: 'doc-fix', estimatedLoc: 80, size: undefined }));
    expect(out).toMatchObject({ ready: true, sized: true, profile: { estimatedLoc: 80 } });
  });
  it('refuses a story that declares estimatedLoc, as invalid', () => {
    expect(c.deriveDispatchProfile(card({ estimatedLoc: 80 }))).toEqual({ ready: false, missing: ['estimatedLoc:task-only'] });
  });
  it('refuses a non-numeric or non-positive estimatedLoc on a task', () => {
    for (const value of ['80', 0, 1.5, -1]) {
      const out = c.deriveDispatchProfile(card({ kind: 'task', taskType: 'doc-fix', estimatedLoc: value, size: undefined }));
      expect(out.ready).toBe(false);
      expect(out.missing).toContain('estimatedLoc:invalid');
    }
  });
});

// #3843 (Fork 4 (b) of #3801) — the checked-in unsized-card size policy: `unsizedCardPolicy` / `defaultSize` /
// `fixSizeSource`, as one setting, with every fallback recorded.
describe('the size-policy setting', () => {
  it('the checked-in setting loads as block, 13, and the three-step chain', () => {
    const raw = JSON.parse(readFileSync('scripts/lib/dispatch-size-policy.json', 'utf8'));
    expect(c.validateSizePolicy(raw)).toMatchObject({
      ok: true,
      policy: { unsizedCardPolicy: 'block', defaultSize: 13, fixSizeSource: ['card-size', 'measured-diff', 'assumed'] },
    });
    expect(c.DEFAULT_SIZE_POLICY).toEqual({ unsizedCardPolicy: 'block', defaultSize: 13, fixSizeSource: ['card-size', 'measured-diff', 'assumed'] });
  });
  it('refuses `fixSizeSource: [policy]` under `unsizedCardPolicy: block` as invalid', () => {
    const result = c.validateSizePolicy({ unsizedCardPolicy: 'block', defaultSize: 13, fixSizeSource: ['policy'] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('`policy`');
    expect(c.validateSizePolicy({ unsizedCardPolicy: 'default-size', defaultSize: 13, fixSizeSource: ['policy'] }).ok).toBe(true);
  });
  it('refuses a `defaultSize` below 13, naming #3784', () => {
    const result = c.validateSizePolicy({ unsizedCardPolicy: 'default-size', defaultSize: 2, fixSizeSource: ['card-size'] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('#3784');
    expect(c.validateSizePolicy({ unsizedCardPolicy: 'default-size', defaultSize: 13, fixSizeSource: ['card-size'] }).ok).toBe(true);
  });
  it('under default-size an unsized route records the setting as the source; a sized route records the card', () => {
    const base = { kind: 'build', scopePaths: ['we:scripts/operations/example.mjs'] };
    const unsized = c.decideDispatchRoute({ ...base }, {
      sizePolicy: { unsizedCardPolicy: 'default-size', defaultSize: 13, fixSizeSource: ['card-size', 'measured-diff', 'assumed'] },
    });
    expect(unsized.outcome).toBe('routed');
    expect(unsized.sized).toBe(false);
    expect(unsized.sizeSource).toBe('defaultSize=13');
    const sized = c.decideDispatchRoute({ ...base, size: 3 });
    expect(sized.outcome).toBe('routed');
    expect(sized.sized).toBe(true);
    expect(sized.sizeSource).toBe('card');
  });
});
