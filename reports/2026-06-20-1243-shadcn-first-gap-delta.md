# shadcn/ui — first reproduction-conformance gap delta (#1243)

First per-target slice of the reproduction-conformance program (#1226, charter #1225 →
`we:docs/agent/platform-decisions.md#reproduction-conformance`). This is the **foundational harness phase**
the `/split 1243` analysis (we:reports/2026-06-20-1243-split-analysis.md) called for: stand up the WE-side
reproduction surface against the first target (shadcn/ui), prove the loop, and **emit the first gap delta —
the deliverable, not the copy.**

## What landed (WE-side, declarative — no rendering)

The hypothesis under test: the only difference between two top design systems is `theme tokens + intents`
over shared structural/behavioral primitives. To probe it against shadcn we expressed its seed components
as exactly that and recorded the residue.

- **Bucket 1 — theme pack.** `we:reproduction-parity/shadcn/theme.ts` — shadcn's neutral-base oklch tokens
  transcribed verbatim (`SHADCN_TOKENS`) and mapped into the webtheme DTCG model as an `extends` override
  over the platform default (`shadcnTheme` / `shadcnTokens`). `buildShadcnScheme()` runs them through the
  webtheme scheme + contrast gate. Only what the model can express is declared; the rest is a gap (below).
- **Bucket 2 — intent set.** `we:reproduction-parity/shadcn/reproduction.ts` — the seed set
  (`button`, `input`, `badge` × states × light/dark) as `ReproductionTarget[]`, each mapped to its WE
  intent(s) + token roles + shadcn variant axis (`INTENT_MAP`): button→**action**, input→**input**,
  badge→**status-indicator**.
- **Bucket 3 — gap list (the deliverable).** `SHADCN_GAPS: GapDelta[]` — six recorded shortfalls (below),
  each a gap-sweep #315 intake line in WE vocabulary.
- **The ingestion loop.** `buildShadcnReport()` rolls up the per-target verdicts the **co-evolving**
  Plateau/FUI oracle produces and conformance-checks each via `assertVerdictGating()` (the thin-contract
  rule: `pass` = AND of the gating pixel+structural legs; the advisory VLM leg annotates, never flips/scores).
  Per the charter's *no claim without measurement*, the seed run ingests **zero** readings (the oracle is
  co-evolving, #1226 Fork 1) — so the report ships the **gap list now, verdicts when the oracle measures
  them**. The ingestion path is proven by test, never by a fabricated pass.

Boundary held: WE owns the theme pack, intent map, gap list, and verdict ingestion/conformance — all
declarative. WE does **not** render FUI primitives (the styled reproduction page is FUI/Plateau,
we-fui-embed-boundary) nor run the oracle (deterministic diff = FUI, VLM = Plateau, #475 no-leakage).

Tests: `we:reproduction-parity/__tests__/shadcn.test.ts` (13, green).

## The first gap delta — what `theme + intents` could NOT express

| # | Layer | Gap | Suggested surface |
|---|---|---|---|
| 1 | token | shadcn flips `--primary` across schemes (light `oklch(0.205 0 0)` → dark `oklch(0.985 0 0)`); webtheme `color.accent` is a single scheme-invariant seed → dark primary surface inexpressible without a 2nd theme | `color.accent` as a scheme-paired (`light-dark()`) role |
| 2 | token | shadcn derives its radius scale by `calc()` offsets of one base (`--radius-md = calc(--radius - 2px)`); webtheme radius is a flat independent scale — the derived relationship can't be encoded, so the scale drifts when re-themed | radius scale as calc-derived offsets of a base radius token |
| 3 | intent | Action Intent expresses semantic priority *levels*, but shadcn buttons also vary on an orthogonal emphasis-**style** axis (filled / outline / ghost / link) at the same priority — not expressible as a level | an emphasis-style dimension on Action Intent (fill \| outline \| ghost \| link) |
| 4 | token | shadcn `focus-visible` uses `--ring` + `--ring-offset`; webtheme has no focus-ring token role (semantic tier = intents, #403), so the focus affordance has no token home | a focus-ring role (color + offset) on the interaction/focus intent layer |
| 5 | token | shadcn leans on neutral surface roles `--border` / `--input` / `--muted` / `--muted-foreground` / `--secondary`; webtheme exposes only bg/fg/accent and no intent supplies neutral border/muted roles → input borders + muted text have no token home | neutral surface roles (border, muted, muted-foreground) on the surface intent |
| 6 | intent | Status Indicator Intent is lifecycle-state-driven (current state + next transitions); shadcn's badge is a decorative/standalone label with tone variants and no lifecycle semantics — mapping it onto a lifecycle chip over-constrains it | a decorative label/tag intent distinct from the lifecycle Status Indicator |

**Reading of the result:** the residue is real but *small and structured* — it clusters in two places
(scheme-paired/derived **tokens** and two **intent-axis** shortfalls), with nothing structural/behavioral
that required escaping WE/FUI. That is the reproduction-conformance thesis holding at the seed scale: the
delta between shadcn and the platform default is overwhelmingly `theme + intents`, and the gaps are
additive standard surfaces, not architectural escapes.

## Intake (gap-sweep #315)

Each gap is filed as a backlog item (token gaps → buildable webtheme stories; intent-axis gaps →
`decision` items, since *where* the axis lives is a design call, not a build): see the items opened
alongside this report, all surfaced-by #1243 / under the #315 program.

## Next

Re-run `/split 1243` once the rendered reproduction surface + the layered oracle co-evolve far enough to
seam per-component build slices against this scaffold (the split analysis's stated re-entry condition).
Expand the seed set (card, dialog, select…) on the next pass.
