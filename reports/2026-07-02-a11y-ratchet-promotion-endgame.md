# Prep session report — #867 per-page rollout ratchet for the WE-docs FUI dogfood (2026-07-02)

Lane of the parallel `/prepare all` run. Brought #867 (reclassified story→decision on 2026-07-02) to
the Definition of Ready: research + authoring only, no ruling, no stamp (orchestrator centralizes
gate/stamp/release).

## What the prep did

1. **Standing test** over the item's reclassified (a)/(b)/(c) question, answered by **live
   measurement** rather than prose: ran the full a11y lane (`npm run test:a11y`, 39 scope-C routes)
   and inspected both repos' gate files.
2. **Prior-art survey** (ratchet policy is greenfield — no design existed): pa11y-ci threshold
   posture, the violation-level baseline pattern (trivago, microsoft/accessibility-insights-action,
   cfn-lint), and the strictness-migration invert-at-drain endgame. Published as
   `/research/a11y-ratchet-promotion-endgame/`
   (`we:src/_data/researchTopics/a11y-ratchet-promotion-endgame.json` +
   `we:src/_includes/research-descriptions/a11y-ratchet-promotion-endgame.njk`).
3. **Rewrote the item** to the prepared-fork shape: grounding digest, axis framing, glance table,
   two `## Fork N` sections with fork-existence lines, (a)/(b)/(c)/(d) options, bold defaults,
   code-level shapes, statute reconciliation vs #774.
4. **Skeptic pass** (foreground sub-agent, four attack axes) and **two-confusion screen** (separate
   fresh-context sub-agent) — verdicts recorded under each fork:
   - Fork 1: Skeptic SURVIVES-WITH-AMENDMENT — default (a) intact; landed attack was classification
     (reclassified genuine either/or → **forced invariant / settled-by-#774**: branch (b) merit-empty
     and #774's green-only rider already governs; G4 exposure removed). Screen: clear (broken branch
     verified broken on merit, not merely slower).
   - Fork 2: Skeptic SURVIVES-WITH-AMENDMENT — default (b) intact; five corrections folded in:
     supersession re-grounded as plain successor-ruling-on-changed-facts (dropped the "rider (ii)
     scoped to bootstrapping / carries no authority" narrowing; Q6 demoted to background — #774
     never explicitly cited it), cited the composing in-repo precedents (#840/#844/#477 warn-first→
     ERROR, fail-closed classifier), added a self-announcing drain trigger, added the post-flip
     sitemap-fetch hard-fail (the `we:tests/a11y/sitemap-routes.ts:96` fallback dies with the set),
     and named the scope-C sample-rotation consequence. Issue-949 citation verified live. Screen:
     clear (fail-open vs fail-closed survives cost-stripping; flip timing is a decidable trigger,
     not a prioritization branch).

## Key measured facts (the grounding)

- Scope-C derived set: **39 routes** (`we:tests/a11y/sitemap-routes.ts:49-67` over live
  `/sitemap.xml`).
- **5 of the 10 enforced routes FAIL today**: `/`, `/adapters/`, `/blocks/`, `/intents/`,
  `/protocols/` — all `[serious] color-contrast` (1–35 nodes) plus `nested-interactive` on `/`.
  All five are exactly the index templates converted to SSR `we-card` tiles (#2019 `fd632345` +
  siblings): **the dogfood conversions regressed the earned enforce posture** and the red lane went
  unnoticed until this measurement.
- Of the 29 warn-only routes, **26 are green** (promotable now); 3 red: `/semantics/`
  (`button-name`, `select-name`), `/web-contexts/` (`document-title`, `html-has-lang`),
  `/rules/backlog-workflow/` (`scrollable-region-focusable`).
- FUI mirror gate (#849) exists with an **empty** enforced seed
  (`fui:tests/a11y/sitemap-routes.ts:21`).
- Keystones #2016 (SSR render) / #2017 (manifest loader) resolved; #2018/#2019/#2020 resolved;
  detail-page sweep #2021 open (#2098 done, #2099–#2106 open).

## The prepared forks

| Fork | Default | Alternative | Confidence |
|---|---|---|---|
| Fork 1 — promotion coupling | **(a)** decoupled: promote any measured-green route now | (b) hold until FUI conversion lands | High |
| Fork 2 — ratchet endgame | **(b)** flip to enforce-by-default (explicit `WARN_ROUTES` exceptions) at the drained-and-green milestone | (a) perpetual warn-entry ratchet | Med-high |

Dissolved to *supported by default*: promotion mechanism (manual vs helper report), remediation
order, FUI-drain slicing. The (a)/(c) shapes of the reclassified question were answered by
measurement/statute: "essentially done" refuted; criteria already ratified (#774), order is
prioritization.

## Statute work

- **#774 overlap (per #1886):** Fork 2 (b) preserves #774's never-un-earn / explicit-set invariant
  and supersedes only its warn-only-entry rider, from the drain milestone onward, as a successor
  ruling.
- **Citation-scope (per #1932):** #774's "most-permissive default" citation (classification Q6)
  governs author-facing standard dimensions, not the repo's own CI gate posture — noted in the item
  so the rider carries no authority past the drain.

## Escalation surfaced (not part of the decision)

**The enforced a11y lane is red right now** (the 5 conversion regressions) under the
already-ratified posture — a fix item is fileable immediately, independent of #867's ratification.
Listed as Planned spin-off 1 in the item.
