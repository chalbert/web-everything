---
kind: decision
size: 2
parent: "563"
status: parked
dateOpened: "2026-06-14"
tags: [methodology, agile, ai, ways-of-working, enablement, positioning, decision, deferred, pre-release]
crossRef: { url: /backlog/143-ai-approach-page/, label: "Public approach page (#143)" }
---

# Artifact shape for the AI-driven agile methodology (playbook / template repo / write-up / talk)

Decide the form [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)'s methodology
takes. This is the fork that gates #563's decomposition — its slices are downstream of the shape, so the
epic cannot be sliced until this lands (decisions are work items, not buried checkboxes).

**Parked / deferred by intent.** Same caution as #143: the practice is still maturing; ratify near
release once it has settled, with real examples, rather than freezing a moving target now. This card
exists so the fork is tracked as a decision work item rather than a hidden checkbox in #563's body — not
because it is ready to ratify (no `preparedDate`).

## The fork — what shape does the artifact take?

Not necessarily exclusive; the real decision is the *primary* shape (the others can follow as surfaces).
Options, with a provisional lean — **do not treat as settled**:

- **A · Written playbook / essay** *(provisional lean)* — the operating model articulated as prose,
  grounded in this repo's own git + backlog history as the case study. Lowest build cost, feeds #143
  directly, honest to "knowledge/positioning value, not a product." Risk: prose alone is harder for
  another team to *adopt* than a runnable kit.
- **B · Adoptable starter-template repo** — the skills + backlog CLIs + workflow docs extracted as a kit
  another team clones. Highest adoption leverage, but highest extraction cost and the strongest pull
  toward "productizing," which #563's guardrail explicitly refuses.
- **C · Talk / article** — a narrative surface (conference talk, long-form article). Good reach, but a
  presentation of the substance, not the substance itself.
- **D · Internal enablement guide** — the same operating model stripped of project specifics, for teams
  stuck at "AI on the margins." Narrower audience, day-job framing.

The shapes are layered, not rival products: B/C/D can each present or package what A captures. The
decision is which is the *source artifact* and which are downstream surfaces.

## Unblocks

- Re-run `/slice 563` against the chosen concrete artifact — the slices become nameable and
  `file:line`-citable only once the shape is fixed.

## Guardrails (inherited from #563)

- **Not a product** — knowledge/positioning value; may feed the monetization narrative
  ([#089](/backlog/089-monetization-product-ideas/)) as credibility, not as a paid offering.
- **Don't freeze early** — capture honestly when settled; this is why the card is parked, not open.
