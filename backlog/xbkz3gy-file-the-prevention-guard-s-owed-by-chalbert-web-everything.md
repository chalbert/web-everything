---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/open-pr-items.mjs", "we:scripts/lib/__tests__/open-pr-items.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2724's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2724's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/lib/open-pr-items.mjs:470` — Fail closed instead of guessing: only trust a status line when the hunk actually proves frontmatter boundaries (shows line 1's opening '---' or an already-established closing '---' within the same hunk chain), and drop the bare line-number fallback; back it with a unit test that plants coincidental colon/indented body content within the first 30 lines edited via a hunk that omits line 1, so this class of defect reddens before merge.
2. `we:scripts/lib/open-pr-items.mjs` — Add a deterministic regression test with a status-changing YAML example before line 30 whose fence falls outside hunk context, asserting no credited IDs. Require verified frontmatter boundaries instead of accepting line position alone.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
