---
bornAs: xg9gboa
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate, security]
---

# Gate module-level frozen lookup tables: null-prototype, built through `frozenLookup`, read via one accessor

A frozen object-literal lookup table read with an **untrusted key** fails OPEN. `Object.freeze` seals own
properties but does not detach `Object.prototype`, so `TABLE['toString']`, `TABLE['constructor']`,
`TABLE['valueOf']`, `TABLE['hasOwnProperty']` and `TABLE['__proto__']` all return an inherited member instead of
`undefined`. The default that was supposed to catch a non-member never fires:

- `TABLE[key] !== undefined` passes on a word that is not in the enum at all, and the inherited function/object
  compares as `NaN` in every `>=` / `>` rank comparison — false in **both** directions, so the guard un-blocks.
- `TABLE[key] ?? fallback` and `TABLE[key] || fallback` are the SAME hole one step quieter: `??` only fires on
  `null`/`undefined` and `||` only on a falsy value, so an inherited truthy member is rendered as if it were real
  data. **This item is scoped to include these**, not only the `=== undefined` form.

Observed on PR #1046 (`#2942`), across four tables:

- `IMPACT_STRICTNESS` (`we:scripts/lib/jury-core.mjs`) was validated with a bare bracket read against a key that
  arrives as **free-form model JSON** (a reviewer authors `impactIfUnfixed`). An invented word like `high` was
  correctly dropped, but `toString` was KEPT as a valid impact level and then rode a clean accept with an
  uncaptured guard — the exact inverse of the feature's central fail-closed invariant.
- `VERDICT_STRICTNESS` / `verdictStrictness` (same file) had the identical hole, pre-existing.
- `VERDICT_LABELS` (`we:scripts/lib/review-render.mjs`), read with `??`: `renderPanelComment({ verdict:
  'toString' })` rendered `**Verdict:** function toString() { [native code] }` into a posted PR comment.
- `VERDICT_MARKERS` (`we:scripts/conveyor/jury-tree.mjs`), read with `||`: the same for the live jury tree.

All four were fixed in that PR (null-prototype via a shared `frozenLookup`, membership via `Object.hasOwn`, one
shared `rankIn` accessor), but nothing stops the next table.

The rule is script-decidable by static scan:

1. **Any module-level frozen object literal used as a LOOKUP** — rank, gloss, label, marker, glyph — must be
   null-prototype, i.e. built through the shared `frozenLookup` helper
   (`Object.freeze(Object.assign(Object.create(null), { … }))`), not a bare `Object.freeze({ … })`. The scope is
   the ROLE (a table indexed by a value), not the name: `*_STRICTNESS` was only where it was first noticed.
2. **Any defaulted read against such a table is a violation**, in every form — `TABLE[expr] === undefined`,
   `!== undefined`, `TABLE[expr] ?? d`, `TABLE[expr] || d`. Membership goes through `Object.hasOwn`.
3. **Rank reads go through ONE accessor.** `verdictStrictness` and `impactStrictness` were a hand-copied twin
   pair — same four-line body, same double `String()`, differing only in table and error string — and the diff
   that introduced the second edited both in lockstep, which is the tell. They now share `rankIn(table, key,
   label)`. A second hand-rolled membership-test-then-read against a lookup table is a violation on its own.

The rootCause worth encoding in the message: the safe-looking shape is COPIED from a position where inputs are
enum-constrained upstream (so a bare read really is safe) into a position where they are not, and `Object.freeze`
reinforces the false sense that the table is sealed. Tests written alongside such a change tend to probe a
hand-picked invented word (`high`) that happens not to be a prototype member, confirming the intent rather than
probing the mechanism — so the suite stays green on a broken invariant.

**Prevention for:** PR #1046 review, blocker 2 and round-2 findings 5 + 6 (`#2942`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lib/jury-core.mjs`,
`we:scripts/lib/review-render.mjs`, `we:scripts/conveyor/jury-tree.mjs`

## Design

**The seam already exists — this is a third source scan, not new machinery.** `we:scripts/check-standards.mjs`
already hosts two pure whole-file source scans of `scripts/**` that were added for exactly this reason (a
one-line idiom that re-introduces a bug silently): `we:scripts/lib/utc-day-slice-scan.mjs` (`findUtcDaySlices` /
`utcDaySliceMessage`, wired at the `// Operator-local date stamps (#2747)` block) and
`we:scripts/lib/stdout-flush-scan.mjs` (`scanStdoutFlush` / `stdoutFlushMessage`). Follow that shape exactly:

- A new `we:scripts/lib/lookup-table-scan.mjs` exporting a `scanLookupTables(root, dirs)` collector plus a
  `lookupTableMessage(hit)` renderer, each hit carrying `{ file, line, table, kind }`.
- Wired into `we:scripts/check-standards.mjs` as its own `try { … } catch` block, emitting **per-hit attributed**
  findings — `err(lookupTableMessage(hit), { kind: 'lookup-table', fix: 'model', file: hit.file, line: hit.line })`
  — because an unattributed finding reds a concurrent session under `--scope=<slug>` and is demoted to a note
  under `--local --files=<lane set>`. Both existing scans carry that comment; copy the discipline, not the walk.
- Unit-tested in `we:scripts/lib/__tests__/lookup-table-scan.test.mjs`, mirroring
  `we:scripts/lib/__tests__/utc-day-slice-scan.test.mjs`.
- The scan file DEFINES the pattern in its own docblock, so it must skip itself keyed on the **resolved** path
  (`resolve(fileURLToPath(import.meta.url))`), never on a basename — the exact carve-out
  `we:scripts/lib/utc-day-slice-scan.mjs` documents at its `SELF` constant.

**The ROLE test — and the population it must NOT be keyed on.** Three candidate discriminators were measured
against `we:scripts/**` (excluding `__tests__/`):

| discriminator | reads | tables | verdict |
|---|---|---|---|
| every module-level `Object.freeze({…})` | ~84 defs | ~84 | far too wide — nearly all are config/spec objects read by a literal key |
| a **frozen** literal read with a non-literal bracket key | 21 | 13 | under-inclusive — **misses every non-frozen table**, see below |
| **any** module-level object literal read with a **defaulted** bracket key (`\|\|`, `??`, `=== undefined`, `!== undefined`) | 17 | 12 | the right population |

**Do not key rule 1 on `Object.freeze`.** The vulnerability is inherited `Object.prototype` members leaking
through a defaulted read; freezing is irrelevant to it. `we:scripts/lib/jury-core.mjs`'s own `frozenLookup`
docblock names the tables this item (`xg9gboa`) is expected to sweep — `REVIEW_LENS_CHARTER`
(`we:scripts/lib/jury-ledger.mjs`), `LENS_DEFAULT_METHOD` / `LENS_EXPECTATIONS`
(`we:scripts/lib/review-core.mjs`), and `STATE_LABEL` (`we:scripts/conveyor/status-artifact.mjs`) — and
`STATE_LABEL` is a **bare, unfrozen** object literal read as `STATE_LABEL[it.state] || it.state`. A
frozen-only population can never select it, so the card's own origin promise would go structurally unfulfilled.

The measured 17 reads over 12 tables are the corpus to remediate: `SEV` (`we:scripts/audit-backlog-health.mjs`),
`childCount` / `childrenOf` / `STATE_LABEL` (`we:scripts/conveyor/status-artifact.mjs`), `COMMANDS`
(`we:scripts/lane-pool.mjs`), `KNOWN_FLAGS` (`we:scripts/lane-stack.mjs`), `DESIGN_PIXEL_METHOD_RUNNERS`
(`we:scripts/lib/design-pixels-adapter.mjs`), `REVIEW_LENS_CHARTER`, `LENS_EXPECTATIONS`, `PREP_RISK_STRATEGY`
(`we:scripts/operations/review-prep.mjs`), and `PR_STATUS` / `ITEM_CHIP` (`we:scripts/progress-board.mjs`).
Re-measure at build time and remediate in the same change; a gate that lands red is not a gate.

**The helpers to point remediation at already exist and are exported** — `frozenLookup` from
`we:scripts/lib/jury-core.mjs` (`Object.freeze(Object.assign(Object.create(null), entries))`), and its rank
accessor `rankIn(table, key, label)` in the same file (module-private today; rule 3 needs it exported, or a
second accessor in the new scan module's sibling). The message must name them, the way `utcDaySliceMessage`
names `localToday()`.

**Rule 3 needs a different detection strategy from rules 1/2, and that is the one thing this design must not
leave vague.** Rules 1 and 2 are single-token regex matches over one line, which is why the two sibling scans
are a good template for them. Rule 3 — "a second hand-rolled membership-test-then-read" — is a **two-statement
correlation** and no regex over one line can see it. Specify it as: within one function body, a membership test
against a table (`Object.hasOwn(T, k)`, `k in T`, `Object.prototype.hasOwnProperty.call(T, k)`) followed by a
bracket read of the **same** table, where the enclosing function is not the shared accessor itself. Two
structurally distinct positives must be in the fixture set — the straight-line form and an `if`/`else` split —
so a detector that only matches the canonical shape cannot pass.

**Exemption marker.** Follow the `utc-day-slice-ok: <reason>` precedent — a `lookup-table-ok: <reason>` comment
on the offending line or in the contiguous comment block above it, with the reason **required** (the marker
alone must not exempt). `__tests__/` is exempt wholesale, same as the two sibling scans.

## Done when

- `npx vitest run lookup-table-scan` fails before and passes after against a new
  `we:scripts/lib/__tests__/lookup-table-scan.test.mjs`, covering all
  four violation forms from rule 2 (`TABLE[expr] === undefined`, `!== undefined`, `TABLE[expr] ?? d`,
  `TABLE[expr] || d`), a bare `Object.freeze({…})` read by a computed key AND a **bare, unfrozen** module-level
  object literal read the same way (rule 1 — the `STATE_LABEL` shape; a frozen-only detector fails this case),
  **two structurally distinct** hand-rolled membership-test-then-read forms (rule 3 — straight-line and
  `if`/`else` split), and the negative cases: a literal-key read, a `frozenLookup` table read through
  `Object.hasOwn`, a `lookup-table-ok: <reason>` exemption, and a bare marker with no reason (NOT exempt).
- `npm run check:standards` on the current tree reports **0** `lookup-table` errors — i.e. all 17 measured
  defaulted reads over 12 tables in `we:scripts/**` are remediated in the same change, not left behind a red
  gate and a follow-up item. `STATE_LABEL`, `REVIEW_LENS_CHARTER` and `LENS_EXPECTATIONS` are among them, which
  discharges the sweep `we:scripts/lib/jury-core.mjs`'s `frozenLookup` docblock explicitly defers to this item.
- A regression fixture proves the mechanism, not the intent: the test probes real prototype members
  (`toString`, `constructor`, `valueOf`, `hasOwnProperty`, `__proto__`) — not an invented word like `high` —
  against both a bare-frozen table and a `frozenLookup` one, so a table that reverts to `Object.freeze({…})`
  turns the suite red. This is the specific gaming the rootCause paragraph above names.
- `rankIn` is reachable from outside `we:scripts/lib/jury-core.mjs` (exported, or its equivalent is), so rule 3's
  "one accessor" is a thing a remediated call site can actually import — verified by the new test importing it.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — Verified directly: we:scripts/lib/jury-core.mjs:107 frozenLookup, :120 rankIn (module-private, not exported — matches the card's claim), and VERDICT_LABELS (we:scripts/lib/review-render.mjs:42), VERDICT_MARKERS/STATUS_MARKERS (we:scripts/conveyor/jury-tree.mjs:46,61) are all already built through frozenLookup, confirming PR #1046's fix landed exactly as described.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The card runs a first-pass scan (~84 blanket-rule sites, ~21 reads over ~13 ROLE-matching tables) before committing to the design, and 'Done when' requires 0 check:standards errors on the current tree before the gate ships — no red-gate-plus-followup escape hatch.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/check-standards.mjs is confirmed as a widely subprocess-invoked gate (we:scripts/autofix/engine.mjs, we:scripts/readiness/dispatch-plan.mjs, we:scripts/push-if-green.mjs, etc. all shell out to it), and the card wires the new scan into that existing seam rather than a standalone ES-import-only mechanism — both consumer paths are covered by construction.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when explicitly requires rankIn to be exported and round-trip-tested by the new scan's own test file importing it, closing the module-private/needs-export gap the card itself identifies at we:scripts/lib/jury-core.mjs:120.
- **population** (NOT addressed; strategy: name the population each threshold guards) — Rule 1 scopes the scan to 'a module-level FROZEN object literal' (design section: 'a frozen table is in scope only when...'), but STATE_LABEL in we:scripts/conveyor/status-artifact.mjs:220 is a bare, non-frozen object literal read via a defaulted bracket key ('STATE_LABEL[it.state] || it.state', line 221) — the exact rule-2 shape — and is one of the tables `we:scripts/lib/jury-core.mjs`'s `frozenLookup` docblock names as needing this sweep (this card's own bornAs id, xg9gboa, is the id that docblock cites as the item that will do the sweeping). Because it isn't frozen, rule 1 can never select it, so the card's own origin promise goes structurally unfulfilled for at least this one table.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Rules 1 and 2 get concrete regex-level pattern definitions and Done-when explicitly requires mutating the exemption marker (bare 'lookup-table-ok:' with no reason must NOT exempt) with a named fixture, closing the classic decorative-marker hole the sibling utc-day-slice-ok precedent already had to fix once. Rule 3 is comparatively underspecified (see findings).
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The design commits to the same per-hit attributed err(...) shape ({ kind, fix, file, line }) the two sibling scans already use at we:scripts/check-standards.mjs:881-882/894-895, with the same rationale (an unattributed finding reds a concurrent --scope session or is silently demoted under --local) — failures surface, not just get counted.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The ~84/~21/~13 site counts are explicitly measured via a first-pass scan before the ROLE-test design was finalized, and the card is explicit these are estimates to be re-measured at build time rather than guessed sizing.

**Corrections recommended:**

- none — the preparation held up as written.

The design is well-grounded — every code citation (frozenLookup, rankIn's current module-private status, the three already-fixed sibling tables, and the utc-day-slice-scan/stdout-flush-scan precedent it copies) checks out against the live repo — but its "frozen object literal" population boundary structurally excludes at least one lookup table (STATE_LABEL) that the card's own origin comment names as needing this exact sweep, and rule 3's detection mechanism is far less specified than rules 1/2. Both gaps are carve-outs (base has no gate at all, so nothing is made worse), not blockers.

**Findings applied after this review** (the two carve-outs it raised, both accepted as correct): the ROLE test no longer keys on `Object.freeze` — it keys on a **defaulted bracket read**, which is what admits the unfrozen `STATE_LABEL` the `frozenLookup` docblock names as owed to this item; and rule 3 now states its own two-statement detection strategy plus a two-fixture floor, instead of inheriting rules 1/2's single-line regex shape it cannot use.

_Recorded through the declared `review-prep` operation._
