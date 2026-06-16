# General reference-retirement convention — prior art + architecture prep (decision #584)

**Date:** 2026-06-14
**Decision:** [#584](../backlog/584-general-reference-retirement-convention-generalize-the-corpu.md) — generalize
#546's corpus `retired` shape across every place the project cites an external reference.
**Epic:** [#583](../backlog/583-external-reference-health-monitoring-liveness-retirement-rep.md) (reference-health
monitoring); this is the **dogfood layer (now)** slice — a self-run convention over *this* repo's references, not
the later WE platform-strategy setting (#583 layer 2).
**Seeded by:** [#546](../backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission.md) — the
`retired`/`retiredDate`/`retiredReason`, keep-not-delete shape added to `benchmarkCorpus.json`'s `fast` source.

## The question

#546 marked the corpus's first dead source with a `retired` shape. The same death (and the subtler *moved* /
*superseded* / *content-drift* failure modes) can hit any external URL the project cites — and those citations
live in **heterogeneous homes**: structured JSON rows, JSON `designSystemResearch[].reference` arrays, deep
per-row doc URLs, and freeform markdown prose. #584 asks: what *one* convention (if any) governs all of them,
where does it live, and how does it mesh with #192's existing `supersedes`/`supersededBy` chain?

## Inventory — every external-reference home in the repo

| # | Home | File | Container | External URLs | Already has retire/supersede? |
|---|---|---|---|---|---|
| 1 | Benchmark corpus sources | `src/_data/benchmarkCorpus.json` | JSON rows | `docsUrl`, `repoUrl` | ✅ `retired`/`retiredDate`/`retiredReason` (#546), `fast` at [benchmarkCorpus.json:63](../src/_data/benchmarkCorpus.json#L63) |
| 2 | Library references | `src/_data/references.json` | JSON link rows | `links[].url` ([references.json:19](../src/_data/references.json#L19)) | ❌ none |
| 3 | Block design-system refs | `src/_data/blocks.json` | `designSystemResearch[].reference` | spec URLs | ❌ none |
| 4 | Intent design-system refs | `src/_data/intents.json` | `designSystemResearch[].reference` ([intents.json:97](../src/_data/intents.json#L97)) | spec URLs | ❌ none |
| 5 | Capability-presence rows | `src/_data/benchmarkCapabilityPresence.json` | join-table rows | `rows[].url` ([benchmarkCapabilityPresence.json:27](../src/_data/benchmarkCapabilityPresence.json#L27)) | ❌ none (has `provenance`) |
| 6 | Research topics | `src/_data/researchTopics.json` | JSON topic rows | — (metadata only) | ✅ `supersedes`/`supersededBy` + `lastReviewed`/`reviewHorizon` (#192/#441/#477/#478), e.g. [researchTopics.json:60-85](../src/_data/researchTopics.json#L60-L85) |
| 7 | Backlog `crossRef` | `backlog/*.md` frontmatter | YAML | internal `/` links only | ❌ n/a (no external URLs) |
| 8 | Adapters / protocols | `src/_data/adapters.json`, `protocols.json` | JSON | — (no spec URLs yet) | ❌ none |
| 9 | Report citations | `reports/*.md` | freeform markdown | inline `[text](url)` | ❌ none |
| 10 | Research descriptions | `src/_includes/research-descriptions/*.njk` | freeform HTML/prose | inline `<a href>` | ❌ none |

**Two clusters fall out:** homes **1–5** are structured JSON with external URLs and zero-to-partial retirement
tracking (the convention's real target); homes **9–10** are freeform prose where a field-set can't be enforced,
only a documented style. Home 6 already has the *replacement* (supersede) half of the model; home 7 cites only
internal links; home 8 has no external URLs yet.

**Validation today:** the only relevant rule is [check-standards-rules.mjs:740](../scripts/check-standards-rules.mjs#L740),
warning when a `verified` presence row lacks a `url`. Nothing validates `retired*`, `docsUrl`, or
`supersededBy`. There are **no JSON Schema files** — validation is imperative in `check-standards-rules.mjs`.

## Prior art — how standards bodies mark retired / replaced references

The survey is decisive: **mature registries converge on a small, document-type-agnostic vocabulary, and they
separate "dead" from "replaced."**

- **W3C** distinguishes three lifecycle states explicitly ([Obsoleting and Rescinding W3C Specifications](https://www.w3.org/guide/process/obsolete-rescinded-supserseded.html)):
  **superseded** (a newer version is now recommended, but the old remains *valid/active*), **obsolete** (should
  no longer be used), and **rescinded** (withdrawn). Crucially, *superseded ≠ dead* — the reference is still
  live, just no longer the recommended one.
- **IETF** uses bidirectional `Obsoletes:` / `Updates:` headers between RFCs (a replacement pointer), plus a
  *separate* **Historic** status for "no longer current." It deliberately does **not** distinguish obsolete from
  deprecated ([RFC 7805](https://www.rfc-editor.org/rfc/rfc7805.html); [IESG Historic statement](https://www.ietf.org/about/groups/iesg/statements/designating-rfcs-historic-2011-06-27/)).
- **Python PEP** — `Superseded-By:`. **ADR** — `Supersedes` / `SupersededBy`. (Already cited in
  [research-freshness-model.njk](../src/_includes/research-descriptions/research-freshness-model.njk).)
- **JSON Schema / OpenAPI** — a single `deprecated: true` boolean *annotation* keyword: keep-not-delete,
  advisory, no behavioural change ([Learn JSON Schema: deprecated](https://www.learnjsonschema.com/2020-12/meta-data/deprecated/)).

**Two findings reshape the forks:**

1. **The retirement vocabulary is document-type-agnostic.** W3C applies the *same* three states to a REC, a
   Note, and a Group decision; IETF applies the same headers to every RFC regardless of stream. This is the
   strongest argument for a **uniform shape** over per-home shapes — the homes differ in *container*, not in the
   retirement *concept*.
2. **Death and supersession are distinct, linkable states — not one axis.** This is the universal pattern
   (W3C superseded-vs-obsolete; IETF Obsoletes-header-vs-Historic-status). #546 only modelled *death*
   (`retired`); #192 only modelled *replacement* (`supersededBy`). The general convention must hold **both**,
   and a reference can be *both at once* (FAST: dead docs **and** replaced by Fluent). This dissolves the
   original Fork 3 ("how does it interact with #192's supersedes chain?") into a concrete choice: **two
   orthogonal markers reusing #192's `supersededBy` pointer**, vs **one richer `status` enum** à la W3C.

## Classification — data governance, not a WE standard (7-question pass N/A)

Like #546, #584 governs the project's *internal reference data*, not a project-facing WE standard (the
platform-strategy *setting* is #583's later layer-2 slice). The Block/Intent/Protocol/Capability layer
sequence is N/A. The principles that *do* bind:

- **Native-first / borrow platform vocabulary** ([[feedback_native_first_default]], the Intl.Collator/aria-sort
  precedent): reuse W3C/IETF/JSON-Schema terms (`retired`, `supersededBy`, `deprecated`) — don't mint new
  jargon.
- **Reproducibility under #192**: keep-not-delete, so a re-run sees *why* a reference left and won't re-add it.
- **Bias toward separation** ([[feedback_bias_separation_decoupling]]): retired-ness and superseded-ness are
  separate facts; default to composable markers, not a fused enum, unless combining proves necessary.
- **Most-permissive default** ([[feedback_most_flexible_default]]): the convention is opt-in metadata, never a
  required field — adding it is the author's choice.

## Forks brought to DoR (full framing in the backlog item)

1. **Uniform shape vs per-home shapes** → **uniform** (one field-set wherever a home is structured JSON;
   prior art is document-type-agnostic).
2. **Where it lives** → **one documented convention + one shared validator helper** in
   `check-standards-rules.mjs` that each home's validator calls (no JSON Schema files exist; don't duplicate
   field definitions per home).
3. **Retirement vs supersession** → **two orthogonal markers** (`retired`+`retiredDate`+`retiredReason` for
   death; reuse #192's `supersededBy` pointer for replacement) rather than a single W3C-style `status` enum.
4. **Scope now** → **structured JSON homes 1–5 now**; freeform prose homes (9–10) get a *documented style only*,
   structured extraction deferred to #597 (the reference-registry substrate).

## References

- [Obsoleting and Rescinding W3C Specifications](https://www.w3.org/guide/process/obsolete-rescinded-supserseded.html)
- [RFC 7805 — Moving Outdated TCP Extensions to Historic](https://www.rfc-editor.org/rfc/rfc7805.html) ·
  [IESG Statement on Designating RFCs as Historic](https://www.ietf.org/about/groups/iesg/statements/designating-rfcs-historic-2011-06-27/)
- [Learn JSON Schema — `deprecated` (2020-12)](https://www.learnjsonschema.com/2020-12/meta-data/deprecated/)
- Internal: [#546 resolution](../backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission.md),
  [#192 freshness model](../backlog/192-longitudinal-research-freshness-system.md),
  [#597 reference-registry substrate](../backlog/597-reference-registry-substrate-index-the-structured-reference-.md)
