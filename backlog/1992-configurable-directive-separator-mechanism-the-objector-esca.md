---
kind: story
size: 5
status: open
blockedBy: ["1987"]
dateOpened: "2026-06-30"
tags: []
---

# Configurable directive-separator mechanism (the objector escape hatch + migration bridge)

#1987 ratified colon as WE's internal authoring spelling and settled the POSTURE that the separator is app-configurable — the answer to 'colons are awful' is deep config, not re-litigating the default, and the same registry-remap is the bridge to whatever spelling the WG eventually ratifies. This item builds the MECHANISM (deferred from #1987): an app/platform-level setting (one separator choice per app, never per-author) that remaps the directive-name separator via the registry's name→behavior binding. Default stays colon; the knob is opt-in. Scope: where it lives in config, how deep it reaches into matchers/comment-parser/registry, and the migration path (colon→enh-* hyphen if ever adopted, never we-*).
