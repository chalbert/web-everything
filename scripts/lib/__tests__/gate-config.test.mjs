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
