#!/usr/bin/env node
/**
 * Soak fixture for breaks/build-daemon-restart-same-file.mjs — ONE live tick of the build-dispatch daemon in its
 * OWN process (so a second invocation is a genuine restart: new pid, empty in-memory bookkeeping), over the REAL
 * durable claim module rooted at argv[3]. The tick core's answer is fixed: two cleared, launchable cards whose
 * scopes share one file. Each dispatch appends one line to argv[4] instead of starting an agent.
 *   node build-daemon-tick.mjs <repoRoot> <lockRoot> <dispatchLog>
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , repoRoot, lockRoot, dispatchLog] = process.argv;
const daemon = await import(pathToFileURL(join(repoRoot, 'skills-src/conveyor/build-dispatch-daemon.mjs')).href);
const claims = await import(pathToFileURL(join(repoRoot, 'scripts/conveyor/build-dispatch-claim.mjs')).href);

const scope = ['plateau-app:src/main.ts'];
const out = await daemon.runBuildDispatchTick({
  bookkeeping: {},
  live: true,
  effects: {
    planTick: () => ({
      decisions: {
        statusLine: 'soak', counts: { building: 0 },
        spawnBuilds: [{ num: '3827', lane: 13 }, { num: '2662', lane: 14 }],
        admission: {
          queue: [{ num: '3827', scope }, { num: '2662', scope }],
          cleared: [{ num: '3827', ready: true }, { num: '2662', ready: true }],
        },
      },
      nextState: {},
    }),
    fetchOpenPrs: () => [],
    listClaims: () => claims.listBuildDispatchClaims({ lockRoot }),
    releaseClaim: ({ num }) => claims.releaseBuildDispatchClaim({ num, lockRoot }),
    acquireClaim: ({ num, scope: s }) => claims.acquireBuildDispatchClaim({ num, scope: s, lockRoot }),
    listRunStoreInFlight: () => [],
    killSwitch: () => ({ engaged: false }),
    dispatch: ({ num }) => { appendFileSync(dispatchLog, `${process.pid} ${num}\n`); return { dispatching: true }; },
  },
});
process.stdout.write(`${JSON.stringify({ pid: process.pid, dispatched: out.dispatched.map((d) => d.num), hold: out.plan.hold })}\n`);
