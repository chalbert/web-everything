---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# drain dup-NNN tripwire auto-heals unguarded (no --onto-ref) — make it loud-only

The #2318 post-land duplicate-NNN tripwire in we:scripts/merge-ai-prs.mjs does not just DETECT a duplicate on main, it auto-HEALS by running we:scripts/backlog-renumber-collisions.mjs with no `--onto-ref` — so the #2316 edge-clobber guard (`ontoSet`) is empty and the corpus-wide reference sweep can rewrite a SURVIVING main item's legitimate `#NNN`/`blockedBy` edge to follow the yielded id (the exact #2314 corruption). Landed via #2318 (PR #206/#207 shared the same commits).

## Why loud-only

The tripwire's own charter is "a duplicate id reaching main is **impossible-or-LOUD**" — its job is to DETECT and surface, not to auto-fix. Auto-healing on live main trades one silent corruption (a duplicate id) for a *different* potential silent corruption (a clobbered `blockedBy` edge). And it can't be fixed by simply passing `--onto-ref=main`: with both duplicate files then in `ontoSet`, `planRenumber`'s RESUME branch sees `incoming.length === 0` and yields nothing — the heal becomes a no-op. Under JIT numbering (#2288) a post-land duplicate is already "structurally rare," so carrying an unguarded corpus-wide rewrite for that rare case is bad risk/reward. Detect → exit 3 → a human runs the guarded heal (we:scripts/backlog-renumber-collisions.mjs with the right `--onto-ref`) by hand.

## Acceptance criteria

- we:scripts/merge-ai-prs.mjs — the post-land tripwire DETECTS a duplicate NNN on main and, if any, prints the loud `TRIPWIRE` line + sets `duplicateIdsOnMain` + exits 3; it NO LONGER runs the renumber heal / gates / commits / pushes. The auto-heal block (and its `healPublished` bookkeeping) is removed.
- we:scripts/pr-land.mjs — the fallback-git tripwire (`residualDups`) only trusts a fresh re-detect when the pre-existing guarded `runHeal` actually published to `BASE`; a heal that committed-but-failed-to-push must keep the duplicate surfaced (mirror of the merge-ai-prs read-local-tree guard), not read the healed-but-unpushed local tree as clean.
- No `git add -A` remains on either tripwire path.
- we:scripts/lib/duplicate-id-tripwire.mjs and its test are unchanged (the pure detector is correct and stays); `npm run check:standards` and the vitest suite stay green.

Realizes the "alert, don't silently heal" intent of #2291 (demote the duplicate-NNN self-heal to a dormant backstop + tripwire) for the #2318 merge-path tripwire specifically — the shipped #2318 code did the opposite (it healed). #2291 remains the broader story (prune the dead heal wiring on the deprecated /pr + /merge routes; keep the shared heal helper as a dormant backstop).

Relates #2291, #2318, #2316, #2314, #2071, #2288.
