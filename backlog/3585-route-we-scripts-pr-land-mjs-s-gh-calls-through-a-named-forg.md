---
bornAs: xnmkay2
kind: story
size: 5
status: resolved
blockedBy: ["3174"]
scope: ["we:scripts/pr-land.mjs", "we:scripts/lib/forge-land-provider.mjs"]
dateOpened: "2026-09-07"
dateStarted: "2026-09-07"
dateResolved: "2026-09-08"
tags: []
---

# Route we:scripts/pr-land.mjs's gh calls through a named forge-land-provider port

Per #3174 (ratified 2026-09-07): the land arc's forge calls stay bare today — `we:scripts/pr-land.mjs:615` holds its own inline `ghC` exec inside `runCli` (its argv builders at `:345`, `:371`, `:378` are already pure and exported; the exec itself is not), plus the file's other direct `gh` invocations (PR create, checks read, label add, merge). Build `we:scripts/lib/forge-land-provider.mjs`, the arc-fitted port `we:scripts/pr-land.mjs` needs — create · checks · addLabel · merge — following the `we:scripts/lib/review-label-provider.mjs` precedent (pure argv builders + an injectable `createGhProvider`-shaped adapter), per Fork 2=(b)'s per-arc-fitted-to-caller doctrine, never a repo-wide neutral interface. Per Fork 1=(c): this is a MUTATING arc, so the port stays importable only from inside `we:scripts/pr-land.mjs`'s own home — never a second route another script could take. Done-when: every bare `gh` invocation in `we:scripts/pr-land.mjs` sits behind the new port; the port's argv is asserted byte-identical to what each call site executed before, per the discipline `we:scripts/lib/__tests__/review-label-provider.test.mjs:19` already applies; `we:scripts/pr-land.mjs`'s existing tests pass unmodified in behavior. No second forge provider is stood up or tested.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
