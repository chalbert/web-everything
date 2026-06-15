/**
 * Loan permission scopes — slice S1b of #379 (#687). Proves the demoable: across roles, HMDA fields
 * hide/show, edit↔read-only flips by lifecycle state, restricted actions are gated, and the
 * `ownsApplication` predicate + the Guard-protocol provider resolve those scopes. Pure domain logic — no
 * UI (the applier is slice S10).
 */
import { describe, it, expect } from 'vitest';
import {
  ownsApplication,
  editability,
  fieldVisibility,
  isEngineReadableField,
  isHmdaField,
  actionAllowed,
  scopeFor,
  denyOutcomeFor,
  createLoanGuardProvider,
  type LoanActor,
} from '../permissions';
import type { Application, ApplicationState } from '../types';

// A minimal Application carrying only the fields the permission scopes read.
function app(state: ApplicationState, over: Partial<Application> = {}): Application {
  return {
    state,
    loanOfficerId: 'lo-1',
    assignedProcessorId: 'pr-1',
    assignedUnderwriterId: 'uw-1',
    borrowers: [{ id: 'b-1' } as Application['borrowers'][number]],
    ...over,
  } as Application;
}

const actor = (role: LoanActor['role'], id = 'x'): LoanActor => ({ role, id });

describe('ownsApplication', () => {
  it('borrower owns an application they are a borrower on', () => {
    expect(ownsApplication(actor('borrower', 'b-1'), app('draft'))).toBe(true);
    expect(ownsApplication(actor('borrower', 'b-9'), app('draft'))).toBe(false);
  });
  it('staff own by assignment; admin owns all', () => {
    expect(ownsApplication(actor('loan-officer', 'lo-1'), app('draft'))).toBe(true);
    expect(ownsApplication(actor('processor', 'pr-1'), app('processing'))).toBe(true);
    expect(ownsApplication(actor('underwriter', 'uw-1'), app('underwriting'))).toBe(true);
    expect(ownsApplication(actor('underwriter', 'uw-9'), app('underwriting'))).toBe(false);
    expect(ownsApplication(actor('admin', 'anyone'), app('declined'))).toBe(true);
  });
});

describe('state-scoped editing', () => {
  it('a borrower edits only their own draft, read-only once submitted', () => {
    expect(editability(actor('borrower', 'b-1'), app('draft'))).toBe('editable');
    expect(editability(actor('borrower', 'b-1'), app('submitted'))).toBe('read-only');
    expect(editability(actor('borrower', 'b-9'), app('draft'))).toBe('read-only'); // not owner
  });
  it('staff edit only in the states they work; terminal is read-only to all', () => {
    expect(editability(actor('processor'), app('processing'))).toBe('editable');
    expect(editability(actor('processor'), app('underwriting'))).toBe('read-only');
    expect(editability(actor('underwriter'), app('underwriting'))).toBe('editable');
    expect(editability(actor('admin'), app('underwriting'))).toBe('editable');
    expect(editability(actor('admin'), app('clear-to-close'))).toBe('read-only'); // terminal
  });
});

describe('field-scoped HMDA wall-off', () => {
  it('non-HMDA fields are visible to everyone', () => {
    expect(fieldVisibility('loan-officer', 'loan.amount')).toBe('visible');
    expect(isHmdaField('loan.amount')).toBe(false);
  });
  it('HMDA demographic is visible to UW/Admin, hidden from the LO pricing view', () => {
    expect(isHmdaField('demographic')).toBe(true);
    expect(fieldVisibility('underwriter', 'demographic')).toBe('visible');
    expect(fieldVisibility('admin', 'demographic')).toBe('visible');
    expect(fieldVisibility('loan-officer', 'demographic')).toBe('hidden');
    expect(fieldVisibility('processor', 'demographic')).toBe('hidden');
  });
  it('a borrower sees their own HMDA self-id (to enter it) but not when not owner', () => {
    expect(fieldVisibility('borrower', 'demographic', { ownsApp: true })).toBe('visible');
    expect(fieldVisibility('borrower', 'demographic', { ownsApp: false })).toBe('hidden');
  });
  it('HMDA is never an input to the rules engine', () => {
    expect(isEngineReadableField('demographic')).toBe(false);
    expect(isEngineReadableField('loan.amount')).toBe(true);
  });
});

describe('action-scoped authority', () => {
  it('underwriter-only decision + condition-clear', () => {
    expect(actionAllowed('underwriter', 'decision')).toBe(true);
    expect(actionAllowed('loan-officer', 'decision')).toBe(false);
    expect(actionAllowed('underwriter', 'clear-condition')).toBe(true);
    expect(actionAllowed('processor', 'clear-condition')).toBe(false);
  });
  it('admin-only threshold edit', () => {
    expect(actionAllowed('admin', 'edit-threshold')).toBe(true);
    expect(actionAllowed('underwriter', 'edit-threshold')).toBe(false);
  });
  it('loan-officer may quote but not approve', () => {
    expect(actionAllowed('loan-officer', 'quote')).toBe(true);
    expect(actionAllowed('loan-officer', 'approve')).toBe(false);
    expect(actionAllowed('underwriter', 'approve')).toBe(true);
  });
  it('un-gated actions are allowed for everyone', () => {
    expect(actionAllowed('borrower', 'view')).toBe(true);
  });
});

describe('LoanGuardProvider — the Guard-protocol seam', () => {
  const provider = createLoanGuardProvider();

  it('denies with no acting identity (safe default)', async () => {
    const d = await provider.evaluate({ kind: 'element', id: 'action:decision' }, 'enter');
    expect(d.allow).toBe(false);
  });

  it('resolves a field region via HMDA visibility', async () => {
    const hidden = await provider.evaluate(
      { kind: 'element', id: 'field:demographic' },
      'enter',
      { actor: actor('loan-officer'), app: app('underwriting') },
    );
    expect(hidden.allow).toBe(false);
    const shown = await provider.evaluate(
      { kind: 'element', id: 'field:demographic' },
      'enter',
      { actor: actor('underwriter'), app: app('underwriting') },
    );
    expect(shown.allow).toBe(true);
  });

  it('resolves an action region via authority and an edit region via state', async () => {
    const action = await provider.evaluate(
      { kind: 'element', id: 'action:approve' },
      'enter',
      { actor: actor('loan-officer'), app: app('underwriting') },
    );
    expect(action.allow).toBe(false);

    const edit = await provider.evaluate(
      { kind: 'element', id: 'edit' },
      'enter',
      { actor: actor('borrower', 'b-1'), app: app('submitted') },
    );
    expect(edit.allow).toBe(false);
  });

  it('always allows the leave event (exit-guard member owns it)', async () => {
    const d = await provider.evaluate({ kind: 'element', id: 'action:approve' }, 'leave', {
      actor: actor('borrower'),
    });
    expect(d.allow).toBe(true);
  });
});

describe('scope parsing + deny outcomes', () => {
  it('parses region ids into permission scopes', () => {
    expect(scopeFor({ kind: 'element', id: 'field:demographic' })).toEqual({ scope: 'field', fieldId: 'demographic' });
    expect(scopeFor({ kind: 'element', id: 'action:approve' })).toEqual({ scope: 'action', action: 'approve' });
    expect(scopeFor({ kind: 'element', id: 'edit' })).toEqual({ scope: 'edit' });
    expect(scopeFor({ kind: 'document' })).toEqual({ scope: 'unknown' });
  });
  it('field denials hide; action/edit denials forbid', () => {
    expect(denyOutcomeFor({ kind: 'element', id: 'field:demographic' })).toBe('hide');
    expect(denyOutcomeFor({ kind: 'element', id: 'action:approve' })).toBe('forbid');
    expect(denyOutcomeFor({ kind: 'element', id: 'edit' })).toBe('forbid');
  });
});
