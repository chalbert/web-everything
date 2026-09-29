---
bornAs: xkqiewd
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2957's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md:4` — A check:standards rule that flags backlog cards whose Done-when text names a we:backlog/… or we:scripts/… path missing from frontmatter `scope`.
2. `we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md:17` — A markdown lint rule in `check:standards` that parses inline code segments starting with `node ` or `npm ` and asserts that their entrypoint script paths resolve cleanly on the filesystem (and do not begin with abstract locus prefixes).
3. `we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md:2` — Add a validation check to `check:standards` that enforces the presence of `workItem` (story/epic/task) and a Fibonacci `size` for all markdown files in the `backlog/` directory.
4. `we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md:2` — A markdown frontmatter linter in `check:standards` that validates the existence and correct schema of `workItem` and `size` fields on all backlog items.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2957@8f7683496ea60ad42bdbcb8fb7bdad66f4a7df92

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
