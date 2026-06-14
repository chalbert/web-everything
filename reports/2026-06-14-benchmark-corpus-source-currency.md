# Benchmark-corpus source currency — the FAST decommission, and how the corpus retires a dead source

> Session artifact for decision [#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/)
> (under epic [#495](/backlog/495-exhaustive-per-source-capability-presence-deep-doc-urls-fan-/) → program [#315](/backlog/315-competitive-coverage-gap-analysis-program/)).
> Published as the `/research/` topic **benchmark-corpus-source-currency**. Prior-art = the live state of
> the FAST project + the corpus's own selection criteria; not a greenfield standards survey.

## The trigger

During [#531](/backlog/531-verify-capability-presence-fast-fast/) (the per-source presence walk for
`fast`), **every FAST component doc page returned HTTP 404**. The slice added zero verified rows and,
rather than fabricate presence from reputation, scaffolded #546 to decide the source's fate. The framed
options were: **(A)** repoint `docsUrl` at a `web.archive.org` snapshot and re-run, or **(B)** retire
`fast` from the corpus.

## What the research found (decisive — it reshaped the call)

The honest framing turns out to be stronger than "the docs 404". Three findings, in order of weight:

1. **The docs site is genuinely gone, not just moved.** `https://fast.design/docs/<v>/components/<name>`
   404s across `1.x / 2.x / 3.x`; the historical working path `/docs/components/<name>/` 404s; and even
   the path the *current repo README points at* — `https://fast.design/docs/2.x/` — 404s. So this is not
   a path-pattern fix; the per-component docs surface the extraction phase reads no longer exists.

2. **FAST has removed its component library entirely.** `github.com/microsoft/fast` is **not archived**
   (pushed 2026-06-12, ~9.6k★, default branch `main`) — but `packages/` now contains only
   `fast-element`, `fast-html`, `fast-router`, `fast-build`, `fast-test-harness`. There is no
   `fast-foundation` / `fast-components`. **FAST is now a low-level web-component *authoring* toolkit**
   (an element base class + templating + a router), **not a component set.** It ships none of the 96
   component/pattern/token capabilities the corpus benchmarks.

3. **FAST's former components are Fluent's components.** Microsoft folded the FAST component library into
   **Fluent UI Web Components** (`github.com/microsoft/fluentui`) — which is exactly the corpus's
   **`fluent-2`** source (`repoUrl: github.com/microsoft/fluentui`). So FAST's former coverage is already
   represented; benchmarking it again would double-count Fluent.

Supporting facts:

- **An archive walk is technically possible but measures a dead product.** Wayback has a complete
  `2024-01-28` snapshot at `https://www.fast.design/docs/components/<name>/` (HTTP 200; confirmed via the
  CDX API). But those URLs are permanently frozen 2024 state for a component library FAST has since
  deleted — citing them as current presence violates the corpus's **currency** criterion and the whole
  "reflect what leading systems offer *now*" premise.
- **The web-component axis stays covered without FAST.** After retiring `fast`, the
  `web-component-system` category still holds **shoelace** (49 presence rows), **spectrum-web-components**
  (51 rows), and **lion** (33 rows). `fast` itself has **0** rows in
  `benchmarkCapabilityPresence.json` — so retiring it (even by deletion) breaks no presence-row reference
  (the only corpus-source check, `check-standards-rules.mjs:735`, is satisfied).

## How this maps to the corpus's own rules

`benchmarkCorpus.json`'s `inclusionRule`: *a source qualifies if it scores on ≥3 selection criteria AND
occupies a category axis.* Two criteria FAST now fails outright **as a component-benchmark source**:

- **`docs-quality`** ("browsable, citable per-component docs — the source material extraction reads") —
  the docs are decommissioned.
- **`currency` as a component set** — the component set was removed; what remains (fast-element tooling)
  is maintained but is not the thing being benchmarked.

And it no longer meaningfully **occupies the `web-component-system` axis** ("ships standards-based custom
elements usable in any framework") — FAST ships *the toolkit you build such elements with*, not the
elements. So under the corpus's own gate, `fast` no longer qualifies.

## Classification pass (corpus data governance, not a standards artifact)

The 7-question layer sequence (Block / Intent / Protocol / Capability …) is **N/A** here: #546 governs
the *input data* of the gap-analysis program, not a WE standard. The governing principles are the ones
that apply to the corpus as a longitudinal research dataset:

- **Honest provenance** (the #495/#352 method: never fabricate presence) → don't keep a source we can't
  truthfully walk.
- **Reproducibility + longitudinal freshness** (the [#192](/backlog/192-longitudinal-research-freshness-system/)
  model; `lastSwept` / `lastChecked`) → a re-run must be able to see *why* a source left the corpus, so
  retirement should be **recorded, not silently erased**.

## Recommendation

- **Fork 1 — retire `fast` from the corpus** (not repoint-to-archive, not keep-as-tooling). The archive
  branch is the broken one (frozen URLs + deleted product + Fluent double-count); keep-as-tooling is a
  coherent-but-empty branch (a permanent zero-row source that no longer occupies its axis).
- **Fork 2 — mark it retired with a reason rather than delete the entry.** `fast` is the corpus's *first*
  dead source and won't be the last (abandonment is an explicit criterion), so establish a reusable
  retirement convention: a `retired` / `retiredDate` / `retiredReason` shape on the source, excluded from
  sweeps, preserving the audit trail and the reason a future re-run shouldn't re-add it.

## Sources

- FAST repo (live, not archived): https://github.com/microsoft/fast — `packages/` = fast-element,
  fast-html, fast-router, fast-build, fast-test-harness (no fast-foundation/components).
- FAST docs 404: `https://fast.design/docs/2.x/` (README-linked), `…/docs/<1.x|2.x|3.x>/components/*`.
- Wayback CDX: `http://web.archive.org/cdx/search/cdx?url=fast.design/docs/components*` — last HTTP-200
  component snapshots `2024-01-28`.
- Fluent UI Web Components (FAST's components' new home): https://github.com/microsoft/fluentui (= corpus
  `fluent-2`).
- `microsoft/fast-react` — explicitly "an archive … deprecated React components".
