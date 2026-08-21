---
bornAs: xubksgo
kind: story
size: 2
parent: "3054"
status: open
dateOpened: "2026-08-10"
tags: [gate, review, drain, review-escalation, fingerprint, evidence]
scope:
  - we:scripts/measure-contribution-digest.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md
  - we:backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio.md
---

# The digest repair's corpus figures ship without the script that produced them

PR #1158 warrants a deliberate fail-open widening with three corpus figures (16 stamped accept→head pairs, 201
machine-replayed rebases, 181 genuine changes) that no committed script reproduces — the exact defect
[#3028](/backlog/3028-judge-helper-the-tool-free-juror-spawn-behind-one-function/) already refused twice.
Commit the generator, or the numbers stay uncitable.

**The numbers are probably right. They are currently uncitable.** This item is not a challenge to the result —
an independent review of #1158 checked the one thing it could check by hand and found it sound. It is a
challenge to the *record*: a figure nobody can re-derive is not evidence, and this repo has already said so
twice, in writing, about smaller stakes than these.

## What is claimed, and where

#1158 (`lane/3054-digest`, closing #3046 and #3052 under epic
[#3054](/backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c/)) reports three corpora:

| corpus | n | before | after |
| --- | --- | --- | --- |
| stamped accept→head pairs from recent history, each self-certified against its own marker | 16 | 2 false stales | 0 |
| machine-replayed content-preserving rebases (`git merge-tree` onto 4 bases, 80 merged PRs) | 201 | 3 false stales | 0 |
| genuine contribution changes (consecutive commits on a PR branch, same base) | 181 | 181/181 detected | 181/181 |

They are not confined to the pull-request description. The 16/201/181 figures are written into the **cards** as
well — `#3054`'s *DIGEST REPAIRED* banner and `#3046`'s resolution banner both carry them (there, the two
false-stale counts are summed as "5 false stales before, **0** after"). So they outlive the PR and become the
standing account of why the widening was affordable.

## What is missing

#1158's diff is **eight files** — four backlog cards,
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs),
[we:scripts/lib/verdict-ledger.mjs](scripts/lib/verdict-ledger.mjs), and their two test files. **No generation
script.** Nothing in the change selects the 16 pairs, replays the 201 rebases, or enumerates the 181 genuine
changes; nothing records the conditions (which repo, which commit range, which four bases, which 80 PRs, when).

**And there is a THIRD home for the figures, missed by this card's own first audit** (found by the independent
review, 2026-08-21): [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) — one of the
eight diffed files — repeats them bare in `normalizeContributionFingerprint`'s *THE RESIDUAL* docblock ("16
pairs … plus 201 machine-replayed content-preserving rebases onto four different bases — the first cut diverged
on 5, this digest on 0"). That occurrence outranks the two card banners in durability: it is the code's own
standing warrant for the widening, sitting beside the function it justifies.
The independent review could regenerate none of the three and marked all three unverified.

What *is* independently checkable is the adversarial case embedded in the suite — the `RIDE_IN` fixture in
[we:scripts/lib/__tests__/review-escalation.test.mjs](scripts/lib/__tests__/review-escalation.test.mjs), which
pins that a line appended to an otherwise-rebased diff still fails coverage. That one holds. It is one case,
and it is not the corpus.

## Why this is a repeat, not a nitpick

[#3028](/backlog/3028-judge-helper-the-tool-free-juror-spawn-behind-one-function/) (resolved 2026-08-09) ruled
on this exact shape and used almost these words:

> **The measurement lands with the helper, or not at all.** A committed script — argv in, loaded-context and
> wall clock out — that anyone can re-run, plus its recorded conditions (cwd, model, prompt). Until that exists
> no number is carried.

Two earlier figures on that item **were withdrawn** for lacking precisely this, and the card says why: "neither
recorded its conditions". What replaced them was
[we:scripts/measure-judge-spawn.mjs](scripts/measure-judge-spawn.mjs) plus a conditions block naming cwd,
`git HEAD`, CLI version, model, effort, sample count, OS, node version, date and spend — and the explicit
instruction to *re-run the script rather than quote the row*.

The same posture is already statute.
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) declines to carry an over-flag
percentage for the quote-aware splitter for one stated reason: "*No over-flag percentage is carried here:* the
ratio moves with the token list used and no committed script reproduces it." It keeps the **direction** and
drops the **number**.

#3054's figures cannot take that escape hatch, because there the number *is* the argument. They are the warrant
for accepting a **deliberate fail-open widening** — `#3021`'s false-honour class was knowingly made wider, and
the case for paying that price is "in production the dropped signals fired on the base 2 times out of 2 while
catching a real relocation 0 times out of 0." Strip the corpus and that sentence has nothing under it.

## What done looks like

- A committed script — argv in, counts out; `we:scripts/measure-contribution-digest.mjs` is the natural home —
  that rebuilds all three corpora from real git history. It is derived data, not a hand-curated sample, so it
  should be re-derivable by construction.
- Run it against the **pre-fix** and **post-fix** projection, printing both columns, so the before/after is a
  script output rather than a claim.
- A conditions block beside the table, in `#3028`'s shape: repo, commit range or `git HEAD`, the four bases,
  the PR set, node/OS, date.
- Then either the existing card figures are re-stamped as that script's recorded run (marked a sample, not a
  constant), or they come out of the cards the way the platform-decisions anchor handles it — direction kept,
  number dropped.

## What this item is not

It does **not** re-open the digest repair, ask for the widening to be reversed, or claim any figure is wrong.
The repair's own falsifiable content — the two incidents replaying to matching digests, THE
INDISTINGUISHABILITY reproduced from real `git diff` output, the run-shape refusal — is in the unit suite and
is checkable today. Only the corpus is not.

Related: [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) (the class the
figures were spent to widen), `#3046`, `#3052`.

## Design

**Model it on the script #3028 already ratified.** [we:scripts/measure-judge-spawn.mjs](scripts/measure-judge-spawn.mjs)
is the shape this repo accepted as sufficient: argv in, numbers out, a `conditions({ … })` block emitted
beside every figure (`measuredAtUtc`, `cwd`, `gitHead`, `gitBranch`, `node`, `os`, `host`, plus the run-shape
knobs), a `--json` mode, and a closing line telling the reader to re-run rather than quote the row. Copy that
skeleton; only the measurement body differs.

**What the new script measures.** The three corpora are all derivable from real git + `gh` history, and the
predicates under test are already pure and exported:

- `acceptanceCoversHead({ acceptedSha, headSha, acceptedDiff, headDiff, acceptedContribution, headContribution })`
  in [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) — the stale/covered verdict.
- `normalizeDiffFingerprint` / `normalizeContributionFingerprint` (same module) — the two fingerprints.
- `ledgerCoversHead` in [we:scripts/lib/verdict-ledger.mjs](scripts/lib/verdict-ledger.mjs) — the ledger-side
  equivalent, if the projection is taken there too.

So the script is a **gatherer plus a two-column replay**: build each corpus from history, then run every case
through the predicate twice — once under the PRE-fix projection, once under the POST-fix one — and print both
columns. The pre-fix column must come from the same committed code, selected by a flag
(`--projection=pre|post|both`), never from a hand-typed remembered number.

**Corpus definitions, spelled out so the counts are reproducible:**

| corpus | how the script builds it |
| --- | --- |
| stamped accept→head pairs | scan recent PRs for a `reviewed-sha`/`reviewed-diff`/`reviewed-contribution` marker set, pair each with that PR's head at the time, replay the predicate |
| machine-replayed content-preserving rebases | for each of N merged PRs, `git merge-tree` its head onto K enumerated bases; each result is a content-preserving move that MUST read as covered |
| genuine contribution changes | consecutive commits on one PR branch against the same base; each MUST read as a real change |

`--prs=`, `--bases=`, `--limit=` are flags, and their resolved values go **into** the conditions block, so
"which 80 PRs, which four bases" is recorded rather than remembered. The script is derived data by
construction — no hand-curated sample list checked into the repo.

**Then reconcile the cards.** The 16/201/181 figures live in three places today: PR #1158's description,
#3054's *DIGEST REPAIRED* banner, and #3046's resolution banner (where the two false-stale counts are summed as
"5 false stales before, 0 after"). Each either becomes a stamped sample of a recorded run, or takes the
`we:docs/agent/platform-decisions.md` escape — keep the direction, drop the number. Do **not** leave one card
stamped and another quoting a bare figure.

## Done when

1. **Executable** — `node` on we:scripts/measure-contribution-digest.mjs with `--json` runs from a clean checkout and emits
   `{ conditions, corpora, summary }`, where `corpora` carries all three corpora with a `pre` and a `post`
   column each. Fails today: the file does not exist.
2. **Observable** — the emitted `conditions` block names, at minimum, `measuredAtUtc`, `cwd`, `gitHead`,
   `gitBranch`, the resolved PR set / commit range, the enumerated bases, `node`, `os` and `host` — the same
   field set [we:scripts/measure-judge-spawn.mjs](scripts/measure-judge-spawn.mjs) prints. One `grep` over the
   JSON output confirms each key is present and non-empty.
3. **Executable** — `npx vitest run measure-contribution-digest` is green: a unit test drives the script's
   pure corpus-building and replay helpers off a fixture history (no network), asserting the pre-column detects
   the false stales the post-column does not, and that the genuine-change corpus is detected in BOTH columns.
   This is what makes the before/after a script output rather than a claim.
4. **Observable** — no bare `16` / `201` / `181` / `5 false stales` figure survives uncited, across **three**
   homes, not two: `we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md`,
   `we:backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio.md`, **and** the
   `normalizeContributionFingerprint` residual docblock in
   [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) (its *THE RESIDUAL* block reads
   "16 pairs … plus 201 machine-replayed content-preserving rebases onto four different bases — the first cut
   diverged on 5, this digest on 0"). Each occurrence is either re-stamped as *"sample from `<script> --json`,
   conditions `<gitHead>`, `<date>`"* or replaced by the direction alone. One `grep` for those numerals across
   all three files shows every hit adjacent to a conditions cite. **The docblock is the one that matters most
   of the three** — it is the code's own standing justification for the widening, read by every future
   maintainer of that function.
5. **Executable** — `npm run check:standards` reports 0 errors.

*(Scope note: this item does NOT re-open the digest repair, reverse the widening, or claim any figure is
wrong — see "What this item is not" above. The `RIDE_IN` fixture in
[we:scripts/lib/__tests__/review-escalation.test.mjs](scripts/lib/__tests__/review-escalation.test.mjs) stays
as-is; it is one adversarial case and is already checkable.)*

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — Verified against the live repo: we:scripts/measure-contribution-digest.mjs does not exist (glob returns nothing), and the exact bare figures ('16 stamp-certified accept→head pairs', '201 machine-replayed…', '5 false stales before, 0 after') are present verbatim, once each, in we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md and we:backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio.md exactly as the card describes.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The declared scope and 'Done when' #4's grep cover only the two backlog cards, but the identical figures ('16 pairs', '201 machine-replayed content-preserving rebases onto four different bases', 'diverged on 5, this digest on 0') also live uncited in a docblock in we:scripts/lib/review-escalation.mjs (lines 1058-1064) — a file the card itself names as part of PR #1158's diff without noticing it also carries the bare corpus figures.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The predicate signatures the design cites match the live repo exactly: acceptanceCoversHead({acceptedSha, headSha, acceptedDiff, headDiff, acceptedContribution, headContribution}) at we:scripts/lib/review-escalation.mjs:1379 and ledgerCoversHead({record, headSha, headDiff, headContribution}) at we:scripts/lib/verdict-ledger.mjs:493, the latter delegating to the former exactly as described.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — 'Done when' #3's unit-test requirement asserts a real behavioural split (pre-column detects false stales the post-column does not, genuine-change corpus detected in both) rather than a satisfiable-on-anything presence check.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The design requires the re-run's actual output — not the old 16/201/181 — to be what gets stamped into the cards, so a re-derived corpus that disagrees with the original figures surfaces as a different number rather than being silently preserved.

**Corrections applied by this review:**

- The card's 'What is missing' section lists we:scripts/lib/review-escalation.mjs as one of PR #1158's eight diffed files but does not note that this same file's docblock (lines 1058-1064) independently repeats the uncited 16/201/181/'diverged on 5, this digest on 0' figures — a third occurrence the card's own audit missed.

The design is well-grounded — the missing script, the two bare-figure card banners, and the cited function signatures all check out against the live repo — but the card's own enumeration of PR #1158's diff names we:scripts/lib/review-escalation.mjs while missing that this same file's docblock (lines 1058-1064) repeats the identical uncited 16/201/181/5-false-stales figures, and neither the declared scope nor "Done when" #4's grep reaches it.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** The finding is correct and is now fixed in the body and in `scope:`. The
16/201/5 figures really do have a THIRD uncited home — `normalizeContributionFingerprint`'s *THE RESIDUAL*
docblock in we:scripts/lib/review-escalation.mjs, verified in the live file — which neither the original
audit nor `## Done when` item 4's grep reached. That occurrence is now named in *What is missing*, added to
`## Done when` item 4 (three files, not two), and we:scripts/lib/review-escalation.mjs is added to the
declared scope so the dispatcher sees the real touch-set. No finding was judged wrong.

