---
kind: decision
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/gate-config.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# Should the agent-behaviour rules that govern landing and review sit at the statute tier, not plain blast-radius?

#2909 registered the two agent-behaviour trees (`we:skills-src/`, `we:agent-memory-src/`, and both `.claude/` spellings) as **blast-radius**, which makes them **agent-clearable**. But some of those files are the operative rules a *reviewing agent* is itself governed by — the land bar, the review procedure — so an agent clearing a diff that loosens them is policing its own leash. The gate's **code** half is protected against exactly this (`isGateSelfPath('we:scripts/lib/review-escalation.mjs')` is `true` → `review:human`); its **prose** half is not. This decision is whether the governing subset moves up a tier.

## The measurement

Verified at PR #1048's head:

```js
scoreEscalation({ changedFiles: ['agent-memory-src/land-on-no-regression-not-perfection.md'], diffLines: 30 })
// → { escalate: true, humanRequired: false, careLevel: 'elevated' }  ⇒ review:pending
```

`review:pending` is the **agent-clearable** park. A converged agent verdict clears it — including a verdict produced by an agent running under the very rule the diff edits.

## Why it is a real hole and not a hypothetical

`we:agent-memory-src/land-on-no-regression-not-perfection.md` is the rule that defines the land bar. PR #1045 narrowed its test 3 ("no weakened gate") and merged **during its own review**; the panel returned `changes` on both mandatory lenses after the merge. #2909 fixed the *silent* case (no label at all). It did **not** decide who may clear the label. #2909 states the tier question is left open, and #2909 resolves in PR #1048 — so without this item the question leaves the backlog entirely at merge.

## Fork 1 — which clearance tier the *governing* subset of the agent-behaviour trees sits at

**Fork-existence justification:** case (b), a real either/or — a path resolves to exactly one clearance
(`review:pending`, agent-clearable, or `review:human`), and each option below assigns it a different one. The
branches cannot coexist on the same file, so this is not "support both".

- **(a) Leave it blast-radius (status quo).** Agent-clearable. Cheapest; keeps the conflict of interest for the governing subset.
- **(b) Add the governing subset to `isStatutePath`.** The land-bar rule and the review procedure become `review:human`. Needs a definition of "governing subset" that a script can evaluate — a named-file roster (like `we:scripts/lib/gate-config.mjs`'s policy-core roster) rather than a directory, or the whole memory corpus if a roster proves unmaintainable.
- **(c) Add them to the policy-core / gate-self roster instead (recommended default).** Same human clearance, but says "this is part of the trust chain" rather than "this is statute" — arguably the more honest classification, since the objection is conflict-of-interest, not governance ratification.
- **(d) A third clearance tier** — human-required only when the diff *loosens* the rule. *Rejected*: nobody has made "loosens" script-decidable, and a gate that needs judgment is not a gate. Re-open only if someone brings a decidable predicate.

**Bold default: (c)** — the failure mode is an agent policing its own leash, which is exactly what the policy-core tier already names, and the roster mechanism (named files, travels by basename) already exists.

*Not yet prepared:* no `preparedDate`, and this fork carries no `Skeptic:` / `Screen:` line yet — those are prep-time work (`/prepare`), owed before the stamp. Stated in `## Fork N` shape from the start so the prep-time gates (`check:health` G4/G5, the readiness fork-justification lint, the #1935 dangling-residue guard) have a heading to bite on rather than iterating an empty set.

## Done when

- The fork is ruled and the ruling codified (statute or `we:docs/agent/*.md`, per the resolve gate for a `kind: decision`).
- If the tier moves: the governing subset is a **named, versioned roster** — never a directory glob over the whole corpus — and `scoreEscalation` on `we:agent-memory-src/land-on-no-regression-not-perfection.md` returns `humanRequired: true`, pinned by a test.
- The `blast-radius` and `statute` token descriptions in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) reflect wherever the line lands.
