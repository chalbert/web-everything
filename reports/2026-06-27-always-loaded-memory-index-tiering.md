# Reconciling the always-loaded memory index with the harness compact target

> Grounding for decision [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/)
> (child of the model-usage watch [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/)).
> Prepared 2026-06-27. In-repo + memory-dir survey — no human judgment.

## The constraint, measured

| Fact | Value | Source |
|---|---|---|
| `we:MEMORY.md` (always-loaded index) | **22,494 bytes** (~21.97 KB) / 140 lines | `wc` on the live file |
| Topic fact files | 140 | `ls` on the memory dir |
| Gate hard ceiling | 22 KB (`MAX_BYTES = 22*1024`) | `we:scripts/check-memory.mjs:27` |
| Gate warn | 20 KB | `we:scripts/check-memory.mjs:28` |
| Per-line cap | 200 chars | `we:scripts/check-memory.mjs:29` |
| Documented harness hard limit | ~24.4 KB silent truncation | `we:scripts/check-memory.mjs:7,27`, `we:docs/agent/memory-management.md:23` |
| "~17.1 KB compact target" | **appears nowhere in the repo** | only in the #1868 card body |

The index is **at the ceiling** (~30 bytes of headroom). [#1864](/backlog/1864-memory-index-prune-dedup-pass-index-is-at-the-22kb-ceiling/)
already ran the mechanical prune/dedup pass and concluded the entries are load-bearing — trimming can't close
a multi-KB gap (it `graduatedTo` "deep compaction → #1868").

## The ~17.1 KB figure is unverified

It originates **only** from the harness compaction hook firing during the #1864 session — observed runtime
behaviour, not a documented threshold. Grep across `scripts/`, `docs/`, `.claude/`, `we:AGENTS.md` finds it
nowhere. The only *documented* harness limit is the ~24.4 KB silent-truncation point
(`we:scripts/check-memory.mjs:7`), against which the 22 KB gate already holds headroom. Compaction heuristics
fire under context pressure; a hook firing is not evidence of a stable 17.1 KB target worth hardening a gate to.

## The lazy-tier question is the crux

`we:docs/agent/memory-management.md` describes a two-tier model — Tier 1 the always-loaded `we:MEMORY.md` index,
Tier 2 on-demand topic files, which (line ~57) *"need not have an index line at all once the index is at
budget."* **But the gate contradicts this directly:** `we:scripts/check-memory.mjs:90-91` **errors** on any
topic file without an index line, commenting that an unindexed file is *"unreachable by recall context."*

So the whole decision pivots on **one empirical fact about the harness this project runs under**: *does the
harness recall an unindexed fact file by its `description` frontmatter, or not?*

- The repo contains **no** search/embedding/lazy-lookup code — Tier 2 is a *convention*, not repo machinery.
- The harness memory contract advertises recall ("`description` — used to decide relevance during recall";
  "Recalled memories appearing inside system-reminder blocks"), which would make per-file recall a **harness**
  feature invisible to a repo scan.
- Yet the gate author's own comment ("unreachable by recall context") encodes the belief that recall is
  **index-driven** — i.e. the model finds a fact via its `we:MEMORY.md` line, then reads the file.

These two readings select opposite mechanisms, and neither can be settled from the codebase — only by observing
the running harness. That observation is the unlock; it is a minutes-long check the decider can run.

## What each branch implies

- **If recall reaches unindexed files** → evicting lowest-recall entries to **recall-only** fact files (and
  relaxing `we:scripts/check-memory.mjs:90-91` to permit a designated unindexed pool) is a real structural fix:
  it shrinks the always-loaded surface — the exact cost the #1855 program guards — without losing facts.
- **If it does not** → "evict to an unindexed pool" is **memory deletion with extra steps** (the file becomes
  unfindable: the only thing that told the model it existed was the line just removed). Then the honest move is
  to **resolve the policy↔gate contradiction the other way** — delete the aspirational `we:docs/agent/memory-management.md:57`
  sentence, accept a bounded index, and reduce load only via the one safe lever that already exists: **rule 1,
  right-home project invariants out of memory into `we:docs/agent/platform-decisions.md`** (the statute layer),
  which removes them from always-loaded context without making them unreachable.

Sharding the single index is rejected on both branches: the harness auto-loads `we:MEMORY.md` only, so splitting
it either still all-loads (no reduction) or needs the *same* recall mechanism the eviction path needs — added
indirection, no independent benefit.

## Skeptic pass (folded in)

- **Fork 1 (gate target) — SURVIVES.** Dismiss the 17.1 KB signal: undocumented, anecdotal, and chasing it
  hardens the gate to a phantom. Keep tracking the documented ~24.4 KB limit (22 KB ceiling, ~2.4 KB headroom).
- **Fork 2 (mechanism) — REFUTED as first drafted.** The "build a real lazy tier by evicting to an unindexed
  pool" default presumed a recall mechanism the repo can't show exists; if it doesn't, eviction destroys
  access rather than deferring load. The refutation is *conditional on no-recall* — so the prepared default is
  reframed: **resolve the recall-mechanism question empirically first**, then take the matching branch
  (eviction+gate-relax if recall reaches unindexed files; policy-clarification + right-homing if not). The
  safe default, absent that check, is the policy-clarification branch.
