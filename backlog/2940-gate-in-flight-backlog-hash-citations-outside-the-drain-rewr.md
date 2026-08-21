---
bornAs: xabqoah
kind: task
status: open
dateOpened: "2026-08-05"
tags: [backlog, gate, hygiene]
---

# Gate in-flight backlog hash citations outside the drain's rewrite scope

JIT numbering (#2288) gives a new item a temporary hash id (`x` + six chars) that the drain rewrites to its
real `NNN` at land. `numberPendingHashes` (`we:scripts/lane-drain.mjs`) rewrites only `backlog/*.md`,
`docs/agent/*.md` and `agent-memory-src/*.md`. Every hash citation planted anywhere ELSE — `scripts/**`,
`skills-src/**`, tests — is never rewritten and dangles permanently once the item lands.

## Why it is owed

The class is already proven to rot in this repo: `we:scripts/lane-drain.mjs` cites `xnsk54v`, which resolves
to nothing. PR #1046 (`#2942`) planted roughly 60 more across `scripts/**` and `skills-src/**` in a single
change; three of them were RUNTIME-emitted text handed to a live reviewing model (a mandate line and two
JSON-schema `description` fields), which is strictly worse than a stale comment — a reviewer cannot look up
a backlog hash and should never be shown one. Those three were stripped by hand; the rest were left, because
renumbering 60 sites by hand is its own error source.

Nothing today tells an author that a hash they type outside `backlog/` + `docs/agent/` will never be
rewritten. The rewrite scope is a constant inside one script, invisible at the point of authorship.

## The guard

A `check:standards` rule: error on any IN-FLIGHT hash token matching `x[0-9a-z]{6}` that appears outside the
drain's rewrite scope.

- **Derive both sets from the same constant.** The scan set and the exemption set must come from the SAME
  exported constant `numberPendingHashes` uses to decide what it rewrites — if the drain widens or narrows
  its scope, the gate follows automatically. Two independently maintained path lists is the same drift the
  rule exists to catch.
- **In-flight only.** A hash for an item that has already landed (no `backlog/<hash>-*.md` on disk) is a
  different, worse problem — a dangling citation — and should read as such in the message. A hash matching a
  live item is a warning that it is about to dangle.
- **Runtime text is a hard error, comments are the ordinary case.** A hash inside a string literal that is
  emitted to a model or a user (prompt text, a schema `description`) must never be allowed; a source comment
  is the class this gate is nudging.
- The remedy the message should suggest: cite the durable thing (the symbol, the invariant, the landed
  parent item) rather than the temporary id, or wait for the item's `NNN`.

**Prevention for:** PR #1046 review, round 2 finding 8 (`#2942`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lane-drain.mjs`

## Re-grounded 2026-08-21 — the rewrite scope has widened, and it is still not a constant

Two corrections before building:

**1. The scope is three roots now, not two.** `numberPendingHashes` (we:scripts/lane-drain.mjs) sweeps
`backlog/*.md`, `docs/agent/*.md` (#2428) **and** `agent-memory-src/*.md` (#3100 — added for exactly this
reason: a compiled agent-memory bundle citing a pending hash left a dead pointer every future session reads).
The body above names only the first two.

**2. The constant ALREADY EXISTS, and so does most of the gate — this is an extension, not a greenfield build.**
(Corrected 2026-08-21 by the independent review, which caught the driver's first pass grepping only for the
literal string `REWRITE_SCOPE` inside we:scripts/lane-drain.mjs.) Verified on the tree:

- `HASH_REWRITE_DIRS = ['backlog/', 'docs/agent/', 'agent-memory-src/']` is **exported** from
  we:scripts/lib/citation-check.mjs, whose header documents it as exactly the `numberPendingHashes` rewrite
  scope. `numberPendingHashes` itself still open-codes its three roots, so the constant and the drain are two
  readers — worth reconciling, but the constant to derive from is that one, not a new one.
- `findOutOfScopeHashSlugs` (#2821 gate 3, same file) is **live and wired** at we:scripts/check-standards.mjs,
  already warning on a hash-slug cited outside the rewrite scope. Its `scanDir` sweep just does not include
  `we:scripts/` or `we:skills-src/` — it covers `backlog/`, `docs/agent/`, `agent-memory-src/`, `reports/` and
  the two research dirs.
- Its sibling `findDanglingMemoryHashSlugs` (#3100 gate 3b) already implements the *resolution* check
  (pending vs. landed vs. unknown) this card calls the liveness axis.

So building "ONE exported frozen constant in we:scripts/lane-drain.mjs" as first drafted would create a second,
differently-named copy of `HASH_REWRITE_DIRS` and a second scanner beside gate 3 — precisely the
"two independently maintained path lists" drift this card's own first design bullet exists to prevent.

**2b. There is an open, unreferenced sibling item on this exact class: `#2933`.** Filed the same day, `blockedBy:
["2821"]`, titled *"Extend citation gate 3 to scan scripts/ for dangling hash slugs the at-land rewriter never
rewrites"*. **Reconcile before building.** The two cards do not merely overlap — they disagree:

- `#2933` argues for **widening the rewrite** (add `we:scripts/` to `numberPendingHashes`) and says the
  flag-it-instead form is wrong here, because "a lane authors its code comments before it knows its number, so a
  hash is the only reference available at write time" — a hard error would fire on every correctly-authored lane.
- This card argues for **flagging**, with the severity split below.

Both readings are defensible and the honest resolution is not "build whichever card you picked up". What this
card owns that widening does NOT fix is the **in-flight window**: a hash inside runtime-emitted text is shown to
a live reviewing model *before* the item lands, so a land-time rewrite never helps it. That is the part worth
keeping as an error. The comment class is `#2933`'s to self-heal. Consolidate the two accordingly, or state
explicitly which half each owns.

**3. The size of the standing corpus, measured.** Word-bounded `x[0-9a-z]{6}` tokens outside the rewrite scope:
roughly **130–140 distinct** tokens across roughly **125–140 files** under `we:scripts/` + `we:skills-src/`,
around a thousand occurrences. (Two independent counts on the same day gave 130/123 and 139/138 — ordinary drift
across concurrent lanes; re-measure at build time rather than trusting either figure.) **Zero** of them are
in-flight — `ls we:backlog/ | grep -E '^x'` is empty, so every one is already a dangling citation. A rule that errors on the dangling class turns `check:standards` red on day one across ~123 files;
a rule that errors only on the in-flight class is silent today and fires the next time someone plants one.
That is the whole reason the severity split below matters.

## Design

**Resolve the card's own internal contradiction first.** The *Guard* section says both "error on any IN-FLIGHT
hash" and "a hash matching a live item is a warning that it is about to dangle" — those cannot both hold. The
reading that makes all four bullets consistent is that **severity is keyed on the emission surface, not on
liveness**, exactly as the third bullet says:

| where the token sits | in-flight (a `backlog/<hash>-*.md` exists) | already landed (no such file) |
| --- | --- | --- |
| a string literal emitted to a model or user (prompt text, a schema `description`) | **error** | **error** |
| a source comment / docblock / prose | **warn** ("about to dangle") | **warn** ("already dangling") |

Liveness changes the **message**, the emission surface changes the **severity**. That keeps the gate green
against the 130 standing comment-sites while making the class the review actually caught — a hash shown to a
live reviewing model — unlandable. If the operator wants the dangling comment class to be an error too, that is
a follow-up sweep, not this rule.

**Three false-positive classes the token regex must not fire on**, all present today:

- **Synthetic fixture ids.** `xhash01` (we:scripts/__tests__/lane-drain-numbering.test.mjs) and `xcarr01`
  (we:scripts/__tests__/merge-ai-prs.test.mjs) are invented ids in tests — they match the shape and cite
  nothing. Exempt `__tests__/` wholesale.
- **The documented example.** `x7k2q9a` is the example value in the `isHash` docblock in
  we:scripts/backlog/id.mjs itself. A rule cannot forbid a module from illustrating its own format.
- **`bornAs:` lines.** `BORN_AS_RE` (we:scripts/backlog/id.mjs) is the durable proof-of-land record and is
  deliberately protected from the drain's blind rewrite; the gate must protect it too.

**Reuse the existing shapes rather than inventing any:**

- The token predicate is `HASH_RE` / `isHash` from we:scripts/backlog/id.mjs — never a fresh regex literal.
  Note `HASH_RE` is anchored (`^…$`), so the scan needs a word-bounded variant beside it, added there.
- The rule/walk split and its call-site shape is §15 of we:scripts/check-standards.mjs (the review-label
  single-home guard): a pure rule in a `we:scripts/lib/` module taking `[{ file, content }]`, and an fs walk in
  we:scripts/check-standards.mjs whose `scanDirs` is **derived from the rule's exported prefix constant**, with the
  comment there explaining why hardcoding the roots twice is the very defect being prevented. That is the
  precedent the "derive both sets from the same constant" bullet is describing.

**Liveness is an fs question, so it stays in the walk**: `existsSync(backlog/<hash>-*.md)` resolved outside the
pure rule and handed in per token, mirroring how `validateBlockImplConformance` takes a resolved `implPresent`.

## Done when

- **Tier 1** — `numberPendingHashes` (we:scripts/lane-drain.mjs) reads `HASH_REWRITE_DIRS` from
  we:scripts/lib/citation-check.mjs instead of open-coding its three roots, and a test asserts the drain still
  sweeps all three (`backlog/`, `docs/agent/`, `agent-memory-src/`) through it. No second constant is
  introduced. A test that only reads the constant proves nothing — drive the sweep.
- **Tier 1** — the new pure rule has fixture coverage in we:scripts/__tests__/ for the severity matrix above:
  a hash in a schema `description` errors, a hash in a comment warns, a hash inside the drain's own rewrite
  scope produces nothing, and each of the three false-positive classes (`__tests__/` fixture, the id-module
  example, a `bornAs:` line) produces nothing.
- **Tier 1** — one constant, one scanner: a test asserts that adding a root to `HASH_REWRITE_DIRS` widens both
  the drain's sweep and the gate's exemption set with no second edit, and `grep -rn "HASH_REWRITE_DIRS"
  we:scripts/` shows exactly one definition. No new scanner is added beside `findOutOfScopeHashSlugs`.
- **Tier 2** — `npm run check:standards` stays **green** on the current tree. Today's 130 dangling tokens are
  all comment-class, so they must land as warnings; an error count that moves off zero means the severity split
  was not implemented and ~123 files just went red.
- **Tier 2** — the message names the remedy, not just the offence: it says to cite the durable thing (the
  symbol, the invariant, the landed parent item) or wait for the `NNN`, and — for a landed hash — says the
  citation is *already* dangling rather than *about to*. Grep the message strings for both branches.

## Independent review — 2026-08-21

Confidence: **Low**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed at the time of review; strategy: check by mutation or reversion ahead of the build) — The card's re-grounding pass asserts 'There is no constant to derive from — extracting one is step one of this build' after grepping only for the literal string REWRITE_SCOPE inside we:scripts/lane-drain.mjs. Live-repo check: we:scripts/lib/citation-check.mjs already exports `HASH_REWRITE_DIRS = ['backlog/', 'docs/agent/', 'agent-memory-src/']` (added in commit d464c225, 'CITATION-VERIFICATION gate, proven subset of #2821'), documented in its own header as exactly the numberPendingHashes rewrite scope. A live gate built on it — `findOutOfScopeHashSlugs`, #2821 gate 3 — is imported and wired into we:scripts/check-standards.mjs (lines 1174-1179), already warning on hash-slug citations outside the rewrite scope; its scanDir sweep (we:scripts/check-standards.mjs:1203-1208) just doesn't yet include we:scripts/ or we:skills-src/. Worse: we:backlog/2933-extend-citation-gate-3-to-scan-scripts-for-dangling-hash-slu.md is an OPEN, unlinked backlog item (dateOpened 2026-08-05, same day as #2940) whose entire body is 'widen numberPendingHashes to cover we:scripts/, OR extend gate-3's flagging to we:scripts/' — the same goal, same lineage (#2821 gate 3), same PR-based motivating evidence pattern. Neither card references the other. Following #2940's Tier-1 Done-when as written ('rewrite roots are ONE exported frozen constant in we:scripts/lane-drain.mjs') would create a second, differently-named, independently-maintained copy of HASH_REWRITE_DIRS and a second scanner beside the existing gate 3 — the exact 'two independently maintained path lists' drift the card's own design principle exists to prevent — rather than extending the mechanism (and the open item) that already does 80% of this.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Card measures the standing corpus (130 distinct tokens / 123 files, roughly 1000 occurrences) and derives the warn-not-error severity split from it. Reproducing the same word-bounded x[0-9a-z]{6} scan on the live tree today gives 139 distinct tokens / 138 files — close but not exact, most plausibly explained by ordinary corpus drift across concurrent lanes since the 'Re-grounded 2026-08-21' pass rather than a methodology error; the design conclusion (comment-class must warn, not error) holds either way.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Tier 1 requires a round-trip test proving the rule's exemption set widens automatically when the (to-be-extracted) constant's root list grows, mirroring §15's derived-scanDirs precedent. Sound in mechanics; undermined only by the premise finding above pointing the extraction at the wrong (nonexistent-need-of) location instead of reusing/relocating we:scripts/lib/citation-check.mjs's existing HASH_REWRITE_DIRS.
- **population** (addressed; strategy: name the population each threshold guards) — The emission-surface × liveness severity matrix names precisely which population gets error vs warn, and resolves the card's own 'error any in-flight hash' vs 'warning about to dangle' contradiction explicitly before Design begins.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The 130/123 corpus measurement is what justifies keeping check:standards green (warn-only for the comment class) rather than reddening ~123 files on day one — a real constraint measured before sizing the rule's severity.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Tier 2 requires the message to name the remedy and to distinguish 'about to dangle' vs 'already dangling' by grepping both branches; the existing warn()/err() mechanics in we:scripts/check-standards.mjs already surface warnings in console output and the JSON report without failing exit code, consistent with the card's 'stays green' requirement.

**Corrections applied by this review:**

- "There is no constant to derive from — extracting one is step one of this build" is false: we:scripts/lib/citation-check.mjs already exports `HASH_REWRITE_DIRS = ['backlog/', 'docs/agent/', 'agent-memory-src/']`, documented as exactly the numberPendingHashes rewrite scope.
- A live, wired gate already implements most of this class: `findOutOfScopeHashSlugs` (#2821 gate 3, in we:scripts/lib/citation-check.mjs) is called from we:scripts/check-standards.mjs and already warns on hash-slug citations outside the rewrite scope — it just isn't yet scoped to we:scripts/ or we:skills-src/.
- we:backlog/2933-extend-citation-gate-3-to-scan-scripts-for-dangling-hash-slu.md is an open, unreferenced backlog item proposing exactly this extension (widen the rewrite, or extend gate 3's scan, to we:scripts/) and should be reconciled with or superseded by #2940 rather than built independently.
- The 'measured 2026-08-21' corpus figures (130 distinct tokens, 123 files) do not reproduce exactly against the live tree today (139 distinct, 138 files) — likely ordinary drift from concurrent lanes rather than a measurement error, and doesn't change the design conclusion.

The card's severity-split design (runtime text = error, comments = warn, keyed on liveness for messaging) is well-grounded against real repo shapes (§15 precedent, HASH_RE/BORN_AS_RE, the three inline rewrite-scope blocks in numberPendingHashes) — but its central "greenfield, no constant exists" premise is false: we:scripts/lib/citation-check.mjs already exports HASH_REWRITE_DIRS and a live, wired gate (findOutOfScopeHashSlugs) implements most of this class, and an open, unreferenced backlog item (#2933) already proposes the same extension.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** The premise finding is **accepted in full and it was the driver's error** —
the first re-grounding pass grepped for the literal `REWRITE_SCOPE` inside we:scripts/lane-drain.mjs and
concluded no constant existed. Re-verified: `HASH_REWRITE_DIRS` is exported from
we:scripts/lib/citation-check.mjs and documented there as exactly this rewrite scope; `findOutOfScopeHashSlugs`
(#2821 gate 3) is live and wired in we:scripts/check-standards.mjs, just not scoped to `we:scripts/` or
`we:skills-src/`; `findDanglingMemoryHashSlugs` (#3100 gate 3b) already does the liveness resolution. The
Design and two tier-1 criteria are rewritten to **extend gate 3** rather than build a parallel scanner, and to
make the drain read the existing constant. `#2933` is confirmed open, `blockedBy: ["2821"]`, on the same class,
and — importantly — arguing the *opposite* mechanism (widen the rewrite, because a lane cannot know its number
when it writes a code comment); the card now states that conflict and names the one part this item uniquely
owns (runtime-emitted text harms during the in-flight window, which a land-time rewrite cannot fix). No
`blockedBy` edge added: the two are overlapping alternatives to consolidate, not a hard prerequisite, and a
false edge would wrongly hide ready work. The corpus figures are softened to a re-measure-at-build-time range
after the reviewer's independent count differed (139/138 vs 130/123).
