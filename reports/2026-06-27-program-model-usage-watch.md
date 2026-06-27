# Program review — Model-usage watch (#1855)

Living report (one per program; appended per run). Program: keep Claude's use of this repo's agent system efficient across subagent flow / context-memory / instructions / skills.

---

## Run 1 — 2026-06-27 (L0 → L1)

First watch. Both fronts swept by hand; program graduates L0→L1 (defined → skill-assisted) by gaining its first children.

### Front A — conformance (internal, measured)

Ran `we:scripts/check-memory.mjs` and inventoried the memory + skill surface.

- **Memory index at ceiling** — `we:MEMORY.md` is 21.9 KB of a 22 KB budget, 139 index lines over 144 topic files. No headroom to index anything new.
- **5 orphaned memories** — topic files with no index line, so recall context can never surface them (gate fails on exactly these): `feedback_no_branches_in_shared_checkouts`, `feedback_response_format_short_tail`, `project_adapter_pages_require_cache`, `project_fui_plugs_drifted_behind_we_local`, `reference_front_end_platform_book`.
- **Instruction surface** — 98 `feedback_*` + 44 `project_*` memories; large enough that redundancy is likely. Not yet de-duped.
- **Subagent return hygiene** — not instrumented; one live data point this run (see Front B): a spawned agent returned bloated prose + fabricated version numbers.

Filed: **#1863** (reconcile the 5 orphans), **#1864** (prune/dedup pass to recover headroom).

### Front B — currency (external)

Delegated a Claude Code feature sweep to a `claude-code-guide` subagent (last ~6 months).

- **Reliability caveat:** the agent attached precise version strings (`2.1.172`, etc.) that read as **fabricated** — treated as noise. Underlying capabilities cross-checked against the live toolset.
- **Verified-present, under-used:** the **Workflow** orchestrator (parallel disjoint lanes — a `/workflow` skill already wraps it), **structured-output schemas** (`agent({schema})` → validated objects), **Agent model-routing** (`model:` per spawn), **hooks**, **skill frontmatter metadata**.
- **Delta that matters:** batch-backlog-items is still serial while a parallel Workflow path already exists; readiness ranking + decision-fork parsing still parse text where a schema would validate.

Filed: **#1862** (decision — does Workflow supersede serial batching?), **#1861** (subagent return-hygiene contract — directly addresses the fabrication observed this run). **#1862** carries a downstream note that structured-output adoption rides on the orchestration outcome.

### Outcome

4 children filed (2 per front). Front-A metrics now have one real measurement each (except return-hygiene, still uninstrumented — #1861 is the first manual countermeasure). Program is L1.

**Next run:** re-measure the memory metrics after #1863/#1864 land (expect green gate + headroom); re-sweep Claude Code releases since 2026-06-27 (idempotent); resolve #1862 and, on its verdict, decide whether to file the structured-output adoption slice.

---

## Run 2 — 2026-06-27 (memory lens — requested literature review)

Focused front-B run: a literature review of latest agent-memory best practices, crossed against our memory model and the open #1868 index decision.

### Front A — conformance (re-measured)

- **Index still at ceiling.** #1863/#1864 (run 1's children) landed, but `we:MEMORY.md` is **22,494 B / 140 lines / 142 topic files** — no headroom recovered; the entries are load-bearing (#1864's finding), so mechanical trimming is exhausted.
- **1 orphan persists** — #1863 cleared 4 of 5; `we:reference_front_end_platform_book.md` still has no index line, so the gate stays **red**. It is the live specimen of the #1868 question (is an unindexed file reachable?).
- **Corpus skew** — 97 `feedback_*` / 42 `project_*` / 2 `reference_*` / 0 `user`. Redundancy likely; un-deduped.

### Front B — currency (literature sweep)

A `general-purpose` subagent surveyed 2025–2026 agent-memory practice (Anthropic context-engineering + Claude memory-tool docs; Generative Agents; MemGPT/Letta; LangMem; Mem0; Zep/Graphiti; Cognee), cross-corroborated.

- **Validates our design:** single always-loaded index + on-demand detail = the mainstream just-in-time / lightweight-identifier pattern; "right-home durable rules into version-controlled canon, not memory" = the field's strongest distinction; "one canonical memory, prune on sight" = Mem0's update-not-append.
- **Pivot evidence for #1868:** the *documented* Claude memory tool does **no** embedding/description auto-search — the agent reaches a file only by viewing the directory and choosing to read it. Leans the #1868 pivot toward "no free recall of unindexed files" → policy-clarification default. **Conflict:** our own harness visibly injects description-matched recalled memories, so the empirical recall check remains the gate.
- **Cheap, infra-free gaps:** write-time UPDATE/DELETE/NOOP classification; minimal recency/`last-affirmed` metadata; scheduled consolidation/reflection; (honesty-flagged) an episodic "winning trajectories" type that may overlap with skills.
- **Not worth it at our scale:** vector search, knowledge-graph, bi-temporal validity — all need infra we lack and are least justified for a solo file store.

### Human steers (this run)

Push the index toward a **pure pointer + core-invariants set**; **preserve instruction-rigor** through any shrink; use **close-out as a self-improvement loop**; and **document the strategy in a permanent file**.

### Outcome

- **Strategy codified permanently** — added a "Strategy & direction (the target architecture)" section to `we:docs/agent/memory-management.md`: the JIT principle, validated practices, status-tracked levers, the rigor-preservation invariant, and the explicitly-not-adopted infra patterns.
- **Folded into open #1868** — the recall-mechanism evidence, the pointer-index steer, and the rigor-preservation constraint; promoted *run the recall check* to its named next action.
- **3 children filed** — **#1878** close-out as a consolidation/reflection loop (the missing cadence) · **#1879** decision: sharpen memory write-time discipline · **#1880** instrument & templatize the watch (script the steps + output templates).

**Next run:** run the **#1868 recall check** — it gates the whole index-shrink; re-sweep Claude Code releases (idempotent); progress #1878/#1880 to graduate the watch cadence L1→L2.
