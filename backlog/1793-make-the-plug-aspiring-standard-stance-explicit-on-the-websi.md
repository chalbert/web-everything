---
kind: story
size: 2
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
tags: [website, plugs, messaging, mission]
graduatedTo: none
---

# Make the plug / aspiring-standard stance explicit on the website

The website should make the *intent* behind Web Plugs clear: each plug imagines how a feature would fit **if it were normalized into the web platform**, in the hope it aligns with where standards are heading — with a far-reaching ambition to push some ideas toward standardization. The stance has to walk a fine line: we depend on **no** adoption and we stay humble (we don't crown ourselves the future standard), while still being honest that "what if this were a standard?" is the design lens. Today that framing isn't stated anywhere a reader can find it.

This is a messaging/copy story, not a mechanism. Surface the stance where a reader forms their mental model of plugs — primarily the **Web Plugs** page and the **mission** page, possibly others (about/home).

## Build
- Add a short, explicit stance section to the Web Plugs page and the mission page.
- Frame it as: speculative-but-standards-aligned, zero adoption dependency, humble, with an aspiration to inform standardization.

## Acceptance
- A reader landing on the plugs/mission pages can articulate the "imagine it normalized" intent without prior context.
- `check:standards` green.

## Progress
- Added a **"What a plug is — and isn't"** stance section to the Plugs page (`we:src/plugs.njk`) — "what if this were a standard?" as the design lens, zero adoption dependency, explicitly not crowning ourselves the future standard.
- Added the same stance (one paragraph) to the **mission** page (`we:src/about.njk`), inline in the Vision section where the reader forms the plug mental model.
- `check:standards` green; `eleventy` build clean.

_Converted from `we:plans/future-standard.md` (#1792 hidden-docs cleanup)._
