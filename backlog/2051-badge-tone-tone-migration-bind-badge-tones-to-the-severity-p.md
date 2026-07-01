---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Badge tone→--tone-* migration: bind badge tones to the severity palette (#2026 Fork 2a)

Ratified by #2026 Fork 2 (a): the badge reads no custom properties — every tone is a hardcoded hex triple (fui:blocks/badge/Badge.ts:87-91). Migrate the tones (neutral/info/success/warning/error) to read the --tone-* severity palette (#tone-meta-contract), the severity family that palette already owns, so a ThemeSource setting --tone-* re-themes the badge. Component-CSS migration, observable once themed through the injector's scope-matched co-emit (#2049).
