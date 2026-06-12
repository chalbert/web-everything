/**
 * Policy and claim lifecycle DEFINITIONS — domain data consumed by the shipping Web Lifecycle block
 * (`DefaultLifecycleProvider`). Two entity machines on one app; authorization (the `guard` names) would
 * resolve through Web Guards in production. The headline reuse of what the loan app drove.
 */

import type { LifecycleDefinition } from '../../../blocks/lifecycle/LifecycleProvider';
import type { PolicyState, ClaimState } from './types';

export const POLICY_LIFECYCLE: LifecycleDefinition<PolicyState> = {
  initial: 'quote',
  states: {
    'quote': { label: 'Quote', tone: 'neutral' },
    'referred': { label: 'Referred to UW', tone: 'caution' },
    'quoted': { label: 'Quoted', tone: 'info' },
    'bound': { label: 'Bound', tone: 'progress' },
    'in-force': { label: 'In Force', tone: 'positive' },
    'cancelled': { label: 'Cancelled', tone: 'critical', terminal: true },
    'expired': { label: 'Expired', tone: 'neutral', terminal: true },
    'lapsed': { label: 'Lapsed', tone: 'caution' },
  },
  transitions: [
    { from: 'quote', to: 'referred', actor: 'agent', guard: 'uw-refer' },
    { from: 'quote', to: 'quoted', actor: 'agent', guard: 'uw-clean' },
    { from: 'referred', to: 'quoted', actor: 'underwriter', guard: 'uw-approve' },
    { from: 'referred', to: 'cancelled', actor: 'underwriter' }, // declined
    { from: 'quoted', to: 'bound', actor: 'agent', guard: 'payment-received' },
    { from: 'bound', to: 'in-force', actor: 'agent' },
    { from: 'in-force', to: 'cancelled', actor: 'agent', guard: 'cancel-reason' },
    { from: 'in-force', to: 'expired', actor: 'agent' },
    { from: 'in-force', to: 'lapsed', actor: 'agent' }, // non-pay
    { from: 'lapsed', to: 'in-force', actor: 'agent', guard: 'reinstate' },
    { from: 'lapsed', to: 'cancelled', actor: 'agent' },
  ],
};

export const CLAIM_LIFECYCLE: LifecycleDefinition<ClaimState> = {
  initial: 'fnol',
  states: {
    'fnol': { label: 'FNOL', tone: 'info' },
    'triage': { label: 'Triage', tone: 'progress' },
    'investigating': { label: 'Investigating', tone: 'progress' },
    'approved': { label: 'Approved', tone: 'positive' },
    'paying': { label: 'Paying', tone: 'progress' },
    'paid': { label: 'Paid', tone: 'positive', terminal: true },
    'denied': { label: 'Denied', tone: 'critical', terminal: true },
    'closed': { label: 'Closed', tone: 'neutral', terminal: true },
  },
  transitions: [
    { from: 'fnol', to: 'triage', actor: 'adjuster' },
    { from: 'triage', to: 'investigating', actor: 'adjuster' },
    { from: 'investigating', to: 'approved', actor: 'adjuster', guard: 'coverage-applies' },
    { from: 'investigating', to: 'denied', actor: 'adjuster' },
    { from: 'approved', to: 'paying', actor: 'adjuster' },
    { from: 'paying', to: 'paid', actor: 'adjuster' },
    { from: 'paid', to: 'closed', actor: 'adjuster' },
    { from: 'denied', to: 'closed', actor: 'adjuster' },
  ],
};
