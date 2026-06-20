---
kind: decision
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-benchmark-corpus-source-currency.md
relatedProject: webdocs
crossRef: { url: /research/benchmark-corpus-source-currency/, label: research topic }
tags: [gap-analysis, benchmark, corpus, currency, fast]
---

# Corpus source 'fast' has a dead docsUrl — FAST docs decommissioned (review/replace/remove)

**Prepared (no design existed — research reshaped the call).** During #531 the `fast` corpus source could
not be walked: every FAST component doc page 404'd. The original framing ("repoint to a `web.archive.org`
snapshot, or retire `fast`") survives only as the *broken* branch — the prior-art survey (published as
[/research/benchmark-corpus-source-currency/](/research/benchmark-corpus-source-currency/), report linked)
found FAST has **removed its component library**, so the call is a near-forced **retirement** plus one
genuine convention choice. Two forks below, each with a **bold** default.

The concern decomposes into two orthogonal axes. **(1) Source fate** — does `fast` stay in the corpus at
all? Its entry ([we:benchmarkCorpus.json:63](../src/_data/benchmarkCorpus.json#L63)) sits in the
`web-component-system` category ([we:benchmarkCorpus.json:42](../src/_data/benchmarkCorpus.json#L42)) and is
gated by the corpus's own `inclusionRule` ([we:benchmarkCorpus.json:38](../src/_data/benchmarkCorpus.json#L38))
against the `docs-quality` + `currency` criteria ([we:benchmarkCorpus.json:28-36](../src/_data/benchmarkCorpus.json#L28-L36)) — both of which `fast` now fails as a component source (docs 404; component library removed → repo is now `fast-element`/`fast-html`/`fast-router` tooling; its former components folded into Fluent UI Web Components = the existing `fluent-2` source at [we:benchmarkCorpus.json:50](../src/_data/benchmarkCorpus.json#L50)). **(2) Retirement mechanism** — *if* retired, do we delete the row or mark it retired? `fast` has **0** rows in [we:benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json) (shoelace 49 / spectrum-web-components 51 / lion 33 keep the axis covered), and the only corpus-source validator ([we:check-standards-rules.mjs:735](../scripts/check-standards-rules.mjs#L735)) merely forbids a presence row pointing at an unknown source — so both delete and mark-retired are validator-safe; the choice is about the longitudinal audit trail, not correctness.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Source fate | **Retire `fast`** | Repoint `docsUrl` to a Wayback snapshot & re-run | High — both alternatives are flawed |
| 2 · Retirement mechanism | **Mark retired with a reason** (keep the row) | Delete the entry | Med-high — a reusable convention call |

## Fork 1 — what happens to the `fast` source

**Crux:** `fast` can no longer be walked for capability presence, and the research shows *why* it can't be
fixed: FAST is no longer a component system. The repo ([github.com/microsoft/fast](https://github.com/microsoft/fast))
is live and unarchived (pushed 2026-06-12), but `packages/` now holds only `fast-element`, `fast-html`,
`fast-router`, `fast-build`, `fast-test-harness` — the `fast-foundation`/`fast-components` library was
removed and folded into Fluent UI Web Components ([we:benchmarkCorpus.json:50](../src/_data/benchmarkCorpus.json#L50), `fluent-2`).

- **A — Retire `fast` from the corpus. ✅ default.** It fails `docs-quality` (docs decommissioned) and
  `currency`-as-a-component-set (component library removed), and no longer occupies the
  `web-component-system` axis (it ships the *toolkit*, not the elements). The axis stays covered by
  shoelace / spectrum-web-components / lion, and FAST's former coverage is already represented by
  `fluent-2` — so nothing is lost.
- *Rejected* — **B — Repoint `docsUrl` to a `web.archive.org` snapshot and re-run.** A complete
  `2024-01-28` snapshot exists, so it's *possible*, but it would cite permanently-frozen 2024 URLs for a
  component set FAST has since deleted (violates the `currency` criterion) and **double-count Fluent**.
  Broken.
- *Rejected* — **C — Keep `fast`, repoint `docsUrl` to the live GitHub repo, rescope to "fast-element
  tooling."** Coherent but empty: the corpus benchmarks component/pattern/token capabilities, and an
  element base class ships none — `fast` would sit as a permanent zero-row source that no longer occupies
  its axis. Keeps a misleading row for no analytical value.

## Fork 2 — how to retire it (the reusable convention)

**Crux:** `fast` is the corpus's *first* dead source, and won't be the last — abandonment/currency is an
explicit selection criterion ([we:benchmarkCorpus.json:28-36](../src/_data/benchmarkCorpus.json#L28-L36)),
and the corpus is a longitudinal dataset (the [#192](/backlog/192-longitudinal-research-freshness-system/)
freshness model; `lastSwept`/`lastChecked`). So the mechanism chosen here becomes the convention every
future dead source follows.

- **A — Mark it retired with a reason; keep the row. ✅ default.** Add a `retired: true` +
  `retiredDate: "YYYY-MM-DD"` + `retiredReason` shape to the `fast` source (and exclude `retired` sources
  from the sweep / the `/research/benchmark-corpus/` active table). Preserves the audit trail — a re-run
  sees *why* `fast` left and won't naïvely re-add it — and is the reproducibility-preserving default under
  #192. Validator-safe (no schema change is enforced on sources).
- *Rejected* — **B — Delete the `fast` entry outright.** Safe right now (0 presence rows, so no dangling
  reference), but it silently erases the fact that FAST was evaluated and dropped, so a future sweep could
  re-add it and re-hit the same dead docs. Loses the longitudinal record for a one-line saving.

---

## Context

**Where this sits.** A per-source slice ([#531](/backlog/531-verify-capability-presence-fast-fast/)) of
epic [#495](/backlog/495-exhaustive-per-source-capability-presence-deep-doc-urls-fan-/) (exhaustive
capability-presence fill), under program [#315](/backlog/315-competitive-coverage-gap-analysis-program/).
#531 is already resolved — it captured the dead-docs finding honestly (zero fabricated rows) and scaffolded
this decision. Resolving #546 removes a `fast` slice from #495's remaining work.

**Classification (corpus data governance, not a standard).** The 7-question layer pass (Block / Intent /
Protocol / Capability) is N/A — #546 governs the gap-analysis program's *input data*, not a WE standard.
The governing principles are honest provenance (the #495/#352 method: never fabricate presence) and
reproducibility under #192 (a re-run must see why a source was dropped) — which is what tips Fork 2 toward
mark-over-delete.

**On resolution** (the `/next decision` turn, not now): apply the ratified branches to
`we:benchmarkCorpus.json`'s `fast` source, update the `/research/benchmark-corpus/` rendering if `retired`
sources should be visually separated, and reconcile epic #495 (one fewer slice). No
`we:benchmarkCapabilityPresence.json` change is needed (`fast` has 0 rows).

---

## Resolution (2026-06-14)

**Both forks ratified at their bold defaults.**

- **Fork 1 → A — `fast` retired from the active corpus.** It fails `docs-quality` (docs decommissioned)
  and `currency`-as-a-component-set (component library removed), and no longer occupies the
  `web-component-system` axis (ships tooling, not elements). Axis stays covered by shoelace /
  spectrum-web-components / lion; FAST's former coverage already lives in `fluent-2`.
- **Fork 2 → A — marked retired, row kept.** Added `retired: true` + `retiredDate` + `retiredReason` to the
  `fast` source ([we:benchmarkCorpus.json:63](../src/_data/benchmarkCorpus.json#L63)). Preserves the
  longitudinal audit trail so a re-run sees *why* `fast` left and won't naïvely re-add it.

**Applied:**

- `fast` source marked retired in [we:benchmarkCorpus.json](../src/_data/benchmarkCorpus.json) (`lastChecked`
  bumped to 2026-06-14); the `retired`/`retiredDate`/`retiredReason` shape is the seed convention.
- [we:benchmark-corpus.njk](../src/_includes/research-descriptions/benchmark-corpus.njk) excludes `retired`
  sources from the active per-axis tables and renders a new **Retired sources** section (with reasons).
- Epic [#495](/backlog/495-exhaustive-per-source-capability-presence-deep-doc-urls-fan-/) reconciled — the
  fan-out is now over **non-retired** sources; the `fast` slice is closed (0 rows).
- No `we:benchmarkCapabilityPresence.json` change (`fast` has 0 rows) — validator-safe.

**Generalisation spun off (kept #546 narrow).** The general "what to do when *any* cited reference retires"
strategy and the **monitoring/detection** capability (this finding surfaced only by tripping over a 404)
are out of scope here and are captured under a new epic
[#583 — External reference health monitoring](/backlog/583-external-reference-health-monitoring-liveness-retirement-rep/),
with children [#584](/backlog/584-general-reference-retirement-convention-generalize-the-corpu/)
(generalise this `retired` convention beyond the corpus) and
[#585](/backlog/585-reference-liveness-detection-sweep-multi-modal-404-moved-arc/) (active liveness sweep).
