/**
 * @file known-breaks.mjs — #4075 daemon soak harness (card x0zg44l). The long soak runs every session behaviour
 * real sessions have — EXCEPT one whose break is known and still unfixed on the tree under test, because that
 * break would turn every tick after it red and hide everything else the soak can see. Such a behaviour is NEVER
 * dropped silently: the soak prints which behaviour is off and why, and the break's own regression scenario
 * (`breaks/<id>.mjs`) stays in the suite as an expected-fail with its card link. The moment the fix lands (the
 * break's `fixPresent` probe turns true), the behaviour turns back on by itself.
 */

import { BREAKS } from './breaks/index.mjs';

/** Break id → the `runSoak` option that turns off the session behaviour that triggers it. */
const BEHAVIOUR_GATES = Object.freeze({
  'scorecard-dirt': { option: 'scorecards', off: false, behaviour: 'review sessions writing scorecard rows' },
  'session-junk-in-daemon-clone': { option: 'junkInCwd', off: false, behaviour: 'lane-less sessions leaving junk in their spawn cwd (the daemon clone)' },
});

/** @returns {string[]} one line per break whose fix is NOT in the tree at `root`. */
export function knownUnfixed(root) {
  return BREAKS.filter((b) => !b.fixPresent(root)).map((b) => `${b.id} — ${b.title} (${b.card}; fix ${b.fixedBy.sha} on ${b.fixedBy.where})`);
}

/** The `runSoak` options for the long soak on the tree at `root`, printing every behaviour it turns off. */
export function soakBehaviourOptions(root, { log = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const opts = {};
  for (const b of BREAKS) {
    const gate = BEHAVIOUR_GATES[b.id];
    if (!gate || b.fixPresent(root)) continue;
    opts[gate.option] = gate.off;
    log(`soak: KNOWN BREAK "${b.id}" is unfixed on this tree (${b.card}, fix ${b.fixedBy.sha} on ${b.fixedBy.where}) — `
      + `${gate.behaviour} turned OFF for the long soak; its own scenario runs as expected-fail`);
  }
  return opts;
}
