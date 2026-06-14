---
type: idea
workItem: story
size: 3
parent: "586"
status: resolved
blockedBy: ["588", "590", "591"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "demo:inline-emoji-picker (src/_data/demos.json)"
tags: []
---

# In-editor inline / tooltip emoji picker (:-trigger)

A specific picker context per #370 Fork 4: a caret-anchored :-trigger popover for inserting emoji/expressive-symbols inside a rich-text editor (small, keyboard-driven). Composes the general picker surface (#588) via the mention/trigger-character pattern (#591) inside the rich-text editing standard (#590) — blocked on both. Not Tier-A ready until those land.

## Progress

- All three blockers landed (#588 picker-surface, #591 inline-trigger ruling, #590 rich-text ruling) and #620 built the runnable `inline-trigger` block + intent — so this picker context is now specifiable.
- Registered the context as a demo: `inline-emoji-picker` in [src/_data/demos.json](/src/_data/demos.json) — the canonical worked instance (`triggerSet: emoji` over the inline-trigger engine + picker-surface results + expressive-symbol glyphs + text/token insertion adapters), with anatomy, the APG editable-combobox a11y, and the detection-only degrade. Surfaces on [/demos/](/demos/).
- **Detection-only is the unlock:** because inline-trigger emits the resolved selection and owns no document model (#591 Fork 2-A), this runs in a plain `contenteditable` today — composed with, not blocked on, the rich-text graduation (#618). The runnable page is a Frontier-UI reference impl; this entry specifies the context it realizes (status `draft`, no `liveUrl` yet).
