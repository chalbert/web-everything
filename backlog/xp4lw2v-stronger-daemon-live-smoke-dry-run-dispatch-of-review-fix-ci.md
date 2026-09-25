---
kind: story
size: 3
parent: "4075"
status: active
scaffoldedBy: "opus-soak-harness"
dateScaffolded: "2026-09-25"
scope: ["we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/__tests__/daemon-live-smoke.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Stronger daemon live smoke: dry-run dispatch of review/fix/ci-heal with a stub spawner + candidate tree stays git-clean after a tick of reads

The live smoke gate (we:scripts/lib/daemon-live-smoke.mjs) that runs before a rebuild is adopted passed while the adopted code crashed ci-heal dispatch on an empty SCOPE and while state writers dirtied the clone. Add (i) a dry-run dispatch of each dispatch kind (review, fix, ci-heal) against the live repo with a stub spawner, which must not throw, including the no-backlog-item / empty-scope shape; (ii) the candidate tree stays git-clean after one real tick of reads. Keep the smoke under 60s for the new checks and keep #2625's skip-unchanged logic. Built on lane/4044-daemon-rebuild-and-clone-lock (PR #2625), where the smoke lives now.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
