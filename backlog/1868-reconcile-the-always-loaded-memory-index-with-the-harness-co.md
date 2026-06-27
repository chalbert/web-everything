---
kind: decision
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
codifiedIn: "docs/agent/platform-decisions.md#memory-optimization-strategy"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-always-loaded-memory-index-tiering.md
tags: [memory, context, model-usage-watch, harness, recall]
---

# Reconcile the always-loaded memory index with the harness compact target

The always-loaded memory index `we:MEMORY.md` sits at ~21.97 KB / 140 lines, at the gate's 22 KB ceiling, with [#1864](/backlog/1864-memory-index-prune-dedup-pass-index-is-at-the-22kb-ceiling/) having shown the entries load-bearing — mechanical trimming can't close the gap. Two calls under the #1855 watch. **Fork 1 (gate target):** keep tracking the *documented* ~24.4 KB harness limit; the card's "~17.1 KB compact target" appears nowhere in the repo. **Fork 2 (mechanism):** the structural fix pivots on one empirically-checkable fact — *does the harness recall an unindexed fact file by its `description`?* — which selects between evict-to-recall-only and a policy clarification.

## Resolution — ratified 2026-06-27

- **Fork 1 → keep the documented ~24.4 KB harness limit (22 KB ceiling).** The ~17.1 KB figure is unverified (appears in no script/doc/config); a compaction hook firing under pressure is not a stable threshold. `we:scripts/check-memory.mjs` stays as-is.
- **Fork 2 → right-home-first; eviction gated on a positive recall read-out.** The always-loaded surface shrinks **now** via the *proven* lever — **rule 1, right-home durable/load-bearing rules out of personal memory into `we:docs/agent/platform-decisions.md` + the `we:AGENTS.md` router** (on-demand, no recall dependency). The **evict-to-recall-only** branch is **deferred** until the armed recall check reads positive; betting rigor on unproven description-recall is rejected. Evidence weighed: this resolution's own session (saturated with "memory") surfaced **zero** unindexed topic files via recall, and the documented Claude memory tool does no embedding auto-search — both lean against free recall, but the cross-session check remains the formal settler for ever enabling eviction.

Codified into `we:docs/agent/memory-management.md` → "Strategy & direction". Opens build story: the right-home pass (child of [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/)). The recall check stays **armed** (see below) as the trigger to revisit eviction.

## The axis — what is genuinely open, grounded in the gate + memory dir

`we:scripts/check-memory.mjs:27` sets `MAX_BYTES = 22*1024` ("headroom under the ~24.4 KB harness truncation limit", `we:scripts/check-memory.mjs:7`), `:28` warns at 20 KB, `:29` caps lines at 200 chars; it byte-budgets `we:MEMORY.md` only. The live index is **22,494 bytes / 140 lines** with **140 topic files** — ~30 bytes of headroom. The card's "~17.1 KB compact target" is sourced **only** from a compaction hook firing during the #1864 session; a grep across `scripts/`, `docs/`, `.claude/`, `we:AGENTS.md` finds it nowhere — the sole *documented* limit is the ~24.4 KB silent-truncation point. The deeper tension is a **policy↔gate contradiction**: `we:docs/agent/memory-management.md:57` says topic files "need not have an index line at all once the index is at budget," but `we:scripts/check-memory.mjs:90-91` **errors** on any unindexed topic file, commenting it is "unreachable by recall context." That comment encodes a belief (recall is index-driven) the memory contract's per-file `description` field ("used to decide relevance during recall") contradicts. Neither can be settled from the codebase — the repo has **no** search/embedding/lazy-lookup machinery; whether unindexed files are recalled is a **harness** behaviour, observable only by running it. That single observation is the unlock for the whole mechanism fork.

## Recommended path at a glance

| Concern | Shape | Recommended | Why |
|---|---|---|---|
| **Fork 1 — gate target** | genuine fork | **Keep tracking the documented ~24.4 KB limit (22 KB ceiling); dismiss the unverified 17.1 KB** | 17.1 KB appears nowhere in repo/docs; a compaction hook firing under context pressure isn't a stable threshold to harden a gate to. |
| **Fork 2 — size mechanism** | genuine fork, empirically-gated | **Run the recall check first; if recall reaches unindexed files → evict-to-recall-only + relax the gate; if not → policy-clarification + right-home invariants** | The repo can't show a recall mechanism exists; absent it, "evict to an unindexed pool" is deletion-with-extra-steps. |

## Fork 1 — gate target: documented 24.4 KB limit vs the ~17.1 KB compact signal

*Fork-existence:* a real either/or on what the gate tracks — tightening to 17.1 KB forces eviction the documented limit doesn't require, so the two targets are mutually exclusive calibrations.

- **(default) Keep tracking the documented ~24.4 KB hard limit** — hold the 22 KB ceiling (~2.4 KB headroom against silent truncation, `we:scripts/check-memory.mjs:7`). Treat ~17.1 KB as **unverified**: if it ever appears in a harness doc, re-calibration is a one-line constant change.
- **(b) Re-calibrate the gate down to ~17.1 KB now** — chases an undocumented, anecdotal runtime signal; would force eviction (Fork 2) on the strength of a hook firing, with no stable threshold behind it.

*Skeptic: SURVIVES → keep the documented limit. Verified 17.1 KB appears in no script/doc/config — only the card body — while `we:scripts/check-memory.mjs:7` and `we:docs/agent/memory-management.md:23` both cite ~24.4 KB. A compaction hook firing under context pressure is not evidence of a stable threshold worth hardening a gate to.*

## Fork 2 — size mechanism: evict-to-lazy-tier vs shard vs policy-clarification

*Fork-existence:* a real either/or — the branches are mutually exclusive structural responses, and (as drafted) the eviction branch's validity is **conditional on a harness fact**, which is what makes the empirical check the gating step rather than a free pick.

- **The pivot — run the recall check first.** Establish empirically whether the harness recalls an *unindexed* fact file by its `description` (e.g. drop one entry's index line, confirm whether it still surfaces in a relevant session). This is minutes of work and decides the branch:
  - **If recall reaches unindexed files → evict lowest-recall entries to recall-only files + relax the gate** so `we:scripts/check-memory.mjs:90-91` permits a designated unindexed pool. This genuinely shrinks the always-loaded surface — the #1855 cost — without losing facts. *(default if recall confirmed.)*
  - **If it does not → policy-clarification** *(safe default absent the check)*: delete the aspirational `we:docs/agent/memory-management.md:57` line (the gate has never permitted it and no recall mechanism backs it), accept a bounded index, and reduce load only via the one safe lever — **rule 1, right-home project invariants out of memory into `we:docs/agent/platform-decisions.md`** (the statute layer), which removes them from always-loaded context without making them unreachable.
- **(rejected) Shard the single index** — the harness auto-loads `we:MEMORY.md` only, so splitting it either still all-loads (no reduction) or needs the *same* recall mechanism the eviction path needs. Indirection without independent benefit.
- **(rejected) Trim harder** — #1864 already exhausted this; the entries are load-bearing.

*Skeptic: REFUTED as first drafted → reframed around the empirical pivot. The "build a real lazy tier by evicting to an unindexed pool" default presumed a recall mechanism the repo can't show exists; if it doesn't, eviction destroys access rather than deferring load (the only thing telling the model a fact exists is the line being removed). So the recall check is promoted to the gating step, and the **policy-clarification branch is the safe default** until recall is confirmed. Sharding stays rejected on both branches.*

## Update 2026-06-27 (run 2 — literature sweep + human steer, under #1855)

Two inputs from the second model-usage-watch run sharpen Fork 2 without yet resolving it (the recall check is still the gate).

- **External evidence on the pivot.** A 2025–2026 agent-memory literature sweep (front B of [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/)) found the *documented* Claude memory tool does **no** embedding/description auto-search — the agent reaches a file only by viewing the directory and choosing to read it ("just-in-time retrieval with lightweight identifiers", *Anthropic, "Effective context engineering"*; Claude memory-tool docs). That leans the pivot toward **recall does NOT reach unindexed files for free** → the policy-clarification safe-default. **But** this repo's harness visibly injects description-matched "recalled memories" into `<system-reminder>` blocks, which points the other way for *our* harness specifically. The two signals conflict, so the empirical check (drop one index line, confirm whether the fact still surfaces in a later relevant session) remains the gating step — it is now **promoted to this card's named next action**.
- **Human steer — push the index toward pure pointers.** Direction set: prefer shrinking the always-loaded index to a small **core-invariants set** plus on-demand topic files ("a rule for X exists if needed, not the rule itself"), because the full ~22 KB index is a per-session context cost. This is the aggressive branch of Fork 2 — *valid only if the recall check passes*.
- **Rigor-preservation constraint on the eviction branch.** If we evict, instruction-rigor must not regress. Guards that must hold for the eviction branch to be acceptable: (1) the core-invariants set (~≤12) stays always-loaded; (2) eviction is gated on a *passing* recall check — never drop an index line before proving the fact is still reachable; (3) `we:scripts/check-memory.mjs` + the write-time hook keep enforcing budget/pointer integrity; (4) durable rigor-bearing rules live in `we:docs/agent/platform-decisions.md` + `we:AGENTS.md` (rule 1), never in the volatile memory index — so the shrink only ever evicts low-recall, non-load-bearing facts.

## Recall check — armed 2026-06-27 (the gating experiment)

Rather than un-index a load-bearing memory (which would risk a real fact during the observation window), the experiment reuses the **existing orphan** as a zero-cost specimen:

- **Specimen:** `we:reference_front_end_platform_book.md` — already has no index line in `we:MEMORY.md` (the persistent gate-red from run 1 of #1855). Leave it un-indexed; do **not** clear it until the observation lands.
- **Observation:** in a future session whose context genuinely touches *front-end platform engineering / the referenced book*, check whether this file appears in the harness's **recalled-memory `<system-reminder>`** block despite having no index line.
- **Read-out:**
  - **Surfaces → recall reaches unindexed files by `description`** → the evict-to-recall-only branch of Fork 2 is viable; relax `we:scripts/check-memory.mjs:90-91` to permit a designated unindexed pool, and the index can shrink to a core-invariants set (the human's pointer-index steer).
  - **Absent across a few such sessions → recall is index-driven** → policy-clarification branch: delete the aspirational `we:docs/agent/memory-management.md` "need not have an index line" line, accept a bounded index, and shed load only via rule 1 (right-home into `we:docs/agent/platform-decisions.md`). Then clear the orphan (index or evict).

Until the read-out, the gate stays red on this one file **by design** — it is the live probe, not an unaddressed defect.

### Recall read-out — NEGATIVE (2026-06-27)

A fresh, uncontaminated session was asked to list the memories auto-recalled into its context without reading any files. It returned **exactly the 139 `we:MEMORY.md` index lines and nothing else** — the unindexed specimen was **absent**, and **no topic-file bodies were recalled at all**. This is a mechanism finding, not just an absence: in this harness **auto-recall = the always-loaded index; topic-file bodies are reached only by an explicit agent read after seeing the pointer.** Converges with the literature (documented Claude memory tool does no embedding auto-search) and the earlier in-session observation.

**Resolves Fork 2 to the policy-clarification branch; the eviction branch is CLOSED** (an unindexed file is unreachable, so eviction loses the fact). Follow-through codified: corrected the disproven "need not have an index line" line in `we:docs/agent/memory-management.md`, updated the strategy lever (eviction closed), and re-scoped [#1881](/backlog/1881-right-home-durable-memory-rules-into-platform-decisions-and-/) to right-home + prune only. Residual edge (minor): this tested session-*start* recall; mid-session topical recall is untested but not relied upon.

## Lineage

Surfaced 2026-06-27 when the harness compaction hook fired repeatedly during the [#1864](/backlog/1864-memory-index-prune-dedup-pass-index-is-at-the-22kb-ceiling/) prune (`graduatedTo` "deep compaction → #1868"), under the model-usage watch [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/). Prepared 2026-06-27: gate + memory-dir survey establishing the real sizes, the unverified 17.1 KB figure, and the policy↔gate contradiction, published as research topic `always-loaded-memory-index-tiering` and report [we:reports/2026-06-27-always-loaded-memory-index-tiering.md](reports/2026-06-27-always-loaded-memory-index-tiering.md). The existing policy is codified at [we:docs/agent/memory-management.md](docs/agent/memory-management.md).
