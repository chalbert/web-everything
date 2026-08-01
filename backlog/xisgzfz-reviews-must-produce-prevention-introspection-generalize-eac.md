---
kind: story
size: 5
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: []
---

# Reviews must produce prevention introspection — generalize each finding to its class + propose the deterministic guard, and route durable ones

Extend the shared review core so every review that surfaces findings ALSO emits a mandatory prevention block per finding-class, at every severity, shaped `{ class, why-the-author-erred, gate-if-gateable, else process/memory fix, route }`. It fixes the ROOT CAUSE (a blameless "why did the author err?" chain, so it isn't reproduced) AND converts findings into deterministic gates — catch as many as possible with a `check:standards` rule / write-gate / lint before human review. Un-gateable classes still owe a process/memory fix (#9). Bias toward gating, flag recurrence as an owed gate, route durables to backlog / memory (#51).

## Why

When a review catches a defect, catching *this instance* is the cheap half. The expensive half — the half that stops the next ten instances of the same shape — is asking "what *class* is this, and what deterministic thing would have caught the whole class?" Today that second half is ad-hoc: it happens only when a reviewer happens to think of it.

The motivating instance is the review bounces on the provenance-hooks work (review rounds **PR #957 / PR #959**, landed via **PR #961**). Those reviewers did produce excellent prevention analysis — they generalized the failures and named the guards **by hand** — and that hand-work is exactly what let the hooks get filed as backlog **#2821** (the ratify-gate + provenance-hooks story). But it was hand-work. Nothing in the review contract *required* it. A less thorough reviewer on the next PR generalizes nothing, files no guard, and the class recurs.

This story makes that generation **automatic and non-optional**. Prevention introspection stops being a thing a good reviewer remembers and becomes a required output of *every* review that finds anything.

Note the trap this very story sits inside: the seed instruction cited the provenance work as "#957/#959/#961/#954". Those are **PR / review-round numbers**, not backlog `#NNN`. The backlog homes are **#2821** (the hooks) and **#2818** (transparency). Mixing the two id spaces — "provenance citation by the wrong id space" — is precisely the *class* of defect this feature is meant to generalize and guard. It is fitting that the story about generalizing findings is itself a finding of that class.

## Thesis — fix the cause, and convert findings into deterministic gates, aggressively

Prevention introspection is not reflection for its own sake. It pursues **two** ends per finding, at **every severity** (a blocker, a major, and a cosmetic nit all get the full treatment):

1. **Fix the cause, not the symptom.** Answer "**why did the author get this wrong?**" as a blameless "why" chain and address *that* — so the same author (agent or human) does not reproduce the class. Catching this instance is worthless if the authoring failure mode stays live.
2. **Convert to a deterministic gate where possible.** Catch as many findings as possible — nits included — with a `check:standards` rule / `PreToolUse` write-gate / lint BEFORE they reach human/independent review, so human review trends toward *only genuine-judgment issues*. The deterministic floor should **grow continuously from review findings**, not stay static.

Because not everything is gateable, each finding yields **two outputs**: a **gate** where the class is script-decidable, AND — for the judgment classes a gate can't catch — a **process / brief / memory fix** that addresses the author-failure-mode. A finding whose root cause is un-gateable still owes a named process/memory improvement.

- **All severities, not just nits.** Apply root-cause + both-outputs to the "closes the dodge" overclaim (a major) and the `#955` typo (a nit) alike. Do not scope the introspection to nits.
- **Every gateable finding is a gate candidate — bias toward YES.** However cosmetic, ask "could this have been a `check:standards` rule / write-gate / lint?" and lean toward yes. A nit is not "too small to gate" — it is the **cheapest, highest-volume** thing to gate, exactly the kind that should be pushed below the human waterline.
- **Recurrence is a defect in the gate set.** If a class was seen in a prior review and *recurs*, that is evidence a gate should already exist. Flag the recurrence and **escalate the guard from "proposed" to "owed"** — a recurring script-decidable class with no gate is a hole in the floor, not a fresh idea.
- **Even the "cosmetic" ones are gateable.** The nits that have slipped recently are all script-detectable, and each is a worked example of *nit → gate*:
  - a **stale merge-base hunk** in a PR diff (a chunk that isn't part of the intended change) → a diff-shape check.
  - a **YAML field that drifts from the shipped validator's schema** → schema-conformance in `check:standards`.
  - a **doc link whose target was renumbered** (`#955`→`#2819`) → a dead/stale-link check.
  - an **overclaiming comment that survives a rename** (says "the ONE X" after X moved) → a claim-vs-code lint.
- **A light metric.** Track the share of a review's findings that became (or could become) a deterministic check, and the **human-nit rate over time** — the signal that the floor is working is that share rising and the nit rate falling. Surface both through the transparency ledger (backlog #2818, PR #954).

## The change (concrete)

Extend the **shared review core** — `we:scripts/lib/review-core.mjs` (#2325), the one engine behind the drain auto-review, `/code-review`, the human `/review`, and the jury panel — so that whenever a review returns a non-empty findings set it ALSO returns a **`prevention`** analysis as a **required field on the verdict**. Because it lives in the shared core (in the mandate seeded by `buildMandate` / the panel mandate, and in the verdict/disposition contract every surface reduces to), **every review surface inherits it** — no individual reviewer, skill, or juror has to remember.

For each finding — or each clustered *class* of findings, at **every severity** (a blocker, a major, and a cosmetic nit all get the full treatment — do not scope this to nits) — the prevention block carries **five** things: `{ class, why-the-author-erred, gate-if-gateable, else process/memory fix, route }`.

1. **Generalize — name the class.** Not the instance. Not "this PR wrote a PR number as `#NNN`" but "provenance citation by the wrong id space". Then ask: *what other similar problems does this class cover?* (dead cross-links, `#955`→`#2819`-style stale renumbers, citing a lane branch as a backlog id, …).
2. **Root cause — why did the AUTHOR get this wrong?** Answer the authoring / process failure mode as a short **blameless "why" chain**, not "this is wrong" and never blame. It targets the *cause* so the same author (agent or human) does not reproduce the class. Worked example: *"referenced the item by its PR number because at authoring time it was an in-flight hash and the PR number was the salient number" → "the brief cited the story by PR, not backlog id" → "nothing forced item-id citation."* The fix in steps 3–4 must address **this** chain, not the symptom.
3. **Gate — if the class is script-decidable, propose the deterministic mechanism (bias toward YES).** Ask "could this class be a `check:standards` rule / `PreToolUse` write-gate / widened lint scope / validator lens?" and lean toward YES; a nit is the cheapest thing to gate, not too small to gate. Name the concrete mechanism. If the class **recurs** (seen in a prior review), the guard is not "proposed" but **owed** — a gate that should already exist. Maximize capture: the more findings a gate catches before human review, the better.
4. **Else the process / memory fix — because not everything is gateable.** For a class a gate *cannot* catch (genuine judgment), name the concrete **process or working-style fix that addresses the root cause from step 2** — a build-brief requirement (e.g. "briefs must cite items by backlog id"), a checklist item, or a working-style correction routed to agent memory (#9). Never "be more careful." A finding whose root cause is un-gateable **still owes** a named process/memory improvement — there is no "nothing to do here."
5. **Route.** A durable, script-decidable mechanism → a **proposed backlog item** (a hook to file); a **recurring** one → an *owed* hook, escalated. A process/working-style correction → **agent memory (#9)** or the relevant brief/checklist. These routes are surfaced as the review's *own output*, so the disposition / ledger carries them and they do not evaporate when the round ends.

The prevention block rides the existing verdict → disposition path (`deriveNegotiationOutcome` / `deriveReviewDisposition` / the panel-verdict reduction), so it is transported by the machinery that already exists rather than a parallel side-channel.

## Mandatory + inherited

- The requirement lives **once**, in the shared core / the mandate `buildMandate` (and `buildPanelMandate`) hands to reviewers, and in the verdict contract they reduce to.
- From that one place it covers **all four surfaces**: the drain auto-review subagent, `/code-review`, the human `/review`, and the **jury lenses** (each lens's findings get the same prevention treatment before `derivePanelVerdict` reduces them).
- Because it is a required field, a review that finds a script-decidable defect and proposes no guard is, by contract, **incomplete** — the missing prevention block is itself a defect the surface can flag.

## Composition (does not duplicate)

- It **composes with** the closing-session improvement-candidate flow and the **transparency ledger (backlog #2818, landed via PR #954)** — it does not replace them. The transparency item makes each pipeline step *visible*; this makes each finding *generalized-and-guarded*.
- The key difference is *timing and granularity*: this fires **at review time, on the actual findings, per-finding-class** — not at session close, and not once per session. Closing-session sweeps the session; this sweeps each defect the moment a review names it.
- The routed outputs (proposed hook / memory note) feed the same destinations those flows already own (the backlog for hooks, `we:MEMORY.md` for working-style), so there is one funnel, not two.

## Cross-references

- **#2325** — the shared review core this extends (the one engine; the single place to add the field).
- **#51** — hookable-vs-judgment: the rule that decides *guard* (script-decidable → hook) vs *working-style note* (judgment).
- **#2821** — the ratify-gate + provenance-hooks story: the first hooks this generation would have produced automatically (produced by hand on the PR #957/#959 bounces, landed via PR #961).
- **#2818** — per-step pipeline transparency (the ledger this composes with, not duplicates; landed via PR #954).
- **#2563 / #2439** — the review pipeline this rides (advisory care-level; hardened validator lens).

## Acceptance

- Every review that returns a non-empty findings set ALSO returns a **per-class `prevention` block** shaped `{ class, why-the-author-erred, gate-if-gateable, else process/memory fix, route }`: a generalization to the class + a **blameless root-cause "why" chain** (why the author erred) + a script-decidable **gate** where gateable + a **process/memory fix** where not + a route (proposed backlog hook, or agent-memory / brief correction).
- The treatment applies at **every severity** — a blocker, a major, and a nit each get the full block. It is not scoped to nits.
- Each finding yields **both** outputs where they apply: the deterministic **gate** (script-decidable classes) AND the **process/brief/memory fix** (judgment classes). A finding whose root cause is **un-gateable still owes** a named process/memory improvement — "note and move on" is not a valid disposition.
- The requirement is defined **once** in `we:scripts/lib/review-core.mjs` (mandate + verdict contract) and inherited by all four surfaces — drain auto-review, `/code-review`, `/review`, jury lenses — with no per-surface reviewer opt-in.
- A review that finds a **script-decidable** defect (nits included) and proposes **no** gate is treated as **incomplete** (the absent prevention block is a flaggable defect). The default disposition for a finding is "root cause + gate/fix," not "note and move on."
- A class that **recurs** across reviews and still has no gate is flagged as an **owed** guard (escalated past "proposed") — a hole in the deterministic floor, not a fresh idea.
- The four recent cosmetic classes — stale merge-base hunk, YAML-drift-from-validator-schema, renumbered dead link, overclaiming comment surviving a rename — are each named as *nit → gate* worked examples the mechanism should have caught.
- Routed outputs land in the existing funnels — proposed hooks to the backlog, working-style corrections to agent memory — carried by the disposition / ledger, not a parallel channel.
- The transparency ledger (backlog #2818, PR #954) surfaces the light metric: the share of a review's findings that became (or could become) a deterministic check, and the human-nit rate over time — the signal the floor is doing its job.
