---
kind: decision
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
codifiedIn: "docs/agent/platform-decisions.md#primary-read-only-lanes-only"
tags: []
---

# What the lane guard enforces — RULED: the primary is read-only, every change lands via a lane→PR

**Ruled 2026-07-03 (safest/strictest):** the shared PRIMARY checkout of a constellation repo is **read-only**
— no source, no content, no backlog-item creation, and **no direct push to `main`**. **Every** change reaches
`main` through a `lane/*` ref → PR → CI-gated merge, so the invariant "nothing lands on `main` ungated" holds
by construction. This supersedes the original fork (a) "allow a bookkeeping-class primary write" — even
bookkeeping is not exempt; the coordination writes that need immediacy (claims/reservations) happen **in-lane**
(the #2123/#2183 claim-in-lane model), not in the primary.

**Why (the incident that forced it):** 2026-07-03 a parallel `/workflow` run did its item-creation setup — a
`we:scripts/backlog.mjs` scaffold + a **direct `git push`** of the new items to `main` — in the primary (the
lanes clone `origin/main` and can only claim items that already exist there). That direct push skipped CI (CI's
`test` runs `check:standards` only on PRs), landing a `resolved-epic-with-open-child` error on `main` that
stalled the whole merge queue. The code work was correctly in lanes; only the setup step violated the rule.

**Enforcement (defence in depth):**
1. `we:scripts/guard-lane.mjs` — PreToolUse(Edit|Write): denies primary-tree edits (existing, #2123).
2. `we:scripts/guard-bash.mjs` — PreToolUse(Bash): denies an **agent-typed** direct `git push` to `main`
   (allows `lane/*`; `MAIN_PUSH_OK=1` is the sanctioned override). Ships with this decision — covers the
   agent/Bash path (all `/workflow` git runs via Bash, so it covers today's incident).
3. A git `pre-push` hook — the completing layer for a **script's** internal push (`we:scripts/pr-land.mjs`
   `--fallback-git` / heal / regen push via `execFileSync`, invisible to the Bash guard). Deferred to **#2217**.

**The one structural need this creates** — the parallel workflow must publish its scaffolded items so lanes can
claim them — is resolved by routing that publish through a **gated lane→PR** (or scaffolding in-lane so the item
rides the lane's own PR), never a direct push. Tracked as **#2215**.

Relates to #2123 (lane isolation), #2183/#2190 (all edits via ready-to-merge PRs), #2197 (clean-clone drain).
