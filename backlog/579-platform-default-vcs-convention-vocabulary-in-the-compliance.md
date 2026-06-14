---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["562"]
dateOpened: "2026-06-14"
locus: webeverything
tags: [dev-browser, fix-loop, conventions, compliance, webcompliance, platform-default]
---

# Platform-default VCS convention vocabulary in the compliance layer (branch/commit/PR shape the fix-loop reads)

Cluster B from [#562](562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac.md)'s surfaced
follow-on work. The fix-loop must **know what VCS conventions to follow** when it opens a PR — branch naming,
commit-message format (conventional-commits?, trace/failure back-reference, the `Co-Authored-By` bot trailer),
PR shape. **This is not a decision that prescribes a convention** — per the conventions-as-compliance ruling
(#436/#437) WE never mandates conventions, and per the config-extends-platform-default rule the **default
vocabulary is defined by the platform config**, which a project's config extends/overrides.

So this item carries the **platform-default VCS convention vocabulary into the compliance layer**:

- Define the default branch / commit / PR convention shape as platform-config defaults (project-customizable).
- Enforced via **webcompliance** (#436/#437), same as every other convention.
- The fix-loop / bot is a **pure consumer**: it reads the project's *resolved* compliance convention and
  conforms to it — it never invents or hardcodes one.

Shape is already ruled (platform-default + project-customizable + compliance-enforced + bot-consumed); this is
the build that carries the vocabulary, not a fresh fork. Pairs with the bot-PR-mechanics decision
[#578](578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag.md) (which *reads* this vocabulary).
