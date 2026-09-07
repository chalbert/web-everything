---
kind: story
size: 2
status: open
blockedBy: ["3158"]
scope: ["we:scripts/converge-cli.mjs", "we:scripts/review-core-cli.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Wire toolsAvailable:false into judgePanel-fed mandate callers

#3158 gave buildMandate/buildPanelMandate/buildValidatorMandate (we:scripts/lib/review-core.mjs) an explicit toolsAvailable param (default true, byte-compatible) and made judgePanel (we:scripts/lib/judge-panel.mjs) refuse allowedTools outright (panel seats stay tool-free by design). That fixed the mechanism but not the wiring: we:scripts/converge-cli.mjs and we:scripts/review-core-cli.mjs still call buildPanelMandate/buildValidatorMandate for judgePanel-fed (tool-free) jurors without passing toolsAvailable:false, so those jurors still get mandate text offering a throwaway git clone and demanding a mutation-probe result they cannot produce. Done when: (1) every buildPanelMandate/buildValidatorMandate call in those two files that feeds judgePanel passes toolsAvailable:false -- grep both files for every call site, do not assume only the ones seen at scaffold time; (2) we:scripts/operations/review-pr.mjs's judgeSpawn-direct calls (genuinely tool-bearing via REVIEW_JUROR_TOOLS) are explicitly left at toolsAvailable:true with a regression test guarding this; (3) an INTEGRATION/WIRING test drives the real call path (we:scripts/converge-cli.mjs's step function or we:scripts/review-core-cli.mjs's CLI entry) and asserts the produced text contains MUTATION_PROBE_RULE_TOOL_FREE and omits the throwaway-clone sentence -- a unit test of buildPanelMandate alone is not sufficient; (4) the repo's standards gate must show 0 new errors.

## Done when

1. Every call to `buildPanelMandate` / `buildValidatorMandate` in `we:scripts/converge-cli.mjs` and
   `we:scripts/review-core-cli.mjs` whose mandate is handed to `judgePanel` (not `judgeSpawn` directly) passes
   `toolsAvailable: false`. Grep both files for every `buildPanelMandate(` / `buildValidatorMandate(` call site
   — do not assume only the ones named in the digest above.
2. `we:scripts/operations/review-pr.mjs`'s two `judgeSpawn`-direct calls (genuinely tool-bearing via
   `REVIEW_JUROR_TOOLS`) are explicitly left at `toolsAvailable: true`, with a regression test that fails if
   this item's change ever flips them.
3. An INTEGRATION/WIRING test — not a unit test of `buildPanelMandate` alone — drives the real call path
   (`we:scripts/converge-cli.mjs`'s step function, or `we:scripts/review-core-cli.mjs`'s CLI entry point) and
   asserts the produced mandate text contains `MUTATION_PROBE_RULE_TOOL_FREE` and omits the throwaway-clone
   sentence.
4. `npm run check:standards` — 0 new errors.
