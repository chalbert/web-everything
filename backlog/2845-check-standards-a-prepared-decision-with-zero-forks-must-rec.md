---
bornAs: xbptb5h
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
scopeRationale: "One new error block inside the existing lintBacklogItemRendering() (we:scripts/check-standards-rules.mjs, ~line 855, right after the #1935 dangling-residue guard it composes with) plus its fixture tests in the sibling test file. No wiring elsewhere: we:scripts/check-standards.mjs (line 672) already calls lintBacklogItemRendering() for every backlog item and pushes its errors/warnings into the gate, so nothing at the call site changes."
tags: [statute-lint, check-standards, prevention, decision]
---

# check:standards: a prepared decision with zero forks must record a fork-existence collapse

A `kind: decision` carrying `preparedDate` but zero `## Fork` headings passes silently, hiding whether the forkless shape is deliberate (a fork-existence collapse) or an authoring miss. Add a `check:standards` error: such an item must record an explicit fork-existence collapse note or a research cite.

## Gap

The prepared-decision health check (G4/G5, `we:scripts/audit-backlog-health.mjs`) reads a decision's readiness but does not require a *justification* when a prepared decision carries no `## Fork` sections at all — G4/G5 only fire *inside* an existing `## Fork` section (prioritization tells / missing justification line); a decision with **zero** such sections is invisible to both. It also lives in `check:health` (an advisory, non-gating CANDIDATE pool), not `check:standards` (the gate). A forkless prepared decision therefore reads identically whether the author collapsed the forks on purpose or simply forgot to write them, and nothing blocks it either way.

## Why it matters

"Prepared" means the forks were researched to Definition-of-Ready before the call. A prepared decision with no forks is either a legitimate fork-existence collapse (the options weren't genuinely in contention) or an invisible gap. Requiring the author to say which turns an invisible forkless pass into a readable, cite-able record — exactly the note PR #982's own decision item (`we:backlog/2851-*.md`) had to add, and the worked example this item's detection must recognize (below).

## Current code state (confirmed 2026-08-15)

- `lintBacklogItemRendering({ item, body })` in `we:scripts/check-standards-rules.mjs:757` is the shared per-item rendering lint (#845) — it already returns `{ errors, warnings }` for one backlog item's body, and `we:scripts/check-standards.mjs:667-675` calls it for every item in the loaded backlog and feeds `errors` into the gate (fails the run) and `warnings` into advisory output (does not fail). This is the right home: no new call-site wiring needed.
- The closest existing analog inside that function is the **dangling-residue guard** (#1935, `we:scripts/check-standards-rules.mjs:855-880`), scoped to `item.kind === 'decision' && (item.status === 'resolved' || item.preparedDate)` — same trigger shape this item needs, but it emits a **warning**, not an error, and it checks for prose residue *outside* a fork, not for the fork section's absence.
- `we:scripts/audit-backlog-health.mjs:388-414` (G4/G5) is the nearest sibling check, but it is `check:health` (advisory only, run separately from `check:standards`) and both G4 and G5 walk `sectionRanges()` filtered to headings matching `/^fork\b/i` — i.e. they only ever look *inside* a fork section; a decision with none never reaches either check. Both are also scoped to `it.status !== 'resolved'` ("resolved decisions are historical — skipped").
- No code anywhere currently detects "zero `## Fork` headings on a prepared decision." This is a real, unfilled gap, not a duplicate of G4/G5.

## Mechanical fix

Add a new **error** block to `lintBacklogItemRendering()`, alongside the #1935 residue guard it composes with:

**Trigger** — `item.kind === 'decision' && item.preparedDate && item.status !== 'resolved'`. Mirrors G4/G5's own scoping (a resolved decision is frozen history; the point is to catch the gap *before* ratification, not retroactively litigate old rulings). Do **not** widen this to include `status === 'resolved'` — see the blast-radius finding below; doing so would immediately break the gate on ~56 pre-existing resolved decisions with no way to fix them without reopening settled history.

**"Zero forks" test** — scan body headings (`/^#{1,6}\s+(.+?)\s*$/gm`, fenced code excluded), trim each heading's text, and test it against `/^(the\s+)?forks?\b/i` — i.e. the heading must **START WITH** the word `fork`/`forks` (optionally preceded by "The ") to count as a real Fork section — **excluding** a heading that itself matches the collapse-note phrase below. A decision has zero real forks iff no heading passes this test.

Do **not** use a bare word-boundary match anywhere in the heading (`/\bforks?\b/i` with no anchor) — that was the original design here, and it is a confirmed bug (caught in human review of an earlier revision of this item, PR #1364): "fork" appearing *anywhere* in a heading includes headings that exist specifically to explain why something is **not** a fork, e.g. `## Why this isn't a classic fork (and is still a decision)` (`we:backlog/1648-*.md`) and `## Scope boundary (timing deferral, not a fork): static now, live later` (`we:backlog/2224-*.md`). Under the unanchored test both headings match `/\bforks?\b/i`, are not excluded by the collapse-note-only exclusion, and so both cards are misread as "has a fork" — which short-circuits the whole check **before** the escape valve is ever evaluated for either. Both cards still end up with 0 errors, but only by accident: the item's own corpus trace claims they clear the "validation-gate phrase test" escape valve, when hand-executing the unanchored design shows that valve is never reached for either. Worse, this is not just cosmetic against these two cards: it means *any* heading anywhere in a forkless decision's body that merely contains the substring "fork" — including in an explicit negation like "this isn't a fork" — makes the "zero forks" test a no-op for that card, bypassing all three named escape valves with no justification required at all. That is the exact invisible-gap failure mode this item exists to close.

Anchoring the test to the *start* of the heading fixes this while still correctly recognizing genuine Fork sections:
  1. A heading reading `## Fork-existence collapse — why this prepared decision carries no ## Fork sections` (the worked-example heading in `we:backlog/2851-*.md`) *does* start with "Fork," so it still needs the explicit collapse-note-phrase exclusion to avoid being misread as a real Fork section on its own escape-valve heading — keep that exclusion.
  2. A heading reading `## The fork` (verbatim in `we:backlog/3115-*.md`, a real `Option A` / `Option B` fork) starts with "The fork" and is correctly recognized by the anchored test (the optional `(the\s+)?` prefix exists specifically for this shape).
  3. `## Why this isn't a classic fork …` (#1648) and `## Scope boundary (…, not a fork): …` (#2224) do **not** start with "fork" — the anchored test correctly does not treat either as a real Fork section, so both fall through to the escape valve below, where valve 2 (the validation-gate phrase test) correctly fires for both — this time for the reason the item's own corpus trace claims, not by heading-match accident.

**Escape valve (either clears it)**:
  1. **Fork-existence collapse note** — body contains the phrase `fork-existence collapse` (case-insensitive), matching the established idiom from `we:backlog/2851-*.md`'s own `## Fork-existence collapse` heading.
  2. **Validation-gate archetype** — body contains `/validation[\s-]gate|why this isn.t a classic fork|go\s*\/\s*no|dissolve test/i`. This is **not** optional polish: `we:docs/agent/backlog-workflow.md` documents a second, doc-sanctioned forkless-prepared shape (the "validation-gate" decision — go/no-go merit gate, canonical worked example `we:backlog/1631-*.md`) that legitimately carries **no** `## Fork N` sections by design, justified instead by a `## Why this isn't a classic fork` heading (or, in practice on the current corpus, a looser inline phrase — see the corpus scan below). Omitting this valve turns the new gate into an immediate false-positive machine against a real, ratified pattern.
  3. **Research cite** — body contains `/research/` (a link to a `/research/` topic) or the item's frontmatter carries `relatedReport`.
  Absent all three, **error**.

## False-positive / false-negative boundary (verified against the live corpus, 2026-08-15, re-derived after PR #1364 human review)

The prior revision of this item stated "3,109 decision items carry `preparedDate`" — that number was actually `ls backlog/*.md | wc -l` (the **total backlog file count**, 3,110), not a filtered count. The real, scripted counts (re-run against the current corpus):

```
ls backlog/*.md | wc -l                                                             # 3,110 total backlog files
grep -l 'kind: decision' backlog/*.md | xargs grep -l 'preparedDate:' | wc -l        # 385 decision items with preparedDate
grep -l 'kind: decision' backlog/*.md | xargs grep -l 'preparedDate:' \
  | xargs grep -L 'status: resolved' | wc -l                                        # 26 in the actual non-resolved trigger scope
```

Ran the **anchored** trigger + detection above (not the buggy unanchored one) against all 26 items in the non-resolved trigger scope:

- **Zero** currently produce a false-positive error under the fixed design — the three live forkless-prepared decisions in today's backlog (`#1648`, `#2224`, `#3115`) each clear the check correctly: `#1648` and `#2224` have **no** heading that starts with "fork" (their "not a fork" headings correctly fail the anchored test), so both fall through to the escape valve, where valve 2 (the validation-gate phrase test) fires on each — `#1648`'s heading literally reads `why this isn't a classic fork`, matching the valve regex directly; `#2224`'s body reads "This is a **validation-gate** decision (go / not-yet / no on a candidate)," matching the same regex. `#3115` clears the check because `## The fork` starts with "the fork" and is correctly recognized as a real Fork section by the anchored test. **This means the rule can land with 0 new `check:standards` errors on the current backlog** — no backfill/grandfather pass is needed before it can go live as a hard error. (Re-verified programmatically, not by hand, against all 26 items in scope — see the fixture list below for the harness used.)
- Widening the trigger to also cover `status === 'resolved'` would immediately break the gate: dozens of resolved decisions in the current corpus have zero fork headings and neither a collapse note nor a validation-gate tell — real historical items that predate this rule and were never asked to justify their shape. **Do not widen the trigger without a separate backfill pass**; the item as specified (scoped to non-resolved) avoids this entirely.
- **Narrowed false-negative surface (the bug this revision fixes):** the previous "contains `fork`/`forks` anywhere in the heading" test let *any* heading merely mentioning the word "fork" — including explicit negations like "this isn't a fork" — count as a real Fork section, silently defeating the whole gate (no escape valve ever evaluated) for that card. The anchored `/^(the\s+)?forks?\b/i` test closes this: only a heading that actually *opens with* "Fork"/"Forks"/"The fork" counts as a real Fork section. Residual, narrower false-negative risk: a heading engineered to open with the word "fork" while not being a genuine Fork section (e.g. `## Fork? Not really, just a note`) would still be misread as real — that residual gap is accepted as the same structural trust boundary G4/G5 already rely on, and is far narrower than "contains the substring anywhere."
- **Test fixtures a build must include** (mirroring the existing `describe('lintBacklogItemRendering …')` block in `we:scripts/__tests__/check-standards-rules.test.mjs:1333`): (a) prepared decision, zero fork headings, no collapse/validation/research language → **error**; (b) same, with a `## Fork-existence collapse` heading → **no error**; (c) same, with `## Fork 1` present → **no error** (has a fork); (d) same, with `## The fork` present → **no error** (anchored heading test catches it); (e) same, with `status: resolved` → **no error** (scoped out); (f) same, with body text `"a validation-gate decision"` → **no error**; (g) same, `preparedDate` absent → **no error** (not yet prepared, not this gate's concern); **(h) same, with a heading that merely mentions "fork" without starting with it and without any valve phrase present anywhere in the body** — e.g. `## Not a fork, just a prioritization call`, body has no `fork-existence collapse`/`validation-gate`/`why this isn't a classic fork`/`go / no`/`dissolve test`/research-cite language — → **error** (proves the fix: under the OLD unanchored design this fixture would wrongly pass with no error, since the heading's bare mention of "fork" would have short-circuited the check; under the fixed anchored design it correctly errors, because a heading merely containing the word is no longer sufficient to count as a real fork). Hand-verified against a throwaway fixture file during this prep pass: old (unanchored) design → no error (bug reproduced); new (anchored) design → error (bug fixed).

## Size estimate

Small — a `task` (never carries a frontmatter `size`; tasks roll up under their parent story/epic, per `check:standards`). One new ~30-35 line error block inside an already-shared function (`lintBacklogItemRendering()`), no new call-site wiring (the gate already invokes it per item), plus the eight fixtures listed above added to the existing `describe('lintBacklogItemRendering …')` block. Comparable in scope to the neighboring #1935 residue guard it sits beside (~25 lines). Equivalent to a size-2 story if it were sized. The one real cost is the investigation already spent in this prep pass (confirming the escape-valve set against the live corpus so the rule ships with 0 new errors, and confirming fixture (h) actually distinguishes the fixed design from the bug it replaces) — a builder does not need to repeat that scan, only implement and test the design specified above.

## Provenance

Outstanding prevention **M4** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.

## Done when

- `lintBacklogItemRendering()` in `we:scripts/check-standards-rules.mjs` emits an **error** (not warning) for a `kind: decision` item with a truthy `preparedDate`, `status !== 'resolved'`, and no heading that **starts with** `fork`/`forks` (optionally preceded by "the"; collapse-note heading excluded) — unless the body carries the `fork-existence collapse` phrase, a validation-gate tell (`validation[\s-]gate`, `why this isn't a classic fork`, `go / no`, `dissolve test`), or a research cite (`/research/` link or `relatedReport` frontmatter).
- All eight fixtures listed under *Test fixtures a build must include* above pass in `we:scripts/__tests__/check-standards-rules.test.mjs`, including fixture (h), which asserts the rule still correctly errors on a heading that merely mentions "fork" without opening with it and without any valve phrase elsewhere in the body — proving the fix is not just an accidental pass on `#1648`/`#2224` for the same wrong reason the human review caught.
- `npm run check:standards` run against the real, current `backlog/` produces **0 new errors** — i.e. it does not regress on `#1648`, `#2224`, or `#3115` (the three live forkless-prepared decisions identified above), and does not fire on any `status: resolved` decision.
- No change to `we:scripts/check-standards.mjs`'s call site (`lintBacklogItemRendering` is already wired at line 672) or to `we:scripts/audit-backlog-health.mjs` (G4/G5 stay as-is; this item does not touch the `check:health` advisory pool, per the Gap section above).
