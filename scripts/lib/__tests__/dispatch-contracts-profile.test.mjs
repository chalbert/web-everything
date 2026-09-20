import { describe, it, expect } from 'vitest';
import * as c from '../dispatch-contracts.mjs';

const raw = (extra = {}) => ({ taskType: 'doc-fix', estimatedLoc: 30, filesTouched: ['docs/readme.md'], acceptanceTestable: true, dependsOn: [], ...extra });
const card = (extra = {}) => ({ kind: 'story', size: 3, scope: ['src/example.js'], preparedDate: '2026-09-20', ...extra });

describe('risk and complexity derivation', () => {
  it('uses envelopes then the bounded Sonnet ceilings', () => {
    expect(c.M_COMPLEXITY_MAX_LOC).toBe(500); expect(c.M_COMPLEXITY_MAX_FILES).toBe(8);
    for (const [type, loc, files, expected] of [['doc-fix', 100, 2, 'S'], ['doc-fix', 101, 2, 'M'], ['bugfix', 250, 4, 'S'], ['doc-fix', 500, 8, 'M'], ['other', 501, 1, 'L'], ['other', 30, 9, 'L']]) expect(c.deriveComplexity(type, loc, files)).toBe(expected);
  });
  it('derives high stakes, statute, large and untestable risks', () => {
    expect(c.deriveRisk('doc-fix', ['docs/agent/a.md'], 'S', true)).toBe('high');
    expect(c.deriveRisk('bugfix', ['scripts/lib/a.mjs', 'tests/a.test.mjs'], 'S', true)).toBe('high');
    expect(c.deriveRisk('doc-fix', ['a'], 'L', true)).toBe('medium');
    expect(c.deriveRisk('doc-fix', ['a'], 'S', false)).toBe('medium');
    expect(c.deriveRisk('doc-fix', ['a'], 'S', true)).toBe('low');
    expect(c.deriveRisk('doc-fix', ['special'], 'S', true, { isStatutePath: (p) => p === 'special' })).toBe('high');
    expect(c.raiseRisk('high', 'low')).toBe('high'); expect(c.raiseRisk('low', 'high')).toBe('high');
    for (const x of [undefined, 'bad', null]) expect(c.raiseRisk('medium', x)).toBe('medium');
  });
  it('builds derived profiles without mutating input, allowing only raises', () => {
    const input = Object.freeze(raw({ filesTouched: Object.freeze(['docs/agent/a.md']), dependsOn: Object.freeze([]), risk: 'low' }));
    const built = c.buildDispatchProfile(input);
    expect(built.ok).toBe(true); expect(built.profile.risk).toBe('high');
    expect(built.profile.filesTouched).not.toBe(input.filesTouched);
    expect(c.buildDispatchProfile(raw({ risk: 'high' })).profile.risk).toBe('high');
    expect(c.validateDispatchProfile(built.profile).ok).toBe(true);
  });
  it.each([
    ['taskType', 'bad'], ['estimatedLoc', 0], ['estimatedLoc', 1.5], ['estimatedLoc', Infinity], ['estimatedLoc', '30'], ['filesTouched', []], ['filesTouched', ['a', 'a']], ['filesTouched', ['/a']], ['filesTouched', 'a'], ['acceptanceTestable', 'true'], ['dependsOn', undefined], ['dependsOn', ['a', 'a']], ['dependsOn', [' ']], ['risk', 'bad'], ['risk', undefined],
  ])('rejects invalid raw %s', (key, value) => {
    expect(c.buildDispatchProfile(raw({ [key]: value }))).toMatchObject({ ok: false, profile: null });
    expect(c.validateDispatchProfile({ ...c.buildDispatchProfile(raw()).profile, [key]: value }).ok).toBe(false);
  });
  it('rejects forged derived risk and complexity', () => {
    const p = c.buildDispatchProfile(raw({ estimatedLoc: 900 })).profile;
    expect(c.validateDispatchProfile({ ...p, complexity: 'S' }).errors).toContain('complexity must equal derived L');
    expect(c.validateDispatchProfile({ ...p, complexity: 'XL' }).ok).toBe(false);
    const statute = c.buildDispatchProfile(raw({ filesTouched: ['docs/agent/a'] })).profile;
    expect(c.validateDispatchProfile({ ...statute, risk: 'low' }).errors).toContain('risk must be at least derived high');
    expect(c.validateDispatchProfile(c.buildDispatchProfile(raw({ risk: 'high' })).profile).ok).toBe(true);
    expect(c.buildDispatchProfile(raw(), { isStatutePath() { throw Error('oops'); } }).ok).toBe(false);
  });
});

describe('prepared-card readiness', () => {
  it('exposes exactly the six auditable size rows', () => {
    expect(c.SIZE_TO_ESTIMATED_LOC).toEqual({ 1: 30, 2: 80, 3: 150, 5: 300, 8: 500, 13: 900 });
    for (const [size, loc] of Object.entries(c.SIZE_TO_ESTIMATED_LOC)) for (const value of [size, Number(size)]) expect(c.deriveDispatchProfile(card({ size: value })).profile.estimatedLoc).toBe(loc);
  });
  it('normalizes scope prefixes, whitespace, deduplication and blocked ids', () => {
    const out = c.deriveDispatchProfile(card({ scope: ['we:./src/a', 'src/a', 'fui:blocks/b', './docs/c', '', ' '], blockedBy: [' 42 ', 42, '', 'we#1'] }));
    expect(out.ready).toBe(true);
    expect(out.profile.filesTouched).toEqual(['src/a', 'fui/blocks/b', 'docs/c']);
    expect(out.profile.dependsOn).toEqual(['42', 'we#1']);
    expect(c.deriveDispatchProfile(card({ scope: 'we:./a', blockedBy: '42' })).profile.dependsOn).toEqual(['42']);
    expect(c.deriveDispatchProfile(card({ blockedBy: 42 })).profile.dependsOn).toEqual(['42']);
  });
  it('uses kind mappings, explicit types and acceptance defaults', () => {
    for (const [kind, taskType] of Object.entries(c.TASK_TYPE_BY_CARD_KIND)) expect(c.deriveDispatchProfile(card({ kind })).profile.taskType).toBe(taskType);
    const input = card(); delete input.kind;
    expect(c.deriveDispatchProfile(input).profile.taskType).toBe('other');
    expect(c.deriveDispatchProfile(card({ taskType: 'doc-fix' })).profile.taskType).toBe('doc-fix');
    expect(c.deriveDispatchProfile(card()).profile.acceptanceTestable).toBe(true);
    expect(c.deriveDispatchProfile(card({ acceptanceTestable: false })).profile.risk).toBe('medium');
  });
  it('never lets a card lower derived risk', () => {
    expect(c.deriveDispatchProfile(card({ scope: ['docs/agent/a'], risk: 'low' })).profile.risk).toBe('high');
    expect(c.deriveDispatchProfile(card({ risk: 'high' })).profile.risk).toBe('high');
  });
  it.each([
    ['preparedDate', undefined, 'preparedDate'], ['preparedDate', ' ', 'preparedDate'], ['preparedDate', 'today', 'preparedDate'],
    ['scope', undefined, 'scope'], ['scope', [], 'scope'], ['scope', [''], 'scope'], ['scope', ['../a'], 'scope'], ['scope', [42], 'scope'], ['scope', ['/a'], 'scope'],
    ['size', undefined, 'size'], ['size', 4, 'size'], ['size', '3.0', 'size'], ['size', {}, 'size'],
    ['taskType', 'unknown', 'taskType:invalid'], ['risk', 'extreme', 'risk:invalid'], ['acceptanceTestable', 1, 'acceptanceTestable:invalid'], ['kind', 'unknown', 'kind:invalid'], ['kind', 'constructor', 'kind:invalid'],
  ])('fails closed on %s=%j', (key, value, missing) => expect(c.deriveDispatchProfile(card({ [key]: value }))).toEqual({ ready: false, missing: [missing] }));
  it('reports missing fields in the specified fixed order', () => {
    expect(c.deriveDispatchProfile({ taskType: 'bad', risk: 'bad', acceptanceTestable: 1, kind: 'bad' }).missing).toEqual(['preparedDate', 'scope', 'size', 'taskType:invalid', 'risk:invalid', 'acceptanceTestable:invalid', 'kind:invalid']);
    const cyclic = {}; cyclic.scope = [cyclic];
    for (const input of [null, [], 'x', 1, cyclic]) expect(c.deriveDispatchProfile(input).ready).toBe(false);
  });
});
