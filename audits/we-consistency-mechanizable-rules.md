# WE consistency — which standing rules are mechanically checkable

Seed audit for the **WE consistency watch** (#1852). Classifies every standing rule in
[docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) by whether conformance can be
verified by a deterministic gate (`check:standards`) or needs a human/semantic read (the manual
watch). Dated **2026-06-27** (creation run). Re-classify as rules are added or migrations land.

## Headline finding

The deterministic gate **already covers what is cheaply mechanizable**; the residue is genuinely
semantic. Two invariants that *look* like easy wins (ZERO-impl, no-backward-DAG-edge) **cannot be
mechanized today** because an in-flight relocation legitimately violates them, and several rules are
**anti-uniform by design** — a flat grep check would contradict the very rule. Net: **no safe new
deterministic check to add right now.** The value of this program is the semantic watch, not more gate
code.

## A — mechanizable AND already enforced (no action)

- **Trait / registry naming** — `use*` prefix is an error, non-`Custom*Registry` a warn
  ([check-standards.mjs:255](../scripts/check-standards.mjs#L255)). Governs
  [#tagname-naming](../docs/agent/platform-decisions.md#tagname-naming)'s machine-checked clause.
- **Status vocabulary, duplicate ids, retirement death-triplet + `supersededBy`, frontmatter shape,
  backlog rendering, program-title-is-a-bare-name** — all live in `check-standards.mjs` /
  `check-standards-rules.mjs`.
- **Entity validators** (protocol / preset / design-system / intent / capability / capability-matrix)
  — manifest-shape, reference-resolves, themeTokens/extends resolution.

## B — mechanizable IN PRINCIPLE but blocked by an in-flight migration (parked → #1853)

These are real invariants whose *end-state* is checkable, but the tree legitimately violates them
**now** because impl is still being relocated WE→FUI ([#1282](../docs/agent/platform-decisions.md)
ZERO-impl; relocation ongoing via #1730 / #1047, #658 only partially drained `blocks/`). A check added
today fires on dozens of correct lines.

- **ZERO standard implementation in WE** — no runtime under `blocks/` / `plugs/`. Today `blocks/`
  carries impl that rides to FUI.
- **No backward DAG edge** — WE source must not runtime-import `@frontierui/*`. Today
  `blocks/renderers/jsx`, `blocks/trusted-html`, `blocks/resource-loader` … import
  `@frontierui/plugs/*` legitimately.
- **tagName value shape** `<prefix>-<id>` in the WE-owned `blocks.json` — checkable once FUI's
  irregular names finish migrating to conform.

**Un-park trigger (#1853):** when `grep -rE "from ['\"]@frontierui" blocks/ src/ plugs/` over WE
returns zero, promote these into `check:standards` as errors. Until then they stay on the semantic
watch.

## C — NOT mechanizable: judgment / anti-uniform by design (stay on the manual watch)

A grep check here would be **wrong**, not just incomplete — these rules explicitly reject flat
uniformity:

- [#registry-name-guard-namespace](../docs/agent/platform-decisions.md#registry-name-guard-namespace)
  — "**never** by a flat 'every `define()` validates the same way' rule." Guard-worthiness is a
  namespace-sharing judgment.
- [#host-backreference-naming](../docs/agent/platform-decisions.md#host-backreference-naming) — "two
  right names (`ownerElement` / `host`) beat one wrong-but-uniform name." Name **by semantics**.
- **Placement / boundary judgments** —
  [#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement),
  [#we-fui-embed-boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary),
  [#devtools-placement](../docs/agent/platform-decisions.md#devtools-placement) (the consumer test),
  [#composition-artifact-ownership](../docs/agent/platform-decisions.md#composition-artifact-ownership),
  [#reusable-home](../docs/agent/platform-decisions.md) — which repo an entity belongs in is a read.
- **Taxonomy bars** —
  [#project-protocol-bar](../docs/agent/platform-decisions.md#project-protocol-bar),
  [#intents-ux-only](../docs/agent/platform-decisions.md#intents-ux-only),
  [#intent-conformance-is-block-compliance](../docs/agent/platform-decisions.md#intent-conformance-is-block-compliance).
- **Business-line rules** — [#monetization](../docs/agent/platform-decisions.md#monetization) (soft),
  [#brand-on-distinctness](../docs/agent/platform-decisions.md#brand-on-distinctness),
  [#no-leakage-client](../docs/agent/platform-decisions.md#no-leakage-client),
  [#vision-tiers](../docs/agent/platform-decisions.md#vision-tiers),
  [#trainable-judge](../docs/agent/platform-decisions.md#trainable-judge).
- **Authoring/derivation rules** —
  [#single-authoring-sot-derived-projection](../docs/agent/platform-decisions.md#single-authoring-sot-derived-projection),
  [#faithful-derivation-exclude-not-fabricate](../docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate),
  [#compose-dont-handroll](../docs/agent/platform-decisions.md#compose-dont-handroll),
  [#native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline),
  [#contract-surface-platform-idiom](../docs/agent/platform-decisions.md#contract-surface-platform-idiom).

## Watch method (how a pass uses this file)

Each `/review-program 1852` run picks a **rotating slice** of section C (≈5–8 anchors, not all per
pass), greps/reads the live tree for entities the slice governs, and files each real drift as a
backlog card `codifiedIn`-linked to the offended anchor (discovery = cards only). Section A needs no
pass (the gate runs every `/check`); section B is one parked promotion (#1853).
