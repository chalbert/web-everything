---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
relatedTo: ["3663", "3664", "3665", "xucqrc6", "xe0ftzc", "3371", "3581", "3513"]
tags: []
---

# Live-fire probe DeepSeek/Qwen open-weight PAYG models as a bulk dispatch executor (validate the #3665 PREP verdict)

`#3665`'s PREP pass (PR #2194) confirmed both named models clear the prerequisite: **Qwen** via an official
agentic CLI; **DeepSeek** via a third-party CLI **and** a cheaper path (its API accepts the Anthropic
Messages format, so this repo's already-validated `claude` wrapper could redirect to it, pending a
fidelity probe). It also found this class and the sibling Grok seat (`#3664`/`#xe0ftzc`) ADD UP rather
than compete. What it could NOT do — by its own statement — is the live quality-trial and schema-fidelity
probe `#3371` ran for Codex. This item carries that forward so `#3665` can stay a clean, resolved record.

## Done when

1. **Probe DeepSeek via base-URL redirection through the existing `claude` wrapper first** (the
   recommended cheapest path) — confirm whether the endpoint's structured-output enforcement is genuinely
   faithful to Anthropic's own semantics (a forced tool call), not just request-shape-compatible. This is
   the single highest-leverage unknown named in the PREP pass: a positive result unlocks the cheapest
   integration path for any future Anthropic-compatible open-weight candidate, not just DeepSeek.
2. **Probe Qwen via its official Qwen Code CLI** directly (no redirection trick needed — already the
   cheapest, best-supported path for Qwen specifically).
3. **Run a real quality comparison, per task class** (classification, formatting/lint-style fixes,
   commit-message generation, PR-description drafting), against whichever of Claude/Codex currently
   performs it — state the basis (sample size, what was scored, how) plainly enough that "no quality
   impact" is a supported claim, not an assumption, mirroring `#3371`'s own evidentiary bar.
4. **Probe the failure-mode shape** (quota exhaustion, malformed schema, timeout, auth loss) for whichever
   path is probed — `#3371`'s probes 5/6/8 are the template.
5. **Write the final verdict**, naming per candidate task class one of: adopt, reject, or needs a larger
   trial — per `#3581`'s risk-tiered framing, restating explicitly whether the add-up relationship with
   `#xe0ftzc` (Grok) still holds once live numbers are in, confirming or amending `#3665`'s provisional
   verdict.
6. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code.

## Deliberately NOT in scope

- **Wiring any open-weight model into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port
  surface.** Later work, gated on this item's own verdict.
- **Re-litigating the build-order choices `#3665` already made** (DeepSeek base-URL redirection before a
  dedicated wrapper; Qwen via its own official CLI, not redirection) — this item probes in that stated
  order, it does not re-decide it.
- **Re-deciding whether a second/third provider should exist at all** — `#3513` already ruled that.

## Lineage

Filed under epic `#3383`, split out of `#3665`'s own Done-when items when `#3665` was resolved as a
completed PREP-only pass (documentation research + verdict, per PR #2194) — the live-fire probe and quality
trial were their own explicitly-unchecked follow-on, not performed by that pass. Sibling successor items:
`#xucqrc6` (Cursor), `#xe0ftzc` (Grok) — the required cross-comparison with the latter carries forward from
`#3665`'s own "Grok and open-weight PAYG add up" finding. Mirrors `#3371`'s probe method and `#3581`'s
risk-tiered surface framing.
