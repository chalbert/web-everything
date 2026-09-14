---
bornAs: xe0ftzc
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
relatedTo: ["3663", "3664", "3665", "3668", "3667", "3371", "3581", "3513"]
tags: []
---

# Live-fire probe Grok base-tier SuperGrok as a bulk dispatch executor (validate the #3664 PREP verdict)

`#3664`'s PREP pass (PR #2194) already confirmed xAI's "Grok Build" is a genuine headless agentic CLI, and
recommended probing base SuperGrok (~$30/mo) first, not Heavy (~$300/mo). It also found Grok and the
sibling open-weight-PAYG candidate (`#3665`/`#3667`) ADD UP rather than compete. What it could NOT do —
by its own explicit statement — is the live-fire install/spawn/break probe `#3371` ran for Codex. This item
carries that forward so `#3664` can stay a clean, resolved PREP record.

## Done when

1. **Install/authenticate against a real base-tier SuperGrok subscription** (not Heavy, not a bare
   `XAI_API_KEY`) and spawn Grok Build headless with a schema-constrained ask, mirroring `#3371`'s probe
   method.
2. **Resolve the unknowns `#3664`'s PREP pass named, with evidence, not assumed:**
   - Whether browser-based subscription auth persists across headless invocations the way Codex's
     ChatGPT login did for `#3371` (`codex login status` surviving between spawns) — unconfirmed from docs.
   - Real rate-limit numbers (requests/day, tokens/week) at the base SuperGrok tier — no source in the PREP
     pass states a number.
   - Whether Grok Build's streaming JSON output (confirmed for tasks like codebase explanation) carries a
     genuine structural forced-schema guarantee equivalent to `we:scripts/lib/judge-spawn.mjs`'s
     `--json-schema`, or is only a request.
   - The failure-mode shape (quota exhaustion, malformed schema, timeout) — mirror `#3371`'s probes 5/6/8.
3. **Test the operator's own hypothesis directly**: is Grok's usage ceiling high enough, and its
   tool/output discipline reliable enough, to serve as a bulk executor for simple, low-judgment dispatch
   tasks specifically (not a general delivery/review-agent replacement)? State plainly whether the base
   tier suffices or Heavy's higher ceiling is actually needed (per `#3664`'s "escalate only if insufficient"
   staging).
4. **Write the final verdict**, per `#3581`'s risk-tiered framing and gated on `#3513`'s trigger having
   fired — confirming or amending `#3664`'s provisional verdict, and restating explicitly whether the
   add-up relationship with `#3667` (open-weight PAYG) still holds once live numbers are in.
5. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code.

## Deliberately NOT in scope

- **Wiring Grok into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port surface.** Later
  work, gated on this item's own verdict.
- **Re-litigating the subscription-seat vs. bare-API-key scope boundary `#3664` already drew** — this item
  stays on the subscription-seat path; any bare-API-key evaluation belongs with `#3667`'s scope, per
  `#3664`'s own note.
- **Re-deciding whether a second/third provider should exist at all** — `#3513` already ruled that.

## Lineage

Filed under epic `#3383`, split out of `#3664`'s own Done-when items when `#3664` was resolved as a
completed PREP-only pass (documentation research + verdict, per PR #2194) — the live-fire probe was its own
explicitly-unchecked follow-on, not performed by that pass. Sibling successor items: `#3668` (Cursor),
`#3667` (open-weight PAYG) — the required cross-comparison with the latter carries forward from `#3664`'s
own "Grok and open-weight PAYG add up" finding. Mirrors `#3371`'s probe method and `#3581`'s risk-tiered
surface framing.
