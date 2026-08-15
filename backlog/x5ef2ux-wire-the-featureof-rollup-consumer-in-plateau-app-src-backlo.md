---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2998"]
locus: plateau-app
scope: ["plateau-app:src/backlog-view/"]
scopeRationale: "Filed sight-unseen from web-everything (never opened plateau-app:src/backlog-view/'s ~40 files) — the exact file(s) the featureOf derivation lands in are for the builder to narrow on pickup."
dateOpened: "2026-08-15"
tags: [taxonomy, data-model, hierarchy]
---

# Wire the featureOf rollup consumer in plateau-app:src/backlog-view/ (the #2998 cross-repo half)

we:#2998 lands the real feature tier (kind:feature, deriveTier/sliceable/epicState epic-parity, and the flat+root invariants) entirely inside web-everything, but its own scope explicitly named a second half it could not deliver from a single-repo web-everything lane: wire a featureOf(epic) consumer into plateau-app:src/backlog-view/, grouping epics under their nearest kind:feature ancestor (walk parent upward) with feature-less epics falling into an Unassigned bucket. Filed as its own item because it needs a plateau-app-repo lane and its own gate (npm test), not the webeverything check:standards gate #2998 landed under.

## Why this is a separate item, not part of #2998

#2998 was built in a lane scoped to the web-everything repo only (a single-repo `.lanes/web-everything/lane-*` clone, landed via `we:scripts/pr-land.mjs` against `chalbert/web-everything`). `plateau-app` (`git@github.com:chalbert/plateau-app.git`) is a genuinely separate repo with its own gate (`npm test`, per `we:scripts/check-standards-rules.mjs` LOCI registry) and its own lane pool — there was no mechanism to land plateau-app-side code from that lane/PR. `plateau-app:src/backlog-view/parse.ts` and `plateau-app:src/backlog-view/loader.ts` already parse backlog frontmatter independently (NOT a consumer of `we:src/_data/backlog.js`), so `kind`/`parent` are already available there; only the featureOf derivation + Unassigned-bucket grouping are missing.

Note this is distinct from the already-filed `plateau-app:src/feature-tracker/` slices under this same epic (#2705) — S5 (#2726, "Epic→slice rollup with connector rails") ships an interim epic≈feature rollup and says "the #2691 adapter later adds the real feature tier above epics"; that adapter work is `feature-tracker`-scoped and may already cover the feature-tracking SCREEN's own rollup. This item is scoped only to `plateau-app:src/backlog-view/` (the general operator backlog board/lane-board surface), which is a separate consumer.

## Scope
- `plateau-app:src/backlog-view/` — add a `featureOf(epic)` derivation (nearest `kind: feature` ancestor walking `parent` upward, cycle-guarded; `null` → Unassigned) and group epics by it wherever `backlog-view` currently renders/consumes epic rollups.

## Done when
- `plateau-app`'s own gate (`npm test`) is green.
- Epics with a `kind: feature` ancestor are grouped under it; feature-less epics land in an explicit Unassigned bucket.
- Unblocks #2733 (the human-gated #2691 baseline refreeze) re-baselining the screen against real feature-tier output.
