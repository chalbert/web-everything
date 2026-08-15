---
bornAs: xpoqw0q
kind: story
size: 5   # basis: matches sibling "mint an intent" stories (#1325, #1431 both size 5; #1484 size 3 for a
          # thinner case) — this one carries a fuller write-up than a bare 3-dimension intent (tagged-union
          # anchor documented in prose instead of as a dimension, 2 new glossary terms with collision
          # checks, and an explicit overlap check against 2 existing protocols), so it sits at the upper
          # end rather than #1484's floor.
status: open
dateOpened: "2026-07-18"
relatedProject: webintents
scope:
  - we:src/_data/intents/visual-diff.json
  - we:src/_data/semantics/visual-diff-intent.json
  - we:src/_data/semantics/delta-region.json
  - we:AGENTS.md
tags: [standards, visual-diff, intent, console-board]
---

# Mint the visual-diff intent — author the three-axis review-surface contract

Author the ratified `visual-diff` intent ([#2538](/backlog/2538-shape-the-annotated-visual-diff-surface-contract-then-decide-mint/), RATIFIED 2026-07-18): a WE-owned annotated before/after review surface. Each delta region carries three orthogonal axes — structural `type` (`added|removed|changed`), `nature` (`unplanned|expected`), review `disposition` (`unreviewed|accepted|rejected`) — plus a tagged-union anchor (`pixel-region|dom-selector|node-id|line-range`) and a per-region disposition model (`accepted` promotes built→baseline; an `expected` region parks as known-pending) with whole-surface approve composing above it. **Intent only** — the differ seam that produces typed regions is a separate standard, still an open decision ([#2544](/backlog/2544-design-the-visual-differ-protocol-two-renders-to-typed-delta/), not yet ratified — do not block on it or pull it into this card's scope). Measured against `we:src/_data/intents/audit-timeline.json` (the nearest non-covering neighbor, per #2538).

## Scope — files this item touches, and why nothing else does

- **`we:src/_data/intents/visual-diff.json`** (new) — the intent entry itself. Auto-discovered by the
  one-file-per-intent loader (`we:scripts/lib/intents-loader.cjs:16`, `readdirSync` + glob over
  `src/_data/intents/*.json`, sorted by `id`) — dropping the file in is the only wiring step; no registry
  array to hand-edit (`we:src/_data/intents.js` just calls `loadIntents()`).
- **`we:src/_data/semantics/visual-diff-intent.json`** (new) — glossary term for the intent's own concept,
  named to match the real sibling convention (see Interfaces below).
- **`we:src/_data/semantics/delta-region.json`** (new) — glossary term for the reviewable unit the intent
  introduces (used repeatedly across #2538/#2544 and the worked-example mockup; a genuinely new abstract
  concept, not a project artifact name — term-first per `we:docs/agent/conventions.md:144`).
- **`we:AGENTS.md`** — the auto-generated inventory block (`<!-- AUTO-GENERATED:inventory -->`,
  `we:scripts/gen-inventory.mjs:20`) must be regenerated after adding an intent/term or `check:standards`
  fails on staleness (confirmed live: `npm run check:standards` imports `renderInventory()` and diffs it
  against the committed file).

**No block, no differ, no demo registration, no vite-proxy change.** Verified against live code/consumers,
not assumed:
- No block entry is needed — `implementsIntent` links are optional and added when a block ships; none
  exists yet (grep confirmed, `we:src/_data/blocks/` has no visual-diff match) and none is owed by this card
  (we:docs/agent/design-first.md "Adding an intent" step 3 is the only block-side step, and it's conditional on a block
  existing).
- No demo registration — checked, **no `we:src/_data/demos.json` or equivalent registry exists in this
  repo at all**; the existing interactive mockup (`we:src/assets/visual-diff-surface-demo/index.html`) is
  decision-support scaffolding embedded directly in #2538's body (the `prepare-decision-item` skill's
  "operable mockup" pattern, `we:docs/agent/backlog-workflow.md:424`), not a site demo — it stays as-is,
  untouched by this item. Reference it while writing the `description` HTML below; do not move or re-home
  it.
- No `/intents/` catalog page change — it reads the assembled intent registry directly (we:docs/agent/design-first.md:
  "Catalog auto-renders"), so a new intent needs nothing beyond its own JSON file to appear.
- No vite dev-proxy change — `/intents/` is an existing top-level route, not a new one.

## Decided design (verified, not re-litigated — #2538 already ratified the contract)

**Three `dimensions`, not four — the tagged-union anchor is prose, not a dimension.** #2538's own title is
"author the **three**-axis review-surface contract"; the tagged-union anchor is named *separately* in the
same ratification, never counted as a fourth axis. This also matches the closest sibling precedent:
`we:src/_data/intents/annotation.json` documents its anchor mechanics (`we:src/_data/semantics/anchor.json`
is a *different*, already-taken concept — CSS Anchor Positioning's floating-element reference) as prose in
`description`, not as a `dimensions` entry, because an anchor is an addressing/interchange concern the
reviewer doesn't directly pick between — unlike `type`/`nature`/`disposition`, which the reviewer does see
and act on. `we:src/_data/intents/decision-trace.json` and `we:src/_data/intents/audit-timeline.json` follow
the same shape: the underlying record (`DecisionRecord`, `AuditEvent`) is described in prose, never promoted
to a `dimensions` key. So: `dimensions: { type, nature, disposition }`; the anchor tagged union is documented
in the `description` HTML as a payload shape (the exact JSON already published in #2538's worked example),
consistent with we:docs/agent/design-first.md's "intents are UX-only, no type shapes" rule — the anchor payload is
illustrative documentation of an interchange shape the differ/surface seam carries, not a new `dimensions`
axis.

**`composesIntents: ["selection", "status-indicator", "bulk-action"]` — recommended, not load-bearing.**
Grounded in the shipped mockup's real behavior (`we:src/assets/visual-diff-surface-demo/index.html:395-397`,
`select(id)` / `setDisp(id, d)` functions) and the ratified per-region + whole-surface accept model:
`selection` for picking one region to inspect (mirrors `we:src/_data/intents/annotation.json`'s own
`composesIntents: ["selection", ...]` for the analogous "user picks a target" moment), `status-indicator` for
the disposition chips (`we:src/assets/visual-diff-surface-demo/index.html:88-95`,
`.dot.rejected/.accepted/.unreviewed/.expected` — a semantic-tone chip is exactly what `status-indicator`
standardizes), `bulk-action` for the ratified "whole-surface approve composes above per-region disposition"
(Fork D) — a one-command fan-out over a target set is `bulk-action`'s exact residual. **This is not itself a
ratified fork** — #2538 never named these compositions — so treat it as the author's documentary judgment,
not a contract clause: if drafting the description surfaces a better fit, change it; it costs nothing (the
gate does not validate `composesIntents` targets — confirmed by reading `validateIntent()`, only
`requiresCapabilities` and the custom-intent `extends` chain are checked,
`we:scripts/check-standards-rules.mjs:1193-1256`).

**No compose-link to `reproduction-parity` or `change-tracking` — checked, genuinely distinct.** Both share
"delta" vocabulary but not scope: `we:src/_data/protocols/reproduction-parity.json` is a machine-only
verdict/gap contract the Plateau vision-judgment service emits for WE's own reproduction-conformance gate
(no human review surface, no anchor, no per-region disposition); `we:src/_data/protocols/change-tracking.json`
is state-mutation Change-Record observation (Proxy/signals/JSON-Patch), unrelated to rendered visual regions.
Note the distinction in the `description`'s scope-boundary paragraph (one sentence) so a future reader doesn't
mistake the overlap for a duplicate — no `composesContracts` link, because no ratified relationship exists to
assert.

**Status: `draft`** (not `concept`) — matches the sibling pattern for an intent whose contract is fully
shaped but has no implementing block yet (`we:src/_data/intents/annotation.json`,
`we:src/_data/intents/audit-timeline.json`, `we:src/_data/intents/decision-trace.json` are all `draft` at
this stage; `checkStatus()` accepts it, `we:scripts/check-standards-rules.mjs:854`).

## Interfaces — exact shapes to author (verified against the live validator, see Verification below)

**`we:src/_data/intents/visual-diff.json`:**
```json
{
  "id": "visual-diff",
  "name": "Visual Diff Intent",
  "status": "draft",
  "composesIntents": ["selection", "status-indicator", "bulk-action"],
  "summary": "Annotated before/after review surface — two panes (e.g. design vs built) with numbered, clickable delta regions carrying three orthogonal axes: structural type, divergence nature, and review disposition. The review-surface half of the visual-diff pattern; a separate differ protocol (follow-on, #2544) turns two renders into the typed regions this intent reviews.",
  "dimensions": {
    "type": {
      "description": "The structural nature of the delta — what changed about the region's existence between the two panes",
      "values": ["added", "removed", "changed"]
    },
    "nature": {
      "description": "Whether the divergence is planned/known or not — orthogonal to disposition. A region can be `expected` and `unreviewed` at once; `expected` classifies the divergence, it is never a review verdict.",
      "values": ["unplanned", "expected"]
    },
    "disposition": {
      "description": "The review verdict for a region. `accepted` promotes the built state into the baseline; an `expected` region parks as known-pending, outside the accept/reject workflow, independent of its own disposition.",
      "values": ["unreviewed", "accepted", "rejected"]
    }
  },
  "events": ["region-focus", "disposition-change"],
  "description": "<h3>What Visual Diff Is</h3>… (see prose outline below)"
}
```
Field-by-field, validated live against `validateIntent()` (`we:scripts/check-standards-rules.mjs:1193`,
which requires exactly `id, name, summary, status, dimensions` non-empty, checks `status` against the
`draft|concept|experimental|active` lifecycle, and warns only if `dimensions` is empty): **0 errors, 0
warnings** on this exact draft (probed with a throwaway script during preparation — see Verification).

`description` HTML — write these sections, in this order, matching the sibling inline-HTML style (`class="text-sm text-gray-600 mb-2"` paragraphs, `<h3>` headers — copy the tag/class pattern straight
from `we:src/_data/intents/annotation.json`'s `description` string):
1. **What Visual Diff Is** — the annotated before/after pattern; cite Percy/Chromatic/reg-suit as prior art
   (from #2538's research); one sentence on "owns the review UX, not the differ."
2. **Type** — the structural axis; `added|removed|changed`.
3. **Nature** — the divergence axis; `expected` is a state, never a verdict — the novel contribution #2538
   surfaced (spell this out, it's the load-bearing nuance a reader will otherwise miss).
4. **Disposition** — the review axis; per-region + whole-surface-approve-composes-above (Fork D), matching
   the demo's own `setDisp`/summary-chip behavior.
5. **Anchor payload** — prose, not a dimension (see Decided design above). Reproduce the tagged-union shape
   from #2538's worked example verbatim: `anchorType: 'pixel-region'|'dom-selector'|'node-id'|'line-range'`,
   `box?` for the pixel case, `ref?`/pane-refs for the structural cases. State plainly that the differ seam
   (follow-on, #2544, not yet ratified) is what *populates* this payload — this intent only consumes and
   renders it.
6. **Composition** — the three `composesIntents` entries, one line each, matching the Decided-design
   grounding above.
7. **Scope boundary** — no differ/comparison algorithm (follow-on #2544); distinct from the
   reproduction-parity protocol (machine-only ingestion) and the change-tracking protocol (state-mutation
   records) — one sentence each.

**`we:src/_data/semantics/visual-diff-intent.json`** (new; filename = `termSlug("Visual Diff Intent")` per
`we:scripts/lib/semantics-loader.cjs:20`):
```json
{
  "term": "Visual Diff Intent",
  "definition": "The canonical annotated before/after review surface — two panes with numbered, clickable delta regions, each carrying a structural type, a divergence nature, and a review disposition. Distinct from Structural Diff (generic snapshot-comparison change detection) and the Reproduction-Parity Verdict/Delta (a machine-only conformance-ingestion contract) — this is the human review-surface UX."
  ,"usage": "Standardized by the Visual Diff Intent (Web Intents)."
}
```
Named `"Visual Diff Intent"` (keeps the `Intent` suffix) to match the real, verified sibling pattern —
`we:src/_data/semantics/audit-timeline-intent.json`, `we:src/_data/semantics/decision-trace-intent.json`,
`we:src/_data/semantics/status-indicator-intent.json` all keep the suffix in practice, even though
`we:docs/agent/conventions.md:144`'s "term first, not the project artifact" line reads as a preference for
dropping it — the coverage check's `conceptKey()` strips the suffix either way
(`we:scripts/check-standards.mjs:322-325`), so both forms satisfy the gate; this card follows the corpus's
actual practice over the aspirational doc line, for consistency with the three nearest sibling intents.

**`we:src/_data/semantics/delta-region.json`** (new; filename `termSlug("Delta Region")` = `delta-region`):
```json
{
  "term": "Delta Region",
  "definition": "The reviewable unit of a visual-diff surface — a located divergence between two rendered panes, carrying a structural type (added|removed|changed), a nature (unplanned|expected), and a review disposition (unreviewed|accepted|rejected), plus a tagged-union anchor locating it in each pane.",
  "usage": "The unit dispositioned by the Visual Diff Intent; produced by the differ seam (follow-on protocol, #2544, not yet ratified)."
}
```
Verified no collision: `grep -rli` over `we:src/_data/semantics/` for both terms returned nothing (checked
live during preparation).

## Tasks (ordered)

1. Write `we:src/_data/intents/visual-diff.json` per the Interfaces section above (copy the JSON skeleton,
   author the full `description` HTML following the 7-section outline).
2. Write `we:src/_data/semantics/visual-diff-intent.json` and `we:src/_data/semantics/delta-region.json` per
   the Interfaces section above.
3. Run `npm run gen:inventory` to refresh `we:AGENTS.md`'s auto-generated counts (1 intent + 2 terms).
4. Run `npm run check:standards` — expect 0 errors (this repo currently carries ~1,371 pre-existing warnings
   unrelated to this change; do not chase them). Confirm no NEW warnings are introduced beyond the standard
   glossary-coverage class (none expected — both new terms are named to clear coverage).
5. Spot-check `/intents/` renders the new tile locally (11ty `:8080` or the Vite proxy `:3000` — no proxy
   change needed, verify it isn't 404ing anyway since this is a pre-existing route).

## Done when

- `we:src/_data/intents/visual-diff.json` exists, loads via the intent loader, and `validateIntent()` reports
  0 errors against it (mechanically checked by `npm run check:standards`).
- The intent's `dimensions` has exactly `type`, `nature`, `disposition` with the values ratified in #2538
  (`added|removed|changed`; `unplanned|expected`; `unreviewed|accepted|rejected`) — diffable against the
  Decided-design section above.
- The `description` covers all 7 sections named above, including the anchor tagged union
  (`pixel-region|dom-selector|node-id|line-range`) reproduced as prose, not a `dimensions` key.
- Two new glossary terms exist (`Visual Diff Intent`, `Delta Region`), each with non-empty `term` +
  `definition`, no duplicate-term error.
- `we:AGENTS.md`'s auto-generated inventory block matches `renderInventory()`'s output (i.e. `gen:inventory`
  was run after the above, not before).
- `npm run check:standards` exits 0 errors.
- The `/intents/` catalog page renders a `visual-diff` tile (manual spot-check, not gate-enforced).

## Delivery shape

**Lands as one piece, not incrementally.** The whole deliverable is 3 new files + one regenerated block —
there is no meaningful behind-`main` half-state to land first; `check:standards`' glossary/inventory checks
mean an intent added without its terms (or with a stale `we:AGENTS.md`) fails the gate immediately, so
partial landing isn't viable anyway. One lane, one PR, doc-only (`npm run check:standards` is the only gate
— no tests apply, this is JSON + one generated markdown block, no `.ts`/`.njk` touched).

## Verification performed during preparation (de-risk pass, per the story-preparation-checklist item 8)

Drafted the exact `we:src/_data/intents/visual-diff.json` shape above into a scratch file and ran it through the **live**
`validateIntent()` (`we:scripts/check-standards-rules.mjs:1193`, imported directly, not re-implemented) with
the real `intentById` map built from the intent loader against this lane's actual `src/_data/intents/` tree:
**0 errors, 0 warnings.** This confirms the decided design (3 dimensions, no `requiresCapabilities`, `status:
draft`) is not just plausible but mechanically passes the exact gate the build will run — the risky part
(does a hand-derived JSON shape actually satisfy the field/status/dimensions contract, or does the doc
undersell a required field) is de-risked before build, not discovered during it. Also ran the current
`npm run check:standards` on a clean tree as a baseline: **0 errors, 1,371 warnings** — establishing that the
warning count is a pre-existing sea unrelated to this item, so the build's own gate run should show the same
0 errors and a near-identical warning count (± the new terms/intent, which clear coverage).
