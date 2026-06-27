# Anonymized dev-action metrics to drive prioritization — decision-prep grounding (#1797)

**Date:** 2026-06-26 · **Grounds:** decision [#1797] · **Relates:** #1415 / #1475 declarative telemetry · **Constellation:** WE → FUI → plateau

## What this decision is

The platform should collect **anonymized developer actions** (counts of installs, builds, tests, …) so
prioritization is informed by real usage, not guesswork — the *product/operations* use of telemetry,
distinct from the in-app declarative emission seam #1415/#1475 designed (how an app emits its own runtime
events). The card frames a gating fork (ride on #1415 vs a dedicated channel) plus supporting calls (metric
set, anonymization model). A skeptic pass reshaped the framing substantially.

## Grounding (real tree)

### #1415 is a transport-agnostic CONTRACT, not just a browser sink

- `we:analytics/contract.ts:1-20` — the analytics protocol is the **pure-contract half**: `track()` is
  **void fire-and-forget** ("advisory telemetry, never a gate"), and the concrete backend is a
  **swappable `CustomTracker` resolved through DI** (default → project override → custom plug). "The
  application never knows about Mixpanel / GA4 / Segment — it only knows how to `track()`."
- `we:src/_data/protocols/analytics-vocabulary.json` — the Analytics Event Vocabulary (Segment Spec +
  deck events), `ownedByProject: webanalytics`.
- The swap registry is the runtime `we:plugs/webanalytics/` plug; #1475 built the `data-track`
  `CustomAttribute` emission seam over it.

This is the crux the skeptic surfaced: #1415's *contract shape* (a transport-agnostic, fire-and-forget,
swappable-sink-via-DI `track()` + a vocabulary-extension mechanism) is **reusable** for dev metrics even
though its *DOM emitter* and its *product-analytics vendor sink* are not. #1476 experiment-exposure already
rode the same contract as a sibling vocabulary, not a new transport.

### No existing collection; the source plan is gone

Grep for `telemetry`/`analytics`/`metrics`/`track(` finds only the #1415 in-app seam and unrelated code —
**no dev-action collection exists today**. The `we:plans/dev-stats.md` #1797 was converted from is no longer
in the tree (only the conversion commit references it); its intent is captured in the card body.

### Constellation placement + server-cost gate

Per [[project_managed_offering_constellation_layering]] / [[reference_repo_constellation]], "what to build
next" is a product/ops concern that decomposes: **contract + vocabulary → WE** (contracts only, no shipping
impl), **reference emitter → FUI**, **aggregation endpoint → plateau** (the only piece that holds data).
The hosted endpoint is a **server-cost** liability — `we:docs/agent/platform-decisions.md:404-418`
(server-cost capabilities are the dominant solo-dev risk; "deterministic + local = free; hosted = paid") —
so it is the deferrable, maturity-gated piece, while the contract is specifiable now.

## Prior art (web survey)

| Tool | opt-in/out default | anonymization model | metric set | disclosure |
|---|---|---|---|---|
| Homebrew | opt-OUT; no data until first-run notice | anonymous; **no machine id**, public aggregate JSON | install/cask events + formula, CI, arch, OS, version | docs + notice |
| VS Code | opt-OUT, graduated levels (off/crash/error/all) | hashed-MAC `machineId` (+ random UUID on web) | crash, error, feature-usage, perf | setting + docs |
| .NET CLI | opt-OUT (`DOTNET_CLI_TELEMETRY_OPTOUT`) | **no PII**; SHA256-hashed MAC machine id; hashed CWD | command, exit code, runner, version, OS, install | first-run banner |
| Next.js | opt-OUT (`next telemetry disable`) | "completely anonymous"; excludes env/paths/contents/errors | command, plugins, build perf, #CPU, OS, CI | site + `NEXT_TELEMETRY_DEBUG` |
| Astro | opt-OUT (`ASTRO_TELEMETRY_DISABLED`) | anonymous, aggregate-only, no PII | command, #CPU/OS/CI, config | site + pkg |
| npm / Vite core / cargo core | collect **nothing** client-side | — | (download counts server-side only) | — |

Norm: opt-out is the convenience default among tools that collect; the strongest-privacy posture is no
machine id (Homebrew); several core tools collect nothing client-side. The persistent hashed-MAC machine
id (VSCode/.NET) is the most-criticized choice.

## Skeptic pass (refute-only sub-agent) — verdicts folded

- **Framing (channel) — REFUTED.** "Ride on #1415 is broken" holds at the *sink* layer, but the card's
  near-term deliverable is the *contract/vocabulary* layer, where #1415's transport-agnostic contract +
  vocabulary-extension pattern ARE reusable (`we:analytics/contract.ts:1-20`). **Folded:** the dedicated
  **sink** is a forced invariant (settled); the live fork is whether the dev-metrics vocabulary reuses
  #1415's contract shape (a sibling vocabulary) or mints a fully separate channel.
- **Gate — SURVIVES-WITH-AMENDMENT.** Split: the contract + vocabulary + FUI reference emitter are fully
  specifiable today → build **now at `priority: low`** (demand-blind per [[feedback_judge_on_pure_merit_never_demand]]);
  only the **hosted endpoint** is gated, under the server-cost rule, with a **typed**
  `maturityTrigger: externalConsumers>=1` — drop any vague "prioritization need" trigger (a #1620 soft-park).
- **Anonymization — REFUTED.** "No machine id at all" destroys the distinct-developer dedupe that is the
  card's whole purpose (1 power user vs 100 users is indistinguishable at small N). **Folded:** a
  **salted, rotating-daily install-id** (per-day distinct count, no persistent identity) preserves dedupe
  without a stable fingerprint.
- **Opt-default — REFUTED.** Opt-out contradicts the platform's privacy / minimize-lock-in pitch (collecting
  by default on its own devs is a credibility self-own); the most-permissive default *for the developer
  being measured* is opt-in. **Folded:** **opt-IN** with a prominent first-run prompt + a one-flag escape.
- **Metric set — SURVIVES.** The prior-art-consensus core (command ∈ closed vocab, exit code, CLI/platform
  version, OS+arch, CI flag, timestamp; exclude all PII) is grounded and demand-blind specifiable.
