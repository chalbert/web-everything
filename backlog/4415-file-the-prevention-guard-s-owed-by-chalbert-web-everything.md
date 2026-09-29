---
bornAs: x8ake8p
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4337-lease-reaper-branch-fallback-reject-lanes-with-unlanded-merg.md", "we:backlog/4315-a-confirmed-broken-impact-advisory-finding-must-not-be-ignor.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2836's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4337-lease-reaper-branch-fallback-reject-lanes-with-unlanded-merg.md:24` — Add deterministic fixture precondition assertions that the unique resolution exists on the lane and is absent upstream before checking containment.
2. `we:backlog/4315-a-confirmed-broken-impact-advisory-finding-must-not-be-ignor.md:2` — A frontmatter schema validator within `check:standards` that enforces the presence of `workItem` on all `backlog/*.md` files (which is exactly what the rescued card 4319 proposes to build).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2836@37cf210525ce939539419ae6e2b294d43f854906

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
