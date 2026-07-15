---
name: drain-gated-build-review-resolve-loop
description: "The user's preferred delivery cadence for working a queue of items: build-in-lane → independent-subagent-review → drain-gated merge → resolve-in-lane → next; lanes for every edit, subagents for every review"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7200b5fd-520a-4cdc-8421-2f82d968d10d
---

When the user asks to work a queue of items "build-review-wait for drain-next" style (established while delivering the Plateau Loop console, epic #2505), run this loop per item, **one build in flight at a time**, and lean on lanes + subagents throughout:

1. **Build in a LANE CLONE off origin/main** — never the primary checkout. Acquire with `node scripts/lane-pool.mjs acquire --repo=<checkout> --purpose=<slug> --session=<slug> --no-install --json` and parse `.path` from the JSON (plain stdout is polluted by npm output). `npm ci` in the lane if node_modules is stale. Release when done.
2. **Independent fresh-context REVIEW via a subagent before every PR** — spawn a general-purpose agent with a diff-only mandate (it sees only the diff + the item's acceptance, judges correctness, returns findings). **Fold in real findings; never rubber-stamp.** Use subagents for broad exploration too.
3. **Verify live** on a LANE dev server on a non-colliding port (never touch the user's own server); drive the real flow (Playwright/curl), observe behavior, then stop the server you started.
4. **Gates:** `npx vitest run` + `npm run build` + `check:render-conformance` (`--update` to baseline a new FUI surface).
5. **Open a `ready-to-merge` PR;** the drain lands it. **Clear agent-clearable `review:pending` parks yourself** — post a verdict comment + swap to `review:accepted` (see [[approve-verdict-sets-review-accepted-label]]); NEVER self-clear a `review:human`/gate-self PR.
6. **After the build PR merges, RESOLVE the item in a WE lane** (backlog mutations are blocked from primary): `backlog.mjs resolve <NNN>`, gate, commit just that file, ready-to-merge PR.
7. **Roll to the next** unblocked item (foundational/smallest first); TodoWrite for progress; terse per-seam reports, full end summary. **Stop for:** a real design fork, a `review:human` park, a build failure, or an empty queue.

**Why:** the user runs this hands-off for throughput and reads the end summary, not the middle. The independent subagent review is load-bearing — it caught real shipped bugs on multiple items (a year-string false-join, an order-dependent render bug, a wrong count) before they merged. Lanes are the sole land route ([[pr-is-the-standard-flow-not-a-question]], [[104-edit-work-runs-in-a-lane-clone]]).

**How to apply:** default to this cadence the moment the user says "batch these" / "keep rolling" / "build-review-drain-next"; don't re-ask per item. Most sibling slices touch the same files, so build them **serially** (drain-gated), not in parallel lanes. Surface only genuine design forks (e.g. a slice that adds a route or a write path). Relates to [[autonomous-loops-non-blocking-red-team-not-prompts]] (adversarial gate, not per-iteration prompt).
