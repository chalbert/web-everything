---
kind: decision
parent: "1552"
status: open
dateOpened: "2026-06-22"
tags: [judge, trainable, explorer]
---

# Trainable judge architecture — what the feedback signal is + the learning mechanism

The trainable-judge epic (#1552) needs its shape settled before any build: **what does a human's feedback on a real run become, and how does the judge learn from it?** Today the judge is frozen, describe-only (`fui:tools/explorer/oracles/advisoryJudge.ts` seam; `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts` Florence-2). Two coupled forks decide everything downstream (capture format, store, eval, on-device feasibility); Fork B follows from Fork A. **Not prepared — needs a grounded `/prepare` pass (on-device feasibility, constellation boundary #1073/#475, dataset seed #489) before ratification.** Defaults below are the author's lean, not a ruling.

## Fork A — what is the feedback signal?

What a human produces while reviewing a report (the `improve-explorer` loop).

- **Verdict on a candidate** — the judge proposes "this looks broken"; the human marks real / not-real / wrong-severity. Trains *precision*.
- **Missed-issue capture** — the human points at something the judge didn't flag; becomes a positive example. Trains *recall*.
- **Both** ⭐ *(author default)* — a judge that only learns from its own proposals can never learn what it is blind to; recall feedback is where the perceptual ceiling actually moves. Cost: the capture format must reference an element/region the judge didn't emit, not just a candidate id.

Open residual: does "missed-issue" need a stable element locator (selector/region box) the human picks, and how does that survive a re-run for eval? (Ties to `fui:tools/explorer/oracles/observation.ts` finding shape.)

## Fork B — the learning mechanism

- **Exemplar / few-shot memory** ⭐ *(author default to START)* — labels become examples the judge retrieves at inference; no weight updates. Cheapest, on-device, zero-lock-in, runnable now; the labeled data is also the seed dataset for the classifier below, so it is not throwaway. Shallow "learning" (pattern-match against stored cases) is the cost.
- **Learned defect classifier** — labels train a small model over screenshot/DOM embeddings. Real, measurable training; needs a dataset + eval harness; stays small and CI-able.
- **Fine-tune the VLM (Florence-2)** — highest ceiling, worst loop: ~2 GB, device-gated, un-CI-able.

Author lean: **exemplar-first, with the capture format designed as the classifier's seed dataset; escalate to a classifier on evidence (an eval showing memory plateaus); fine-tune only if a classifier plateaus.** "Start cheap, keep the data, escalate on evidence" — a sequence, not a permanent pick. Confidence: medium-high on starting at exemplar; medium on eventually needing the classifier (depends whether feedback is mostly "judge is wrong" → memory suffices, vs "judge can't see this class" → needs trained features).

## Decided

_Pending — ratify after `/prepare` (or an explicit discussion → go). Record the chosen Fork A signal + Fork B starting mechanism + escalation trigger; then `codifiedIn` a platform-decisions anchor and scaffold the build slices under #1552._
