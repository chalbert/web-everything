---
bornAs: xh9yqt2
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/pr-land.mjs", "we:scripts/merge-ai-prs.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "2bfaad8764471712f05d22b82cad0fa116a609cb"
tags: []
---

# A worker PR that discloses a rule deviation parks for the operator automatically

Operator decision 2026-09-29 ~2:40 PM ET: a worker PR that discloses a rule deviation must not auto-merge. Two live cases already happened with no mechanical support for that rule: #2942 merged with a disclosed `WE_LAND_UNVERIFIED` override plus a local full-suite run, and #2945 merged with a soak-waiver instead of a real soak break — both landed on the worker's own say-so, with no forced human checkpoint. Nothing reads a body-level disclosure today: `Deviation` appears nowhere under `scripts/` or `skills-src/`, and `review:human` is only ever set by the escalation rubric (file/size/blast-radius signals), never by "this worker admitted it broke a rule."

## Premise check (2026-09-29, against main `2bfaad876`)

Still true. `grep -rn Deviation scripts skills-src` finds no handling; `git log --grep=Deviation:` finds no prior mechanism. The item's original guess — add a `human` target to `REVIEW_LABEL_TARGETS` in `we:scripts/review-set-label.mjs:187` — is the WRONG seam: that script only swaps labels on an already-decided verdict, and the park label is applied by the escalation rubric, not by a verb. The real seam is the rubric's `humanRequired` flag (below), so `we:scripts/review-set-label.mjs` is dropped from `scope:` and `clear-human` (`we:scripts/review-set-label.mjs:273`) stays the untouched way OUT.

## Design

The rubric already has one human-forcing input, `humanRequired`, produced by `scoreEscalation` (`we:scripts/lib/review-escalation.mjs:670`) and consumed by two callers that must agree:

- the producer, `resolveProducerReviewLabel` (`we:scripts/pr-land.mjs:584`, called at `:1022`) — decides the label at PR open; `humanRequired || roster.humanAlignmentRequired` → `review:human` (`:1032`);
- the drain, `we:scripts/merge-ai-prs.mjs` — calls `scoreEscalation` at `:4606`, feeds `score.humanRequired` into `decideReviewGate` (`:4877`), and on a `humanRequired` park writes the reason block into the PR body via `reconcileEscalationReasonBlock` (`:5006-5011`, `we:scripts/lib/review-escalation.mjs:2723`).

Mechanism: a new pure `parseDeviationDisclosure(body)` in `we:scripts/lib/review-escalation.mjs` returns the trimmed text of the FIRST-line `Deviation: <text>` (case-sensitive prefix, non-empty text; `null` otherwise — a `Deviation:` on any later line does not count, so quoted docs/examples cannot trigger it). `scoreEscalation` gains an optional `deviation` input; when non-null it sets `humanRequired = true`, pushes the reason `worker disclosed a rule deviation: <text>` (verbatim) and records `signals.deviation`. Because the text rides `score.reasons`, the existing #2324 body block and park comment quote it with no new comment path. `resolveProducerReviewLabel` gets the same optional input and both callers pass `parseDeviationDisclosure(body)` — `pr-land` from the body file it is opening with, the drain from `p.body` it already fetches (`we:scripts/merge-ai-prs.mjs:1563`, `:1609`). The two-caller symmetry matters: producer-only would let a later body edit slip past; drain-only would leave a window between open and first pass.

**Drain seam.** The scoring call at `we:scripts/merge-ai-prs.mjs:4606` no longer holds `p` (the code already stashes `v.bodyGraduatedTo = graduatedToFromBody(p.body)` early for exactly that reason, ~`:1563`). So stash `v.deviation = parseDeviationDisclosure(p.body)` beside it in `buildDrainVerdicts` and pass `v.deviation` to `scoreEscalation` at `:4606`. (The live-body fetch at `:5008` runs after the gate and only on an already-parked PR — not usable.) `pr-land` reads the body it is opening with (`BODY`, `--bodyFile`); its `humanRequired ||` line is `:1035`.

**Accept-bypass gap (review finding).** `decideReviewGate` (`we:scripts/lib/review-escalation.mjs:2801`) checks `review:accepted` FIRST and, on a fresh head, returns `merge` even when `humanRequired` is true; INVARIANT 2 lives in `we:scripts/review-set-label.mjs` and only refuses `--to=accepted` when `review:human` is already on the PR. So a PR already `review:pending`+accepted (or auto-accepted before the drain scores it), that then carries a `Deviation:` line, would still merge. The MVP therefore adds a gate rule: `decideReviewGate` takes `deviation`; if set, an `accepted` label counts only when a recorded human clearance exists (the existing `operatorClearance` input, `:2804`); otherwise re-park `review:human`. The builder must confirm `operatorClearance`'s semantics there before wiring; if it cannot express "human cleared", escalate rather than weaken. The operator's `clear-human` ceremony remains the only exit.

**Leniency.** The disclosure is the first NON-BLANK line (leading blank lines / BOM skipped), so a stray newline cannot silently disable the gate; still not any later line.

## MVP

Musts only:

- `parseDeviationDisclosure(body)` (first-line `Deviation: <text>` only).
- `scoreEscalation` + `resolveProducerReviewLabel` take `deviation`; non-null forces `humanRequired` with the verbatim reason.
- `decideReviewGate` deviation rule: an accept without a recorded human clearance does not merge a deviation PR (see Accept-bypass gap).
- The drain stashes `v.deviation` in `buildDrainVerdicts` and passes it at `:4606`.
- `we:scripts/pr-land.mjs` and `we:scripts/merge-ai-prs.mjs` pass the parsed value at their existing scoring call sites.
- `we:skills-src/conveyor/delivery-agent-brief.md`: tell workers to put `Deviation: <text>` as the PR body's first line whenever they take `WE_LAND_UNVERIFIED=1` (documented at `:425`), a soak/gate waiver, or disclose any other rule break.

OUT (Follow-ups): other disclosure shapes; operator-queue surfacing; any `we:scripts/review-set-label.mjs` verb.

## Test plan

Each case is RED before the fix because `scoreEscalation` / the parser take no body today (`parseDeviationDisclosure` is not exported → import fails; the score cases return `humanRequired:false`).

- `parseDeviationDisclosure`: first-line `Deviation: x` → `'x'`; same line on line 2, inside a fenced block, empty text, or lowercase `deviation:` → `null`; CRLF and trailing space trimmed.
- `scoreEscalation({deviation:'x', changedFiles:[a trivial doc]})` → `humanRequired:true`, reasons include the verbatim text, even with zero other signals; with `deviation:null` the score equals today's (regression guard for the ordinary path).
- `resolveProducerReviewLabel` with `deviation` → `label: review:human`.
- GUARD (already green on main, not RED): `decideReviewGate` with `humanRequired` and NO accept label → human park.
- RED: `decideReviewGate({deviation, labels:['review:accepted'], no operatorClearance, fresh head})` → re-park `review:human` (today: `merge`); with a recorded human clearance → `merge`.
- RED: drain wiring — a verdict built from a body starting `Deviation: x` yields a `parked` entry with `humanRequired:true` and the reason, and one built from an accepted+deviation PR does not merge.
- Parser: a leading blank line / BOM before the first-line `Deviation:` still parses.
- Fixtures reconstructed from #2942 (`Deviation: WE_LAND_UNVERIFIED override — full suite run locally`) and #2945 (`Deviation: soak waived — no real soak break`) bodies: both score `humanRequired` and both reasons carry the quoted text.
- Brief-conformance: the delivery-agent brief contains the `Deviation:` first-line instruction (existing brief/doc-lint test pattern, or a grep assertion).

## Proof plan

- Before: on main, pipe the #2942 and #2945 fixture bodies (from `gh pr view 2942/2945 --json body`, falling back to the reconstructed fixtures if the originals lack the line) through `resolveProducerReviewLabel` with a trivial changed-file set → `humanRequired:false`, no `review:human` (transcript captured).
- After: same call in the lane → `review:human` with the quoted deviation reason (transcript captured).
- Live surface: run the drain in dry-run (`we:scripts/merge-ai-prs.mjs` with `--dry-run --json`) (or the repo's existing dry-run drain probe) against a throwaway open PR / stubbed `gh` whose body starts `Deviation: proof` and show the JSON `parked` entry `humanRequired:true` with the reason — dry-run only, no label writes to real PRs.

## Follow-ups

- Other disclosure shapes (not just a first-line `Deviation:`), once the first-line form has soaked.
- Surface the deviation text in the operator-facing queue/board (`we:scripts/operations/operator-queue.mjs`), not only the PR body block.
- Optional: a `check:standards` lint that a `WE_LAND_UNVERIFIED` mention in a PR body without a `Deviation:` line is flagged.

## Done when

1. **Executable** — the new deviation cases fail before this item lands and pass after:

```bash
npx vitest run scripts/lib/__tests__/review-escalation.test.mjs -t "deviation"
```
