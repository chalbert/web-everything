---
kind: story
size: 3
status: open
scope: ["we:backlog/x0f7apa-producer-numbering-at-pr-open-and-the-write-point-clash-veri.md", "we:backlog/xk8rem0-refuse-a-hash-bearing-tree-at-every-scripted-push-of-main.md", "we:backlog/x61tff4-the-backlog-ids-required-check-and-the-operator-setup-step.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a backlog lint that flags a story whose body or statute clause says 'once X exists' or 'after X' wh… (from chalbert/web-everything#3809 review)

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3809's review (reviewed head `3ee99f41b05ff8dc8a8476d1c34d8e94184e7622`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:backlog/x0f7apa-producer-numbering-at-pr-open-and-the-write-point-clash-veri.md:7` — Add a backlog lint that flags a story whose body or statute clause says 'once X exists' or 'after X' when X is not in its blockedBy. As a cheaper fix, add x61tff4 to x0f7apa's blockedBy, or make the tail removal an explicit last step gated on the check being active.
2. `we:backlog/xk8rem0-refuse-a-hash-bearing-tree-at-every-scripted-push-of-main.md:7` — State one shared 'hash-bearing' predicate (added or renamed paths versus the base, not the whole tree) in the statute, and have each enforcement card cite it. Add an acceptance item to xk8rem0 where the fixture's base already contains a legacy hash and an unrelated numbered push still succeeds. Add x4qfbpf to blockedBy.
3. `we:backlog/x61tff4-the-backlog-ids-required-check-and-the-operator-setup-step.md:20` — Add a Done-when item to x61tff4: the workflow checks out the base ref only, reads the PR diff as data via git/API, never executes PR-supplied scripts, and runs with `permissions: contents: read`. Back it with a deterministic check:standards or workflow-lint rule that fails any workflow using `pull_request_target` together with a checkout of the head or merge ref followed by script execution.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
