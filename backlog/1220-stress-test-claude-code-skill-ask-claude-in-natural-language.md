---
kind: story
size: 2
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:.claude/skills/stress-test/SKILL.md"
crossRef: { url: /backlog/1167-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that/, label: "#1167 autonomous UI tester epic (resolved) — this is its conversational trigger" }
tags: [fui-devtool, exploratory-testing, claude-code, skill, dx]
---

# stress-test Claude Code skill — ask Claude in natural language to stress-test a page URL

The "integration with Claude" the user wants: say *"stress test http://localhost:3001/button"* and have it run. Add a Claude Code skill at `fui:.claude/skills/stress-test/` (repo-local, where the tool lives) mapping the natural-language ask to the #1219 CLI: detect the running dev-server port, run `npm run explore -- <url>` (or `gate` for a pre-close check), summarize the Layer-1 findings, and offer to file each as a backlog item. Purely the NL→CLI binding — no engine logic of its own. Honors the don't-kill-a-running-server rule (the CLI attaches to the live instance). Blocked on #1219.
