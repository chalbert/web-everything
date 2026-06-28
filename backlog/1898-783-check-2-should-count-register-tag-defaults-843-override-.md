---
kind: task
status: resolved
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: [gate, check-standards, webrouting, transient, "783", "843"]
---

# #783 Check 2 should count register*(tag=) defaults + #843 override names as on-disk registrations (FUI gate)

FUI. The `#783` Check-2 *reverse* ("phantom name") gate in `fui:scripts/check-standards.mjs` (`walkDefines`
→ `diskNames`) only recognizes literal `customElements.define('x')` / `attributes.define('x')` as an on-disk
registration. But `#843` override pretty-names + custom-attr names (`auto-heading`, `app-view`, `app:link`,
`on:click`) are registered **only** via parameterized `register*(tag = 'we-…')` with the pretty name passed
by consumers — they have no on-disk literal, so they appear on disk **only in JSDoc `* …define('x')`
examples**. The reverse check currently passes solely because `walkDefines` counts those JSDoc-block lines
(a coincidence, left in place deliberately — see the comment there). Replace that with real accounting:
collect `register*(tag = '…')` defaults into `diskNames`, and treat a `fui:src/_data/blocks.json`
`registeredName` as satisfied when its block declares a parameterized register fn (override names need no
literal). Then the `walkDefines` collector can drop the JSDoc-counting and skip `* …` example lines too.
Surfaced fixing the post-#1777 FUI gate red (the upgrader-relocation fixture/comment false positives).

## Progress (batch-2026-06-27)

Real accounting landed in `fui:scripts/check-standards.mjs` (Check-2 reverse, `walkDefines`/`diskNames`):

- **Dropped the JSDoc-counting hack** — `walkDefines` now skips `* …` JSDoc-example lines as well as `//`
  comments, so a relocated test-fixture doc example (`* attributes.define('x')`, the post-#1777 false
  positive) no longer reads as a phantom registration. `diskNames` is again **literal-only** (real
  `customElements.define`/`attributes.define`).
- **Parameterized-block satisfier** — collected the set of source files that export a `register*(…)` fn
  (`REGISTER_FN_RE = /\bfunction\s+register\w*\s*\(/` — the universal FUI convention: `registerButton`,
  `registerTabs`, `registerEventAttributes`, …). The phantom (forward) check now treats a declared
  `registeredName` as satisfied when its block's `sourcePath` exports such a fn — so #843 override names
  (`auto-heading`, `on:click`, …) need **no on-disk literal** (the name is consumer- or registry-supplied).
- **Scope correction vs the card's literal phrasing:** the card said "collect `register*(tag=)` defaults into
  `diskNames`", but feeding register-defaults into the *reverse* (sibling-drift) check surfaced 17 untracked
  renderer register-defaults (`we-data-table`, `we-tabs`, `we-route-view`, …) whose `fui:src/_data/blocks.json`
  entries carry **no `registeredNames`/`sourcePath` at all** — declaring them is a separate `fui:src/_data/blocks.json` migration,
  out of this gate-logic task's scope. The parameterized-register-fn rule (which the card also specifies)
  covers the same #843 override names *plus* registry-loop attrs like `on:click` (`registerEventAttributes`
  defines names from an internal map, not a `tag=` default), so the forward-check goal is met without
  scope-creeping the reverse check. `REGISTER_DEFAULT_RE` (still used by Check 2b) was hoisted to the shared
  block.

Gate green: `0 error(s)` (was a flood when register-defaults were globally added; clean with the scoped
rule). Registered-name count `20 → 16` — the 4 dropped are the former JSDoc-only override names, now
forward-satisfied via the parameterized-block rule. No gate-test harness exists (the script walks the real
tree); the green run on the live tree is the proof.
