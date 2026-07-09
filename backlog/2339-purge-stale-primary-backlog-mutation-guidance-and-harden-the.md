---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# Purge stale primary-backlog-mutation guidance and harden the BACKLOG_MUTATE_OK override

#2219/#2302 settled the read-only-primary invariant (no backlog splice on primary, ever) but two holes remain: (1) we:skills-src/batch-backlog-items/SKILL.md and we:docs/agent/backlog-workflow.md STILL tell agents that we:scripts/backlog.mjs claim/resolve/retype/scaffold are guard-clean and run on primary; (2) the #2302 guard (we:scripts/guard-bash.mjs) advertises a BACKLOG_MUTATE_OK escape that lets any session mutate primary anyway (used in error 2026-07-09). Purge the stale docs to point pack-phase + lifecycle mutations at a lane, and remove or narrow-and-log the override so primary stays read-only in fact, not just by convention.

## Resolution

- `we:docs/agent/backlog-workflow.md` — the "Work in a lane" blockquote no longer describes `claim`/`release`/`resolve` as a "sanctioned exception" that "runs on primary"; it now states plainly that every `we:scripts/backlog.mjs` frontmatter splice (`claim`/`release`/`resolve`/`scaffold`/`settle`/`retype`/`yield`/`prepare-stamp`) runs in the lane clone and lands via its PR, with `we:scripts/guard-bash.mjs` denying every one unconditionally from a primary cwd (#2302), per #2219's ratified direction.
- `we:skills-src/batch-backlog-items/SKILL.md` — the pack-phase `retype` guidance no longer implies "guard-clean [on primary]"; it now says `retype` still lands via the lane→PR like every other mutation, with no `BACKLOG_MUTATE_OK` escape.
- `we:scripts/guard-bash.mjs` — removed the `BACKLOG_MUTATE_OK=1` override entirely (the #2302 primary-cwd backlog-mutation denial is now unconditional). #2219 already ratified that NO item-file frontmatter transition may ever splice to primary — unlike `MAIN_PUSH_OK`/`STALE_LANE_OK` (which cover cases with a real remaining legitimate use), there was no legitimate case left for this one; it was the exact hole the item's incident (used in error 2026-07-09) exploited.
- Updated `we:scripts/__tests__/guard-bash.test.mjs` and the two affected `we:scripts/golden-corpus/hook-guard-bash/*.json` fixtures (+ `we:scripts/mine-golden-corpus.mjs`'s scenario label) to match the new unconditional-denial behavior.
