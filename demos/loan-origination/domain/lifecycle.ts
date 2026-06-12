/**
 * The loan application's lifecycle DEFINITION — domain data (legitimately app-side; the engine is the
 * Web Lifecycle block). A declarative status set + guarded, role-scoped transition map consumed by the
 * shipping `DefaultLifecycleProvider`. Authorization (the `guard` names) would resolve through Web
 * Guards in production; the demo uses the provider's permissive default.
 */

import type { LifecycleDefinition } from '../../../blocks/lifecycle/LifecycleProvider';
import type { ApplicationState } from './types';

export const LOAN_LIFECYCLE: LifecycleDefinition<ApplicationState> = {
  initial: 'draft',
  states: {
    'draft': { label: 'Draft', tone: 'neutral' },
    'submitted': { label: 'Submitted', tone: 'info' },
    'processing': { label: 'Processing', tone: 'progress' },
    'underwriting': { label: 'Underwriting', tone: 'progress' },
    'approved-with-conditions': { label: 'Approved w/ Conditions', tone: 'caution' },
    'suspended': { label: 'Suspended', tone: 'caution' },
    'clear-to-close': { label: 'Clear to Close', tone: 'positive', terminal: true },
    'declined': { label: 'Declined', tone: 'critical', terminal: true },
    'withdrawn': { label: 'Withdrawn', tone: 'neutral', terminal: true },
  },
  transitions: [
    { from: 'draft', to: 'submitted', actor: 'borrower' },
    { from: 'draft', to: 'withdrawn', actor: 'borrower' },
    { from: 'submitted', to: 'processing', actor: 'processor' },
    { from: 'submitted', to: 'withdrawn', actor: 'borrower' },
    { from: 'processing', to: 'underwriting', actor: 'processor' },
    { from: 'processing', to: 'withdrawn', actor: 'borrower' },
    { from: 'underwriting', to: 'approved-with-conditions', actor: 'underwriter', guard: 'meets-eligibility' },
    { from: 'underwriting', to: 'suspended', actor: 'underwriter' },
    { from: 'underwriting', to: 'declined', actor: 'underwriter' },
    { from: 'approved-with-conditions', to: 'clear-to-close', actor: 'underwriter', guard: 'conditions-cleared' },
    { from: 'approved-with-conditions', to: 'suspended', actor: 'underwriter' },
    { from: 'suspended', to: 'underwriting', actor: 'processor' },
    { from: 'suspended', to: 'withdrawn', actor: 'borrower' },
  ],
};

/** Map a finding to a Status Indicator tone — same intent, reused for the rules-engine outcome. */
export const FINDING_TONE: Record<string, 'positive' | 'caution' | 'critical' | 'neutral'> = {
  'approve-eligible': 'positive',
  'refer': 'caution',
  'refer-with-caution': 'caution',
  'ineligible': 'critical',
};
