import { describe, it, expect } from 'vitest';
import {
  DefaultAuditProvider,
  CustomAuditRegistry,
  registerAudit,
  auditLifecycle,
  type AuditEvent,
} from '../../../audit/AuditProvider';
import { DefaultLifecycleProvider, type LifecycleDefinition } from '../../../lifecycle/LifecycleProvider';

const ev = (id: string, action: string, at: string): AuditEvent => ({
  target: { type: 'loan', id }, action, actor: { role: 'underwriter' }, at,
});

describe('DefaultAuditProvider', () => {
  it('append() is append-only and queryByEntity returns one entity chronologically', async () => {
    const p = new DefaultAuditProvider();
    await p.append(ev('L1', 'b', '2026-06-12T02:00:00Z'));
    await p.append(ev('L1', 'a', '2026-06-12T01:00:00Z'));
    await p.append(ev('L2', 'x', '2026-06-12T03:00:00Z'));
    const hist = await p.queryByEntity('L1');
    expect(hist.map((e) => e.action)).toEqual(['a', 'b']); // sorted by `at`, only L1
    expect(await p.queryByEntity('L2')).toHaveLength(1);
  });

  it('a recorded event is frozen (immutable)', async () => {
    const p = new DefaultAuditProvider();
    await p.append(ev('L1', 'created', '2026-06-12T00:00:00Z'));
    const [e] = await p.queryByEntity('L1');
    expect(Object.isFrozen(e)).toBe(true);
  });

  it('queryByEntity honours action + since filters', async () => {
    const p = new DefaultAuditProvider();
    await p.append(ev('L1', 'created', '2026-06-12T00:00:00Z'));
    await p.append(ev('L1', 'lifecycle.transition', '2026-06-12T05:00:00Z'));
    expect(await p.queryByEntity('L1', { action: 'lifecycle.transition' })).toHaveLength(1);
    expect(await p.queryByEntity('L1', { since: '2026-06-12T04:00:00Z' })).toHaveLength(1);
  });

  it('subscribe() notifies on append for the matching entity only', async () => {
    const p = new DefaultAuditProvider();
    const seen: string[] = [];
    p.subscribe('L1', (e) => seen.push(e.action));
    await p.append(ev('L1', 'created', '2026-06-12T00:00:00Z'));
    await p.append(ev('L2', 'other', '2026-06-12T00:00:00Z'));
    expect(seen).toEqual(['created']);
  });
});

describe('registerAudit', () => {
  it('returns an idempotent global CustomAuditRegistry', () => {
    const reg = registerAudit();
    expect(reg).toBeInstanceOf(CustomAuditRegistry);
    expect(registerAudit()).toBe(reg);
    const p = new DefaultAuditProvider();
    reg.define('loan', p);
    expect(reg.get('loan')).toBe(p);
  });
});

describe('auditLifecycle composition', () => {
  type S = 'draft' | 'submitted';
  const DEF: LifecycleDefinition<S> = {
    initial: 'draft', states: { draft: {}, submitted: {} },
    transitions: [{ from: 'draft', to: 'submitted', actor: 'borrower' }],
  };

  it('turns each lifecycle transition into one AuditEvent', async () => {
    const lifecycle = new DefaultLifecycleProvider<S>(DEF, () => true, () => '2026-06-12T00:00:00.000Z');
    const audit = new DefaultAuditProvider();
    const stop = auditLifecycle(lifecycle, audit, 'loan');
    await lifecycle.transition({ id: 'L1', state: 'draft' }, 'submitted', { role: 'borrower' });
    const [logged] = await audit.queryByEntity('L1');
    expect(logged.action).toBe('lifecycle.transition');
    expect(logged.actor.role).toBe('borrower');
    expect(logged.after).toEqual([{ path: '/state', op: 'replace', oldValue: 'draft', newValue: 'submitted' }]);
    stop();
  });
});
