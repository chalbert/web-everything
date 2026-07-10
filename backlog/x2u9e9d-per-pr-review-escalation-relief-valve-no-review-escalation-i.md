---
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
tags: []
---

# per-PR review-escalation relief valve — --no-review-escalation is pass-wide and unguards every unlabelled candidate

The documented stuck-park relief valve (--no-review-escalation on we:scripts/merge-ai-prs.mjs) is pass-wide: relieving ONE stuck review:pending PR disables the escalation rubric — including fresh gate-self/human-required detection — for every unlabelled candidate in the same pass, a strictly wider unreviewed-merge window than the per-PR timeout x30jq9n removed (panel security finding on PR #401 round 1, 2026-07-10). The x30jq9n round-1 editor added a PASS-WIDE warning to we:skills-src/drain/SKILL.md (singleton-queue + --dry-run guidance) as the stopgap. Durable fix: a per-PR override — e.g. --no-review-escalation=<pr#> (repeatable) or a review:relieve label applied to the one PR — so the rubric stays live for the rest of the pass; the override still refuses review:human/review:changes. Tests: relieved PR merges on allowPending semantics while a fresh gate-self PR in the SAME pass still parks review:human; bare --no-review-escalation keeps today's behavior or is deprecated with a loud pointer.
