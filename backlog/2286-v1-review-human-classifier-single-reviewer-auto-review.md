---
kind: story
size: 5
status: resolved
parent: "2285"
relatedTo: ["2171", "2262", "2162"]
tags: [lane, drain, review, merge-queue, agent, footgun]
dateOpened: "2026-07-04"
dateResolved: "2026-07-04"
---

# v1: `review:human` conflict-of-interest classifier + single-reviewer auto-review in `/drain`

First slice of #2285. Two parts — a deterministic classifier (script) and an agent ceremony (skill) — split
along the hookable-vs-judgment line: *which* PRs a human must review is script-decidable; the actual review is
judgment.

**Deterministic (`we:scripts/lib/review-escalation.mjs`):**
- Add `review:human` to `REVIEW_LABELS` — the conflict-of-interest tag; only a human may clear it.
- Add `GATE_SELF_PATHS` + `isGateSelfPath(path)` — the auto-review trust chain: `we:scripts/lib/review-escalation.mjs`
  (the gate rubric) and `we:scripts/merge-ai-prs.mjs` (the lander that reads the verdict labels and merges). ONLY
  these force a human; every other blast-radius path stays agent-reviewable.
- `scoreEscalation` returns `humanRequired` (any changed file ∈ `GATE_SELF_PATHS`); `coupleEscalation`
  propagates it (strictest member wins).
- `decideReviewGate` takes `humanRequired`: when set, park with `applyLabel: review:human` and **never** time
  out to `merge-anyway` (a human gate can only be cleared by a human). `review:accepted` still merges — that IS
  the human's verdict. Non-human escalations park with `review:pending` and keep the existing timeout.

**Agent ceremony (`we:scripts/merge-ai-prs.mjs` + the `/drain` skill):**
- `we:scripts/merge-ai-prs.mjs` applies `review:human` for the humanRequired case and emits an enriched `parked`
  set (`{ num, repo, humanRequired, reasons }`) so the skill can route.
- `/drain` SKILL gains an auto-review step: for each parked PR where `humanRequired === false`, spawn a
  fresh-context adversarial review subagent that sees ONLY the diff and returns `accept` | `changes` → apply
  `review:accepted` / `review:changes` → re-run the drain to land the accepted. **Never** auto-apply
  `review:accepted` to a `review:human` PR — surface those to the operator. No drain-side editing yet
  (that is v2). Preserves the #2285 invariant: a landed PR was accepted by a non-author.

**Provisioning:** `review:human` must exist as a GitHub label (like the other `review:*` — see #2262/#2279),
else the park's `--add-label` silently no-ops. Create it in the same idempotent step.

**Proof:** unit-test `isGateSelfPath`, `scoreEscalation.humanRequired`, `coupleEscalation` propagation, and
`decideReviewGate` (humanRequired → `review:human`, never `merge-anyway`; `review:accepted` still merges).
This slice touches the gate's own decision code, so its OWN PR lands as `review:human` — it dogfoods the gate.
