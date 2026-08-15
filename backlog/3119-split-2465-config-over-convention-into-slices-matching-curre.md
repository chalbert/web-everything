---
bornAs: xf0jln6
kind: task
parent: "2445"
status: open
dateOpened: "2026-08-15"
crossRef: { url: /backlog/2465/, label: "#2465 — config-over-convention (the item this splits)" }
tags: [plateau-loop, config, split]
---

# Split #2465 config-over-convention into slices matching current repo state

[#2465](/backlog/2465-plateau-loop-config-over-convention-gating-review-drain-mode/) ("gating / review /
drain / model as platform config, wired to the operable console") was found NOT build-ready during a
2026-08-15 prep pass (see its own "Prep assessment" section for the full grounding) and needs to be split,
not prepared as one story.

## Why it doesn't decompose into one story

Two of its four axes already shipped as config under different epics after #2465 was filed: gating
(`we:scripts/lib/gate-config.mjs`, #2448) and review escalation (`we:scripts/lib/review-policy.contract.json`,
#2566/#2771/#2785) are both already versioned, machine-diffable, human-gated config — editing either from a
console UI would re-open the self-gating invariant
(`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`), which is its own decision, not a
builder's call to make silently. Drain policy is partly config (`plateau:tools/drain-daemon/lib.mjs:36-50`
already reads `DRAIN_DAEMON_*` env vars) and partly hardcoded constants
(`plateau:tools/drain-daemon/lib.mjs:405-420` — `STALL_WARN_PASSES`, `FAIL_WARN_COUNT`, etc.). Model choice
has no config surface at all — `RunnerTask.model` / `BuildFlowOpts.model` are plumbed to the CLI's `--model`
flag (`plateau:src/build-runner/runner.ts:36-37,90`; `plateau:src/build-runner/build-action.ts:131-132`) but
no caller ever sets them. The "wired to the operable console" half is unbuilt for all four axes — none of
`we:scripts/lib/gate-config.mjs`, `we:scripts/lib/review-policy.contract.json`, or `DRAIN_DAEMON_*` is
referenced anywhere under `plateau:tools/dev-panel/` or `plateau:src/backlog-view/`.

## Recommended slices (for whoever runs `/split` or re-preps this)

- **A — console policy-inspector, read-only.** Surface the already-live config artifacts in the Plateau
  console: the gate-config tier roster, the review-policy contract's thresholds/reason vocabulary, and the
  drain-daemon's `resolveConfig()` output. No new write path — inspection only, so it carries none of the
  self-gating risk. Buildable now, in `plateau-app`.
- **B — model choice as real config.** Give `BuildFlowOpts.model` an actual source (start with a
  `PLATEAU_BUILD_MODEL` env var, same pattern as `DRAIN_DAEMON_*`) and a console control to view/select it.
  Buildable now; the plumbing already exists end-to-end, only the config source is missing.
- **C — externalize the remaining drain thresholds.** Move `STALL_WARN_PASSES`/`STALL_CRIT_PASSES`/
  `FAIL_WARN_COUNT`/`FAIL_CRIT_COUNT`/`TIMEOUT_WARN_COUNT`/`PARK_STALE_PASSES`/`CONSIDERED_NEVER_MERGED_PASSES`
  (`plateau:tools/drain-daemon/lib.mjs:405-420`) onto the same env-override pattern the timing constants
  already use (`resolveConfig()`, `:36-50`). Small and mechanical.
- **Explicitly NOT a slice yet:** an *edit* path for gating/review-escalation config from the console. That
  needs its own decision (how a console write reconciles with the declarative-leash self-gating invariant) —
  do not let a slice assume an answer to it.

## Done when

- #2465 is either resolved as superseded-by-split (pointing here + at the new slice items) or its scope is
  narrowed to explicitly exclude what A/B/C above already cover, and
- new backlog items exist for A, B, and C (or a documented reason fewer than three are needed), each carrying
  its own decided design/interfaces per the story-preparation checklist before being marked build-ready.
