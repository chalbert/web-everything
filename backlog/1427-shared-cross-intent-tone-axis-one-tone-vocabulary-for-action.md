---
kind: decision
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: [webintents, tone, semantic-tone, cross-intent, placement, gap]
relatedProject: webintents
relatedReport: reports/2026-06-21-cross-intent-tone-vocabulary.md
preparedDate: "2026-06-21"
---

# Shared cross-intent tone axis? one tone vocabulary for action/badge/alert/banner vs per-intent tone (#1337 spinoff)

Spun off from the [#1337](/backlog/1337-revisit-whether-destructive-belongs-on-level-prominence-or-i/)
ruling, which seated an open-numbered `tone` dimension on Action Intent with an action-scoped core of
`neutral | danger` and explicitly deferred the broader question: should a **shared cross-intent `tone`
vocabulary** exist — one semantic-tone axis (`neutral | danger | success | warning | info`) consumed by
badges, alerts/banners, status indicators *and* action — versus per-intent tone dimensions that diverge
([prior-art survey](/research/cross-intent-tone-vocabulary/)).

The axis the prep pins to the real tree: this is a **near-false-dichotomy resolved by separating the shared
*token/contract* layer from the per-intent *value enum*.** The precedent is
[#1318/#1324](/backlog/1318-action-intent-emphasis-style-axis-fill-outline-ghost-link-or/), which rejected a
shared Emphasis Intent with the load-bearing rule "**sharing happens at the meta-schema layer, never the
value layer**" — it rejected flattening the *vocabulary*, not sharing *tokens*. And the in-tree evidence is
decisive divergence: six intents carry **four different value sets** under **three different dimension
names**, with members (`progress` on status-indicator, `categorical` on tag) that are meaningless on other
intents — even the intents whose prose claims a "unified vocabulary" disagree (feedback
`info|success|warning|error` ≠ message `neutral|positive|caution|negative`). Every mature system (Spectrum,
Chakra `status` vs `colorScheme`, Ant, Radix) separates a shared palette from a per-component blessed
subset; Bootstrap is the lone flattener and a known smell (`btn-warning`).

### Triage context

- **Kind**: Cross-intent placement (token palette + meta-contract vs per-intent enum) · **Native grounding**: no native `<button tone>`; the design-system convention is a shared palette + per-component subset
- **Native-first**: ▽ low (DS convention) · **Gap**: ◆ medium (three names, four value sets, unreconciled) · **Effort**: ◆ medium · **Surfaced by**: #1337 deferral; constrained by #1318/#1324

### Current tone vocabularies (the divergence is the evidence)

| Intent | Dimension | Values |
|---|---|---|
| Action (per #1337) | `tone` | `neutral · danger` |
| [we:src/_data/intents/status-indicator.json](../src/_data/intents/status-indicator.json) | `tone` | `neutral · info · progress · positive · caution · critical` |
| [we:src/_data/intents/tag.json](../src/_data/intents/tag.json) | `tone` | `neutral · info · positive · caution · critical · categorical` |
| [we:src/_data/intents/message.json](../src/_data/intents/message.json) | `tone` | `neutral · positive · caution · negative` |
| [we:src/_data/intents/feedback.json](../src/_data/intents/feedback.json) | `severity` | `info · success · warning · error` |
| [we:src/_data/intents/system-notification.json](../src/_data/intents/system-notification.json) | `severity` | `info · success · warning · error` |

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · where "shared" lives** | **per-intent value enum + a shared tone CONTRACT + a shared tone TOKEN palette (webtheme)** | one flat shared value enum *(rejected — flattens; #1318/#1337 + Bootstrap smell)* · fully independent *(loses the token DRY)* | **~85%** — high-leverage; flag for the skeptic pass |
| **2 · names + synonyms** | standardize the name **`tone`** + a canonical synonym table; file the rename sweep | leave `tone`/`severity`/`level` divergent *(rejected — three names, one concept)* | **~65%** — naming/scope judgment |

## Fork 1 — where does "shared" live: the token/palette layer, or the value vocabulary?

*Fork-existence:* the two coherent designs cannot coexist — either WE blesses **one cross-intent value
enum** (flatten) or it keeps per-intent enums and shares only the **contract + token palette**. The flatten
branch is **broken** by the in-tree evidence (six intents, four value sets, with
`progress`/`categorical`/`danger`-only members meaningless on other intents), by #1337 (action must stay
`neutral | danger`), and by the #1318 precedent ("sharing happens at the meta-schema layer, never at the
value layer"; Bootstrap is the lone flattener and a smell). A real either/or.

**Fork 1 (a) — per-intent blessed value enum + a shared tone CONTRACT (meta-schema) + a shared tone TOKEN
palette in webtheme (recommended, ~85%).** WE codifies one tone meta-contract (a tone value names a semantic
color/severity family the theme resolves, never a hex; open-numbered per #1318) and one token palette
(`--tone-danger`, `--tone-success`, …); each intent blesses its own subset (action `neutral | danger`;
message `neutral|positive|caution|negative`; status-indicator `+progress`; tag `+categorical`;
feedback/sys-notif `info|success|warning|error`). The #1318 statute applied a second time (variant → tone) —
DRY where it's real (palette + contract), divergent where it's real (the enums).

**Fork 1 (b) — one flat shared value enum every intent consumes (rejected).** The broken/flatten branch
above.

**Fork 1 (c) — fully independent per-intent tone, no shared contract or palette (rejected).** The status
quo; leaves the fictional "unified vocabulary" claims unreconciled and lets each intent re-coin colors,
losing the genuine token-layer DRY win all prior art confirms is shareable.

*The residual (~15%):* the precise membership of the shared token palette (does it include
`progress`/`categorical`, or are those intent-local tokens?) — a webtheme detail, not a blocker. **This is
the high-leverage fork; flag it for the deciding agent's skeptic pass** — the temptation to read "shared
axis" as (b) is exactly the trap #1318 already sprang. Verify the #1337 freeze holds (action stays
`neutral | danger`).

## Fork 2 — reconcile the divergent dimension names + synonym sets?

*Fork-existence:* genuine but lower-stakes — WE either standardizes one dimension *name* + a canonical
synonym mapping, or ratifies the current divergence. Neither is *broken* (both are coherent end-states), so
this is a real either/or, not a forced invariant.

**Fork 2 (a) — standardize the name `tone` + a canonical synonym table (recommended, ~65%).** e.g.
`danger ≡ negative ≡ critical ≡ error`; `success ≡ positive`; `warning ≡ caution`; `info ≡ neutral-info` —
so the theme resolves any synonym to one token. Fixes the already-fictional "unified vocabulary" prose;
`tone` already won the #1337 naming fork over `severity`/`status`. #1427 *rules* the canonical names and
*files* the per-intent rename sweep as a separately-prioritized build (mirrors #1337's migration handling).

**Fork 2 (b) — leave names and synonyms as-is (rejected).** Perpetuates three names for one concept and
unmatched enums under a "unified" banner.

*The residual (~35%):* whether full synonym-reconciliation is in scope for #1427 or spins to a webtheme
token-naming build — recommend #1427 rules the canonical names and files the sweep separately.

---

### Supported by default (not forks)

- **Open-numbered per #1318.** The tone meta-contract is an open set; WE ships a recommended core, authors
  mint members from the contract.
- **Tone is UX-only; the theme resolves the hex.** Intents name the tone; webtheme owns the color tokens
  (every in-tree tone description already says "the tone, not the hex").
- **Action keeps `neutral | danger` regardless** (#1337 residual). Non-negotiable; #1427 cannot widen
  action's blessed set.
- **Resolution model** `explicit (per-element) ⊕ ambient project default ⊕ default`, most-permissive
  `unspecified → neutral` — already the shape on every tone dimension in-tree.

### Seams — three cleanly separable layers (this separation IS the decision)

1. **Shared tone TOKEN palette — webtheme.** `--tone-{danger,success,warning,info,neutral,…}`
   (light/dark-aware), one DRY color contract; consumed by every intent's block.
2. **Shared tone META-CONTRACT — a platform-decisions statute.** "A tone value names a semantic
   color/severity family the theme resolves (never a hex); open-numbered; membership test = differs only in
   semantic color, not behavior/lifecycle." The #1318 statute, second application.
3. **Per-intent blessed VALUE enum — each intent's own `tone` dimension.** Stays divergent and
   intent-owned; sharing never reaches this layer (#1318 holding).

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: define the `--tone-*` token palette in webtheme + codify the tone meta-contract
statute in `we:docs/agent/platform-decisions.md`. If Fork 2 (a) ratifies: file the per-intent
`severity`/`level` → `tone` rename + synonym-normalization sweep. Not part of this placement call.
