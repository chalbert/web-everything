---
bornAs: xp0hefv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4501-ci-heal-treats-a-red-soak-replay-gate-as-red.md", "we:backlog/4503-soak-replay-gate-don-t-read-not-a-bug-fix-as-a-bug-fix.md"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2962's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4501-ci-heal-treats-a-red-soak-replay-gate-as-red.md:13` — A card-authoring lens or checklist: before naming a constant or function as the defect site, read its docblock and its callers and cite the classification path. A deterministic gate is not feasible for prose claims, so this stays a review-lens item.
2. `we:backlog/4503-soak-replay-gate-don-t-read-not-a-bug-fix-as-a-bug-fix.md:34` — Add a note to the backlog card template or the gate-authoring checklist: for any change that relaxes a gate classifier, the test plan must include an adversarial mixed-input case, meaning an exemption phrase next to a real trigger. If the card checks can be scripted, put this in a card lint under check:standards. Until then it is a review-lens item.
3. `we:backlog/4501-ci-heal-treats-a-red-soak-replay-gate-as-red.md:2` — A deterministic `check:standards` lint that parses all `backlog/*.md` frontmatter and asserts the presence of the `workItem` key with a valid enum value.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2962@ec79e6d8566906cc3ce71fccc3f5186927376c63

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
