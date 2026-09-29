---
bornAs: xcom9j2
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2837's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md:5` — A `check:standards` lint that scans all backlog files and fails the build if the abandoned `plateau:` prefix is used for new work scope.
2. `we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md:2` — A strict JSON schema validator for markdown frontmatter included in the `check:standards` gate that asserts the presence of `workItem`.
3. `we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md:40` — A review lens or automated check that requires any explicit constraint mentioned in 'Risks' to have a matching, named executable test in the 'Test plan' section.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2837@012435fdb39b14ce718cdb5b5b8461e656d3c529

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
