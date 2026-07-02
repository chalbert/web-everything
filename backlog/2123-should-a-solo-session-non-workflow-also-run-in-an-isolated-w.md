---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
codifiedIn: "docs/agent/platform-decisions.md#pr-flow-rollout-mechanism"
preparedDate: "2026-07-02"
relatedTo: ["1143", "2138", "2151", "2152", "2153"]
tags: [worktree, lane, isolation, session-hygiene, decision]
relatedReport: reports/2026-07-02-solo-session-worktree-lane-prior-art.md
---

# Should every edit-action session (incl. solo, non-`/workflow`) run in an isolated lane? — RULED: yes, uniform

**Ruling (2026-07-02):** **Yes.** Every edit-action session — a solo `/next` build, a `/prepare`, a
`resolve`, and `/workflow` alike — runs in an **isolated lane clone** and lands via the PR/merge-queue flow;
there is **no content-session carve-out**. This confirms [we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](docs/agent/platform-decisions.md)'s
"every automated writing session works in a clone" clause for the solo/interactive case and **ends the #1998
Rung-1 interim** (serial-on-`main`) for solo sessions. Codified as a rider under that anchor.

The scope question above was the **one genuine call** this item makes. The *mechanics* of how a lane claims,
verifies its before-state, and lands are session-tooling — tracked in the #2138 merge-queue line and its
build-outs (see **Delegated mechanics**), **not re-ruled here** (per the user's narrowing, 2026-07-02: "this
decision should only be about if all edit actions adhere to it — which is yes; we already have items for how
the lanes are merged").

**Which layer:** agent-workflow / session-tooling — nothing crosses the WE↔FUI standard boundary, defines a
consumer-observed contract, or touches a registry. Codifies as session house rules extending the #1996/#1998
anchors, not as standard vocabulary.

## The ruling: yes, uniform — no content-session carve-out

#1985 deferred clone-scope ("every session vs substantive-work-only") to #1996; #1996 ratified "**every**
automated writing session works in a clone." The writer in an agent session *is* the agent, so #1996's
"(agent / `/workflow`)" scope and its rationale (an ad-hoc agent `main` edit cannot be *proven* disjoint from
a live lane) cover solo/interactive agent sessions verbatim — the human-writes-`main` carve-out does not
rescue them. This item **confirms** that clause for the solo case: uniform, no permanent exemption.

**Red-team (the one real alternative — a permanent content-session carve-out: sessions touching only
`backlog/`/`reports/`/research files stay on the primary).** The carve-out is tempting: those files are
one-per-item by design (#1145 granularity) and rarely collide, and it preserves the human's live-observation
loop during a `/prepare`. It loses anyway, on **misclassification**: session scope is not knowable at entry —
a "content" session that then codifies a doc, edits a script, or regenerates a derived artifact silently
crosses the line mid-session, and a uniform rule cannot be misclassified. Decisively, the proven incident
sits on this very file class: `batch-2026-06-29e` clobbered a concurrent `/prepare`'s in-progress files (an
item body, a research topic, a report) on the shared tree — so exempting content sessions exempts the proven
collision surface. Amending a freshly-ratified clause needs a stronger warrant than a live-observability gap
the phase-1 trigger closes anyway. **Attack fails → yes-uniform holds.**

**Phase-1 sequencing (capability trigger, not a scope carve-out).** Code-only writing sessions (a lone
`/next`, a `resolve` — WE-only, non-visual, verification = tests/gate) lane **now** from the existing pool
([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs)). Interactive/content sessions (a `/prepare`, a decision
turn where the human reads the rendering item body live) **stay on the shared primary until a lane can boot
its own WE dev-pair on its band ports** (the `.env.local` env-load link, spin-off 0) — because their
load-bearing mitigation (the human reads the in-progress body on the lane-band board) cannot boot today, and
uniform laning now would cost every `/prepare` its hot-reloading item body with nothing in its place. This is
a *when-the-capability-lands* flip, **not** a permanent exemption: the ratified steady state is uniform.

## Delegated mechanics (ruled in the #2138 track, not this item)

The prep produced defaults for the lane's claim/verify/land mechanics. On the narrowing these are **inputs to
the merge-queue line, not this item's ruling** — recorded so the work is not lost:

- **Claim & status locus** — prepped default **(a) primary-locus with immediate publish**: claim-class
  transitions + the claims ledger run on the shared primary and publish as **`origin/main` + the claim splice
  only** (never the primary's whole HEAD, which may carry the human's unpushed commits — ahead-check before
  any interim `push origin main`); lanes never claim; the `resolve` splice rides the lane's landing commit; an
  abandoned lane's published `active` claim is released at closeout. → carried to #2138 / the entry-closeout
  helper.
- **Before-state soundness for the lane UI 3-musts check** — prepped default **(a) lane-local by default**:
  snapshot the lane band on the pre-edit tree; the primary's `:3000` serves as the *before* only as a
  provably-clean shortcut (touched surfaces verifiably unmodified). The user's `:3000` is never touched or
  restarted. → carried to the #2138 track / port-parameterizing `/review-design` + the Playwright checks.
- **Landing substrate** — local `git merge` vs **self-approved PR / GitHub merge queue** — is **#2138 Fork 5**
  (user direction 2026-07-02), built by **#2151** (CI gate on `pull_request`), **#2152** (main branch
  protection for self-approved PR landing), **#2153** (PR-based drain; native queue for single-repo WE,
  custom sequencing for cross-repo couples). `gh` is installed (2.95.0), not yet authed.

## Settled by precedent (not decisions)

- **Worktree vs clone (the card's title premise):** settled — the branch guard denies `git worktree
  add`/`checkout -b` in the shared checkout (#1153), and #1996 codified "isolation = a clone"; the pool is
  built and proven ([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs)). The harness's own
  `isolation:"worktree"` stays fine for throwaway read-mostly sub-agents.
- **Verify against the lane's own booted pair:** settled by #1996's fifth call (visual lanes land only on a
  headless render check against their own booted WE+FUI pair); this item ruled only the *before-state*
  soundness residue, now delegated above.
- **Landing procedure:** settled by composition — durable `lane/*` push first, then merge `origin/main`,
  authoritative gate **on the merged tree** ([we:docs/agent/platform-decisions.md#gate-on-merged-tree-lane-fast-fail](docs/agent/platform-decisions.md)),
  then land; on red, the `lane/*` ref preserves the work.
- **Per-lane dev-server ports:** ratified (#1996) + generated (#1997); the `.env.local` env-load link is the
  one missing build (spin-off 0), not a decision.
- **Cross-repo caveat:** before a cross-repo solo lane, sync each impl repo's `origin/main` first, or the lane
  resets to a stale tree and false-drops ([we:.claude/agent-memory/workflow-crossrepo-lanes-falsedrop.md](.claude/agent-memory/workflow-crossrepo-lanes-falsedrop.md)).

## Context

**Statute-overlap reconciliation (per #1886):** this decision **executes** #1996/#1998 (it does not
duplicate them) — the go, the "every session" scope clause, the visual fallback, and the verify-against-own-
pair wiring are all in the ratified anchor; what this item added was *confirming the scope for solo/interactive
sessions and ending the Rung-1 interim for them*, codified as the anchor rider. **Composes with** #1985
(non-destructive closeout — a lane makes "act only on your own manifest" trivial; its "dirty primary is the
normal baseline" clause grounded the lane-local before-state default) and #1937 (the solo landing step *is*
the central gate seat). **No collision with** Rule 104 (a lane clone has its own HEAD; no `checkout -b`) or
Rule 105 (ownership stays `status: active` on shared visible state). **Dev-server rules** compose — the user's
`:3000` is never stopped or restarted; the lane boots its own pair on a free band once spin-off 0 exists.

**Spin-off builds (separately prioritized):** (0) the `.env.local` env-load link; (1) the solo-lane
entry/closeout helper; (2) port-parameterizing `/review-design` + the Playwright checks; (3) the lane
visual-loop probe that fires the interactive-session flip (aligns with #1996 Gate 5 / the #1895 repro
harness); (4) the self-approved-PR landing substrate (#2151/#2152/#2153 under #2138 Fork 5). Lineage:
relatedTo #1143 (parallel-orchestrator epic whose lane machinery this reuses); rests on #1933 (clone model),
#1996/#1998 (statutes), #1997 (ports generated).
