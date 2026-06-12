import { describe, it, expect } from 'vitest';
import {
  DefaultLifecycleProvider,
  CustomLifecycleRegistry,
  registerLifecycle,
  type LifecycleDefinition,
  type LifecycleEvent,
  type EntityRef,
} from '../../../lifecycle/LifecycleProvider';

type S = 'draft' | 'submitted' | 'approved' | 'declined';

const DEF: LifecycleDefinition<S> = {
  initial: 'draft',
  states: { draft: {}, submitted: {}, approved: { terminal: true }, declined: { terminal: true } },
  transitions: [
    { from: 'draft', to: 'submitted', actor: 'borrower' },
    { from: 'submitted', to: 'approved', actor: 'underwriter', guard: 'may-approve' },
    { from: 'submitted', to: 'declined', actor: 'underwriter' },
  ],
};

const FIXED = '2026-06-12T00:00:00.000Z';
const newProvider = (guard = () => true) =>
  new DefaultLifecycleProvider<S>(DEF, guard, () => FIXED);

describe('DefaultLifecycleProvider', () => {
  it('available() filters edges by the actor role', async () => {
    const p = newProvider();
    const loan: EntityRef<S> = { id: 'L1', state: 'submitted' };
    expect(await p.available(loan, { role: 'underwriter' })).toEqual(['approved', 'declined']);
    expect(await p.available(loan, { role: 'borrower' })).toEqual([]);
  });

  it('available() drops an edge whose guard denies', async () => {
    const p = newProvider((g) => g !== 'may-approve'); // deny only the guarded approve edge
    const loan: EntityRef<S> = { id: 'L1', state: 'submitted' };
    expect(await p.available(loan, { role: 'underwriter' })).toEqual(['declined']);
  });

  it('transition() applies the move and emits a LifecycleEvent', async () => {
    const p = newProvider();
    const seen: LifecycleEvent<S>[] = [];
    p.subscribe((e) => seen.push(e));
    const loan: EntityRef<S> = { id: 'L1', state: 'draft' };
    const ev = await p.transition(loan, 'submitted', { role: 'borrower' });
    expect(loan.state).toBe('submitted'); // entity mutated
    expect(ev).toEqual({ entity: 'L1', from: 'draft', to: 'submitted', actor: 'borrower', at: FIXED });
    expect(seen).toEqual([ev]); // subscriber notified
  });

  it('transition() rejects an illegal edge and a wrong-actor edge', async () => {
    const p = newProvider();
    await expect(p.transition({ id: 'L1', state: 'draft' }, 'approved', { role: 'underwriter' }))
      .rejects.toThrow(/illegal lifecycle transition/);
    await expect(p.transition({ id: 'L1', state: 'draft' }, 'submitted', { role: 'underwriter' }))
      .rejects.toThrow(/may not fire/);
  });
});

describe('registerLifecycle', () => {
  it('returns an idempotent global CustomLifecycleRegistry that holds named providers', () => {
    const reg = registerLifecycle();
    expect(reg).toBeInstanceOf(CustomLifecycleRegistry);
    expect(registerLifecycle()).toBe(reg); // same instance
    const p = newProvider();
    reg.define('loan', p);
    expect(reg.has('loan')).toBe(true);
    expect(reg.get('loan')).toBe(p);
  });
});
