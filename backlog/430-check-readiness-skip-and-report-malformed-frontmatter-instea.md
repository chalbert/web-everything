---
type: issue
workItem: task
status: open
dateOpened: "2026-06-12"
tags: [tooling, backlog, readiness, robustness]
---

# check:readiness skip-and-report malformed frontmatter instead of crashing

One backlog item with malformed YAML frontmatter **hard-crashes** `scripts/check-readiness.mjs` (uncaught
`js-yaml` `YAMLException`), blocking the *entire* readiness selection — not just the bad item. The
recurring trigger is a `graduatedTo:` value with an **unquoted colon** (e.g. `graduatedTo:
design-refs/targets.json: readySelector …`), which YAML reads as a nested mapping. It hit `/prepare` twice
on 2026-06-12 (#401, #392), each needing an ad-hoc quote-fix first. Fix: **catch per-item parse errors,
skip the bad item, and report it** (id + reason) so one file degrades to a warning, not a crash. Optionally
lint unquoted colons in scalar frontmatter at author time via `check:standards`.
