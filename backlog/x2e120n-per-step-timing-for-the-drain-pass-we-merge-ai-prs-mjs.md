---
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Per-step timing for the drain pass (we:merge-ai-prs.mjs)

The resident drain daemon (we:scripts/merge-ai-prs.mjs, launchd com.plateau.drain-daemon) takes 9-18 min per pass to merge 2-3 PRs (e.g. 659s for 3 considered/2 merged), and we:.drain-daemon/history.jsonl + daemon.log carry NO per-step timing, so nobody can tell where the time goes. Add a timings object to each history.jsonl pass record plus one summary log line, covering listing, per-PR classify/gate reads, rebase-drop-manifest, CI wait, merge call, post-merge pull, JIT numbering, resolve-on-land, derived regen, release-on-land, and any other shelled-out step. Then use the real before/after timing to fix the dominant costs (batch post-merge work once per pass, skip regen when nothing relevant changed, avoid redundant fetches, parallelize independent reads, shorten/­event-drive CI polling) without weakening any safety check.

## Done when

1. **Executable** — `node we:scripts/merge-ai-prs.mjs --label=ready-to-merge --json --dry-run` prints a
   `merge-ai-prs · pass timings: …` summary line to stderr and its stdout JSON's `result.timings` carries a
   step-keyed ms breakdown plus `total`; `npx vitest run we:scripts/lib/__tests__/pass-timings.test.mjs` passes.
