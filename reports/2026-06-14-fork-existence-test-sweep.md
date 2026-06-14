# Fork-existence-test sweep — single-solution mandate audit — 2026-06-14

Backlog: [#602](/backlog/602-fork-existence-test-sweep-find-single-solution-mandates-that/). One-time hygiene
sweep of the WE standard for anything leaked in as a **mandated single solution** where the
[fork-existence test](../docs/agent/backlog-workflow.md) — the lens that dissolved [#578](/backlog/578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag/)'s
Fork 1 into a support-all credential-source provider seam — says it must be a provider registry / open
config / config-extends-platform-default / most-permissive default instead.

## Result — clean sweep

**0 genuine leaks · 3 legitimate invariants confirmed.** No place in the standard fixes a single answer where
a coherent (non-broken) alternative is wrongly excluded. Every single-valued mandate examined either reuses a
proven external standard with adoption rationale, fixes an invariant whose alternative is *broken*, or is
already correctly structured as an open provider seam / config-extends-platform-default flavor. A clean sweep
is an explicitly valid outcome for this item — recorded here, no fix items filed.

## The four test questions

1. **Coherent alternative excluded?** → should be a provider registry / open set.
2. **Default disguised as a mandate?** → should be Config-Extends-Platform-Default (default lives in the flavor).
3. **Default not the most-permissive value?** → the restriction must be the author's opt-in.
4. **Actually a forced invariant** (alternative *flawed*)? → legitimate; record as a ratified invariant, not a finding.

## Scope swept

- `src/_data/*.json` registries: `intents.json`, `protocols.json`, `adapters.json`, `capabilityMatrix.json`,
  `blocks.json`, `plugs.json`, render-strategy registry.
- Authored standard docs: `src/_includes/project-*.njk` and block/protocol/SSR contract prose; mandate language
  (`MUST` / `SHALL` / `only` / `canonical` / `required`).

## Legitimate invariants confirmed (test #4 — alternative is broken, no action)

| Location | What it fixes | Why it's a legitimate invariant |
|---|---|---|
| [project-webcomponents.njk:217](/src/_includes/project-webcomponents.njk#L217) | **Autonomous custom elements only** — never `customElements.define(..., { extends })` | Safari refuses `is=""` for customized built-ins ([:213](/src/_includes/project-webcomponents.njk#L213)); the alternative is non-portable. Transient Components are the documented portable substitute. |
| [project-webtheme.njk:124](/src/_includes/project-webtheme.njk#L124) | **Native CSS is the only runtime** (custom properties + `@property`) | Explicit rationale ([:19–21](/src/_includes/project-webtheme.njk#L19)): no build-time theming engine to lock into; the output is plain Baseline-2024 CSS. Token *authoring* stays vendor-portable (DTCG). |
| [project-webanalytics.njk](/src/_includes/project-webanalytics.njk#L14) | **Fixed Segment-Spec event vocabulary** (the Analytics Event Vocabulary Protocol) | A stable call-site vocabulary is what enables the no-touch backend swap ([:5–9](/src/_includes/project-webanalytics.njk#L5)) — Segment/Mixpanel/etc. remain swappable behind it. The vocabulary's fixity *is* the open seam's contract, not a lock. |

## Correct open-provider patterns verified (not leaks)

- **Provider registries already open:** the `CustomXRegistry` plug family (positioning, recovery,
  translation-provider, validity-merge, validator-resolution, change-strategy, storage-strategy,
  render-strategy) — all per-scope-resolved open sets with precedence + degradation as the only rules.
- **Defaults already config-extends-platform-default:** render-strategy (`declarative-static`), storage
  (IndexedDB + localStorage), auto-define — defaults live in platform flavors and resolve per-scope via the
  injector chain, not as baked constants in the core.
- **Adapters interconvertible:** HTML / JSX / template-string formats are mutually AST-translatable;
  "canonical" names a reference direction, not a mandated single format.
- **Capability matrix open:** the `impls[]` adapter table is registrable (2 impls today, more addable);
  capability support is feature-detected, not asserted.

## Method note

Conservative classification: a forced choice was only logged as a leak if a *working, non-broken* coherent
alternative is excluded (tests #1–3). A single answer that exists *because* the alternatives are broken
(test #4) is a legitimate invariant, not a finding. The sweep confirms the standard already governs the
single-solution-vs-open-provider decision deliberately — consistent with the codified `support-all-coherent`
and `fork-is-not-a-prioritization-tool` rules the test was distilled from.
