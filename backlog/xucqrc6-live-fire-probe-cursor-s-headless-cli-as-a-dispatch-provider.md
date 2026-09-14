---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
relatedTo: ["3663", "3664", "3665", "xe0ftzc", "xjo6uux", "3371", "3581", "3513"]
tags: []
---

# Live-fire probe Cursor's headless CLI as a dispatch provider (validate the #3663 PREP verdict)

`#3663`'s PREP pass (PR #2194) already confirmed `cursor-agent -p --force` is a genuine headless CLI
subprocess (the same shape `we:scripts/operations/dispatch-lane-io.mjs` wraps for Claude Code/Codex), and
rejected Cursor's separate Background/Cloud Agent API as structurally incompatible with this repo's
lane-lease/PR-transport pipeline. What it could NOT do — by its own explicit statement — is the live-fire
install/spawn/break probe `#3371` ran for Codex. This item carries that forward so `#3663` can stay a
clean, resolved PREP record.

## Done when

1. **Install/authenticate against a real Cursor subscription** and spawn `cursor-agent -p` headless with a
   schema-constrained ask, mirroring `#3371`'s probe method exactly.
2. **Resolve the four unknowns `#3663`'s PREP pass named, with evidence, not assumed:**
   - Whether Cursor CLI's structured output (`json`/`stream-json`) is a genuine forced-tool-call guarantee
     (like `we:scripts/lib/judge-spawn.mjs`'s `--json-schema`) or only a request the model can ignore.
   - Whether `--force` under `-p` can run fully unattended (no human ever present) without an undocumented
     approval gate firing — `#3371`'s Codex probe found exactly this kind of stdin trap on its first run;
     assume Cursor capable of an equivalent until proven otherwise.
   - Whether a Free-plan `CURSOR_API_KEY` is sufficient for the CLI, or a paid plan is required even for
     print-mode.
   - The failure-mode shape (quota exhaustion, malformed schema, timeout) — mirror `#3371`'s probes 5/6/8.
3. **Break it on purpose** (an unsatisfiable schema, a huge/slow request, a simulated quota-exhausted case)
   and compare its parsing discipline to `we:scripts/lib/judge-spawn.mjs`'s fail-loud approach.
4. **Write the final verdict** on which task CLASS Cursor CLI is actually suited for (independent
   review/fix-dispatch vs. full delivery-agent build vs. neither), per `#3581`'s risk-tiered framing and
   gated on `#3513`'s trigger having actually fired — confirming or amending `#3663`'s provisional
   "buildable-in-principle, not yet proven" verdict.
5. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code.

## Deliberately NOT in scope

- **Wiring Cursor into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port surface.** Later
  work, gated on this item's own verdict.
- **Re-litigating Fork 1 of `#3663`** (which Cursor surface is even a candidate) — already ratified there;
  only the CLI print-mode subprocess is in scope here.
- **Re-deciding whether a second/third provider should exist at all** — `#3513` already ruled that.

## Lineage

Filed under epic `#3383`, split out of `#3663`'s own Done-when item 3 when `#3663` was resolved as a
completed PREP-only pass (documentation research + verdict, per PR #2194) — the live-fire probe was its own
explicitly-unchecked follow-on, not performed by that pass. Sibling successor items: `#xe0ftzc` (Grok),
`#xjo6uux` (open-weight PAYG). Mirrors `#3371`'s probe method and `#3581`'s risk-tiered surface framing.
