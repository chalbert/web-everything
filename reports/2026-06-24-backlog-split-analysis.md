# Backlog split analysis — #1684 emitter buildout (graduated from #1688)

**Date:** 2026-06-24
**Focus:** `/slice 1684` — materialize the emitter build slices graduated by the #1688 ratification.
**Verdict:** **could split — 6 new slices** added under the already-storied epic #1684 (no conversion needed).

## Context

#1684 (`kind: epic`, webrouting standard) is already a storied epic: its four decision children
(1685–1688) are **resolved**, and it carries build slices A–E (1725–1729) plus 1720 (runtime ingestion),
1721 (route-map projection schema), 1732 (route-config schema). The resolved #1688 ratified the **emitter
set + dynamic-route policy** and explicitly graduated its build "under #1684 via `/slice 1684`: the emitter
registry + four emitters as separately-prioritized build items, plus the Fork-1 param-source hook." **None
of the existing slices cover that** — slice E (1729) is route-format/url-as-state conformance, not emitter
output. So this run *adds* emitter slices; it does not re-slice the epic.

## Work-investigation pass (real tree)

- The kernel every emitter reads is the **serializable route-map projection** (#1685 ratified, schema =
  slice 1721): `routes[].path` derived from `RouteDefinition` (`we:blocks/router/types.ts:131`) by
  `parseRouteDefinitions()` (`we:blocks/router/types.ts:194`), dropping `pattern: URLPattern` and
  `template: HTMLTemplateElement`.
- Slice 1721 explicitly parks the **DOM→map builder**: *"the derived-map BUILDER is not this slice; it
  folds into the first consuming slice (#1688 sitemap)."* → the registry/builder slice (S1) below owns it.
- Each emitter is a **pure facade over `routes[].path`** producing one downstream artifact, so they are
  independent siblings, not a chain. Output formats are known standards (no invention): `sitemaps.org/0.9`,
  `<script type="speculationrules">` (`we:src/_data/blocks/router.json:192`), a hierarchical nav-tree
  (mirrors `@11ty/eleventy-navigation`), a prerender path-manifest.
- **Constellation homing:** WE holds the **derivation + conformance vectors** (the headless-DOM builder is a
  permitted author/validate derivation per `#single-authoring-sot-derived-projection`; 1721 already frames it
  that way). A browser-runtime emitter impl rides downstream to FUI on the contract — out of scope for these
  WE slices. Each slice's deliverable = derivation logic + conformance vectors (route-map input → expected
  artifact).
- Fork 2's composition (IA-tree realizes the Navigation Intent `structure` axis,
  `we:src/_data/blocks/router.json:146`) and Fork 1's exclude-by-default + opt-in param-source live in S3
  and S6 respectively.

## Could split — proposed slices (all under epic #1684, no conversion)

| # | Title | workItem / size | blockedBy | Batchable |
| --- | --- | --- | --- | --- |
| S1 | webrouting emitter registry + route-map builder | story / 3 | 1721, 1725 | after S1's deps land |
| S2 | webrouting sitemap.xml emitter (`sitemaps.org/0.9`) + vectors | task | S1 | ✓ |
| S3 | webrouting IA nav-tree emitter (realizes Navigation Intent `structure`) + vectors | task | S1 | ✓ |
| S4 | webrouting prerender manifest emitter + vectors | task | S1 | ✓ |
| S5 | webrouting Speculation-Rules emitter (`<script type=speculationrules>`) + vectors | task | S1 | ✓ |
| S6 | webrouting dynamic-route param-source hook + build-time skip notice | story / 2 | S1 | ✓ |

**DAG (flat — max independence):**

```
1721 (projection schema) ─┐
1725 (slice A skeleton)  ─┴─→ S1 registry+builder ─┬─→ S2 sitemap.xml emitter
                                                    ├─→ S3 IA nav-tree emitter
                                                    ├─→ S4 prerender emitter
                                                    ├─→ S5 Speculation-Rules emitter
                                                    └─→ S6 param-source hook  (consumed by S2 + S4)
```

S2–S6 are independent siblings off S1. S6's param-source hook **additively** enriches the concrete-URL
emitters (S2, S4) — they ship with exclude-by-default first (valid demoable state: static routes only), and
the hook is the opt-in enumeration capability layered on. So no hard S2←S6 edge; the hook is authorable
against S1 alone.

## Rubric check (all five hold)

1. **Size is volume, not a fork** — settled at the epic + #1688 ratification (support-all + both fork
   defaults). No buried fork; every policy is ratified and codified (`#faithful-derivation-exclude-not-fabricate`).
2. **≥2 nameable slices, real home each** — 6 slices; each a distinct emitter/mechanism with a concrete WE
   home (derivation + vectors under the webrouting standard). #1688 *mandated* the four emitters as separate items.
3. **Each slice ≤3 / task** — S1 story·3, S6 story·2, S2–S5 tasks.
4. **Clean DAG, real independence** — S2–S5 produce disjoint artifacts (different format/consumer); each
   independently deliverable off S1.
5. **Every slice leaves a valid demoable state** — S1 yields the registry + route-map (renders);
   each emitter adds one artifact independently; sitemap-with-static-routes is valid without S6.

## Could not split

None — all six pass. (The downstream FUI runtime impl of each emitter is out of scope here, not a
could-not-split: it rides the WE contract these slices define, filed under FUI when a consumer needs it.)
