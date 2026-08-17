---
kind: story
size: 2
status: resolved
dateOpened: "2026-08-16"
dateStarted: "2026-08-16"
dateResolved: "2026-08-16"
codifiedIn: "we:scripts/gen-inventory.mjs#--staged"
graduatedTo: none
tags: [git, hook, inventory, write-time, ci]
---

# Write-time we:AGENTS.md inventory regen — pre-commit auto-regen so a commit can't land a stale inventory block

we:gen:inventory now runs automatically at commit time (pre-commit hook, scoped to inventory-affecting staged files) and re-stages we:AGENTS.md if it changed, so #1404's stale-inventory CI failure on an already-accepted PR can't recur

## Motivating incident

PR #1404 added a research topic (`src/_data/researchTopics/*.json`) without regenerating the
we:AGENTS.md inventory block. The staleness wasn't caught until `check:standards` failed in CI on an
already-`review:accepted` PR — costing a full extra round-trip (fix, re-push, wait for CI, re-review)
for a defect a machine could have prevented before the commit ever existed.

## Decision

The operator reviewed three options to close this gap:

1. **CI-time catch (status quo)** — keep relying on `check:standards`'s `kind: 'inventory'` check to
   catch staleness. Rejected as the sole line of defence: it's exactly what let #1404 through to an
   already-accepted PR.
2. **Never-commit the computed block; compute at read-time** — stop committing the inventory summary
   into we:AGENTS.md at all, and have it rendered on demand. Rejected: we:AGENTS.md needs to stay
   plainly readable with no build step for a session bootstrapping context (a session's first read of
   we:AGENTS.md must not depend on running a script first).
3. **Write-time auto-regeneration (chosen)** — keep the inventory committed (so we:AGENTS.md stays a
   plain file), but make `gen:inventory` run automatically at commit time so a commit that touches
   inventory-affecting content can't land stale. This mirrors existing precedent in this repo for
   write-time enforcement over CI-time catching — e.g. the locus-prefix scan hook
   (we:scripts/lint-locus-prefix.mjs) that runs on `PreToolUse(Edit|Write)` and again as a pre-commit
   staged sweep (#883/#1574).

## Implementation

- we:scripts/gen-inventory.mjs gained a `--staged` mode: if the commit's staged files include any of
  the six per-entry registries `renderInventory()` reads (`src/_data/{blocks,plugs,intents,semantics,
  researchTopics,projects}/*.json`) or we:AGENTS.md itself, it regenerates the inventory block and, if
  it changed, `git add`s we:AGENTS.md back into the SAME commit. Otherwise it's a silent no-op — an
  unrelated commit never touches we:AGENTS.md.
- Wired as `npm run gen:inventory:staged` into we:.githooks/pre-commit (the same `core.hooksPath`
  mechanism used by `lint:locus` and we:scripts/guard-git-push.mjs), after the locus-prefix gate.
- Cost: `gen:inventory` measured at ~0.37s (it only reads the small per-entry JSON registries, no
  build step), so it runs unconditionally once the staged-file scope check passes — no need for
  finer-grained cost scoping.
- `check:standards`'s existing `kind: 'inventory'` check (we:scripts/check-standards.mjs) is KEPT as a
  CI backstop for any commit path that bypasses the local hook (`--no-verify`, a non-standard commit
  path, or a `--local` lane build where the check is deferred to the per-merge gate per #1159). This is
  additive, not a replacement.

## Done when

1. **Executable** — a throwaway inventory-affecting change (e.g. adding a `src/_data/researchTopics/*.json`
   file), staged and committed with no manual `gen:inventory` step, produces a commit whose diff
   includes an updated we:AGENTS.md inventory block with no separate action from the committer.
2. `npm run check:standards` reports 0 new errors.
