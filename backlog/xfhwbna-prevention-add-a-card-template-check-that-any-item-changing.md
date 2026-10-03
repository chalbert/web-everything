---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4682-prevention-keep-the-registry-keyed-model-as-the-configured-w.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a card-template check that any item changing a refusal or hold path states the fail-open versus fai… (from chalbert/web-everything#3630 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4682-prevention-keep-the-registry-keyed-model-as-the-configured-w.md:47` — Add a card-template check that any item changing a refusal or hold path states the fail-open versus fail-closed decision on error as a Must line. Until that gate exists, make this a review-lens checklist item.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3630@93b7557f58e7bea025516758509981fb89260f2a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
