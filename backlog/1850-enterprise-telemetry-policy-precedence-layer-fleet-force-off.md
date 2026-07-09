---
kind: decision
parent: "1848"
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-06-27"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
codifiedIn: one-off
tags: [telemetry, enterprise, policy, privacy, placement]
---

# Where does the enterprise telemetry-policy precedence layer build — WE-contract + FUI-resolver vs plateau-app (locus fork)

Roll-under of the enterprise epic #1848; the central policy-precedence layer for dev-metrics consent ratified
in #1797. Absent organization policy, the per-developer opt-in default from #1849 applies; an enterprise
policy (env var / config file at a precedence the per-dev flag cannot override) can force-off telemetry
fleet-wide (the common compliance case) or force-on across machines the organization owns. **Precedence
order: enterprise policy > per-dev consent > opt-in default.**

## Grounding — the flagged locus is wrong (batch-2026-07-01)

This item shipped flagged `locus: plateau-app`, but that doesn't survive pre-flight:

- **plateau-app has ZERO telemetry surface** — no analytics/consent/metrics/policy files exist under
  `../plateau-app/src` (grepped). So "the first concrete consumer in plateau-app" would be greenfield with
  no substrate to layer precedence onto.
- **The consent substrate lives in the constellation's upper layers.** #1849 landed the dev-metrics
  **contract** in WE (`we:analytics/dev-metrics.ts` — `DevMetricsConsent`, salted install-id, the
  `@webeverything/contracts/dev-metrics` arrow). The **reference emitter + consent gate** live in FUI
  (`fui:plugs/webanalytics/devMetrics.ts`). Precedence is a consent-*resolution* concern: the emitter must
  resolve `enterprise > per-dev > default` before it emits — that resolution belongs where consent is read,
  not in a product with no telemetry.

## The fork — placement

- **(a) WE contract defines the policy shape + precedence order; FUI implements the resolver — RECOMMENDED.**
  Extend #1849's `DevMetricsConsent` in `we:analytics/dev-metrics.ts` with a `DevMetricsPolicy` (the
  precedence contract + the enterprise-source shape: env-var name / config-file path). FUI's
  `fui:plugs/webanalytics/devMetrics.ts` reads the enterprise source and resolves the three tiers before
  emitting. This matches the constellation (#96: WE owns contract, FUI owns impl) and puts precedence where
  consent already resolves. Locus → **WE + FUI**, not plateau-app.
- (b) Build the whole precedence layer in **plateau-app** (keep the flagged locus). Rejected: no telemetry
  substrate there, and it's the product layer — a fleet-wide policy mechanism is not a single product's
  concern.
- (c) WE + FUI as in (a), **and** plateau-app optionally supplies an example enterprise config (the "product
  that sets the org policy" role). This is (a) plus a thin plateau demo — reasonable as a follow-up slice, not
  a blocker.

**Default: (a).** A low-cost env-var/file-based policy source read by the FUI resolver; server-based
distribution stays out of scope (no enterprise infra exists yet). On ratification, reset `locus` and
`blockedBy` accordingly (#1849 is resolved) and re-scaffold the build as a `story·3`.

## Ratified (2026-07-09) — (a)

Ruled **(a)**: WE contract defines the `DevMetricsPolicy` shape + precedence order; FUI implements the
resolver. The flagged `locus: plateau-app` is corrected — the build lands in **WE + FUI**, not the product
tier (verified: plateau-app has no telemetry/consent substrate).

- **Resolver seam (red-teamed, attack failed):** WE holds the *declarative shape + ordering rule* only;
  FUI does the env-var/config-file **reading** and three-tier **resolution** before emitting. Reading the
  environment is a side-effect = impl → FUI, keeping WE at zero-implementation (#6, #96). It is **not** a
  WE-side pure function.
- **Scope cut (deliberate):** env-var / config-file policy source only. Server-based fleet distribution
  (the broader #1848 shape) stays out of scope until enterprise infra exists — the cheaper source is the
  right first cut.
- **(c) deferred:** a plateau-app example enterprise config is a reasonable follow-up slice, not part of
  this build.

Successor build scaffolded as **#xgf7ale** (`story·3`, parent #1848, locus WE + FUI). #1848 remains the
open parent epic.
