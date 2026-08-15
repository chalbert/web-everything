---
bornAs: x06qgn8
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2716"]
scope: ["plateau-app:src/feature-tracker/feature-tracking.webcases.ts", "plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S0a · FT webcases registry + invariant tests + SPEC allow-list

Graduate all 115 FT cases into a plateau-app feature-tracking webcases registry (mirroring the plateau-app card-taxonomy webcases pattern) with a conformance test enforcing the 5 invariants plus the SPEC allow-list. Delivers #2709. No runtime surface.

## Deliverable
Graduate all 115 cases (8 families S/F/K/M/E/L/C/R) mirroring the plateau-app card-taxonomy webcases: a WEB CASE header + assert line, a two-token-plane parser (STATE/FAULT/WAIT), a manifest, and a conformance test enforcing the 5 invariants + the SPEC allow-list. Invariant (iii) is rewritten to the §0 forecast ruling (projection allowed; no date on blocked/gated/stalled/cycle). No runtime surface.

**Delivers #2709** — the registry half of the taxonomy → webcases story.

## `blockedBy: ["2716"]` is stale — unblocked in substance (verify before claim)
#2716 (S0r) already shipped: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` commit `da66083e`
(plateau-app PR #115, merged 2026-07-27) is exactly S0r's acceptance — `FT_FAMILIES`, `FT_CASES` (115, derived),
`SPEC_BEFORE_RENDER` (frozen at 44), `SPEC_COUNT`, `FT_FORECAST_RULE` (the §0 three-branch ruling), and
`validateFtRegister()` enforcing all 5 invariants at module load. The `we:backlog/2716-*.md` tracker card
itself is just stale (still `status: open`) — a separate tracker-hygiene gap, filed as #3133
(`we:backlog/3133-resolve-2716-in-the-we-tracker-status-stale-code-already-shi.md`), not this item's
concern. **A builder starting this item works directly on top of the already-shipped S0r constants — nothing
here is actually waiting on #2716.** (Re-verify the commit is still on plateau-app's default branch at claim
time — the substance-unblocked finding is only as current as this preparation pass.)

## Scope + consumers (verified 2026-08-15)
- `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` — the S0r file above; this item ADDS to it
  (does not replace it). `grep -rl "feature-tracking.webcases" plateau-app:src plateau-app:scripts` finds no
  external importer yet — this is a graduation slice with **no consumers to break**, same shape as S0r before
  it. (Later sibling slices — S0b onward — are the first real consumers; not this item's concern.)
- `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` — new file, this item's conformance
  suite.
- No `we:` (WE-repo) files change — this is 100% plateau-app (impl repo), matching #2716's precedent and the
  "WE holds zero standard implementation" rule; this item lands as a plateau-app commit, not a WE PR (see
  *Delivery shape* below).

## No pre-existing per-case content exists to graduate from
Unlike `plateau-app:src/backlog-view/card-taxonomy.webcases.ts` (37 cases, whose exact per-case glyph/motion/
verb table is transcribed from a ratified design doc, `plateau-app:docs/backlog-console-design.md` §6e), **no
artifact anywhere names the 115 individual FT case titles, descriptions, or token values.** Checked: the
epic's two linked design-decision artifacts (`https://claude.ai/code/artifact/ba98baf4-…` and `…/d6816fec-…`,
cited on #2705) cover the overall screen's visual design and a 31-feature mock dataset, not the FT-<letter><n>
case taxonomy; no `we:reports/*.md` or `we:backlog/*.md` file lists per-case titles either. Only the
*structural* facts are ratified: the 8 family names/counts, the 44-item spec allow-list membership (by code),
and the §0 forecast rule (all three already frozen in S0r). **This means the builder AUTHORS each case's
title/description/tokens** — this is expected, bounded work, not a hidden lookup: every acceptance check below
is structural (invariant-based), none require matching an external ground truth, so any authored content that
satisfies the invariants is correct. One piece of real grounding for the K (forecast) family specifically: the
ratified mock's forecast-chip vocabulary (from the `d6816fec-…` artifact) is `FORECAST` (ok) /
`FORECAST-CAVEAT` (caveat — blocked feature, unblocked-remainder-only projection) / `NO FORECAST · stalled`
(stall) / `TOO NOISY` (noisy) — ground the K-family's 9 cases in this existing vocabulary (extended with a
`delivered` case and a `gated point, no date` case per the §0 three-branch rule) rather than inventing
unrelated forecast-state names.

## Decided design — the STATE/FAULT/WAIT grammar
Two token-planes per case, not one flat line (unlike card-taxonomy's single `assert:` line) — a mandatory
**STATE** line on every case, plus AT MOST ONE of an optional **FAULT** line (E-family only) or **WAIT** line
(L-family only); the two are mutually exclusive by construction since no case is in both families:

```html
<!-- WEB CASE N: <title>
  <description>
  state: code=FT-<letter><n> rendered=yes|spec [forecast=projection|delivered|absence]
  fault: failEdge=red                              ← E-family cases only
  wait: waitClass=normal|watch|stalled              ← L-family cases only
-->
<div class="ft-cell" data-code="FT-<letter><n>">…</div>
```

- `state:` keys: `code` (must equal the case's `FT-<letter><n>`, matching `FtCase.code` from S0r — reuse that
  exact field name, don't rename it `uc` the way card-taxonomy does; card-taxonomy's `uc=` naming is that
  file's own history, not a contract this item must copy), `rendered` (`yes|spec`, must agree with
  `renderFlagOf(code)` imported from S0r), and an OPTIONAL `forecast` key carried ONLY by K-family (forecast)
  cases, valued `projection|delivered|absence` — the three §0 branch ids, reused verbatim from
  `FT_FORECAST_RULE.branches[].id` (already frozen by S0r) rather than inventing new branch names.
- `fault:` line, E-family only: exactly one key, `failEdge=red` — this is what satisfies the "every E has
  `failEdge=red`" acceptance bullet.
- `wait:` line, L-family only: exactly one key, `waitClass=<token>`, a CLOSED enum the conformance test
  defines locally (e.g. `normal|watch|stalled`) — deliberately symbolic, not tied to any numeric threshold.
  The real stalled-window / too-noisy-variance / min-sample thresholds are an OPEN decision (#2719, prepared)
  and #2687's forecast primitive; this item must NOT hardcode a number that decision hasn't ruled yet — the
  enum only names the *shape* of the states L-family cases represent.
- **Parser**: `parseFtAssert(code: string): FtAssert` where
  `FtAssert = { code: string; rendered: 'yes'|'spec'; forecast?: 'projection'|'delivered'|'absence';
  failEdge?: 'red'; waitClass?: string }`. It parses the `state:` line (required, throws if absent — mirrors
  card-taxonomy's `parseAssert` throwing on no assert line) and, if present, ALSO parses the trailing `fault:`
  or `wait:` line into the same returned object. **"Round-trips both planes"** (the acceptance bullet) means:
  for any case carrying a `fault:` or `wait:` line, every token from BOTH lines is recovered losslessly into
  one `FtAssert` — the conformance test builds a card, parses it, and asserts no token from either plane is
  dropped or misattributed to the wrong plane.

## Interfaces / protocol
`plateau-app:src/feature-tracker/feature-tracking.webcases.ts` — ADD (S0r's existing exports are untouched):
```ts
import type { WebCases, WebManifest, WebCase } from '@webeverything/contracts/webdocs';

export interface FtAssert {
  readonly code: string;
  readonly rendered: 'yes' | 'spec';
  readonly forecast?: 'projection' | 'delivered' | 'absence';
  readonly failEdge?: 'red';
  readonly waitClass?: string;
}
export function parseFtAssert(code: string): FtAssert; // throws if no `state:` line

export const FT_CASE_BLOCKS: WebCases; // 8 keys, one per family — the WEB CASE registry
export const FT_MANIFEST: WebManifest; // id/name/description + blocks = the 8 family block ids, S·F·K·M·E·L·C·R order
```
Family → block-id mapping (canonical order, matches `FT_FAMILIES` from S0r): `S→ft-screen`, `F→ft-feature-row`,
`K→ft-forecast`, `M→ft-detail-markers`, `E→ft-error`, `L→ft-latency`, `C→ft-concurrency`, `R→ft-theme-responsive`.

`plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` — new file, `import` BOTH S0r's frozen
constants (`FT_FAMILIES, FT_CASES, SPEC_BEFORE_RENDER, SPEC_COUNT, FT_FORECAST_RULE, renderFlagOf`) and this
item's new exports (`FT_CASE_BLOCKS, FT_MANIFEST, parseFtAssert, FtAssert`) from the one file, and cross-checks
them — e.g. every `FT_CASES` entry has a matching `FT_CASE_BLOCKS` WEB CASE whose `state.rendered` equals
`renderFlagOf(code)`, so the two halves (S0r's structural register, S0a's graduated cases) can never drift
apart. This import shape is why the scope is the SAME `.ts` file for both S0r and S0a (per S0r's own docstring:
*"the sibling slice S0a graduates each case … that imports the constants frozen here"*), not two separate
modules.

## Tasks
1. Re-verify #2716/S0r is still shipped as described above (re-read the file, re-run its module-load
   self-validation) before building on it.
2. Author the 8 family blocks (`FT_CASE_BLOCKS`), 115 WEB CASE entries total, each with a real title +
   one-line description + the `state:`/`fault:`/`wait:` header per the grammar above; ground K-family content
   in the ratified forecast-chip vocabulary noted above; ground E/L-family framing in "the failure axis" /
   "latency" language already used in #2709's family list.
3. Implement `parseFtAssert` (mirror card-taxonomy's `parseAssert` multi-word-value-continuation parsing, but
   for two lines instead of one).
4. Build `FT_MANIFEST` (id/name/description/blocks, 8 block ids in canonical order).
5. Write the conformance test: 115 present; every family's codes are contiguous `FT-<letter>1..n` (mirrors
   S0r's own family-range check, now applied to the graduated `FT_CASE_BLOCKS` too); K-family `forecast`
   values ∈ the 3 branch ids and no case's code/description/title contains an ISO-date-like literal or a
   "target:" token (the honest-forecast invariant, machine-checked); every E-family case has `fault:
  failEdge=red`; every case's `state.rendered` ∈ `{yes, spec}` and agrees with `renderFlagOf`; the 44-item
  spec set is exactly `SPEC_BEFORE_RENDER`, none of them render, and (mirroring S0r's own "list only shrinks"
  assertion) the actual `spec` set is a subset of the frozen allow-list; `parseFtAssert` round-trips a
  constructed fault-bearing and a constructed wait-bearing case with no token loss.
6. `npx vitest run` (plateau-app) green.

## Size basis (3)
~115 short, formulaic WEB CASE entries following a now-fully-specified two-plane grammar and a proven
same-repo precedent (card-taxonomy, 37 cases) — high per-case throughput, near-zero per-case judgment once the
grammar above is fixed. The conformance test is ~7 assertions, each mirroring an existing pattern in
`plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts` almost line-for-line. No runtime wiring, no new
consumer, no cross-repo seam.

## Delivery shape
Single piece, directly to plateau-app's default branch (same shape as #2716/S0r's landing: one commit, no
flag, additive-only to a file with zero consumers). Not a WE PR — WE holds no standard implementation; this is
pure product-repo (plateau-app) work. Cannot usefully land "behind main" partially — the conformance test
needs the full 115-case set and the manifest to import cleanly, so it ships as one commit once authored.

## FT cases → rendered=yes
All 115 as registry entries (no render).

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`
- `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts`

## Done when
- `npx vitest run` is green in plateau-app with all of the following enforced (this restates the original
  Acceptance line as individually testable statements):
  - all 115 `FT_CASE_BLOCKS` cases present, across the 8 families in canonical order;
  - each family's codes are contiguous `FT-<letter>1..n` — no gap, no extra, no duplicate;
  - every K-family case's `forecast` ∈ `{projection, delivered, absence}`, and no case's title/description/
    code contains a typed future date or target-date token (the §0 ruling, machine-checked on the graduated
    cases — not just on S0r's structural register);
  - every E-family case's header carries `fault: failEdge=red`; no case outside E carries a `fault:` line;
  - every case's `state.rendered` ∈ `{yes, spec}` and equals S0r's `renderFlagOf(code)`;
  - the actual `spec` set (cases with `rendered=spec`) is exactly `SPEC_BEFORE_RENDER` (44), none of them
    render, and the set only shrinks (a subset check, S0r's own invariant applied to the graduated cases);
  - `parseFtAssert` round-trips both planes with no token loss on a constructed fault-bearing and a
    constructed wait-bearing case.
