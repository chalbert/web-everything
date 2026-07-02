---
kind: decision
status: open
relatedTo: ["1952", "2148", "2077"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
tags: []
---

# Decision: should we:package.json and we:.eleventy.js be blacklisted as merge-risk files (rule 2c), reversing #1952 for these two paths?

**Retyped story→decision during batch-2026-07-02 (was "just add two paths"): it directly contradicts ratified #1952 and cannot be an agent-mechanical edit.** #1952 ("C: demote build-config files off the monolith serial trigger", resolved 2026-06-29) *deliberately removed* build-config files from `RESERVED_MERGE_RISK` in exactly this predicate, on the codified principle that build config is **line-structured** — distinct-line edits (a `scripts` entry, a passthrough) merge clean, and a genuine same-line clash is a **real git conflict** that the rebase-retry / serial-replay floor catches. The `we:scripts/readiness/lane-partition.mjs` header now states this explicitly ("NOT here (#1952, slice C): BUILD CONFIG … `we:package.json` …"). Adding these two paths back reverses that call.

**The fork.** Does #1952's "build config is safe under optimistic merge" principle hold for `we:package.json` + `we:.eleventy.js`, or do these two warrant a co-serialize exception?

- **Default (bold): keep #1952 as-is — do NOT blacklist.** No wrong-merge has actually been observed; the item's own evidence (#2018/#2020 on `we:.eleventy.js`, #2024/#2087 on `we:package.json`) is only that they ran **flagged as `multiLaneFile`** — a non-failing post-hoc notice, which is exactly the optimistic floor working as designed. A duplicate-key / same-region clash is a real git conflict (caught), not a clean-but-wrong merge. Blacklisting trades real concurrency for a risk not shown to exist.
- **Alternative: blacklist the two paths.** Argument: `we:package.json` is npm-mandated-single (not splittable like the #1145/#1146 per-entry registries), and two lanes each adding a JSON key at different line offsets *can* clean-merge into a duplicate-key object (last-wins) — a genuine clean-but-wrong case #1952's line-merge reasoning may under-weight for structured JSON specifically. If accepted, also reconcile the #1952 header comment so the statute stays self-consistent, and consider whether the split-instead approach (like #2148 did for the FUI barrels; `we:package.json` can't split, `we:.eleventy.js` can into config fragments) is strictly better than co-serializing.

Original story text (for reference): *"Cheap floor companion to #2148 … add these two paths to the merge-risk (blacklist) file set in `we:scripts/readiness/lane-partition.mjs` plus the inline mirror in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`, non-negotiable rule 2c, so any two items sharing them are forced same-lane. The third irreducible monolith — the orchestrator script itself (#2073/#2071) — is the self-modifying case covered by #2077, not this item."*

Needs a ratify call (and, if GO, an amendment to #1952's codified rationale) — not batchable as a mechanical edit.
