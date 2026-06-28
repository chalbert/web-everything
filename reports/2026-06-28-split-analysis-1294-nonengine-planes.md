# Split analysis — #1294 non-engine planes (intl · analytics · reliability)

**Date:** 2026-06-28 · **Epic:** #1294 · **Companion to:** `we:reports/2026-06-28-split-analysis-1294-webtheme.md`

## Why now

Decision **#1816** (resolved) settled the conformance model for non-verdict relocated runtimes and **#1847**
(resolved) built the shared matcher mechanism (per-key `matcher` field in `we:conformance-vectors/schema.ts` +
Plateau judge dispatch). That unblocks the remaining three **non-engine planes**. Each already ships a clean WE
contract module, so — unlike webcompliance (which needed an extract-contract slice) — each follows the **4-slice
webpolicy shape** (#1799–#1802): relocate runtime → binding+vectors → plateau-iframe docs → delete WE runtime.

| plane | WE-resident runtime | WE contract (stays) | conformance subject (#1816) | matcher |
|---|---|---|---|---|
| intl | `we:intl/{provider,registry,index}.ts` | `we:intl/contract.ts` | `Number`/`DateTime`/`RelativeTime` parts; `Collator` sign/order | `parts-structure` + `predicate` |
| analytics | `we:analytics/provider.ts` | `we:analytics/contract.ts` | recorded-call log (routing/swap/absence/count) | `predicate` |
| reliability | `we:reliability/{provider,registry,index}.ts` | `we:reliability/contract.ts` | `RecoveryResult` | `deep-equal` |

## Could split — three independent 4-slice cascades (this wave)

Each cascade is a clean linear DAG, every slice ≤3, real incremental delivery, every slice leaves a valid demoable
state, no slice buries a fork (the matcher fork is resolved in #1816). The three cascades are mutually independent
(distinct subsystems / files) — they can be worked in parallel.

**intl** — relocate `we:intl/{provider,registry}.ts` → `fui:intl/` → binding (parts-structure on `formatToParts`,
predicate on `Collator`) + vectors → docs page → delete WE runtime.

**analytics** — relocate `we:analytics/provider.ts` → `fui:analytics/` → binding (predicate over the recorded-call
log) + vectors → docs page → delete WE runtime.

**reliability** — relocate `we:reliability/{provider,registry}.ts` → `fui:reliability/` → binding (deep-equal on
`RecoveryResult`) + vectors → docs page → delete WE runtime.

## Could not split (still gated)

- **process**, **webtraits** — facts→verdict *engines*; #1816 settled only the *non-engine* model. Need a
  per-subsystem engine-plane conformance-shape decision (the #1816 analogue) filed first.
- **webcases** — mixed tooling, tracked by **#1566**; placement read pending.

## Recommendation

Carve all three non-engine cascades now (12 slices). Leave process/webtraits/webcases gated on their reads —
their unblock is a decision to file, not a carve.
