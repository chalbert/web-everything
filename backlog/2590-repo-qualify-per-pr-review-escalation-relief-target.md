---
bornAs: xrq396a
kind: story
size: 2
status: open
dateOpened: "2026-07-20"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:skills-src/drain/SKILL.md
  - we:skills-src/pr/SKILL.md
---

# repo-qualify the per-PR --no-review-escalation relief target so it can't waive the wrong repo's PR

The per-PR relief valve (#2423, `parseNoReviewEscalation` / `applyEscalationRelief` in
`we:scripts/merge-ai-prs.mjs`) matches the relieved PR by a **bare integer** with NO repo qualifier, but the
drain sweeps all three constellation repos in one pass (#2257) and PR numbers are per-repo. So
`--no-review-escalation=396` waives `web-everything#396` **and** `frontierui#396` — contradicting #2423's own
headline ("relief stays scoped to one PR") and landing unreviewed code. Narrow trigger (two same-numbered
pending parks in one pass) and a `--this-repo` workaround exists, so it was accepted as a follow-up.

Surfaced by the independent `/review` of PR #611 (the #2423 landing PR), 2026-07-20.

Fix: let the flag express a repo-qualified target — accept `--no-review-escalation=owner/repo#396` (or
`repo#396`) alongside the bare `=396` form, and match on `v.repo` + `v.num` when a repo qualifier is present.
The bare `=396` form is tightened to the local/cwd repo, mirroring `matchesOnlyTarget` (#2683) — see
*Design* below for why that branch rather than "keep matching any repo"; the sub-choice is settled here, not
left to the fix. Tests: a repo-qualified `frontierui#396` does NOT relieve `web-everything#396` in the same
pass; the bare form is pinned to the local-repo behaviour; the existing #2423 refusals
(`review:human`/`review:changes` never waivable) still hold.

## Design

**The precedent to copy is already in the file.** #2683 solved the identical "PR numbers are per-repo"
problem for `--only=<pr>` with a pure predicate, `matchesOnlyTarget` (`we:scripts/merge-ai-prs.mjs:235`),
whose contract is worth reusing verbatim:

```
number mismatch                              → never
an explicit repo qualifier is given          → the PR's repo must equal it
else a SINGLE-repo sweep (repoCount === 1)   → match
else (multi-repo sweep, no qualifier)        → match ONLY the local/cwd repo
```

That last branch is also the answer to the open question the digest leaves ("a bare `=396` may keep matching
any repo … or be tightened") — **tighten it to the local repo, exactly as `matchesOnlyTarget` does.** Two
reasons, both grounded: it makes the flag's behaviour identical to the sibling flag an operator already
knows, and it is the fail-closed direction (relief is a *waiver*; a bare number matching every repo waives
more than the operator named). Documented divergence between two per-PR targeting flags in the same CLI is
its own defect.

**Parse side.** `parseNoReviewEscalation` (`we:scripts/merge-ai-prs.mjs:177`) today pushes bare integers into
`prs: number[]`. Widen the value grammar to accept `owner/repo#396`, `repo#396` and `396`, and return
structured targets instead of bare numbers. Keep `passWide` untouched — a bare flag is still the legacy
pass-wide waiver. `prs` is read by four call sites, so either keep `prs` as the numeric projection and add a
`targets` array beside it, or migrate all four together; do not leave two half-migrated readers.

**The four call sites that must all agree** (each one currently `includes(Number(…))` with no repo):

- `we:scripts/merge-ai-prs.mjs:1098` — inside `buildCarrierHealth`
- `we:scripts/merge-ai-prs.mjs:1244` — inside `buildDrainVerdicts`
- `we:scripts/merge-ai-prs.mjs:2824` — the `runCli` label-on-green reconcile
- `we:scripts/merge-ai-prs.mjs:3487` — the `runCli` `applyEscalationRelief` call

Three of the four have the repo in hand (`p.repo` / `v.repo`), so they need only the predicate swap. **The
fourth is not free**: `buildCarrierHealth` (`we:scripts/merge-ai-prs.mjs:1074`) receives
`(openPrContext, { escalationRelief, label, candidateHeldByKey })` and its sole caller (`:1326`) forwards
exactly those — neither `isLocalRepo` nor a repo count reaches it, so it needs a real signature change. And
the `openPrContext` it reads spans the wider `CONTEXT_REPOS` set, not the narrower `REPOS` sweep that
`repoCount`/`isLocal` are defined against, so the right `repoCount` is not trivially derivable from what it
already holds. Decide that plumbing deliberately; it is the part of this item that is not a one-line swap.

A single shared `matchesReliefTarget({ relief, repo, num, isLocal, repoCount })` keeps the four from
drifting; four inline comparisons is how this bug happens again.

**The bare form is documented, so the docs move with it.** `we:skills-src/drain/SKILL.md:275-282` presents
`--no-review-escalation=396,401` as the PREFERRED per-PR form with no repo qualifier, and
`we:skills-src/pr/SKILL.md:109` references the same relief. Tightening the bare form to the local repo turns
the documented example into a silent no-op for a sibling-repo PR — so both docs must gain the qualified form
in the same change.

`applyEscalationRelief` (`:206`) itself needs **no** change — it takes an already-decided `relieved` boolean
and owns only the never-waivable refusals (`review:human`, `review:changes`, `staleAcceptance`).

## Done when

1. **tier 1 — the wrong repo is not waived.** `we:scripts/__tests__/merge-ai-prs.test.mjs` pins the
   motivating case: with two PRs numbered 396 parked `review:pending` in one pass,
   `--no-review-escalation=frontierui#396` relieves the frontierui PR and leaves the web-everything PR
   parked. Fails before — today both are waived.
2. **tier 1 — the parse grammar.** The same file pins `parseNoReviewEscalation` over all three value forms
   (`owner/repo#396`, `repo#396`, `396`), the repeatable/comma-separated combinations already supported,
   and the unchanged `passWide` behaviour for a bare flag.
3. **tier 1 — the bare form is tightened to the local repo.** A unit case asserts a bare
   `--no-review-escalation=396` on a default multi-repo sweep relieves only the local/cwd repo's #396, and
   a matching case asserts a single-repo sweep (`--this-repo`) still relieves its one #396. This is the
   `matchesOnlyTarget` contract; assert the two predicates agree on the same inputs.
4. **tier 1 — the #2423 refusals still hold.** The existing `applyEscalationRelief` cases for
   `review:human`, `review:changes` and `staleAcceptance` still pass unchanged — a repo-qualified target
   never widens what is waivable, only narrows who it applies to.
5. **tier 1 — all four sites agree, proven behaviourally, not by grep.** A unit case per call site (or one
   table-driven case over all four) asserts each returns the same relief answer for the same
   `{relief, repo, num, isLocal, repoCount}` input. **A grep is not enough here**: the prep review ran
   a `grep -n` for `includes(Number(` over `we:scripts/merge-ai-prs.mjs` and it matches only three of
   the four sites — `we:scripts/merge-ai-prs.mjs:1098` writes `includes(num)` against a pre-converted
   variable and is invisible to it. Include `we:skills-src/drain/SKILL.md` and `we:skills-src/pr/SKILL.md`
   in the same change so the documented example matches the new behaviour, and keep
   `npm run skills:sync:check` green.

The commands that decide 1-5:

```
npx vitest run scripts/__tests__/merge-ai-prs.test.mjs
npm run skills:sync:check
```

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — Verified live: all four relief-comparison sites in we:scripts/merge-ai-prs.mjs (:1031 buildCarrierHealth, :1177 buildDrainVerdicts, :2757 the runCli reconcile, :3408 the runCli applyEscalationRelief call) compare a relief target by bare PR number with no repo field, so a same-numbered PR in any constellation repo is indistinguishable today — the bug the card targets is real, not hypothetical.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:skills-src/drain/SKILL.md and we:skills-src/pr/SKILL.md document `--no-review-escalation=<pr#>` (e.g. `=396,401`) as the preferred bare-number per-PR form with no repo qualifier. The card's design deliberately tightens the bare form to the local/cwd repo only; neither doc file is in the declared scope or the Done-when list, so an operator following the documented example for a sibling-repo PR will get a silent no-op (PR stays parked, no error) after this lands.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Only the tier-1 test clearly pins real behavior for the primary merge-decision path; the other three call sites' agreement with the new shared predicate is enforced only by the tier-2/5 grep, which I confirmed is already blind to one of the four sites on the live repo (see finding) — so there is no behavioral round-trip proof that all four sites actually agree.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Mutation/verification result: running the card's own tier-2 grep for `includes(Number(` over `we:scripts/merge-ai-prs.mjs` against the live, unmodified repo returns only 3 of the 4 relief-comparison sites (:1177, :2757, :3408) — never :1031 inside buildCarrierHealth, which expresses the identical bare-number check via a pre-converted `num` variable. The gate is already structurally unable to catch a left-behind unqualified check at that site; see blocking finding.
- **population** (addressed; strategy: name the population each threshold guards) — The card explicitly names and tests both populations the local/repoCount branch guards (multi-repo default sweep vs. single-repo --this-repo sweep), mirroring matchesOnlyTarget. I mutated matchesOnlyTarget's final `return !!isLocal;` branch to `return true;` and confirmed the named test at we:scripts/__tests__/merge-ai-prs.test.mjs:357-360 ("multi-repo default sweep, no --only-repo → disambiguate to the LOCAL repo only") reddens — the precedent being copied is a real, non-decorative guard.

**Corrections applied by this review:**

- The card's four call-site line citations are stale against the live repo: the actual locations in we:scripts/merge-ai-prs.mjs are :1031 (buildCarrierHealth, not :1098), :1177 (buildDrainVerdicts, not :1244), :2757 (the runCli label-on-green reconcile, not :2824), and :3408 (the runCli applyEscalationRelief call, not :3487).
- The claim 'each of these has the repo in hand ... so no plumbing is needed — only the predicate swap' is false for buildCarrierHealth (we:scripts/merge-ai-prs.mjs:1007-1032): neither its own signature nor its sole caller's forwarding at we:scripts/merge-ai-prs.mjs:1259 currently passes isLocalRepo/repoCount, so a genuine signature change is needed there, not just a predicate swap — and the openPrContext driving it spans the wider CONTEXT_REPOS set (per the #xc7p3q9 comment near :2671-2674), not the narrower REPOS sweep the repoCount/isLocal semantics are defined against, so the correct repoCount value isn't even trivially derivable from what buildCarrierHealth already receives.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

**Accepted and fixed above:**

- **consumer** — `we:skills-src/drain/SKILL.md` and `we:skills-src/pr/SKILL.md` document the bare per-PR
  form; both are now in `scope:` and in Done-when criterion 5.
- **decorative-guard / interface** — the grep criterion is genuinely blind to the
  `we:scripts/merge-ai-prs.mjs:1098` site (`includes(num)`, a pre-converted variable), exactly as the review
  found. Criterion 5 is now a behavioural tier-1 check across all four sites instead of a grep.
- The `buildCarrierHealth` plumbing correction is right and is now stated in *Design*: its signature and its
  caller both need changing, and `repoCount` is not derivable from what it already receives.

**Rejected, with reasoning — the line-number correction is wrong.** Re-verified against `origin/main` at the
revision the reviewer read: `we:scripts/merge-ai-prs.mjs:1074` is `buildCarrierHealth`, `:1098` its relief
comparison, `:1244` the `buildDrainVerdicts` one, `:2824` the `runCli` reconcile and `:3487` the
`applyEscalationRelief` call. The alternative set offered (:1031, :1177, :2757, :3408) lands on unrelated
lines — `:1031` is a doc-comment, `:3408` a bare `continue;`. The card's numbers stand. (Two independent
prep reviews of this same file reported a similar constant offset on the same day; the offset is in the
review tooling's view of the file, not in the card.)
