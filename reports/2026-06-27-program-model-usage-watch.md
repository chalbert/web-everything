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
