---
bornAs: xp71hri
kind: story
size: 5
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2639"]
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/workflows/review-parked-prs.mjs"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Juror-invite-on-discovery: cite the finding, spend a round, capped by care band

Account for a jury that grows mid-review: a juror who finds a discovery opening a new failure axis (e.g. a correctness reviewer notices a security hole) can invite another lens/method. Model it as "the discovery raises care-level → recompute rigor → spawn only the delta." Guardrails so it grows *only with reason*: the invite must **cite the finding** that justifies it (grounding), it **spends a round-trip and never resets the counter** (so a chain of invites can't dodge the cap), and the per-care-band ceiling bounds total jurors. Build in `we:scripts/lib/review-core.mjs` (the care recompute + delta) and `we:scripts/workflows/review-parked-prs.mjs` (the loop that spawns the invited juror). Depends on the convergence loop.

## Progress

Done. Landed the pure care-recompute + delta in `we:scripts/lib/review-core.mjs`, the loop that spawns the invited juror in `we:scripts/workflows/review-parked-prs.mjs`, and a single-sourced CLI seam.

- **Pure core (`we:scripts/lib/review-core.mjs`)** — `raiseCareForDiscovery(careLevel)` bumps care exactly one band, capped at `INVITE_CARE_CEILING` (`high`); `deriveJurorInvite({ careLevel, seatedLenses, jurorsPerLens, invitedLens, citedFinding })` returns the `JurorInvite` delta. All three guardrails are enforced deterministically: (1) a missing/blank `citedFinding` → `reason: 'ungrounded'` (cite the finding); (2) `spendsRound: true` on every path (the caller advances the round, never resets — the loop enforces it); (3) the raise is ceiling-capped and the delta is drawn from a finite lens vocabulary, so an at-ceiling invite that adds nothing returns `reason: 'at-ceiling'`. The delta is "spawn only the delta" — a newly-invited lens seats the full per-lens count; an already-seated lens gains only the raised band's per-lens increase (never a re-seat). Reuses the existing `panelRigorForCareLevel` dial, `rosterLensList` normalizer, and `LENS_DEFAULT_METHOD` grounding — no new dial.
- **CLI (`we:scripts/review-core-cli.mjs`)** — new `invite` subcommand shells `deriveJurorInvite` (injection-safe: the untrusted cited finding rides a JSON `--file`, never a shell arg), so the growth decision is single-sourced and never re-derived in the harness sandbox — the same pattern as `rigor`/`reduce`.
- **The loop (`we:scripts/workflows/review-parked-prs.mjs`)** — the roster is now MUTABLE across rounds. A lens reviewer may return an optional grounded `invite`; `convergePr` picks one grounded invite per round (`pickGroundedInvite`, restricted to panel lenses the diff-text jury can actually seat), shells `applyJurorInvite` (→ the `invite` CLI) to grow the jury by the delta, then re-reviews the SAME diff with the grown roster. The invite advances `round` (spends a round-trip) and NEVER resets it, and lives under the SAME fixed `roundCap` — a chain of invites is hard-bounded (escalates to `review:human` at the cap).

Gate green (`check:standards`, 0 errors); 12 new unit tests in `we:scripts/lib/__tests__/review-core.test.mjs` prove all three guardrails (176 total pass); the harness-sandbox body still parses as an async-wrapped body. The workflow loop itself is validated live against a real `review:pending` PR (a harness workflow needs live agents + runtime primitives; not unit-testable), same as the rest of the file.
