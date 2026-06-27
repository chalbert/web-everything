---
kind: decision
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1849
codifiedIn: one-off
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-anonymized-dev-action-metrics.md
tags: [telemetry, metrics, prioritization, privacy]
crossRef: { url: /backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu/, label: "#1415 declarative telemetry vocabulary" }
---

# Anonymized dev-action metrics to drive prioritization

Prepared and ready to ratify. Collect anonymized developer actions (install/build/test counts) to inform
"what to build next", aggregate and anonymized, no per-developer identifiable data. The recommended path:
**reuse #1415's transport-agnostic contract shape** (a sibling dev-metrics vocabulary over the
swappable-sink-via-DI `track()` contract, with a dedicated *platform* sink), a **salted rotating-daily
install-id** (per-day distinct count, no persistent fingerprint), an **opt-IN** default with a first-run
prompt, and a **build scope split** — the contract + vocabulary + FUI reference emitter built **now at
`priority: low`**, the hosted plateau aggregation endpoint **`maturityGated` on `externalConsumers>=1`**
(server cost). Grounded in [the prep report](../reports/2026-06-26-anonymized-dev-action-metrics.md) and
[the research topic](/research/anonymized-dev-action-metrics/).

The axis is *how a platform-owned dev-metrics channel relates to the in-app analytics contract #1415/#1475
already ship, and how it stays privacy-first*. The decisive verified fact: `we:analytics/contract.ts:1-20`
is a **transport-agnostic** contract — `track()` is void fire-and-forget and the backend is a **swappable
`CustomTracker` resolved through DI** ("the application never knows about Mixpanel / GA4 / Segment") — so
its *contract shape* + the vocabulary-extension mechanism (`we:src/_data/protocols/analytics-vocabulary.json`)
are reusable even though its DOM emitter and product-analytics vendor sink are not. Constellation: contract +
vocabulary → WE, reference emitter → FUI, aggregation endpoint → plateau (the server-cost piece,
`we:docs/agent/platform-decisions.md:404-418`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| Fork 1 — #1415 relationship | **(a) Reuse #1415's contract shape + a sibling dev-metrics vocabulary, dedicated platform sink** | (b) A fully separate channel (own contract + sink) | Med-high |
| Fork 2 — anonymization | **(a) Salted rotating-daily install-id (per-day distinct, no persistent identity)** | (b) No machine id; (c) persistent hashed-MAC | Med-high |
| Fork 3 — opt-default | **(a) Opt-IN + prominent first-run prompt + one-flag escape** | (b) Opt-OUT (industry norm) | Med (judgment call — see skeptic) |

## Fork 1 — relationship to #1415's analytics contract

> **RATIFIED 2026-06-27 → (a)** reuse #1415's transport-agnostic contract shape + a sibling dev-metrics
> vocabulary, with a dedicated platform sink. (Forks 2 & 3 still open.)

**Fork-existence:** a real either/or at the contract/vocabulary layer; the product-analytics *vendor sink*
is **not** part of the fork (it's a forced invariant — a platform-owned dev-metrics stream cannot route to a
consumer's Segment/GA4 sink, so "ride #1415's sink" is the broken branch, settled below). What remains
genuinely two-way: reuse #1415's transport-agnostic contract **shape** (a) vs a fully separate channel (b).

**Crux.** `we:analytics/contract.ts:1-20`: `track()` is void fire-and-forget, the backend a swappable
`CustomTracker` via DI; the vocabulary is an extensible registry
(`we:src/_data/protocols/analytics-vocabulary.json`). #1476 experiment-exposure already rode this as a
*sibling vocabulary*, not a new transport — the precedent for (a).

**Options.**
- **(a) Reuse the contract shape + sibling vocabulary** *(default)* — dev-action events are a sibling entry
  in (or alongside) the Analytics Event Vocabulary, emitted through the same transport-agnostic,
  fire-and-forget, swappable-sink-via-DI contract; the **sink** is a dedicated platform tracker (not a
  product-analytics vendor). Reuses the shipped contract + DI seam; the only net-new WE surface is the
  dev-metrics vocabulary.
- **(b) A fully separate channel** — its own contract, vocabulary, and sink, no reuse. *Rejected* — forks a
  contract that is already transport-agnostic; the only thing genuinely dev-specific is the sink, which (a)
  already makes dedicated. Needless duplication.

**Skeptic:** REFUTED→reframed. The original "ride on #1415 is broken → dedicated channel, settled" was
refuted: the elimination holds at the *sink* layer only; the contract/vocabulary reuse is live, so this is a
real fork (a). The dedicated *sink* is folded out as a forced invariant.

## Fork 2 — anonymization model

> **RATIFIED 2026-06-27 → (a)** salted rotating-daily install-id; **not configurable** — making the
> identity model a knob would fragment the aggregate (mixed rotating-daily / no-id installs break
> consistent distinct-developer dedupe), and the only meaningful looser setting (no-id) is already
> covered by Fork 3's on/off consent flag. Fixed mechanic, not a dimension.

**Fork-existence:** a real either/or — you ship one identity model — and **both** alternatives are *flawed*:
(b) no machine id destroys the distinct-developer dedupe that is the card's whole purpose (1 power user vs
100 users is indistinguishable at small N — pure noise for a young platform); (c) a persistent hashed-MAC is
the most-criticized choice in the prior art (a stable cross-session fingerprint). (a) is the reconciliation.

**Options.**
- **(a) Salted, rotating-daily install-id** *(default)* — a per-day install identifier (salt rotates daily),
  enabling per-day distinct-developer counts with **no persistent identity** across days. Preserves the
  dedupe signal prioritization needs without a stable fingerprint.
- **(b) No machine id at all** (Homebrew aggregate-only) — *Rejected*; works only at internet scale where N
  self-averages; at small N it deletes the distinct-developer signal.
- **(c) Persistent hashed-MAC machine id** (.NET/VS Code) — *Rejected*; a stable fingerprint, the
  most-criticized prior-art choice; over-collects for a privacy-first platform.

**Skeptic:** REFUTED→flipped. The original "no machine id" default was refuted (self-defeating for the
card's purpose); flipped to the salted rotating-daily id, which the original false-dichotomy (no-id vs
hashed-MAC) had skipped.

## Fork 3 — opt-in vs opt-out default

> **RATIFIED 2026-06-27 → (a)** opt-IN default + first-run prompt + one-flag escape, **plus an
> enterprise-policy precedence layer**: absent org policy the individual dev is opt-in; an enterprise
> policy (env var / config file at a precedence the per-dev flag cannot override) can force-off
> (the common compliance case) or force-on (org consenting on machines it owns). Precedence order:
> enterprise policy > per-dev consent > opt-in default. Carried into the build story as a requirement.

**Fork-existence:** a real either/or; (b) opt-out is the *flawed* branch **for this platform specifically**
— a platform whose differentiation is privacy / minimize-lock-in (the platform's minimize-lock-in / native-first stance) collecting by default on its own developers is a credibility self-own,
and the most-permissive default *for the developer being measured* is opt-in (industry opt-out is the
convenience default the project rejects elsewhere).

**Options.**
- **(a) Opt-IN + prominent first-run prompt + one-flag escape** *(default)* — no data collected until the
  developer affirmatively consents; a single env-var/flag toggles it. Principled for a privacy-first
  platform; aligns with the card's "first-class privacy" framing.
- **(b) Opt-OUT** (Homebrew/VSCode/.NET/Next/Astro norm) — *Rejected* as the default; higher data volume but
  contradicts the platform's stated stance.

**Skeptic:** REFUTED→flipped. The original opt-out default ("industry norm") was refuted as contradicting
the platform's governing privacy/lock-in principle; flipped to opt-in. Confidence is Med — this is the one
genuine judgment call (data volume vs principle); the decider may legitimately override to opt-out if data
volume is judged decisive, but the prep recommends opt-in on principle.

## Build scope & maturity gate (a ruling, not a fork)

The contract + vocabulary + FUI reference emitter are **fully specifiable today** → build **now at
`priority: low`** (demand-blind per the judge-on-merit-not-demand rule — zero installs is a
low-*value* signal, not an un-buildable one). The **hosted plateau aggregation endpoint** is the only
server-cost piece → `parkedReason: maturityGated`, `maturityTrigger: "externalConsumers>=1"`
(`we:docs/agent/platform-decisions.md:404-418`). No vague "actual prioritization need" trigger — that is the
#1620 soft-park this gate must avoid. **Skeptic:** SURVIVES-WITH-AMENDMENT → the typed trigger replaces the
vague one; the build-now-at-low vs gated-endpoint split is the folded result.

## Supported by default (settled — not decisions)

- **Sink is dedicated (forced invariant).** A platform-owned dev-metrics stream cannot route to a
  consumer's product-analytics vendor sink; the #1415 vendor-sink "ride-on" is the broken branch.
- **Metric set (prior-art consensus).** Command ∈ a closed vocabulary (install/build/test/…), exit code,
  CLI/platform version, OS + arch, CI flag, timestamp. **Exclude all PII** — file paths, file contents, env
  vars, project name/repo/author, logs, serialized errors (the Next.js exclusion model).
- **Constellation placement.** contract + vocabulary → WE; reference emitter → FUI; aggregation endpoint →
  plateau (the constellation-layering rule).

## Context

- **Relationship to #1415/#1475:** resolved as reuse (Fork 1 (a)) — a sibling vocabulary over the shared
  transport-agnostic contract, with a dedicated platform sink, not the in-app product-analytics path.
- **Lineage:** converted from `we:plans/dev-stats.md` (#1792 hidden-docs cleanup). Resolving opens the build
  story (WE contract + vocabulary + FUI emitter at `priority: low`; the plateau endpoint maturity-gated).
