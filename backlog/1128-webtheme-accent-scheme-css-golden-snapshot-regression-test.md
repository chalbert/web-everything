---
type: idea
workItem: task
parent: "1097"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webtheme: accent + scheme CSS golden/snapshot regression test

Replace the 4 toContain checks (we:webtheme/__tests__/schemes.test.ts:143-149) with a full-output snapshot/golden of compileSchemeCss(deriveSchemeRuntime(defaultTokens)) — :root color-scheme + --color-bg/-fg + every --color-accent-N in ramp order + the HC block (we:webtheme/schemes.ts:350-375,282-294); pin at least accent-9's derived value. Demo: a one-line emit change breaks the snapshot loudly.
