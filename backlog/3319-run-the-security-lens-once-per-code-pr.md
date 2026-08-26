---
bornAs: xn9c3mh
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Run the security lens once per code PR

Of the 92 replayed cases, 87 recorded a lens row and **86 of those 87 were `correctness`**. The security lens ran exactly once — #1457 r2 — and declared exactly **one** finding: the run-store / agent-listing seat-forgery hole at `we:scripts/operations/explore-io.mjs:165`. That single finding is the whole of the evidence that a second lens sees something the incumbent misses. One juror, parallel with correctness, on code PRs only, at roughly 29 cents per PR amortised. Size the decision against evidence of **one**, not more.

> **Retracted — this card's opening sentence was wrong on both halves, re-counted 2026-08-26 over `we:scripts/review-corpus/cases` (92 case files plus `we:scripts/review-corpus/cases/index.json`).**
> It read *"All 84 recorded verdicts ran correctness alone. Security ran once and found two real forgery holes in
> we:scripts/operations/explore-io.mjs, the only lens with evidence it sees something the incumbent misses."*
> **(a)** There is no population of 84 anywhere in the corpus — the parent card `3318` retracts the same figure.
> Measured: 92 cases, 87 record a lens row, 86 of those `correctness`. And "alone" is false: #1457 r2 is `security`.
> **(b)** The security lens declared **one** finding, not two. The second `we:scripts/operations/explore-io.mjs`
> hole — the Nunjucks raw-block injection in `renderResearchTopic` — is recorded in
> `we:scripts/review-corpus/cases/1457-r1.json` under lens `correctness`, so it was the incumbent lens's catch.
> Crediting it to security doubled the evidence for the very claim this card is built on.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
