---
kind: epic
locus: frontierui
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
relatedReport: reports/2026-06-19-autonomous-exploratory-ui-testing.md
tags: [fui-devtool, exploratory-testing, autonomous-agent, judge, trainable, vision, epic]
---

# Fully trainable explorer judge — feedback becomes training signal, the judge learns (not more hand-coded oracles)

The explorer's Layer-3 **judge** (`fui:tools/explorer/oracles/advisoryJudge.ts` + `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts`, on-device Florence-2) is **inference-only and frozen** — it *describes* a state, never diagnoses, and nothing it sees updates it. So improving the explorer's *perception* today means hand-coding another deterministic **oracle** per issue — which doesn't scale to subjective/perceptual problems and is the explicit anti-goal ("not just adding scripts around the agent"). This epic makes the judge **trainable**: human feedback from the `improve-explorer` review loop becomes labeled training signal, and the judge improves on its own — so the next run catches what a human flagged without anyone writing a rule.

## Why an epic (not a story)

It spans: a **feedback-capture format** (label a finding/state: false-positive / missed / severity-wrong / looks-broken), a **training-signal store** (the labeled dataset — possibly seeded by #489's frame/verdict pairs), a **learning mechanism** (the real fork — below), an **eval** (does a trained judge beat the frozen one on held-out feedback?), and the **constellation boundary** (training/model may be WE/Plateau-side per the [no-leakage-client](docs/agent/platform-decisions.md#no-leakage-client) rule, #1073/#475; the explorer/FUI consumes outputs — `fui:tools/explorer/oracles/advisoryJudge.ts` `JudgeModel` is already the zero-lock-in seam for the swap).

## The architecture fork (a `type:decision` child — DO NOT pre-pick here)

1. **Exemplar / few-shot memory** — feedback becomes labeled examples the judge retrieves at inference; no weight updates. Cheapest, on-device-friendly, but "training" is shallow.
2. **Learned defect classifier** — feedback labels train a small model over state features (screenshot/DOM embeddings). Real training; needs a dataset + eval harness.
3. **Fine-tune the VLM** — heaviest; ~2 GB Florence-2, device-gated, hard to CI.

## Lineage (standalone epic; not a child — its ancestors are resolved)

- Grows out of the explorer engine epic **#1167** (resolved) and the advisory-judge seam **#1176** (resolved) + the Tier-2 VLM model **#1221** (resolved) — those shipped the *frozen* judge this epic makes *learning*.
- Sibling to **#1522** (Explorer CLI autonomy): #1522 is reach/coverage/output; #1552 is perception that improves.
- Possible dataset seed: **#489** (persist frame/verdict pairs).
- Driven by the `improve-explorer` skill's interactive feedback loop (`fui:.claude/skills/improve-explorer/SKILL.md`).

## First slices (to scaffold as children when picked up)

- A feedback-capture schema + the loop that emits it from a report review (the label vocabulary).
- The training-signal store / dataset format.
- The architecture decision (fork above).
- An eval: trained-vs-frozen judge on held-out human labels.
