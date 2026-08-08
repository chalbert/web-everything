/**
 * @file gate-config.test.mjs — regression pins for the TRUST_CHAIN roster (scripts/lib/gate-config.mjs).
 *
 * WHY THIS FILE. The trust-chain roster is basename-matched config: registering a basename forces every PR
 * touching a file of that name to ESCALATE (get an independent review), and — for the POLICY tier — to force
 * `review:human`. The sibling `gate-invariants.test.mjs` proves the SAFETY PROPERTIES of the matcher over the
 * escalation surface (review-escalation.mjs). THIS file pins the ROSTER MEMBERSHIP itself, directly against
 * `gate-config.mjs`: it fails the moment a gate-deciding basename is dropped, so a change that silently
 * un-registers a member cannot pass green.
 *
 * WE #2480 — the phase-1 RESIDENT DRAIN DAEMON (plateau-app/tools/drain-daemon/) shipped the self-hosting
 * coordinator under NEW basenames. Its files that INVOKE the merge or CLEAR a review (daemon.mjs runPass →
 * spawns the sweep; cli.mjs `once` → real merge, `review-set-label` → clears a review; lib.mjs buildPassArgs
 * → merge argv, buildSetLabelArgs → review-clear argv) are gate-deciding and must stay registered as ENGINE
 * tier (escalate + agent-reviewable — they obey the gate the WE child defines, they do not define it).
 */
import { describe, it, expect } from 'vitest';
import {
  TRUST_CHAIN,
  TRUST_CHAIN_BASENAMES,
  POLICY_CORE_BASENAMES,
  isTrustChainPath,
  isPolicyCorePath,
  POLICY_LEASH,
  POLICY_SPEC_BASENAMES,
  POLICY_DERIVATION_BASENAMES,
  isPolicySpecPath,
  isPolicyDerivationPath,
} from '../gate-config.mjs';

// The phase-1 drain-daemon gate-deciding files (WE #2480). Each maps a registered basename to the shipped
// home path the daemon actually lives at, so the regression proves the basename match TRAVELS to the real
// plateau-app location (not just the bare basename).
const DAEMON_ENGINE_MEMBERS = [
  { file: 'daemon.mjs', home: 'plateau-app/tools/drain-daemon/daemon.mjs', why: 'runPass() spawns the merge sweep' },
  { file: 'cli.mjs', home: 'plateau-app/tools/drain-daemon/cli.mjs', why: '`once` merges; `review-set-label` clears a review' },
  { file: 'lib.mjs', home: 'plateau-app/tools/drain-daemon/lib.mjs', why: 'buildPassArgs (merge argv) + buildSetLabelArgs (review-clear argv)' },
];

describe('TRUST_CHAIN — drain-daemon gate-deciding files are registered (WE #2480)', () => {
  it('every daemon basename is a member of TRUST_CHAIN_BASENAMES', () => {
    for (const { file } of DAEMON_ENGINE_MEMBERS) {
      expect(TRUST_CHAIN_BASENAMES.has(file)).toBe(true);
    }
  });

  it('every daemon basename has a TRUST_CHAIN entry tagged ENGINE tier (obeys the gate, agent-reviewable)', () => {
    for (const { file } of DAEMON_ENGINE_MEMBERS) {
      const entry = TRUST_CHAIN.find((m) => m.file === file);
      expect(entry, `TRUST_CHAIN entry for ${file}`).toBeTruthy();
      expect(entry.tier).toBe('engine');
      expect(entry.desc).toMatch(/2480/); // the registration cites its ticket
    }
  });

  it('daemon files are ENGINE, not POLICY — they escalate but are NOT human-forced', () => {
    for (const { file } of DAEMON_ENGINE_MEMBERS) {
      expect(POLICY_CORE_BASENAMES.has(file)).toBe(false);
    }
  });

  it('the basename match TRAVELS to the shipped plateau-app path — the file escalates there', () => {
    for (const { home } of DAEMON_ENGINE_MEMBERS) {
      expect(isTrustChainPath(home)).toBe(true);  // a PR touching the real path always gets an independent review
      expect(isPolicyCorePath(home)).toBe(false); // engine tier — a converged agent panel may clear it (no human forced)
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE POLICY-TIER `leash` SPLIT (#2771 / #2785). The roster is now the single source of truth for TWO
// questions, not one: "is this the policy tier?" (`tier`) and "does it force a human?" (`leash`). These pins
// hold the second one to the ratified classification — the file-by-file table #2771 wrote down.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('TRUST_CHAIN — the declarative-leash / derivation-code split (#2771/#2785)', () => {
  // The exact classification #2771 Fork A ratified, as a table read directly off the roster.
  const RATIFIED = {
    // the DECLARATIVE LEASH — human
    'review-policy.contract.json': 'spec',
    'gate-config.mjs': 'spec',
    'gate-invariants.test.mjs': 'spec',
    'review-policy.conformance.test.mjs': 'spec',
    // the DERIVATION CODE — independent committee
    'review-escalation.mjs': 'code',
    'review-core.mjs': 'code',
    'review-policy.mjs': 'code',
    'disposition-land-seam.mjs': 'code',
    'auto-land-seam.mjs': 'code',
  };
  it('every basename #2771 named carries exactly the leash the ruling gave it', () => {
    for (const [file, leash] of Object.entries(RATIFIED)) {
      const entry = TRUST_CHAIN.find((m) => m.file === file);
      expect(entry, `TRUST_CHAIN entry for ${file}`).toBeTruthy();
      expect(entry.tier).toBe('policy');
      expect(entry.leash, `${file} leash`).toBe(leash);
    }
  });
  it('the derived sets agree with the roster entries, and the matchers agree with the sets', () => {
    for (const [file, leash] of Object.entries(RATIFIED)) {
      expect(POLICY_SPEC_BASENAMES.has(file)).toBe(leash === POLICY_LEASH.SPEC);
      expect(POLICY_DERIVATION_BASENAMES.has(file)).toBe(leash === POLICY_LEASH.CODE);
      expect(isPolicySpecPath(`scripts/lib/${file}`)).toBe(leash === POLICY_LEASH.SPEC);
      expect(isPolicyDerivationPath(`scripts/lib/${file}`)).toBe(leash === POLICY_LEASH.CODE);
      expect(isPolicyCorePath(`scripts/lib/${file}`)).toBe(true); // BOTH halves are still the policy tier
    }
  });
  it('the check:standards contract + conformance suite join the leash by KIND, not by name (#2769)', () => {
    // Registered after #2771 was ratified, so the ruling could not name them — but a contract and a conformance
    // suite are exactly the two artifact kinds #2771 calls declarative leash, so they classify as `spec`.
    for (const file of ['check-standards.contract.json', 'check-standards.conformance.test.mjs']) {
      expect(TRUST_CHAIN.find((m) => m.file === file).leash).toBe(POLICY_LEASH.SPEC);
    }
    // …while the check:standards IMPL stays engine tier and carries no leash at all.
    for (const file of ['check-standards.mjs', 'check-standards-rules.mjs']) {
      const entry = TRUST_CHAIN.find((m) => m.file === file);
      expect(entry.tier).toBe('engine');
      expect(entry.leash).toBeUndefined();
    }
  });
  it('an unregistered basename is neither half (the split never invents membership)', () => {
    for (const p of ['scripts/pr-land.mjs', 'demos/spa.html', 'scripts/lib/rebase-drop-manifest.mjs']) {
      expect(isPolicySpecPath(p)).toBe(false);
      expect(isPolicyDerivationPath(p)).toBe(false);
    }
  });
});
