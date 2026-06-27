---
name: feedback_batch_conflict_avoidance
description: "Running batches alongside concurrent agents — per-item claim (status:active flip) dodges races, NOT git; splice shared data files; yield NNN on collision"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a37f1971-8ef6-45bb-9e58-98e1fe2d2fe2
---

How to run a `/batch` (or any work) on this repo without colliding with other agents working the
same backlog concurrently.

**Why:** multiple agents share `backlog/` and the `src/_data/*.json` registries at once, so a status
snapshot goes stale mid-flight and two agents can grab the same file or the same `NNN`. The batch arc
keeps per-item on-disk ownership precisely so a race is detectable and recoverable.

**How to apply:**
- **Ownership is `status: active`, NOT git.** Updated 2026-06-13: `backlog.mjs claim` no longer inspects
  git at all (the old `isDirty` guard was removed) — concurrency is the `status: open → active`
  transition (a second claimer hits `active` and the transition errors) plus the `reserve` session
  soft-holds (#083). **Never run `git status`/`git diff` to detect a race or judge eligibility, and
  never drop/hand-flip an item over its commit state** — a dirty/untracked tree is the normal baseline.
  See [[feedback_claim_ignores_git_state]]. The only race signal is the item already reading
  `status: active`; if `claim` errors with "not still open", another session took it — take the next.
- **Claim per item, re-read right before claiming.** Don't trust the selection-time snapshot — the
  instant before claiming, re-`cat` *that one* item's frontmatter; if it now reads `status: active`,
  you lost the race, take the next. (`claim` re-reads and enforces this atomically.)
- **`claim` flips `open → active` + stamps `dateStarted` BEFORE any code**, and keeps `## Progress` in
  sync — that on-disk active flag is what makes selection drop it so a second agent won't re-pick it.
- **Shared data files are the real hotspot.** `src/_data/*.json` (intents.json, blocks.json, the
  capability matrix, etc.) are where parallel appends clobber each other. Edit by **anchored splice**,
  never a full rewrite/round-trip — touch only your entry's bytes so two agents editing different
  entries don't conflict (see [[project_intents_json_mixed_escaping_footgun]] for the round-trip diff
  trap specifically).
- **On any `NNN` collision the *newer* item yields** — take the next free number; never renumber an
  item already on disk (it breaks `#NNN` refs and cascades collisions under concurrency). Re-check
  `ls backlog/` immediately before writing a new item.
- **Overlap is handled by the `status` flip + reservations, not by avoiding "dirty" files.** Don't
  scan `git status` to pick non-overlapping items, and never stop a batch because a file "went dirty" —
  that's not a signal. Real contention shows as an item already `status: active` (or a `reserve` hold);
  the `--parallel` lane partition (#083) is the mechanism when you genuinely need disjoint file sets.
- A stranded `active` item (crashed session) is **resumable, not dead** — read its `## Progress`,
  continue from **Next**; don't re-pick it as fresh.
