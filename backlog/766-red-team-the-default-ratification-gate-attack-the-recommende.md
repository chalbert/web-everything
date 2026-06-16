---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Red-team-the-default ratification gate — attack the recommended branch before resolving a decision

The decision stress-test is strong on mechanics (tier/size/blockedBy, check:health, D3) but weak on principle: a prepared, '✓ ready to ratify' default gets a completeness skim, not an attack — the same agent preps and ratifies with one blind spot, and the stamp is an unverified self-assertion. #730's C1 default violated impl-is-not-a-standard yet passed every gate; a human caught it. Fix: a red-team-the-default pass on the ratification path — before resolving, the agent argues the OPPOSITE of its bold default and tries to name the principle it violates (attack fails → ratify, attack lands → amend), generalizing the #730 verify-grounding-claims bullet to the whole class.

## The gap (why the current gate misses this)

Three linked weaknesses, all on the **semantic/principle** side (the mechanical gates are solid):

1. **`✓ ready to ratify` is the strongest-sounding signal but the weakest-verified one** — it is just
   `preparedDate` being set, a self-assertion by whoever prepped, not an independent check. #730 had the
   stamp, a `relatedReport`, and concrete `file:line` refs and *still* shipped a default that put a running
   handler in the standards repo.
2. **Prep and ratify aren't adversarially separated** — the same session authors the bold default and then
   ratifies against it, with the same blind spot in both seats. "Prepared" actively primes a fast-confirm
   frame, the opposite of stress-testing.
3. **The fork-readiness / principle pre-flight (#607/#608) is a completeness skim, not an attack** — it
   checks "options stated, fork legible, stamp truthful," and applies the A–E catalog to *"is the item
   conformant,"* never forcing *"does the recommended default conform"* or *"try to break this branch."*

Tell: a human caught a violation every automated gate passed — the human-in-the-loop is silently doing
work the process claims to do.

## Proposed change — one forcing function, not more checklists

Add a **red-team-the-default** step to the ratification path in
[docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md) (the *Fork-readiness pass* /
*the ratification gate*, ~L224–290): **before** a decision is resolved, the deciding agent must

- **argue the opposite of its own bold default** — state the strongest case for the main alternative, and
- **try to name the guiding principle the default violates** — run the chosen branch (not the item) against
  the relevant principles (impl-is-not-a-standard, npm-scope-mirrors-layer, the A–E catalog), one line each.

Outcome rule: **attack fails → ratify; attack lands → amend the default, then re-attack.** This generalizes
the *verify-grounding-claims* bullet (added under #730 — verify cited precedents + contract-vs-impl
placement against the real tree) from a single instance to the whole class of "the confident default is
wrong in a way the mechanics can't see."

**Weight:** inline reasoning pass for every decision (cheap — one extra step); reserve a *separate-skeptic
sub-agent* (a throwaway agent prompted to refute) for **high-leverage forks** (wide-open, or high `gates`
count). Do **not** impose a heavyweight two-agent prep/decide split on every mechanical ratification.

## Scope / acceptance

- [ ] A `Red-team the default` subsection in `backlog-workflow.md`'s ratification path, cross-referenced
      from the *Fork-readiness pass* and *the ratification gate*, with the attack-fails/attack-lands rule.
- [ ] The decision-mode skill steps (`next-backlog-item` 0b/3a, `prepare-decision-item`) point at it so the
      pass runs at ratify time, not just prep time.
- [ ] States the inline-vs-sub-agent weighting (high-leverage → separate skeptic).
- [ ] `#730` cited as the worked example; `check:standards` green after the edit.

Lineage: extends the #607 retrospective audit + #608 forward principle-conformance gate (this is the
adversarial complement to their completeness skim) and the #730 *verify-grounding-claims* bullet. Pure
docs/process change — no code, no new dependency; agent-ready.
