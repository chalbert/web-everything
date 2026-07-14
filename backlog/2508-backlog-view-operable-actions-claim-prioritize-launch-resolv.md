---
bornAs: xkypxl6
kind: story
size: 8
parent: "2505"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: operable actions — claim / prioritize / launch / resolve from the UI

The write half of "operable from the screen": act on a backlog item directly from the Plateau UI — claim it, change its priority, launch work on it, resolve it — rather than dropping to the CLI.

Deferred behind the v1 read foundation ([read-only backlog view](/backlog/2507-backlog-view-v1-read-only-backlog-view-in-plateau/)) and the data-path decision ([D1](/backlog/2506-plateau-loop-how-the-backlog-console-reads-a-repo-s-backlog-/)) — you can't operate on items until you can read them, and the write path rides whatever seam D1 fixes.

**The design constraint that shapes this story: item-mutations are lane-gated.** A backlog frontmatter splice (claim / resolve / etc.) can't run under a shared primary checkout — the guard denies it, and every mutation must ride a lane → PR. So the action path from the UI **routes through a lane**, not a direct write to the target repo. How the console requests, tracks, and reflects that lane-gated mutation is the central design point of this story.
