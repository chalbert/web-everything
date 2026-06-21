# Shared cross-intent tone axis — placement survey

Prior-art survey grounding decision [#1427](/backlog/1427-shared-cross-intent-tone-axis-one-tone-vocabulary-for-action/)
(a [#1337](/backlog/1337-revisit-whether-destructive-belongs-on-level-prominence-or-i/) spinoff).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

#1337 seated an open-numbered `tone` dimension on Action with an action-scoped core of `neutral | danger`
and **explicitly deferred** the broader question: should a **shared cross-intent `tone` vocabulary** exist —
one semantic-tone axis consumed by badges, alerts/banners, status indicators *and* action — vs per-intent
tone dimensions that diverge? There is a precedent: #1318/#1324 rejected a shared **Emphasis Intent**
("vocabularies diverge per intent → don't flatten").

## WE context — the two prior rulings that bound this

- **#1337 (the parent).** Ratified relocating `destructive` off `level` onto a new open-numbered `tone`
  dimension on Action, action core `neutral | danger`; it refused to bless `success | warning | info` *on
  action* ("a green Confirm is unusual; danger is the one consequence tone that clearly applies to a
  button") and deferred the cross-intent question, noting the residual: **action keeps `neutral | danger`
  regardless** of #1427. So #1427 cannot widen action's blessed set; it can only decide whether a shared
  *contract/palette* exists above the per-intent enums.
- **#1318/#1324 (the precedent).** Rejected a cross-cutting "Emphasis Intent" holding one shared value list,
  choosing a per-intent `variant` dimension. The load-bearing reasoning: "**What is shared is the
  *contract*, not an intent** … we are applying one named statute N times"; "the value sets diverge per
  intent, so a shared list flattens lossily … **sharing happens at the *meta-schema* layer, never at the
  *value* layer**." It did **not** reject sharing *tokens* — it rejected flattening the *value vocabulary*.

## Current tone vocabularies in the WE tree (the divergence is the evidence)

| Intent | Dimension | Actual values | Source |
|---|---|---|---|
| Action (per #1337) | `tone` | `neutral · danger` | [we:src/_data/intents/action.json](../src/_data/intents/action.json) (ruling; build pending) |
| Status Indicator | `tone` | `neutral · info · progress · positive · caution · critical` | [we:src/_data/intents/status-indicator.json](../src/_data/intents/status-indicator.json) |
| Tag | `tone` | `neutral · info · positive · caution · critical · categorical` | [we:src/_data/intents/tag.json](../src/_data/intents/tag.json) |
| Message (alert/banner) | `tone` | `neutral · positive · caution · negative` | [we:src/_data/intents/message.json](../src/_data/intents/message.json) |
| Feedback (toast) | `severity` | `info · success · warning · error` | [we:src/_data/intents/feedback.json](../src/_data/intents/feedback.json) |
| System Notification | `severity` | `info · success · warning · error` | [we:src/_data/intents/system-notification.json](../src/_data/intents/system-notification.json) |

Observations: **three different dimension names** (`tone`, `severity`, `level`) for one concept; **four
different value sets** across six intents. Even the intents whose prose claims a "unified severity
vocabulary" disagree (Feedback `info|success|warning|error` ≠ Message `neutral|positive|caution|negative`) —
the "unified" claim is **aspirational, not realized**. status-indicator's `progress` and tag's
`categorical` exist *only* because those intents need them — the strongest in-tree "blessed subset diverges"
evidence.

## Prior-art findings

1. **(Load-bearing) Shared palette, per-component blessed subset.** [Adobe Spectrum](https://spectrum.adobe.com/page/color/)
   ships one semantic palette (`negative · notice · positive · informative`) but each component blesses a
   *different subset*: Badge = `positive · accent · informative · notice · negative`; StatusLight =
   `positive · informative · neutral · notice · negative`. Same tokens, divergent component enums.
2. **[Chakra](https://chakra-ui.com/docs/components/alert) splits the two layers literally** — `status`
   (the blessed semantic subset `info · warning · success · error`) vs `colorScheme` (the full ~20-color
   palette). Alert takes `status`; Button takes `colorScheme` + a danger-ish scheme — buttons don't get a
   "success status."
3. **[Ant Design](https://ant.design/components/alert) — one palette, three vocabularies per component:**
   Alert `type` = `success·info·warning·error`; Badge `status` = `success·processing·default·error·warning`
   (adds `processing`/`default`, drops `info`); Button = a `danger` *boolean*. The button gets only
   `danger` — mirroring #1337's action core exactly.
4. **[Bootstrap](https://getbootstrap.com/docs/5.3/components/alerts/) — the one system that flattens (the
   cautionary tale).** Eight contextual classes applied uniformly to `.alert-*`/`.badge-*`/`.btn-*` — and
   `btn-warning`/`btn-info` are widely cited as semantically odd. Uniform-flattening is *possible* but
   produces low-meaning combinations the disciplined systems avoid.
5. **[Radix Colors](https://www.radix-ui.com/colors) — pure token layer, no component vocabulary.** Ships
   the palette + a thin semantic aliasing (red→danger, green→success) and deliberately does *not* dictate
   which components expose which semantic. Cleanest proof the token/palette layer is separable from the
   per-component enum.

**Cross-cutting pattern:** every mature system separates a shared color/token palette from a per-component
value enum; the only flattener (Bootstrap) is a known smell. Buttons converge on `danger`-only; alerts/toasts
carry the full set; badges/status sit between with their own additions. **The blessed subset provably
diverges per component even when the palette is shared.**

## Recommended placement

- **Fork 1 — where does "shared" live: the token/palette layer or the value vocabulary?** This is a
  near-false-dichotomy resolved by separation. The **shared *value enum*** branch (one flat
  `neutral|danger|success|warning|info` every intent consumes) is **broken** by the in-tree evidence (six
  intents, four value sets, with `progress`/`categorical`/`danger`-only members meaningless on other
  intents), by #1337 (action must stay `neutral | danger`), and by #1318 ("sharing happens at the
  meta-schema layer, never at the value layer"; Bootstrap is the lone flattener and a smell). Default
  (~85%): **per-intent blessed value enum + a SHARED tone CONTRACT (meta-schema) + a SHARED tone TOKEN
  palette in webtheme.** WE codifies one tone meta-contract (a tone value names a semantic color/severity
  family the theme resolves, never a hex; open-numbered per #1318) and one token palette (`--tone-danger`,
  `--tone-success`, …); each intent blesses its own subset. This is the #1318 statute applied a second time
  (variant → tone) — DRY where it's real (palette + contract), divergent where it's real (the enums). The
  fully-independent status quo (no shared contract/palette) loses the genuine token-layer DRY win.
  **High-leverage fork — flag for the skeptic pass**: the temptation to read "shared axis" as the flat
  enum is exactly the trap #1318 already sprang.
- **Fork 2 — reconcile the divergent dimension *names* (`tone`/`severity`/`level`) and synonym sets
  (`info`↔`neutral`, `error`↔`negative`↔`critical`)?** Default (~65%): **standardize the dimension name
  `tone` + a canonical synonym table** (`danger`≡`negative`≡`critical`≡`error`; `success`≡`positive`;
  `warning`≡`caution`) so the theme resolves any synonym to one token; `tone` already won the #1337 naming
  fork. Leaving names/synonyms as-is perpetuates three names for one concept under a "unified" banner.
  Recommend #1427 *rules* the canonical names and *files* the per-intent rename sweep as a
  separately-prioritized build (mirrors #1337's migration handling).

Supported by default: open-numbered per #1318 (a recommended core + author-extensible); tone is UX-only,
the theme resolves the hex; action keeps `neutral | danger` regardless (#1337 residual, non-negotiable);
resolution model `explicit ⊕ ambient project default ⊕ default`, most-permissive `unspecified → neutral`.

Seams (three cleanly separable layers — this separation *is* the decision): (1) the shared tone TOKEN
palette in **webtheme** (`--tone-{danger,success,…}`, light/dark-aware); (2) the shared tone META-CONTRACT
as a platform-decisions statute (the #1318 statute, second application); (3) the per-intent blessed VALUE
enum, intent-owned and divergent (action `neutral|danger`; message `neutral|positive|caution|negative`;
status-indicator `+progress`; tag `+categorical`; feedback/sys-notif `info|success|warning|error`) — sharing
never reaches this layer (#1318 holding).
