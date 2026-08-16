---
kind: story
size: 5
parent: "142"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: #1635 has shipped and routing is in real use, AND the persona model carries capability/expertise (not just ownership), AND a real workload shows owner-only routing under-serving"
priority: low
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1635", "166", "564", "2095"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, ownership, task-queue, ai-generated, accepted-on-merit, dissolved]
---

# Capability-matched task queue

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — the capability-matched-queue delta is real and on-moat — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger (all three, AND):** (1) [#1635](/backlog/1635-ownership-aware-routing-in-context/) has shipped and its routing value is proven in real use, (2) the persona model carries capability/expertise (not just ownership), (3) a real workload shows owner-only routing under-serving. Parked `maturityGated` on this compound trigger — not a bare `blockedBy` edge, which would only encode condition (1) and let the readiness engine promote this to agent-ready the moment #1635 resolves even though (2) and (3) are still unmet. Everything below is retained as the **settled** merit rationale (the concession), not an open question.

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: open work is routed into each person's queue by **ownership + expertise + their current context** — not a flat backlog people self-assign from, and not a round-robin. It extends [#1635](/backlog/1635-ownership-aware-routing-in-context/) ownership routing from single-item hand-off into a standing, prioritised work feed: "the best-matched person, given what they own, what they're good at, and what they're already looking at."

**Recommended verdict: not-yet — accept the candidate as real, gate the build hard.** **Confidence: Medium.** The capability-match delta is genuine, but this sits two layers up the substrate (it needs #1635's owner resolution *and* an expertise/context model) and risks over-building ahead of demand — gate it on #1635 shipping plus proven routing value.

## What you're deciding

Does Web Everything commit to a **capability-matched task queue**, and on what trigger? Concretely it would route open work by three signals:

- **Ownership** — who owns the semantic node the work touches (resolved via [#1635](/backlog/1635-ownership-aware-routing-in-context/)).
- **Expertise / capability** — modeled skill or role from the persona roster, so the queue can prefer the *best-matched* owner among several.
- **Current context** — what the person is already working in, so related work clusters instead of fragmenting their attention.

…surfaced as a per-person queue in the dev browser, not a shared board people pull from.

## Why this isn't a classic fork (and is still a decision)

No contested either/or — no rival design where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop — still a `decision` card per the user directive, resolving to a **go / no / not-yet verdict**. The genuine tension is the **trigger and over-build risk**: a full match-engine is a lot of machinery to stand up before the simpler #1635 routing has even proven its worth.

## Context & prior art delta

The category is saturated — the delta is *semantic capability+context match vs assignment plumbing*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Jira / Linear assignment** | A queue of work assigned to people | Assignment is **manual or rule-by-field** (component field, label); no model of who's *best-matched* by capability + current context |
| **GitHub Projects boards** | Columns of work, optionally auto-added | Status/board automation; no skill or context matching, no semantic-ownership key |
| **Round-robin / load-balancer bots** (e.g. review-assignment bots) | Auto-distributes work to a pool | Balances by *fairness/count*, deliberately ignoring fit; the opposite of capability-matching |
| **PagerDuty escalation** | Routes to an on-call person by schedule | Schedule-keyed, not capability-or-context-keyed; infra-incident-shaped, not dev-task-shaped |

The moat (per #142): a WE app knows **who owns each semantic piece and (via the persona model) what they're capable of**, so the queue matches on *meaning* — capability against the actual nodes the work touches — which assignment tools can't, because their "match" is a field value or a round-robin counter.

## Dependencies & lineage

- **Extends [#1635](/backlog/1635-ownership-aware-routing-in-context/)** (ownership-aware routing) — that card resolves the owner of a node; this card turns single hand-offs into a standing, prioritised, capability-ranked queue. #1635 is the prerequisite layer.
- **Needs an expertise/context model.** Beyond ownership, the match needs modeled capability — sourced from the persona roster ([#166](/backlog/166-governance-persona-roster-charter-schema/)) / personas-first-class ([#564](/backlog/564-personas-as-a-first-class-agile-concept/)) — plus a notion of "current context." Both existing is the trigger.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** Real and on-moat, but it's the most-derived feature in the ownership thread — gate it hard so it doesn't get built ahead of the simpler routing it stands on.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** [#1635](/backlog/1635-ownership-aware-routing-in-context/) has shipped and routing is in real use, **AND (2)** the persona model carries capability/expertise (not just ownership), **AND (3)** a real workload shows owner-only routing under-serving (e.g. several valid owners, no way to pick the best-matched). All three, because the cost of the match-engine only pays off past simple routing.
- **Skeptic:** "Linear/Jira already auto-assign and Projects auto-route — a queue is solved." *Refuted on the delta, not on novelty:* their "match" is a field rule or round-robin, which by design ignores *fit*; WE matches on semantic capability against the actual owned nodes — a thing they can't do without the self-describing ownership+persona model. The residual the skeptic is right about is **over-build risk** — this is the deepest feature in the thread — hence not-yet with a hard three-part gate, not go.

*~~If you'd rather decide go now or no (drop it), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*

## Independent review — 2026-08-14 (finding confirmed and fixed — 2026-08-16 update)

Confidence: **Medium**

**Update (2026-08-16):** the `decorative-guard` finding this review recorded below has been independently reproduced and is now **fixed** on `main`, via commit `33431e2a` ("we: #1637 fix maturity gate — blockedBy only encoded 1 of 3 stated conditions", landed through PR #1300, which credits this review's finding). At the time this review ran (2026-08-14), the frontmatter carried `status: open` / `blockedBy: ["1635"]` and the banner's parenthetical read `(blockedBy: 1635)` — exactly what the finding below quotes. Neither is true of the card any more: the frontmatter above now reads `status: parked` / `parkedReason: maturityGated` / a full three-part `maturityTrigger`, and the banner states the compound AND-trigger explicitly instead of the bare `blockedBy` edge. Everything below this line is kept as the historical record of the finding at review time — read every present-tense frontmatter quote as "as of 2026-08-14," not current.

**Risks assessed** (per we:backlog/3103-*.md's taxonomy, as of 2026-08-14):

- **decorative-guard** (confirmed at review time; **fixed 2026-08-16**, see update above) — The card's own Recommendation section stated a three-part AND-gated un-gate trigger: (1) #1635 shipped and routing proven, (2) the persona model carries capability/expertise not just ownership, (3) a real workload shows owner-only routing under-serving. Frontmatter at the time encoded only condition (1), via `blockedBy: ["1635"]`; conditions (2) and (3) existed nowhere machine-readable. we:src/_data/backlog.js's `deriveTier` promotes any `status: open` item to Tier A the instant its `blockedBy` list clears, with no check of prose-only conditions; we:scripts/readiness/engine.mjs confirmed 'every prerequisite cleared -> the loader put this at tier A.' Contrast with siblings dissolved by the same #2095 batch that also have compound/non-single-item triggers — #1635 itself, #1638, #1639, #1641, #1646, #1649, #1931 — all of which used `status: parked` + `parkedReason: maturityGated` + a typed `maturityTrigger` (gated by we:scripts/check-standards-rules.mjs, `MATURITY_TRIGGER_RE`) precisely so the item stays off Tier A until the untracked condition is independently verified. #1637 used `status: open` instead, so once #1635 resolved the guard that looked like it enforced the card's full gate in fact enforced only 1 of 3 conditions. Mutation probe (at review time): flipping #1635's `status` to `resolved` would have flipped #1637 to Tier A with no code path checking conditions (2)/(3); no test asserted that a `blockedBy`-only gate must cover every AND-condition stated in the card body. **This gap is now closed**: commit `33431e2a` replaced the bare `blockedBy` edge with `status: parked` + a typed `maturityTrigger` covering all three AND-conditions — we:src/_data/backlog.js's `deriveTier` only promotes `status: open` items, so a `parked` item is excluded from Tier A entirely, not merely gated on a partial condition.
- **legibility** (NOT addressed at review time; **improved as a side effect of the same 2026-08-16 fix**) — At review time, #1635 resolving would have made #1637 present as ordinary readiness signal (a green 'agent-ready' tile), not as an error or a flagged partial gate. Since the fix, `status: parked` + `parkedReason: maturityGated` renders a distinct badge (we:src/_includes/backlog-badges.njk: tone `warning`, icon `⏸`, labelled from `parkedReasonMeta`) instead of a plain agent-ready tile, so the compound, still-unmet gate is now visually distinguishable — this was not a change this review made or verified in detail, only an observed consequence of the same commit worth noting for anyone re-checking the legibility risk.
- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — Spot-checked the card's load-bearing citations against the live repo at review time: we:backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v.md's verdict table row for 1637 ('DISSOLVE | conceded ... gate it hard; residue = over-build ordering vs routing | #1635 shipped + proven routing value') matched the card's banner; we:backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization.md's dissolve doctrine and #1637's own concession language ('real and on-moat ... gate it hard') matched the ruling it claims to apply; we:backlog/1635-ownership-aware-routing-in-context.md was confirmed `status: parked` (not yet shipped), consistent with #1637 remaining blocked; frontmatter fields (kind, size, tags, locus) all matched the card body's own description — `blockedBy` did too, at the time, though that field has since been removed by the 2026-08-16 fix along with the gap it caused. No stale citation or reverted premise was found.

**Corrections applied by this review (2026-08-14) — superseded by the actual fix (2026-08-16):**

- The DISSOLVED banner's parenthetical '(blockedBy: 1635)' overstated what the frontmatter actually captured: the Recommendation section's real un-gate trigger is a three-part AND (#1635 shipped-and-proven, persona model carries capability, demonstrated under-serving), but only the first part was a mechanically-checked edge at the time — this review's own note said the banner should not imply blockedBy alone represents the full gate. Commit `33431e2a` went further than this note asked: rather than just softening the parenthetical, it replaced the gate mechanism itself (`blockedBy`/`status: open` → `parkedReason: maturityGated`/`maturityTrigger`) and rewrote the banner's trigger prose to state the compound AND-condition directly, which is what the card above now shows.

The card accurately narrated its own dissolve lineage at review time (we:backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v.md and we:backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization.md both verified verbatim), but its frontmatter then encoded only one of its own stated three-part un-gate trigger, so the readiness engine could have silently promoted it to agent-ready the moment #1635 resolved even though two of the three required conditions were unmet and untracked. That finding was independently confirmed and is now resolved: see the 2026-08-16 update above.

_Recorded through the declared `review-prep` operation. Confirmed-fixed update recorded following PR #1270 review feedback (`stale-review-content`)._
