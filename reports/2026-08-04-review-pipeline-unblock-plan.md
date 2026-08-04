# Review pipeline: unblock plan (2026-08-04)

**The goal is to get PRs moving again, not to improve the review method.** Every idea below is real, and every
one of them is a trap if worked now: each becomes an item, a lane, a PR, and a review — and the review queue is
the thing that is already stuck. This document exists so nothing is lost *and* nothing is started early.

## THE RULE while the pile is blocked

> **Open no PR that does not unblock an existing PR.**

An improvement is not an unblocker. PR #1031 is an unblocker (without it the converge loop cannot run at all). A
diff-budget hook is not, however obviously correct it is. Everything in *Parked design decisions* stays parked
until the trigger at the top of that section fires.

Corollary: a change that lands **unparked** costs nothing and may be made freely — PR #1029 and PR #1030 both
landed on their own within the hour, with no human touch, because they carried no `review:*` label. Backlog-only
and docs-only changes are effectively free. Trust-chain changes are not.

## Board state (2026-08-04)

| PR | state | blocked on | note |
| --- | --- | --- | --- |
| **#1031** | `review:pending` | **operator** | **critical path** — makes the converge loop launchable at all |
| #1017 | `review:pending` | operator | assistant-authored; cannot self-clear (#2439) |
| #1020 | `review:pending` | operator | assistant-authored; cannot self-clear (#2439) |
| #984 | `review:human` + `changes` | operator | gate-self; human-only by construction |
| #1012 | `review:changes` | its lane | round 4; carve R8 out per the operator ruling |
| #1018 | `review:changes` | its lane | converge-loop verdict posted, 7 findings |
| #1019, #1021, #1022, #1023, #1024 | `review:pending` | assistant | not assistant-authored → reviewable now |

## Critical path

1. **Land PR #1031.** One operator clear. Until then the converge loop lives only in a lane clone, the durable
   jury ledger stays empty, and the scheduled runner keeps escalating everything to a human — the exact loop
   that produced this backlog.
2. **Run the converge loop on the five non-assistant PRs** (#1019, #1021–#1024). Act on each verdict. This is
   the actual drain of the pile, and it needs no new machinery.
3. **Measure the false-positive rate** on a control PR before trusting the batch. This is the number the field
   treats as decisive: below ~10% findings get investigated; above ~30% they get triaged with suspicion; above
   50% they are dismissed by default. We do not know ours.
4. **Then** #2864 (ledger freshness, size 3) → **then** #2572 (the enforce flip + the converge-daemon rename).
   After that the pipeline routes itself and this document is obsolete.

## What blocked everything, for the record

[`we:scripts/workflows/review-parked-prs.mjs`](../scripts/workflows/review-parked-prs.mjs) built its
`meta.description` by string concatenation. The Workflow runtime requires `meta` to be a pure literal and rejects
the script at validation, before spawning anything. It has therefore been **unlaunchable since it was written** —
and the failure was silent in the only way that matters: it never ran, so it never produced a wrong answer. It
produced nothing.

Three layers inherited that nothing. The durable jury ledger (#2641, resolved) had no entries. The scheduled
runner (#2830) read an empty ledger and fail-closed every parked PR to a human — correctly, but
uninformatively. The operator hand-queued reviews for weeks, reasonably concluding the automation was unbuilt.

**One syntax constraint at the bottom surfaced as "we need to build an autonomous reviewer" at the top.** The
guard against recurrence is in PR #1031.

## Decisions already taken (do not re-litigate)

- **Name.** The shadow runner becomes the **converge daemon**, riding #2572. *Shadow* names its mode, not its
  job. *Review daemon* was rejected because it hides that the process pushes fixes to PR branches. Pairing:
  drain daemon writes to `main`; converge daemon writes to PR branches. Recorded on #2572 (landed, PR #1030).
- **Model tiering.** Mechanical agents (fetch/discover/labels/rigor/reduce/record) run on `haiku` at low effort —
  they shell one command and return a schema-validated shape. Panel jurors and the editor stay on the session
  model until measured. In PR #1031.
- **Rigor is derived, never hand-set.** Passing `careLevel` alongside `reasons` suppresses the dial. Both juries
  run on 2026-08-03 were hand-set to `high` and cost 30 agents each; the derived run cost 16 and did more.
- **Lens diversity is the axis that pays; jurors-per-lens is the axis that saturates.** Research: two
  heterogeneous agents match or exceed sixteen homogeneous ones. Keep four lenses at every band; drop the second
  juror.
- **Rounds are for convergence only.** In review-only use, rounds 2–3 judge the jury's own edits. Read round 1.
- **#2572 is blocked by #2864**, now in the DAG (PR #1030). The ledger carries no commit SHA, so a verdict
  written at head A folds to *clear* at head B — enforced, that clears a diff no juror saw.

## Parked design decisions

> **Trigger:** work none of these until the board shows **zero `review:pending` PRs** *and* #2572 has landed.
> Until then they are captured, not scheduled.

**1 — Mechanize the four authoring norms as one pre-PR check.** All four are script-decidable, and memory rule
51 / `#deterministic-core-thin-judgment` says script-decidable becomes a hook. The computation *already runs*:
[`we:scripts/pr-land.mjs`](../scripts/pr-land.mjs) calls `scoreEscalation` at label time and reports
"blast-radius (…); size (881 ≥ 400)" as a **verdict**. Run the same call one step earlier and print it as a
**choice** — *"3 of your 12 files trigger blast-radius; the other 9, 340 lines, would land unparked. Split?"*
The four checks:

- *Separability.* Which files trigger escalation, and what would the complement land as? Escalation is
  **contagious within a PR** — one trust-chain file drags everything bundled with it into the expensive tier.
- *Diff budget.* Warn at ~300 lines, below the 400 escalation threshold, while splitting is still free.
- *Contract before impl.* Detect an exported-signature change whose consumers are in the same diff.
- *Risk-tiered review.* Tier per file by escalation signal **plus the import graph** — a helper imported by a
  trust-chain file inherits its tier, or the risky change hides in the cheaply-reviewed file. Same four lenses
  everywhere; only the model scales. Default up when uncertain, and print the assignment so it is auditable.

*Evidence the norms cannot stay norms:* the assistant violated all four on 2026-08-03, within hours of arguing
for them — an 881-line PR from a size-3 story, a report-only CLI stapled to a merge-gate change, a
return-contract change buried in an implementation PR, and no glance at diff size. Not carelessness; it was
mutation-testing throughout. Norms do not survive contact with focus.

**2 — Consolidate command.** Cluster near-duplicate backlog items and propose merges. The algorithm already
exists and is tested: [`we:scripts/conveyor/learnings-dedup.mjs`](../scripts/conveyor/learnings-dedup.mjs)
(#2614) — same `kind` + normalised `area` + Jaccard on token sets, complete-link agglomeration — currently
pointed at the learnings drop-box. Its own header cites `#deterministic-core-thin-judgment`: reuse the core,
never re-derive it. Clustering is mechanical; *deciding* to merge is judgment. *Evidence of need:* `xn51la2`,
`xcyqiis`, `xgor579`, `x2ss0ma`, #2874 and `xtvn00y` are six separate items all saying "add a check:standards
rule for a review-integrity class" — six lanes, six reviews, six PRs for what is plausibly one rule pack.
`xtvn00y` was filed knowing it overlapped #2837.

**3 — Recurrence-triggered stop-the-line.** Extend the existing red-main dispatch freeze
([`we:scripts/readiness/red-main-remediation.mjs`](../scripts/readiness/red-main-remediation.mjs), #2681) from
"main is red" to "this defect class has recurred". First occurrence: fix and file. **Second occurrence: stop,
build the gate, run it against the blocked PR** — the blocked PR is the gate's test case, which is how you avoid
writing an unbuildable one like `xn51la2`. Needs an escape for expensive remediations (size ceiling, or explicit
override with the reason recorded) or a growing parked pile becomes a growing blocked pile. Recurrence is now
countable because the jury ledger persists findings. **Sequencing (operator): after auto-delivery works, not
before — andon needs a line that is moving.**

**4 — Continuous adversarial micro-review.** Not pairing: a *fresh* refuting agent per increment, different
model from the driver, that may never say "looks good" — only "here is what I cannot rule out". Pairing drags a
shared frame along, and by the end the navigator has endorsed every step and shares the driver's blind spots.
The value was never the pairing; it was the **immediacy**. Strip the shared context and it is continuous
micro-review, which keeps the benefit without the correlation or the false comfort. Its two questions are the
ones mutation testing structurally cannot answer: *is this branch reachable in production?* and *if this step
silently does nothing, does anything notice?* **Does not replace the fresh-context panel** — it reduces how much
the panel has to find.

**5 — Improvement loop: file → build.** Prevention items are filed diligently and built rarely. `xn51la2`,
`xcyqiis`, `xgor579` and `x2ss0ma` are unbuilt; #2874 was filed for the bare-`#NNN` class and that class bit
#2572 again on 2026-08-03. Give prevention items a claim on capacity, and let **recurrence** promote them — now
measurable from the ledger. Also missing: nothing feeds back what the *reviewers* get wrong (#1552 is the
placeholder).

## Open questions

- **False-positive rate — unmeasured.** Three runs, all on PRs that had genuine defects. Never run on a diff
  verified clean, so the rate that decides whether findings are trusted is unknown.
- **Convergence rate — zero so far.** Three runs, zero accepts. The loop has added findings and not yet saved a
  review. Arguably correct (it refused to clear bad code), but the payoff is still theoretical.
- **Auto-fix may be net-negative.** On PR #1018 the editor changed 15 files and the next panel faulted its
  repair three ways. Consistent with published findings that 45.1% of autonomously generated PRs need
  post-review fixes.
- **Seven findings were posted to PR #1018 on the panel's authority without independent verification.** Unlike
  PR #1017 and PR #1020, they were not reproduced. If some are wrong, that cost its author a cycle.

## Sources for the research claims

Agent scaling via diversity (arXiv 2602.03794) · single-agent vs multi-agent under equal thinking-token budgets
(Tran & Kiela) · 3,100 opinions on code review in an AI world (arXiv 2607.07980) · SWE-Review (arXiv 2607.06065)
· agentic refactoring, an empirical study (arXiv 2511.04824).
