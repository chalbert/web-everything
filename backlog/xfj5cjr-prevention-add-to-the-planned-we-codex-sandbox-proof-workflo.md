---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xezin1k-prevention-reviewers-can-spot-this-by-reading-the-final-jsdo.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add to the planned we:codex-sandbox-proof-workflow.test.mjs: (1) assert top-level permissions: contents… (from chalbert/web-everything#3690 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xezin1k-prevention-reviewers-can-spot-this-by-reading-the-final-jsdo.md:47` — Add to the planned `we:codex-sandbox-proof-workflow.test.mjs`: (1) assert top-level `permissions: contents: read`, (2) assert no `${{ inputs.* }}` appears inside any `run:` block (the input must go through `env:`), (3) assert the version matches a strict semver regex before install, and (4) assert actions are pinned by SHA. A repo-wide gate such as actionlint or zizmor in `check:standards` would cover every workflow.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3690@c3eb8ad0551d52fb2428ceeda41401a3897255ca

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
