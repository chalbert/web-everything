---
name: drain
description: Launch the deferred merge-queue drain — land the queued `lane/*` couples onto `main` via the standard PR transport, impl-first/WE-last, in cross-item `blockedBy` order. Use when the user asks to "drain the queue", "run the merge monitor/drain", "land the queued lanes", "watch the merge queue", or "clear the ready-to-merge couples". NOT for landing one specific committed change (that is `/pr`).
---

# Drain the deferred merge queue (#2162)

The whole mechanism lives in **[scripts/lane-drain.mjs](../../../scripts/lane-drain.mjs)** — this skill is
the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The drain is the
consumer side of the #2138 deferred merge queue: producing sessions (parallel `/workflow` lanes and solo
`#2123` lanes) that run in **stop-at-push mode** leave each ready couple as *lane pushed + `.lane-manifest.json`
written + `backlog.mjs queue`d*; this drain lands them serially, in a later session, under the same
integrator contract the inline `/workflow` integrator uses.

> **Converged label lander (#2188).** Under #2183 the producer now **opens a ready-to-merge PR per item** (not
> a `queued.json`-only couple). Those PRs — including orphans opened directly by `/pr` — are landed by the ONE
> label-scoped lander `scripts/merge-ai-prs.mjs --label=ready-to-merge`, which merges the labelled PRs in
> cross-item `blockedBy` order (each PR's `.lane-manifest.json`, read off its head ref, supplies the edges) and
> whose PR-merge IS the single clear point (no `queued.json` unqueue). `/merge` (bare) is the same lander
> without the label scope. This queued-`lane-drain.mjs` path remains for legacy `queued.json` couples; new
> producer output lands via the label lander.

## Preconditions

- Run from the **WE checkout on `main`** (the drain reads WE's `queued.json` + drives WE's `backlog.mjs`; it
  fails loud if cwd's git root isn't the WE checkout). `push-if-green` (its publish leg) also requires `main`.
- `gh` is authenticated (`gh auth status`) — landing goes through `pr-land.mjs` (self-approved PR + the
  required `test` check). See [`/pr`](../pr/SKILL.md) for the transport.
- The tree is clean-*ish* on `main`: the post-land housekeeping (unqueue + manifest cleanup + any reopen) syncs
  via `git pull --ff-only`, which is best-effort and degrades (reported) under a heavily-dirty tree.

## Run it

```
node scripts/lane-drain.mjs drain --dry-run --json   # plan only — show ready / deferred / invalid / unresolvable, drain NOTHING
node scripts/lane-drain.mjs drain                     # ONE cascade pass: drain every ready couple, then regen derived once, exit
node scripts/lane-drain.mjs watch --interval=30       # same, then keep polling for new producer enqueues (Ctrl-C to stop; --max-idle=N bounds it)
node scripts/lane-drain.mjs drain --body-file=<path>  # attach a PR body (the #2170 review dismissals) to each couple's PRs
```

**Always dry-run first** to show the queue plan, then run `drain` (one-shot) or `watch` (follow). Prefer
`drain` unless the user wants a long-lived monitor waiting for producers.

## How it works (per pass)

1. Reads the ready-to-merge queue (`.claude/skills/batch-backlog-items/queued.json`).
2. For each queued item, reads its `.lane-manifest.json` off its WE lane ref and orders by cross-item
   `blockedBy` — a couple whose blocker is still queued **defers** to a later pass (the cascade).
3. Drains each ready couple serially via `drain-one`, which lands its repos **impl-first / WE-last** through
   `pr-land.mjs` (WE carries the `active→resolved` flip, so a failed impl never leaves a false `resolved`).
4. **On success:** clears the queue marker (the single clear point) + deletes the `.lane-manifest.json` it
   carried onto `main`. **On failure:** leaves the couple queued (never falsely resolved) and reconciles the
   stranded WE item `active→open` — preserving the queue marker + `lane/*` refs for the next pass (#2175).
5. Regenerates WE derived artifacts **once** at the end (the relocated Phase 4c).

## Exit codes (surface these)

- `0` = the queue fully drained (or a dry-run). 
- `2` = something is left needing attention — a couple failed to land (left queued), an invalid/unresolvable
  manifest, a land-but-unqueue-fail, or a permanently-deferred couple. The JSON result names each.

## Guardrails

- **Re-uses the shared transports, never re-implements them:** couples land via `pr-land` (PR + `test` CI),
  housekeeping publishes via `push-if-green.mjs` — never a raw `git merge`/`git push` of `main`.
- **Never deletes a `lane/*` ref on failure** — refs are durable so the next pass (or a human) can retry.
- **Currently opt-in:** the *producer* half is behind `DEFERRED_DRAIN` (default OFF), so until a `/workflow`
  run with `deferredDrain: true` (or a stop-at-push solo lane) populates the queue, `drain` is a clean no-op.
- **Queue-scoped, NOT PR-scoped:** the drain only touches couples present in `queued.json` — each maps to a
  backlog item `NNN` with a `.lane-manifest.json` on its lane ref. It will **not** discover, land, or clean up
  an arbitrary open PR that has no queued work item (an orphan PR, or one opened by `/pr` directly). Those are
  outside its scope — land them with `/pr` or by hand. So the drain is not a "merge every open PR" tool.
