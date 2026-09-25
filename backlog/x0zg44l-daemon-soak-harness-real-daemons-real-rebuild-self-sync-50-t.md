---
kind: story
size: 8
parent: "4075"
status: active
scaffoldedBy: "opus-soak-harness"
dateScaffolded: "2026-09-25"
scope: ["we:scripts/conveyor/soak/", "we:vitest.soak.config.ts", "we:package.json", "we:.github/workflows/ci.yml", "we:vitest.config.ts"]
dateOpened: "2026-09-25"
tags: []
---

# Daemon soak harness: real daemons + real rebuild/self-sync, ~50 ticks, invariants after every tick, a scenario per live break

The daemons keep breaking live in ways their unit tests never see (7 breaks on 2026-09-25, all green in tests). Build a soak harness reusing the daemon scenario simulator (we:scripts/conveyor/__tests__/sim/, we:scripts/conveyor/__tests__/helpers/fake-gh.mjs): a throwaway daemon clone of a real local bare remote with main advancing between ticks, the REAL review + fix daemons and self-sync code, a fake GitHub with PRs in varied states, fake sessions that run the real state writers and sometimes crash/hang/leave junk. After every tick assert: clone git-clean, at most 1 main move behind, tick bounded, owed work dispatched, no onTick crash. One regression scenario per break, red before the fix / green on main, expected-fail with card link when unfixed on main. npm run test:soak, wired into CI for daemon-touching PRs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
