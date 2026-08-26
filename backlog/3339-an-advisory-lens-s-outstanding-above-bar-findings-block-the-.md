---
bornAs: x38ergj
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# An advisory lens's outstanding above-bar findings block the panel verdict

#3314 ruled `claim-accuracy` advisory with a scoped blocking sub-class — `impactIfUnfixed >=
PREVENTION_IMPACT_BAR`. `derivePanelVerdict` already blocks on an advisory lens's findings, but only for
**resolved** ones owing an uncaptured guard; an **outstanding** above-bar finding rides the accept at any
impact. Add the third scan, gated by an explicit `BLOCKING_ADVISORY_LENSES` set holding `claim-accuracy`
alone. Until this lands, #3314's ruling behaves identically to plain advisory.

## Shape

In `we:scripts/lib/jury-core.mjs`, alongside the existing prevention scan in `derivePanelVerdict`:

- Export `BLOCKING_ADVISORY_LENSES` — frozen, `['claim-accuracy']`. **Explicit, never `ADVISORY_LENSES`**:
  generalizing the bar to every advisory lens is a separate ruling (`#3338`).
- Scan the panel's findings for `isFindingOutstanding(f)` **AND an IMPACT-ONLY bar test** whose originating
  lens is in that set → `changes`. The bar test is, verbatim:

  ```js
  const declared = f.impactIfUnfixed;
  if (declared === undefined) return true;                       // undeclared ⇒ fail closed
  return impactStrictness(declared) >= impactStrictness(bar);    // bar = PREVENTION_IMPACT_BAR
  ```

  Fail-closed on an undeclared level is deliberate and matches `blocksAcceptance`'s existing
  undeclared-blocks contract (`we:scripts/lib/jury-core.mjs:530-535`). Do **not** call `impactStrictness`
  on the raw value without that guard — it THROWS on an unranked level (`:242`) rather than returning
  `undefined`; `normalizeFindings` (`:384`) already drops an unrecognised word, so undeclared arrives as
  `undefined`.

  > **Retracted — this bullet used to prescribe the wrong predicate.** It read *"Scan the panel's findings
  > for `isFindingOutstanding(f) && blocksAcceptance(f, { bar })`."* **That is wrong and a builder following
  > it verbatim would ship a gate that lets #3314's own worked example through.** `blocksAcceptance`
  > (`we:scripts/lib/jury-core.mjs:530`) opens with `if (!hasUncapturedPrevention(finding)) return false;`,
  > and `hasUncapturedPrevention` (`:485`) is `finding.prevention && finding.preventionCaptured !== true`.
  > It is a PREVENTION predicate that happens to consult impact, not an impact predicate. Take the statute's
  > own example — a juror finds a card's Done-when cites a `file:line` that does not exist, declares
  > `impactIfUnfixed: 'broken'`, names the prevention "the `check:standards` locus gate" and sets
  > `preventionCaptured: true` because that gate already exists. `hasUncapturedPrevention` returns `false`,
  > so `blocksAcceptance` returns `false` and the finding rides the accept. A finding that names no
  > `prevention` at all fails the same way. #3314 promises an **unconditional** impact bar, so the coupling
  > to prevention-capture was a defect in this Shape, not in the ruling.
- Order it **after** the mandatory-lens `needs-human`/`changes` checks and **before** the prevention scan: a
  real mandatory defect still outranks it, and an outstanding defect outranks a missing guard.
- Provenance comes from `buildPanelFindings`, which prefixes `category` with the lens (`claim-accuracy/…`) —
  match on that prefix, and add a test pinning the coupling so a change to the prefix format fails loudly
  rather than silently un-blocking the sub-class.
- The lens brief in `we:scripts/lib/review-core.mjs` must tell a `claim-accuracy` juror how to pick an
  `impactIfUnfixed` level, with #3314's two worked examples (a wrong acceptance criterion is `broken`; a
  wrong figure no criterion depends on is `cosmetic`). Without that the typed field is discretion wearing a
  type.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs` passes with a new case
   proving an **outstanding** `claim-accuracy` finding at `broken` drives `derivePanelVerdict` to `changes`
   while the same finding at `cosmetic`, and the same `broken` finding from `simplicity`, both still
   `accept`.
2. **Executable — the prevention axis must NOT be consulted.** The same suite passes with a case proving an
   **outstanding** `claim-accuracy` finding at `broken` **with `preventionCaptured: true`** still drives
   `derivePanelVerdict` to `changes`, and a second with **no `prevention` field at all** that also drives
   `changes`. This is the guard for the retracted Shape bullet above: neither case varies impact, so a
   `blocksAcceptance`-based implementation goes RED on both while an impact-only one stays green. Criterion 1
   alone cannot catch it — it varies broken-vs-cosmetic and claim-accuracy-vs-simplicity, and neither axis
   moves `preventionCaptured`.
3. **Executable — undeclared fails closed.** The same suite passes with a case proving an **outstanding**
   `claim-accuracy` finding carrying **no `impactIfUnfixed`** drives `changes` rather than throwing or
   riding the accept.
