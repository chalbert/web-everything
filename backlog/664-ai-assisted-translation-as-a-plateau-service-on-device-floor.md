---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: localization protocol translated-catalog verify contract (src/_data/protocols.json) + ai-translation-verify-loop research topic + description partial
tags: [translation, localization, webintl, plateau-service, no-leakage, on-device, byo-key, ai-proposes-standard-verifies]
relatedProject: webintl
---

# AI-assisted translation as a Plateau service (on-device floor, BYO-key/SaaS tiers) for the webintl standard

## Digest

Add an **AI-assisted translation capability** that turns a source-locale message catalog into
target-locale catalogs on the **webintl** Localization protocol (MF2-aligned). This is an
**implementation capability, not a WE standard** — so by the governing ruling it is a **Plateau
service the WE *project* consumes as a no-leakage client** (the vision-is-a-service ruling,
[475](/backlog/475/)), **not** an `@webeverything` artifact. Only outputs (translated catalogs) reach the
standard; *how* they were produced is invisible to it.

The user's framing — *"probably SaaS or BYO-key"* — is the metered path, which is **valid as a tier
but not the floor**. The project's linear-cost hard rule ([488](/backlog/488/)) already settles the
pricing model: **on-device model as the bundled/default tier; hosted
API + BYO-key as the optional higher-quality upgrade.** So this card *applies* that settled pattern
to translation — it does **not** re-open the pricing fork.

> **Why translation is an even cleaner on-device fit than vision:** the browser now ships an
> on-device **Translator / Language Detector API** (Chrome built-in AI, on-device NMT), and small
> open MT models (NLLB-200, MADLAD-400, Opus-MT) run locally. The on-device floor is *more*
> attainable here than for the vision gate — the hosted/BYO-key tier is the bridge for
> low-resource locale pairs and quality-sensitive copy, not the only option.

## The moat — "AI proposes, the standard verifies"

This is the [089](/backlog/089/) white-space loop applied to translation: incumbents (Lokalise /
Phrase / DeepL) produce *plausible* translations; ours produces **provably-conformant** ones,
because webintl gives a machine-checkable target. The standard verifies, post-translation, that
each output catalog:

- preserves every **MF2 placeholder / selector / markup part** from the source (no dropped
  `{$count}`, no broken `.match` plural arms);
- round-trips locale negotiation and **plural/gender category coverage** for the target locale
  (ICU/CLDR categories present);
- leaves no untranslated-but-claimed keys, no placeholder-arity drift.

That conformance gate is the durable edge over generic AI translation — and it lives in the
**standard** (verification), while the model lives in the **Plateau service** (production). This is
why #089 parked the *translation-manager product* as low-moat but the *capability behind the
verify loop* is worth carrying: the moat is the verifiable target, not the model.

## Where it lives (the no-leakage seam)

- **Capability (production):** a **Plateau service** — the served-product layer of the constellation ([091](/backlog/091/)).
  The WE project consumes it through a **thin swappable client seam** that today may call a hosted
  MT API or the browser on-device API directly, and is **repointed** at the Plateau service when it
  lands. No throwaway provider baked into standard tooling.
- **Verification (the standard):** the webintl conformance checks above — published, model-free,
  the only thing that may live in `@webeverything`.
- **No leakage:** no published `@webeverything` artifact imports the translation model/SDK; it
  receives only translated catalogs as produced artifacts.

## Tiers (applying the settled linear-cost pattern)

1. **On-device (default / bundled)** — browser Translator API or a bundled small MT model; zero
   marginal inference cost → flat-subscription-safe. **Graduation benchmark, not a reject:** ship
   the bridge tier now; flip pairs on-device as on-device quality clears a per-locale-pair
   threshold (the [488](/backlog/488/) re-benchmark cadence).
2. **Hosted API + BYO-key (premium / bridge)** — higher-quality or low-resource locale pairs; the
   *consumer* carries metered cost (BYO-key = a tier, not the floor).

## Open questions (translation-specific — the pricing model is already settled)

- On-device MT quality vs. the conformance bar **per locale-pair**: which pairs clear the on-device
  floor today (browser Translator API + NLLB/MADLAD class) and which need the hosted bridge? →
  candidate `/research/` topic.
- Does the (source, target, verdict) translation corpus become a **distillation dataset** the same
  way the vision verdict cache does (#488 clean-loop) — i.e. do dev-time translations train a
  smaller on-device fine-tune?
- Catalog-level vs. message-level invocation, and how MF2 markup parts survive a model that wasn't
  trained MF2-aware (pre/post placeholder-masking in the client seam).

## Relationships

- **Applies the pattern from** [475](/backlog/475/) (vision = Plateau service, no-leakage) and
  [488](/backlog/488/) (on-device floor + BYO-key bridge + graduation benchmarks).
- **Distinct from** the parked *translation-manager product* in [089](/backlog/089/) (catalogs /
  locale negotiation / lazy loading as a Lokalise-alike) — this card is the **AI capability +
  verify loop**, the part #089 flagged as the only real edge.
- **Standard:** webintl Localization protocol (MF2-aligned catalogs).

## Progress

- **2026-06-15 — codified (design story, materialized; verification-only in @webeverything).** The
  no-leakage standard-side contract is now part of the Localization protocol summary
  (`src/_data/protocols.json` — `localization`): a produced catalog verifies MF2 placeholder/selector/markup
  preservation, CLDR plural/gender category coverage, and no untranslated-claimed-keys / no arity drift,
  with production (the model) explicitly held out as a Plateau service the WE project consumes as a
  no-leakage client (#475/#488). Design rationale + the three translation-specific open questions published
  as the `ai-translation-verify-loop` research topic + description partial. No model/SDK enters
  `@webeverything`; the executable conformance harness is a deferred build that lands when the protocol
  graduates from `concept`. Pricing fork not re-opened (settled by #488). graduatedTo: the localization
  protocol verify contract + the research topic.
