---
kind: story
size: 2
parent: "xqmw8g9"
status: open
scope: ["we:scripts/lib/lane-litter.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Lane-pool litter allowlist misses .fix-*, tmp/, .prep-*.md and -plateau suffixed scratch

2026-09-24: lanes whose only dirty files were agent scratch named .fix-*, a tmp/ directory, .prep-*.md or files with a -plateau suffix stayed dirty and unacquirable, because we:scripts/lib/lane-litter.mjs does not list those names. Add them per the list's own rule (extend the list, do not loosen the matcher), with a test per pattern. Root cause lives in #3987 (briefs write scratch into the lane root).

## Done when

1. **Executable** — a unit test per new pattern (`.fix-*`, `tmp/`, `.prep-*.md`, `-plateau` suffix) proves
   a lane dirty only with that scratch counts as clean; it fails before this lands.
