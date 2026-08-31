---
kind: story
size: 5
parent: "3279"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:skills-src/review/review-agent-brief.md"]
dateOpened: "2026-08-31"
tags: []
---

# Technically enforce review-dispatch's never-self-accept / never-merge rule against a compromised dispatched session

Independent-review finding (PR #1756 r1, security lens, CONFIRMED): the dispatched review session's "never self-accept, never merge" rule lives only as PROSE in we:skills-src/review/review-agent-brief.md. Nothing technically restricts its tools, so a prompt-injection payload embedded in the reviewed PR's own diff/description could in principle talk it into running `--answer=accept` or a merge command directly, bypassing we:scripts/operations/review-loop-cli.mjs's own code-enforced refusal entirely. Needs a technical mitigation (a restricted tool/permission default, or a wrapper refusing that argv) rather than prose alone. Filed rather than blocking #3279's land, mirroring the #2895 precedent: state the residual honestly, defer the hardening.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
