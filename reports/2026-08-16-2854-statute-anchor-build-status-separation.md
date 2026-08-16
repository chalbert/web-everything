# Statute-anchor timeless rule vs point-in-time build status — prior art
**Date**: 2026-08-16
**Point**: Prep research for decision #2854 (does point-in-time build status belong in a statute anchor, or on
the decision item / open guards?). Surveyed three mature rule-documentation systems that face the identical
tension — a durable rule vs a status that changes as the world catches up to it — and all three keep the two
apart, with the strength of the separation tracking the cost of maintaining it.
**Plan file**: none (decision prep, not the `plans/` pipeline)
**Research page**: `/research/statute-anchor-build-status-separation/`

---

## Question

PR #982's round 2 review asked the author to be honest about what a new statute anchor's invariant claims but
does not yet enforce. The author complied by writing the disclosure directly into the anchor body
(`#fix-review-convergence-independent-root-cause`, invariant 1 — now 277 words of "today", "not yet",
"build-pending" prose). Round 3 read the result as a layering violation: the anchor is supposed to be a timeless
citable rule, and it now goes false the moment the enforcement it describes ships. Is there prior art for keeping
a rule's *text* and its *build status* apart, and if so, what does the split actually cost?

## Findings — three systems, one direction, three different costs

**1. ADR status field (Michael Nygard's pattern, and its OASIS/MADR descendants).** An Architecture Decision
Record's `Status` (proposed / accepted / deprecated / superseded) is a **distinct structured field**, separate
from the `Decision` and `Consequences` narrative — the decision text is written once and stays as the record of
what was decided; the status is what's allowed to move. This is the weakest form of the split (status still
lives in the same document) but it establishes the base claim decision #2854 rests on: **even the systems that
keep status physically adjacent to the rule still refuse to interleave it into the rule's own sentences.**
[architecture-decision-record (joelparkerhenderson)](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md),
[adr.github.io](https://adr.github.io/)

**2. IETF RFC + errata.** The strongest and most directly analogous precedent. A published RFC's text is
**immutable** — it is never edited in place, even to fix an acknowledged error. Corrections and status notes
(Verified / Rejected / Held for Document Update) live entirely in the **separate errata system**, cross-linked
by RFC + section number. A reader who wants "is this still accurate" checks the errata registry; the RFC itself
never carries a "this clause is not yet implemented anywhere" caveat. This is structurally identical to #2854's
option (a): rule text in the anchor, status on the linked item, at effectively zero rendering cost — the errata
system is a flat append-only log, not a live-rendered field. [IETF errata definitions](https://www.rfc-editor.org/errata-definitions/),
[IESG errata processing](https://www.ietf.org/about/groups/iesg/statements/processing-errata-ietf-stream/)

**3. MDN / web-features "Baseline" status badges.** The one system that inlines status *into* the spec-adjacent
page — but the badge is never hand-authored prose. It is **generated automatically** from a separate
machine-readable dataset (`@mdn/browser-compat-data` / `web-features`), and a build step re-renders the badge
whenever that dataset changes. This is #2854's option (c): a dedicated machine-readable field the renderer
parses and displays, giving the reader the best experience (status visible in place, always current) but only
because a data pipeline keeps it truthful — hand-written prose achieving the same effect would drift the moment
the underlying fact changed and nobody remembered to re-edit that sentence. [MDN feature status](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Page_structures/Feature_status),
[web-features Baseline](https://web.dev/baseline)

## What's conspicuously absent

None of the three systems' *core rule text* carries hand-maintained "as of today, X is not yet built" prose —
the shape PR #982 produced and #2854's Fork 1(b) proposes keeping. The closest analogue, MDN's inline badge, is
inline *rendering* of an *external* structured fact, not inline *authoring* of a status claim inside the rule's
own sentences. That absence is evidence, not silence: it is exactly the shape that goes stale, and the mature
systems that could have chosen it didn't.

## Confirmed in the wild, during this very prep

The skeptic pass run against this recommendation (see #2854's `Skeptic:` line) turned up a live instance of exactly
the decay option (b) predicts, inside the anchor under discussion:

- `#fix-review-convergence-independent-root-cause` invariant 1 still reads "**Build-pending — not yet current
  fact**… still owed" about the reviewer-id / self-clear enforcement. But `we:scripts/lib/invariant-catalogue.json`
  (entry `review.land-seam-refuses-self-cleared-verdict`, `anchor` back-linked to this exact heading) has recorded
  `"status": "enforced"` since PR #1100 (2026-08-08), backed by real shipped code
  (`we:scripts/lib/review-independence.mjs`, `we:scripts/lib/auto-land-seam.mjs`, `we:scripts/review-set-label.mjs`).
  The anchor's own prose is currently **false** against ground truth the repo already tracks elsewhere.
- Separately, #2842 (resolved 2026-08-16) already had to patch **six** false `OPEN`/`` `status: open` `` claims out
  of this same anchor's body and Lineage paragraph, and #2853 (still open) exists solely to fix the
  "pending #2853's re-point" placeholders #2842 left behind. The anchor has needed two rounds of stale-status
  correction within two weeks of being written — this is not a hypothetical failure mode, it is the anchor's actual
  maintenance history.
- The skeptic pass also surfaced that a working version of option (c) — a dedicated machine-readable status field —
  **already ships**, but only for a curated subset: `we:scripts/lib/invariant-catalogue.json`'s
  `status`/`owedTo`/`anchor` schema, gated by `validateInvariantEnforcers` (#2844), proves the field-per-claim shape
  works for *catalogued* operational invariants. It does not yet cover the free-text point-in-time tokens (`today`,
  `not yet`, `build-pending`) #2849 targets on *uncatalogued* anchor prose — extending it there, not inventing it
  from scratch, is (c)'s real remaining cost.

## Recommendation

Grounds #2854 Fork 1's default at **(a)** — build status lives on the decision item / open guards; the anchor
states only the rule — as the RFC/errata pattern at effectively the lowest implementation cost (the backlog
already is that separate tracked system; no new tooling needed). Option **(c)** (MDN/Baseline pattern) is the
long-run better reader experience but requires the `/rules/` renderer to grow a parsed field, which #2854 already
prices as "highest cost" — a legitimate future upgrade path from (a), not a competing default now: (a)'s
anchor-links-to-item shape is what a later machine-readable field would parse *from*, so choosing (a) now doesn't
foreclose (c) later. Option (b) — the shape PR #982 shipped — has no supporting precedent in any of the three
systems surveyed and produced the exact 277-word single-paragraph anchor the corpus-measurement flagged.
