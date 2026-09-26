/**
 * @file breaks/index.mjs — #4075 daemon soak harness (card x0zg44l). THE REGISTRY of real-world daemon breaks,
 * one module per break. Each module exports a default object:
 *
 *   {
 *     id:        'short-kebab-id',
 *     title:     'what broke live, in one line',
 *     card:      'backlog card / PR the fix belongs to',
 *     fixedBy:   { sha: 'abc1234', where: 'main' | 'lane/<branch>' , paths?: ['files the fix changed'] },
 *     fixPresent(root): boolean   — does THIS tree carry the fix? (a source marker the fix added). When false the
 *                                   break's test is EXPECTED-FAIL (it must still fail — see breaks.soak.test.mjs);
 *                                   it flips to a required pass by itself the moment the fix lands.
 *     async run({ log }):  a `runSoak(...)` report — the scenario that reproduces the break,
 *     judge(report): string[]      — the problems that mean "the break happened" ([] = green).
 *   }
 *
 * THE RULE (`we:skills-src/conveyor/SKILL.md`, `we:skills-src/conveyor/fix-agent-brief.md`): every daemon bug fix
 * adds its real-world case here, and shows it RED against the tree before the fix
 * (`node scripts/conveyor/soak/red-green.mjs --break=<id>`) and GREEN with it.
 */

import unsupportedRepoDirt from './unsupported-repo-dirt.mjs';
import scorecardDirt from './scorecard-dirt.mjs';
import ghShimMidRebuild from './gh-shim-mid-rebuild.mjs';
import ciHealEmptyScope from './ci-heal-empty-scope.mjs';
import laneAcquireUnderLoad from './lane-acquire-under-load.mjs';
import fixDaemonLockWait from './fix-daemon-lock-wait.mjs';
import skippedTickOnTick from './skipped-tick-ontick.mjs';
import stickySmokeRejection from './sticky-smoke-rejection.mjs';
import sessionJunkInDaemonClone from './session-junk-in-daemon-clone.mjs';
import shortJobBehindFullSuite from './short-job-behind-full-suite.mjs';
import claudeAuthExpired from './claude-auth-expired.mjs';
import claudeAuthFalsePositive from './claude-auth-false-positive.mjs';
import rebuildSmokeOffLock from './rebuild-smoke-off-lock.mjs';
import daemonOverlayLockWait from './daemon-overlay-lock-wait.mjs';
import badOverlayFallsBack from './bad-overlay-falls-back.mjs';
import brokenSmokeHarnessHoldsLastGood from './broken-smoke-harness-holds-last-good.mjs';
import claudeAuthDispatchPause from './claude-auth-dispatch-pause.mjs';
import rebuildConcurrentCandidates from './rebuild-concurrent-candidates.mjs';

export const BREAKS = Object.freeze([
  unsupportedRepoDirt,
  scorecardDirt,
  ghShimMidRebuild,
  ciHealEmptyScope,
  laneAcquireUnderLoad,
  fixDaemonLockWait,
  skippedTickOnTick,
  stickySmokeRejection,
  sessionJunkInDaemonClone,
  shortJobBehindFullSuite,
  claudeAuthExpired,
  claudeAuthFalsePositive,
  rebuildSmokeOffLock,
  daemonOverlayLockWait,
  badOverlayFallsBack,
  brokenSmokeHarnessHoldsLastGood,
  claudeAuthDispatchPause,
  rebuildConcurrentCandidates,
]);

export function breakById(id) {
  const b = BREAKS.find((x) => x.id === id);
  if (!b) throw new Error(`soak: no break "${id}" — known: ${BREAKS.map((x) => x.id).join(', ')}`);
  return b;
}
