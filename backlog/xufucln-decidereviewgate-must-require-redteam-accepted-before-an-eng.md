---
kind: story
size: 3
status: open
blockedBy: ["2410"]
dateOpened: "2026-09-04"
tags: []
---

# decideReviewGate must require redteam:accepted before an engine-tier (blast-radius) auto-land

#2412 Layer 4: we:scripts/lib/review-escalation.mjs's REVIEW_LABELS.redteamAccepted comment already names this as #2412's concern — decideReviewGate currently accepts a plain review:accepted for a blast-radius/engine-tier park (#2445's two-tier auto-land), never requiring the independent redteam:accepted signoff. No CODE-LEVEL / daemon-reachable writer applies redteam:accepted to a live PR yet: we:scripts/converge-cli.mjs's pre-PR /converge tool runs the validator judging (buildValidatorMandate) but never calls combineValidatedVerdict and never writes any label (by design — /converge is advisory only, never opens/labels/lands a PR); the ONLY place the actual `gh pr edit --add-label redteam:accepted` procedure exists today is as hand-run prose in we:skills-src/drain/SKILL.md, for a human/agent to type during an interactive escalated-PR drain session — no `.mjs` script anywhere calls it, so the fully-automated resident daemon and the deterministic we:scripts/merge-ai-prs.mjs sweep have zero code path touching it. That gap is #2410 slice 2. Enforcing the requirement in decideReviewGate before #2410 ships a code-level writer would strand every future blast-radius auto-land that goes through the automated/daemon path (the interactive-only manual procedure doesn't cover it), so this is scaffolded blocked on #2410 rather than built now. Once #2410 lands a live-PR writer for redteam:accepted, we:scripts/lib/review-escalation.mjs's decideReviewGate should require it (not just review:accepted) for the blast-radius/engine-tier reason family before returning action:merge.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
