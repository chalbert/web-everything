---
bornAs: xx7ipdw
kind: story
size: 5
parent: "3318"
status: open
dateOpened: "2026-08-26"
relatedTo: ["3319", "3314"]
scope:
  - we:scripts/review-core-cli.mjs
  - we:scripts/operations/review-pr.mjs
  - we:skills-src/review/SKILL.md
tags: [review, jury, operations]
---

# A review caller must derive its lenses from the PR's touch-set, before the run starts

PR #1580 changed the statute (`we:docs/agent/platform-decisions.md`) and was reviewed under `correctness` alone — the caller fixed the lens before reading what the PR touched. Score that same file list and the repo already answers care `high`: five lenses, two jurors, three rounds. One lens sat. The opposite end is as bad — PR #1569 round 2 sat `claim-accuracy`, an ADVISORY lens, so no mandatory lens judged a declarative-leash change at all. The caller must read the touch-set first and derive its shape from it; the operation must refuse a declared shape the PR contradicts.

## Why this matters

**`--lens` is one seat, and it is frozen before the PR is read.** `we:scripts/operations/review-pr.mjs:471`
declares `lens: { type: 'string', required: false, default: DEFAULT_LENS, enum: [...PANEL_LENSES] }` — one value
out of five, defaulting to `correctness`. The touch-set does not exist yet at that moment: `read` is step 1
(`we:scripts/operations/review-pr.mjs:548`) and it is what computes `netChangedFiles`
(`we:scripts/operations/review-pr.mjs:266`). Inputs cannot be revised afterwards either — `--resume` refuses
input flags on purpose (`we:scripts/operations/cli-adapter.mjs:338`). So whoever types the command line has
already decided how hard the review looks, using nothing.

**Both directions of the hole fired within one day, 2026-08-26.** Swept every PR from #1561 to #1589 for the
comment shape this operation emits (the `**Lens:** \`x\`` line): 26 PRs carry a recorded verdict, and **all 26
carry `correctness`**. Exactly one — #1569 — also carries a `claim-accuracy` verdict, its round 2 at 14:12.
`claim-accuracy` is in `ADVISORY_LENSES` (`we:scripts/lib/jury-core.mjs:698`), so that round ran with **zero**
mandatory lenses. #1569's touch-set includes `we:scripts/lib/review-policy.contract.json` — the declarative leash
(`isDeclarativeLeashPath`, `we:scripts/lib/review-escalation.mjs:333`). #1580's includes
`we:docs/agent/platform-decisions.md` — the statute (`isStatutePath`, `we:scripts/lib/review-escalation.mjs:76`).
Neither caller warned, in either direction.

**The derivation the caller skipped already exists, pure and importable.**
`scoreEscalation({ changedFiles })` (`we:scripts/lib/review-escalation.mjs:542`) turns a file list into
`{ reasons, signals, humanRequired, careLevel }`, and `panelRigorForCareLevel`
(`we:scripts/lib/jury-core.mjs:745`) turns the care-level into `{ rounds, lenses, jurorsPerLens }`. Run over the
same 26 PRs' `gh pr view --json files`: **11 score `none`, 10 `elevated`, 5 `high`** — the five being #1587,
#1583, #1580 (statute), #1571 (statute + leash) and #1569 (leash). Every one of the 26 sat one lens, one juror,
one round. For the five, the dial asks for 3 rounds × 5 lenses × 2 jurors. Nothing consults it.

**Correcting the brief this card came from, on one point.** The care dial does not produce "the mandatory pair
for code": at `low`, `elevated` and `high` alike it asks for the **whole five-lens set**, and only `rounds` and
`jurorsPerLens` change (`we:scripts/lib/jury-core.mjs:747`–`750`). `none` asks for **no panel at all**
(`lenses: []`). So for a ONE-SEAT operation the honest reading is two bands, not three: `none` → the floor lens
is proportionate; anything escalated → one seat cannot deliver what the dial asks, so the seat must go to a
`MANDATORY_LENSES` value (`we:scripts/lib/jury-core.mjs:694`) and the shortfall must be recorded rather than
implied away.

## What the caller must do

1. **Read the touch-set first.** `gh pr view <pr> --json files --jq '[.files[].path]'`, before the run command
   is composed — not the park comment's echo of it, which can lag the head.
2. **Derive, never re-taxonomize.** The shape comes from `scoreEscalation` + `panelRigorForCareLevel`, reached
   through a command rather than re-implemented in a skill's prose. `we:scripts/review-core-cli.mjs` already
   has the sibling — `rigor` (`:418`) takes `--reasons` and prints care-level + rigor. A files-shaped entry
   point belongs beside it, and must agree with `rigor` fed the same PR's `scoreEscalation().reasons`.
3. **Spend the seat on a mandatory lens whenever the PR escalates.** An advisory lens as the *only* lens is the
   #1569 hole; it must be a stated choice, never a default that nobody notices.
4. **Declare the derived shape to the operation, and let `read` check it.** This is the half that cannot be
   left to prose: the caller passes the care-level it derived, and `read` — which has just computed
   `netChangedFiles` — refuses the run when its own `scoreEscalation` over those files disagrees.
   `shapeReadFinding` already refuses this way for a mis-shaped net diff
   (`we:scripts/operations/review-pr.mjs:257`), so the mechanism is established, not invented here. This
   deliberately does **not** try to gate a *step* on the touch-set — see *Relates to* below for why that is
   structurally unavailable.

## The honest half — and what is already true

The brief for this card asked that a verdict "must not imply lenses that did not sit". **That half already
holds, and the card's job is to keep it and extend it, not to claim it as missing.** `renderVerdictWriteUp`
renders a one-row table (`lenses: [lens]`, `we:scripts/operations/review-pr.mjs:382`) under a comment that
states the rule — *"THE TABLE LISTS WHAT RAN, NOT WHAT EXISTS"*
(`we:scripts/operations/review-pr.mjs:375`) — and a footer naming the lenses that did not run
(`we:scripts/operations/review-pr.mjs:414`–`416`). PR #1580's live comment carries it verbatim: *"The other 4
panel lenses (security, simplicity, standards-conformance, claim-accuracy) did NOT run."*

What is missing is the other side of the same sentence: the write-up says what did not run, never that the PR
**earned** it. A reader of #1580 sees "4 lenses did not run" and cannot tell whether that was proportionate or
a `high`-care statute change that got one of the thirty juror-runs its dial asks for. So the write-up must also
name the derived care-level and the shortfall — what the touch-set earned, beside what sat. Both halves are
defended by criteria below, because the existing half is exactly the kind of true sentence a later edit
deletes by accident.

## Not in scope

- **Seating a second lens.** That is `#3319` (PR #1585, open) — a second declared `judge` step for
  `MANDATORY_LENSES[1]`. This card assumes nothing about how many seats exist; it fixes who chooses them and
  what the record says. When #3319 lands, the shortfall this card reports shrinks from four lenses to three
  and nothing else here changes.
- **Wiring the multi-lens panel.** `we:scripts/lib/judge-panel.mjs` is built and unwired (`#3050`, resolved),
  and wiring it today would make every seat tool-free — `#3158`, open.
- **Promoting `claim-accuracy` to mandatory.** `#3314`, open. This card must behave correctly whichever way
  that ruling goes: it reads `MANDATORY_LENSES` rather than naming lenses.
- **A conditional step.** Making a `judge` step *not run* on a docs-only PR is unavailable by construction;
  see below.

## Relates to

`#3319` is the structural fix **inside** the operation and this card is its **stated residual**. Its own
write-up records why: *"The step list is fixed at REGISTRATION, before any PR is read; the engine runs every
declared step at its cursor … An input cannot gate it either — an input changes what a step ASKS, never
whether it RUNS. So a docs-only PR pays for a security juror. Gating belongs to a caller that knows the
touch-set before it starts the run."* That is this item. The two do not overlap: #3319 adds a seat, this one
decides what goes in the seats that exist and what the verdict is allowed to claim about them.

## Done when

1. **Executable — the derivation is reachable from a file list.** A `we:scripts/review-core-cli.mjs` entry point takes a
   PR's changed-file list and prints `{ careLevel, reasons, humanRequired, earnedLenses, mandatoryFloor }`,
   composed from `scoreEscalation` + `panelRigorForCareLevel` with no second taxonomy. A named test asserts it
   over #1580's touch-set (`we:docs/agent/platform-decisions.md`) → `careLevel: 'high'`, `humanRequired: true`,
   `earnedLenses.length: 5`; and that its `careLevel` equals `rigor --reasons=<its own reasons>`'s.
2. **Executable — an escalated PR cannot be judged by an advisory lens alone.** A named test drives the
   declaration with a `high` declared shape and `lens: 'claim-accuracy'` and asserts the run refuses by name
   before any juror is requested. `node we:scripts/operations/run.mjs review-pr --help` (drop the `we:` prefix when actually running it) lists the new input.
3. **Executable — a declared shape the PR contradicts is refused at `read`.** A named test gives `read` a
   stubbed view whose `netChangedFiles` score `high` while the run's declared care-level says `none`, and
   asserts `shapeReadFinding` throws naming both values. This exercises the real `scoreEscalation`, not a
   double.
4. **Mutation.** Delete the shortfall line from `renderVerdictWriteUp` and a named test reddens; separately,
   delete the existing *"did NOT run and are not reported as unjudged"* footer
   (`we:scripts/operations/review-pr.mjs:414`) and a named test reddens. Both must be defended, and a test
   that stays green with either removed is itself a finding.
5. **Observable — the caller's documented flow starts with the touch-set.** `we:skills-src/review/SKILL.md`'s
   run block opens with the `gh pr view --json files` read and the shape command, and its `--lens=` paragraph
   (`:77`) states the two bands rather than leaving the choice to habit. `npm run check:standards` — 0 errors.
