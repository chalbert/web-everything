---
bornAs: xhw9h59
kind: story
size: 1
parent: "2405"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards.test.mjs
status: resolved
dateOpened: "2026-07-28"
dateResolved: "2026-08-15"
graduatedTo: none
tags: [review-gate, drain, conveyor, fold-in]
scopeRationale: Re-scoped 2026-08-15 prep (see finding below) — the original land-gate ask is already shipped, so the only remaining buildable work is the #2739 fold-in cleanup. we:scripts/check-standards-rules.mjs gets the new exported pure predicate; we:scripts/check-standards.mjs is the one call-site it replaces; we:scripts/__tests__/check-standards.test.mjs is where the hollow test lives and the new wiring test is added.
---

# A `review:changes` (or any unresolved `review:*`) label must veto the land — independent of `ready-to-merge`

On 2026-07-28, PR #870 (WE #2739) received an independent `review:changes` verdict via /review, yet MERGED while still labeled `review:changes` (the label was never flipped to `review:accepted`), because it carried `ready-to-merge` and the drain/land path landed it anyway. Separately, during the review a background drain/conveyor process stamped `review:accepted` onto that `review:changes` PR (removed by hand; it merged regardless). The land gate must treat an unresolved `review:*` label (`review:changes`, `review:pending`, `review:human`) as a HARD merge blocker that vetoes the land no matter what `ready-to-merge` says.

## Detail (original ask, 2026-07-28)

- Investigate two things: (a) the land path (`we:scripts/merge-ai-prs.mjs` / the drain land gate) that landed #870 despite `review:changes`; (b) what wrote `review:accepted` onto a `review:changes` PR mid-review.
- Proposed guard: any unresolved `review:*` label vetoes the land, independent of `ready-to-merge`.
- Note: #870's SUBSTANCE was fine — the doc fix (commit 96156d15) was in before it landed — so this is purely a process/gate defect, not a bad merge. Sibling to #2745 ("a formerly-review:human PR must survive its human gate").

## Prep finding (2026-08-15) — the land-gate veto (a) is ALREADY SHIPPED, verified live

Grounded against the live tree (lane-16, `origin/main` @ c1a4d770), not just history:

- **The exact guard this item asks for is live in `we:scripts/merge-ai-prs.mjs:531-594`** (`classifyPr`, "HOLD-INTEGRITY (#2820)") and its shared predicate `hasUnclearedReviewLabel` in `we:scripts/lib/review-escalation.mjs:1365-1398`. The merge decision is an AND, never an OR on `ready-to-merge`: a PR carrying `review:changes` / `review:human`, or a non-relieved `review:pending`, without `review:accepted`, is refused regardless of `ready-to-merge` (`we:scripts/merge-ai-prs.mjs:593`: `else if (reviewUncleared) { decision = 'skip'; reviewHeld = true; ... }`). The docstring names the exact #870/#956 shape as the regression case it closes.
- **This shipped as `we:backlog/2820-review-hold-labels-must-block-merge-regardless-of-ready-to-m.md`** (filed 2026-08-01, four days after this item, for a near-identical incident on WE PR #956), landed via PR #975 (merge commit `a50abcc5`, 2026-08-02T17:07:47-04:00) starting from `6e9221ef` ("#2820: review hold blocks merge regardless of ready-to-merge"), then hardened over four independent review-fix rounds: `b869dfd3` (park not bare-skip), `4ba90324` (blast-radius: escape hatch + pending dead zone), `53d6e43a` (fifth mint-site + a class guard discovering merge-gate consumers), `ba61f87f`/`a63a4308` (skip-stamp de-dup, finding-1 scope fix), `8fecb22f` (durable-record attestation fix). That review depth is well beyond what this item's own prep could add.
- **Defense-in-depth (this item's "note 2" ask, mutual exclusivity) also shipped**, under #2832: `REVIEW_HOLD_LABELS`, `isReviewHoldLabel`, `readyMergeConflictsWithHold` (`we:scripts/lib/review-escalation.mjs:1405-1432`) — applying a hold label strips `ready-to-merge`, and the reconcile does not re-add it while a hold is unsatisfied.
- **Part (b) — what wrote `review:accepted` onto a `review:changes` PR mid-review — was not literally root-caused as a standalone artifact**, but the write path it would have needed is now structurally closed. The ONLY sanctioned writer of `review:accepted` is `we:scripts/review-set-label.mjs`, shelled by every caller including the unattended auto-land seam (`we:scripts/lib/auto-land-seam.mjs`); SAFETY RAIL 4 there (`we:scripts/lib/auto-land-seam.mjs:147-162`) refuses to write `review:accepted` unless the clearer is PROVABLY distinct from the PR's author (`we:scripts/lib/review-independence.mjs`, #2439/#2844), fail-closed on `unknown`. `we:scripts/lib/review-escalation.mjs:1365-1398`'s `hasUnclearedReviewLabel` additionally refuses `accepted`+`pending` and `accepted`+`human` co-presence (only `accepted`+`changes` is left alone, by a later deliberate ruling, #2974, because a fresh accept legitimately supersedes a stale bounce). No further build work is proposed for (b) here — flag it only if a NEW concrete mid-review-stamp incident is observed.
- **This item has a near-duplicate sibling, `we:backlog/2750-review-changes-must-veto-the-merge-the-drain-landed-a-review.md`** — filed the same day (2026-07-28) about the exact same PR #870 incident, also `status: open`. It is out of this item's scope to edit, but whoever picks it next should check it against the same #2820 evidence above before scoping any build work into it.

**Conclusion: the primary ask of this item is DONE, in production, independently re-reviewed four times.** Re-implementing it would duplicate `we:scripts/merge-ai-prs.mjs:531-594` and `we:scripts/lib/review-escalation.mjs:1365-1432`. The only genuinely open, buildable remainder is the fold-in cleanup below.

## Remaining scope — the fold-in cleanup (build-ready)

**The finding, re-verified live (2026-08-15):** `we:scripts/__tests__/check-standards.test.mjs:263-270` defines its own local copy of `dirLevelScopeFinding` (mirroring the inline WARN rule at `we:scripts/check-standards.mjs:756-760`, §6d-sexies, #2739). The "false-positive corpus guard" test at `we:scripts/__tests__/check-standards.test.mjs:301-320` runs that LOCAL copy over the real `we:backlog/*.md` corpus and asserts three properties (`status !== 'resolved'`, empty `scopeRationale`, entry `endsWith('/')`) that are guaranteed BY THE FUNCTION'S OWN filter chain the moment it returns a non-empty array — no code change to `dirLevelScopeFinding` itself could ever make this test fail. Confirmed unchanged since this item was filed: `git log --oneline --since=2026-07-28 -- we:scripts/__tests__/check-standards.test.mjs` returns nothing. Running the local mirror over the current real backlog (dry-run during prep, no file written) returns 27 legitimately-flagged items (e.g. `2740-un-gate-tripwire...`, `2774-opt-in-feedback-capture...`) — so the rule fires correctly today; the gap is purely that the TEST cannot detect a future break in it.

### Decided design

Extract the predicate into an **exported, SHIPPED pure function** in `we:scripts/check-standards-rules.mjs` (the file this repo already uses for every OTHER individually-testable rule body — see its own file-header: "factors the highest-value, context-pure rules out of that script so they can be unit-tested... the script stays the single source of live behavior: it imports and composes these, so the test exercises the exact code the production gate runs"). Have `we:scripts/check-standards.mjs` call the shipped function instead of re-deriving `dirs` inline, and have the test import the SAME function instead of a hand-mirrored copy. Add a **wiring test** that reads `we:scripts/check-standards.mjs`'s source text and asserts it still imports and calls this exact function — the same technique already proven in this repo at `we:scripts/__tests__/check-standards-rules.test.mjs:2323-2351` ("rule 19 is WIRED: the gate imports the real walk, and the real walk still reaches the rule"), which exists for exactly this failure mode (PR #1235 review finding 4: a mutated call site left 314 tests green because the guards re-implemented the walk instead of running the shipped one).

**Why not just delete the corpus test (the item's other named option)?** Deleting loses the real-corpus fuzz coverage (does the predicate misbehave on real, messy frontmatter?) for no reason — extraction is a small, mechanical, behavior-preserving change (verified during this prep: the extracted logic returns the identical 27-item flagged set as the current inline code, computed by dry-running the predicate over the live `we:backlog/` directory), and it fixes the ACTUAL defect (a hand-mirrored copy that can drift) rather than just removing the symptom.

### Interfaces / protocol

**New export, appended near the end of `we:scripts/check-standards-rules.mjs`** (after the existing mandate-fence-scan block, current EOF ~line 2841):

```js
const SCOPE_REPO_PREFIX_RE = /^(?:we|fui|plateau|webeverything|frontierui|plateau-app):/;

/**
 * @param {{scope?: unknown, status?: string, scopeRationale?: string}} item - RAW (pre-loader) frontmatter
 * @returns {string[]} the repo-qualified, "/"-terminated scope entries to flag; [] when item.scope isn't an
 *   array, item.status === 'resolved', or a non-empty (trimmed) item.scopeRationale justifies the span.
 */
export function dirLevelScopeFinding(item) { /* body unchanged from the current test-file mirror */ }
```

Same single-object argument shape the test file's current local copy already uses, so the six existing unit tests at `we:scripts/__tests__/check-standards.test.mjs:272-299` need ZERO changes to their call sites.

**Call site, `we:scripts/check-standards.mjs` line 69** (top-of-file named-import list from `we:scripts/check-standards-rules.mjs`): add `dirLevelScopeFinding,` to the list.

**Call site, `we:scripts/check-standards.mjs` line 757**: replace
```js
const dirs = scope.filter((p) => typeof p === 'string' && SCOPE_REPO_PREFIX_RE.test(p) && p.endsWith('/'));
```
with
```js
const dirs = dirLevelScopeFinding(raw);
```
(`raw` is already the exact frontmatter object the local mirror expects — it already carries `.scope`, `.status`, `.scopeRationale`, read two lines above at `we:scripts/check-standards.mjs` line 709.) Leave the file's OTHER `SCOPE_REPO_PREFIX_RE` uses (the bare-entry check at `we:scripts/check-standards.mjs` lines 706 and 735) untouched — different rule, not in scope here.

**Test site, `we:scripts/__tests__/check-standards.test.mjs`**: delete the local `dirLevelScopeFinding` definition (current lines 263-270); add `dirLevelScopeFinding` to the existing `we:scripts/check-standards-rules.mjs` import block (top of file, alongside `buildGraduatedKinds`/`validateBacklogItem`/`isCanonicalGraduated` at line 23).

**New wiring test**, same `describe` block, mirroring `we:scripts/__tests__/check-standards-rules.test.mjs:2323-2351`: read `we:scripts/check-standards.mjs` source via `readFileSync`, assert it matches an import of `dirLevelScopeFinding` from `we:scripts/check-standards-rules.mjs` AND a call `dirLevelScopeFinding(raw)` inside the §6d-sexies section (bounded by locating the `// ── 6d-sexies.` marker and the next `// ── ` section marker, same slicing technique as the cited test), and assert that slice is not wrapped in a swallowing `try/catch`.

**Retained real-corpus loop** (current lines 307-319): keep running the (now-shipped) function over every real `we:backlog/*.md` file, but re-word its surrounding comment to stop calling it a "false-positive guard" — it is a not-inert sanity/fuzz check (does the shipped predicate stay well-typed over real, messy data) now that drift-safety is the wiring test's job, not this loop's.

### Tasks (ordered)

1. Add `dirLevelScopeFinding` to `we:scripts/check-standards-rules.mjs` (new export + its own module-scope `SCOPE_REPO_PREFIX_RE`, matching the file's existing non-exported-const-before-function convention, e.g. `LOCUS_MARKER_RE` at `we:scripts/check-standards-rules.mjs` line 1703).
2. Wire `we:scripts/check-standards.mjs` (import list line 69, call site line 757) to use it; delete the inline re-derivation.
3. Update `we:scripts/__tests__/check-standards.test.mjs`: import the shipped function, delete the local copy.
4. Add the wiring test (step above), modeled on `we:scripts/__tests__/check-standards-rules.test.mjs:2323-2351`.
5. Re-word the real-corpus loop's comment (no logic change) to drop the "false-positive guard" claim it cannot back.
6. Run `npm run check:standards` before and after and diff the output — must be byte-identical (same WARN items, same messages) — this is the behavior-preservation check for the refactor. Run the touched test file under vitest and confirm green.

## Done when

- `we:scripts/check-standards-rules.mjs` exports `dirLevelScopeFinding`; `we:scripts/check-standards.mjs` calls it at its §6d-sexies site; no inline re-derivation of `dirs` remains there.
- `we:scripts/__tests__/check-standards.test.mjs` no longer defines a local copy of the predicate — it imports the shipped one, and the six existing unit tests (current lines 272-299) still pass unchanged against it.
- A new test asserts, by reading `we:scripts/check-standards.mjs`'s own source, that §6d-sexies imports and calls `dirLevelScopeFinding` outside any try/catch — this test must go RED if a future edit reverts to an inline re-derivation or silently drops the call (verify by temporarily reverting the wiring locally and confirming this specific test fails, before finalizing the PR).
- `npm run check:standards` emits the same WARN items (same backlog ids, same messages) before and after the change on the real backlog — zero behavior change.
- The touched test file (`we:scripts/__tests__/check-standards.test.mjs`) is green under vitest.
- No file still frames the real-corpus loop as a "false-positive guard."

## Delivery shape

Single small PR, lands as one piece (no flag/incremental staging needed) — a pure refactor (extract + import + one new test) across three files with no behavior change and nothing to migrate. Gate: `npm run check:standards` (0 errors, WARN output unchanged) plus the touched vitest file.

## Closing note (2026-08-15) — fold-in cleanup shipped

The remaining fold-in scope is built: `dirLevelScopeFinding` is now a shipped, exported pure function in `we:scripts/check-standards-rules.mjs`; `we:scripts/check-standards.mjs`'s §6d-sexies calls it (no inline re-derivation of `dirs` remains); `we:scripts/__tests__/check-standards.test.mjs` imports the shipped function (its local hand-mirrored copy is deleted) and gained a new wiring test that reads `we:scripts/check-standards.mjs`'s own source and asserts the import + call site stay live outside any try/catch (verified RED against a manual revert before finalizing). `npm run check:standards` output is unchanged for the actual rule (the only diff was the two touched files' own line-count self-reports in an unrelated lock-point warning). The touched test file is green (39/39). Resolved with `graduatedTo: none` — a refactor of existing code, no new entity. Primary ask remains shipped under #2820 (see Prep finding above).

## Cross-references

- `we:backlog/2820-review-hold-labels-must-block-merge-regardless-of-ready-to-m.md` — ships this item's primary ask (see Prep finding above).
- `we:backlog/2750-review-changes-must-veto-the-merge-the-drain-landed-a-review.md` — same-day near-duplicate of this item's original ask; also still `status: open`, also superseded by #2820 in substance.
- #2832 — the mutual-exclusivity defense-in-depth this item's "note 2" asked for.
- #2974 — the later ruling on the `review:accepted` + `review:changes` co-presence edge case, referenced under part (b) above.
- #2439/#2844 — the non-author-clears invariant that forecloses an unattended process silently writing `review:accepted`.
