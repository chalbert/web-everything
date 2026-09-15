---
kind: decision
status: open
scope: ["we:scripts/lib/model-capability-ratings.mjs", "we:scripts/lib/model-capability-ratings.json", "we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-15"
tags: []
---

# AI model-capability watch program — keep external capability ratings current

Tonight (2026-09-15) we:scripts/lib/model-capability-ratings.mjs shipped as a SECOND signal, deliberately
separate from real dispatch trial data: external benchmark/leaderboard capability ratings per
{provider, model}, feeding we:scripts/lib/provider-routing.mjs's selectProvider() as an advisory hint only,
never selectSupervisionLevel(). The registry ships with entries: [] (no unverified numbers checked in as
fact) -- so keeping it current is an open, unprepared decision, not an implementation detail.

## Context

The operator explicitly declined to seed real numbers from an external leaderboard PDF shared as an
example -- unverified, another agent's report, will go stale. Per the operator's own framing, "the actual
benchmark and ponderation will have to be regularly updated." This card exists to capture that recurring
process as its own decision, left for a future `/prepare-decision-item` pass:

1. **Refresh cadence** — a fixed schedule, or triggered by a new model/provider entering rotation?
2. **Trustworthy-source bar** — a single leaderboard, a cross-checked aggregate, first-party benchmark
   disclosures, or some combination? Who confirms an entry's `verified: true`?
3. **Who/what runs the refresh** — a scheduled mechanized pass (mirroring we:scripts/conveyor/'s own
   mechanized passes), or a manual periodic review session?

Not resolved here on purpose — this decision is unprepared (no `preparedDate`), per this repo's "never take
an unprepared decision" rule.

## Done when

1. **Ratified, not executed** — this is a governance decision, not a build: "done" means a future session
   runs `/prepare-decision-item` on this card (research + fork authoring), then a later session actually
   rules on the three open questions above and sets `codifiedIn`. No code artifact is owed by this card
   itself.
