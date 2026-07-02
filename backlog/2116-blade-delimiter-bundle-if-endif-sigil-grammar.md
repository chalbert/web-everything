---
kind: story
size: 3
parent: "2094"
status: open
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, bundle, blade]
---

# Blade delimiter bundle (@if…@endif sigil grammar)

Ship the Blade bundle — the sigil-keyword grammar #2074's Fork 3 names as the declared-close edge case: @if…@endif (no-bracket open, end-fused name-echo close), @verbatim escape, {{ }} escaped vs {!! !!} raw output (distinct opens), {{-- --}} hidden comment. @include recorded as a pending-#1980 scorecard row, not a blocker. Scored via #2113; gap list published as a we:reports/ topic.
