---
bornAs: xt1ljei
kind: story
size: 2
parent: "3383"
status: active
scope: ["we:scripts/conveyor/run-scorecard-store.mjs", "we:skills-src/conveyor/launchd/", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/review-set-label.mjs", "we:scripts/gen-dispatch-routing-table.mjs", "we:.gitignore"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
tags: []
---

# A review round's advisory scorecard write dirties the daemon clone and freezes every review dispatch

Live 2026-09-25 16:31Z on the review daemon clone: review-pr's codex advisory-review seat (graduated in #3907) appended scorecards to the git-tracked we:scripts/conveyor/run-scorecards.json via we:scripts/conveyor/run-scorecard-store.mjs, because CONVEYOR_STATE_ROOT (#4052) is not set in the com.we.review-daemon plist. The clone went dirty, daemon-rebuild refused to move it (rebuild did not move the clone (dirty)), the clone fell 4 commits behind origin/main, and every review dispatch after that was refused by assertMainNotStale. It hits the session and job review paths alike, since both run review-loop-cli from the daemon clone. Fix: pin CONVEYOR_STATE_ROOT for every daemon (plist + we:skills-src/conveyor/launchd/ template), or default it for daemon-run processes, so no review round writes a tracked file in a daemon clone; add a check that fails when a daemon run leaves its clone dirty.

## Done when

1. **Executable** — run from a checkout root. Before: exits 1 (the store resolves to the tracked in-tree file). After: exits 0 (the store resolves outside the checkout, and the old file is no longer tracked).

   ```sh
   node --input-type=module -e "import {resolveScorecardStorePath as r} from './scripts/conveyor/run-scorecard-store.mjs'; process.exit(r().startsWith(process.cwd()) ? 1 : 0)" && ! git ls-files --error-unmatch scripts/conveyor/run-scorecards.json 2>/dev/null
   ```
2. **Proof** — a real `appendScorecard` in a clean checkout leaves `git status --porcelain` empty and the row lands in the shared store under the daemon state directory in the home folder (`resolveScorecardStorePath`); the old tracked history is unioned in once (stamp `legacy-in-tree-store-4155`).
