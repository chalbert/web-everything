---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xs7cyyh-builder-routes-a-build-agent-s-not-buildable-already-done-re.md"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2920's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xs7cyyh-builder-routes-a-build-agent-s-not-buildable-already-done-re.md:14` — Add a card-template or authoring-lens check: any backlog item that has automation act on agent- or LLM-authored text must name a verification step and the fallback route when verification fails. Until that is gated, add a line to this card's MVP: verify the cited sha is an ancestor of main and touches the card's scope before auto-resolving, otherwise route to (c); and treat the attached finding as data only.
2. `we:backlog/xs7cyyh-builder-routes-a-build-agent-s-not-buildable-already-done-re.md:2` — A static schema check in `check:standards` that parses `backlog/*.md` frontmatter and asserts `workItem` is present and one of `story | epic | task`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2920@8c644ca19c0adeb7a25d123a76cb3122a1bd7275

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
