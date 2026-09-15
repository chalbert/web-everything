---
kind: story
size: 5
status: open
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs"]
dateOpened: "2026-09-15"
tags: []
---

# Make Antigravity (Gemini + Claude-via-Antigravity) the default selectProvider recommendation, not an opt-in quotaStrained fallback

Operator priority (2026-09-15): Antigravity is now the top lever for capacity relief, not just an opt-in
fallback. we:scripts/lib/provider-routing.mjs's selectProvider() should default Claude-tier work to the
agy route, with native Claude becoming the thing that needs justifying — not the reverse. Trust/graduation
(selectSupervisionLevel()) stays untouched; this only changes which provider gets recommended first.

## Context

Today, selectProvider()'s Claude cascade branch (step 4) only offers the `alternateBackend` (Gemini-hosted
Claude-tier route via agy) when the caller explicitly sets `context.quotaStrained === true`; otherwise it
recommends native Claude by default. The operator wants this flipped.

Open implementation questions for whoever picks this up:

1. **Cascade restructure** — does the existing Gemini/Antigravity fitness check (step 1) already cover
   this, or does the Claude-tier branch need its own default-to-agy logic?
2. **Statute-tier/architectural-decision/triage-research branches** (currently hard-forced to native
   Claude) — do they also default to agy, or stay native? Does "forces Opus" still mean literal native
   Claude Opus, or can it route through agy's Opus-tier equivalent too?
3. **Existing test suite** — all ~59 current `selectProvider` tests assert `alternateBackend` is `null`
   unless `quotaStrained=true`. These need deliberate review, not blanket rewriting.

Spun off while landing we:scripts/lib/model-capability-ratings.mjs (backlog/xij3dkb, PR #2285) —
deliberately not folded into that already-merged PR.

## Done when

1. **Executable** — a caller-visible behavior change: `selectProvider()` recommends the agy route for
   Claude-tier work by DEFAULT (no `quotaStrained` flag required), with the existing test suite updated to
   assert the new default and cover the still-native-required cases from question 2 above.
