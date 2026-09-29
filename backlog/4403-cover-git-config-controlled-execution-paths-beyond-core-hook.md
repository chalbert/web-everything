---
bornAs: xnygz00
kind: task
status: active
scaffoldedBy: "conveyor-4401-lane-38"
dateScaffolded: "2026-09-28"
scope: ["we:scripts/lib/git-hook-surface.mjs", "we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Cover git config-controlled execution paths beyond core.hooksPath in the probation-run hook hardening (core.fsmonitor, filters, hook.<name>.command)

The probation run scripts' hook hardening (4401) covers `.git/hooks/` and `core.hooksPath` only. A worker can still reach code execution through other paths: `core.fsmonitor`, `clean`/`smudge`/`textconv` filters, `hook.<name>.command` config-hooks, or a gitignored file the gate loads (a vitest/npm config, `node_modules`). A detected tamper restores the whole pre-worker `.git/config`, but a lane whose config was poisoned by a run that crashed before cleanup is still re-baselined as clean at the next acquire. Cover these, ideally by running the worker in a disposable clone whose `.git` it cannot write (#4291 advisory review).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
