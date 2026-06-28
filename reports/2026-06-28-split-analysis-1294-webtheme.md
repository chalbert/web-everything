# Split analysis — #1294 next wave (non-engine planes unblocked)

**Date:** 2026-06-28 · **Epic:** #1294 (relocate WE-resident logic reference runtimes to FUI)

## State at this slice

Two per-subsystem cascades have landed and reached the #1282 end-state:

- **webpolicy** — W1–W4 (#1799 engine→FUI · #1800 binding+vectors · #1801 plateau-iframe docs · #1802 delete WE runtime).
- **webcompliance** — C1–C5 (#1808 extract contract · #1814 relocate runtime · #1809 binding+vectors · #1810 docs page · #1815 delete runtime), plus #1819 (vcs-conventions) and #1847 (shared matcher mechanism).

**Unblock event:** decision **#1816** (conformance model for non-verdict relocated runtimes) is **resolved** —
ratified a closed four-member matcher set `{exact · deep-equal · parts-structure · predicate}`, and **#1847**
already built the shared mechanism (per-key `matcher` field in `we:conformance-vectors/schema.ts` + Plateau judge
dispatch). So the four **non-engine planes** that were gated on #1816 are now sliceable, each with a *settled*
conformance shape:

| subsystem | WE-resident runtime | conformance subject (per #1816) | matcher |
|---|---|---|---|
| **webtheme** | `we:webtheme/{tokens,compile,schemes,defaultTokens,paletteSource}.ts` | `resolveTokens` map (not `compileToCss` string) | `deep-equal` |
| intl | `we:intl/{provider,registry,index}.ts` (contract exists) | `Number`/`DateTime`/`RelativeTime` parts; `Collator` sign/order | `parts-structure` + `predicate` |
| analytics | `we:analytics/provider.ts` (contract exists) | recorded-call log (routing/swap/absence/count) | `predicate` |
| reliability | `we:reliability/{provider,registry,index}.ts` (contract exists) | `RecoveryResult` | `deep-equal` |

## Could split — the webtheme cascade (this wave)

webtheme is the cleanest first non-engine plane: #1816 worked it in most depth (resolveTokens deep-equal, #404
anchor), and it adjoins the just-landed #1683 webinjectors token work. It carries **no contract file yet** (its
contract is the token schema), so it takes the full 5-slice cascade mirroring webcompliance exactly:

| slice | title | size | blockedBy | demoable state |
|---|---|---|---|---|
| T1 | Extract the webtheme contract (token/scheme schema + types) | 3 | — | WE keeps a pure contract module; runtime still in place |
| T2 | Relocate the webtheme resolution+compile runtime (`resolveTokens`/`compileToCss`) → FUI | 3 | T1 | runtime runs from `fui:webtheme/`, WE re-exports/contract-only |
| T3 | webtheme conformance binding (observe `resolveTokens`, `deep-equal` matcher) + WE vector corpus | 3 | T2 | conformance provable via the shared #1847 matcher |
| T4 | Wire the webtheme docs conformance page via the plateau iframe | 2 | T3 | visible conformance surface, plateau-hosted |
| T5 | Delete the WE webtheme runtime (keep contract + vectors) | 2 | T4 | #1282 end-state for webtheme |

Clean linear DAG, each slice ≤3, real incremental delivery, every slice leaves a valid demoable state, no slice
buries a fork (the only fork — the matcher model — is resolved in #1816).

## Could split next (ready, file on pickup — NOT scaffolded now)

- **intl**, **analytics**, **reliability** — each unblocked by #1816/#1847 with a settled matcher (table above).
  Each takes a webcompliance-shaped cascade (contracts already exist, so likely 4 slices: relocate → binding+vectors
  → docs page → delete). Deliberately not pre-scaffolded — one wave at a time; they file on pickup.

## Could not split (gated — needs a read first)

- **process**, **webtraits** — facts→verdict *engines* (non-trivial conformance shape). #1816 settled only the
  *non-engine* model; these need a **per-subsystem conformance-shape / placement read** that is not yet filed.
  *Unblocking action:* file a `kind: decision` for the engine-plane conformance shape (the #1816 analogue), then slice.
- **webcases** — mixed tooling, tracked by **#1566**; placement read pending there. *Unblocking action:* resolve the
  #1566 placement read, then slice.

## Recommendation

Carve **the webtheme cascade (T1–T5)** as #1294's next wave. Hold intl/analytics/reliability for subsequent waves and
leave process/webtraits/webcases gated on their reads.
