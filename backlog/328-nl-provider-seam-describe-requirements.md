---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: plateau-app/src/technical-configurator/nl-provider.ts (NLProvider seam + describeRequirements + normalizeRequirements)
tags: [technical-configurator, natural-language, provider-registry, ai-agnostic, plateau, self-run-tool]
---

# NL provider seam + describe(nl,domain) to Requirements contract (BYO-key, tier-1 self-run)

Build the surface-agnostic NL provider seam for the Technical Configurator: a `describe(nl, domain) → Requirements` contract where the provider returns only the closed `Requirements` map (axis-id keys, value-id enums) and never selects the implementation — `rankStrategies` stays the deterministic guardrail and the registry remains the moat. BYO-AI-key, tier-1 self-run (no hosted broker). Ratified in #096 (Forks 2 & 4): the smallest trust surface that keeps registry-as-moat intact, with partial fill the honest default (an absent axis = "not required"). Parent build for the schema generator (#329) and panel wiring (#339).

## Progress

**Status:** resolved 2026-06-12 → `plateau:plateau-app/src/technical-configurator/nl-provider.ts`.

Built the surface-agnostic NL provider seam in **plateau-app** (where the Technical Configurator lives):

- `we:types.ts` — added the `NLProvider` contract: `describe(nl, domain) → Promise<Requirements>` + `id`/`label`. Documented as the second swap seam (the first, `CapabilityProvider`, reads domains; this one produces Requirements). The provider translates intent only and never selects a strategy.
- `plateau:nl-provider.ts` — the seam: a swappable provider registry (`registerNLProvider`/`setActiveNLProvider`/`resolveNLProvider`/`hasNLProvider`/`listNLProviders`/`resetNLProviders`), the single surface entry point `describeRequirements(nl, domain)`, and `normalizeRequirements(raw, domain)` — the **closed-vocabulary lock** that drops off-vocabulary axis/value ids and emptied axes, so no model can widen the decision space (keeps the capability registry the moat regardless of which provider is plugged). First-registered becomes active; `{ active: true }` lets a BYO-key provider supersede the no-key fallback.
- `plateau:nl-provider-keyword.ts` — a deterministic, no-key reference provider (substring match on axis value id/label) that demonstrates the partial-fill contract with zero configuration; explicitly the fallback the constrained-decoding provider (#329) supersedes.
- `plateau:nl-provider.test.ts` — vitest suite covering normalization, registry/active selection, `describeRequirements` (throw-when-unconfigured + normalize), and the keyword provider.

Faithful to the ratified forks: `describe(nl, domain) → Requirements` (smallest trust surface, Fork 2); partial fill the honest default — an absent axis is "not a requirement", mirroring the compat engine (Fork 4); surface-agnostic so the panel (#339), a future CLI, and an editor command consume the same `describeRequirements()`; BYO-AI-key / tier-1 self-run (no hosted broker).

**Gate note:** vitest is not installed in this plateau-app checkout (the `test` script references it but it's absent — same gap the pre-existing `plateau:compat.test.ts` hits), so the suite couldn't run here. Verified instead by `tsc --noEmit` (production files clean; only the pre-existing `Cannot find module 'vitest'` test-type gap remains) **and** a 17-assertion esbuild+node runtime smoke test of the full seam — all pass.

Follow-on builds remain: per-domain schema generator + constrained decoding (#329), panel NL box wiring (#339).
