---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/review-state-ledger-target.md", "we:backlog/xe3xtio-cut-dispatch-and-conflict-discovery-graphql-reads-using-the.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3092's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:docs/agent/review-state-ledger-target.md:1` — The `check:standards` gate should enforce that `docs/agent/` only contains standing guides, and that files claiming to be snapshots or reports belong in `reports/` or `research/`.
2. `we:backlog/xe3xtio-cut-dispatch-and-conflict-discovery-graphql-reads-using-the.md:6` — A markdown link linter in `check:standards` that validates all internal paths point to real files and rejects unknown URI schemes like `we:`.
3. `we:backlog/xe3xtio-cut-dispatch-and-conflict-discovery-graphql-reads-using-the.md:2` — The `check:standards` script should validate the frontmatter of all `backlog/*.md` files to ensure the `workItem` field is present as required by we:AGENTS.md.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3092@8aefe7dfc980fa88d0522e073e5079ce5dfa95d8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
