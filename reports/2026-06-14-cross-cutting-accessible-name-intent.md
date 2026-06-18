# Cross-cutting accessible-name intent — prior-art survey grounding decision #596

**Date**: 2026-06-14
**Point**: The web platform already standardizes *name computation* (W3C AccName); what recurs across glyphs/icons/media/images is a thin declarative *naming policy* (meaningful↔decorative + label-source/fallback) — enough, and recurrent enough, to earn its own composable `accessible-name` intent, but NOT a protocol (re-specifying AccName would be lock-in for zero interop gain).
**Plan file**: n/a (decision-prep, not a `plans/` inbox item)
**Research page**: `/research/accessible-name-intent/`
**Decision item**: `/backlog/596-candidate-cross-cutting-accessible-name-intent/`

---

## Question

Should Web Everything mint a **cross-cutting `accessible-name` intent** — a reusable `role=img`/`aria-label`/`aria-labelledby` naming policy composed across glyphs, icons, media, images, avatars — or keep accessible naming as a **per-intent dimension** owned individually by each intent that produces named non-text content (the way the expressive-symbol intent #587 currently owns its own accessible-name axis, and `validation` owns `aria-invalid`/`aria-describedby`)?

Surfaced by #370 Fork 3: the repo has no accessible-name intent (only `live-region-status`, which owns *announcement*, not *naming*). Independent of the #370 chain — a candidate to weigh, not a blocker.

## Recommendation (to ratify in #596)

1. **Mint a cross-cutting `accessible-name` intent** (Fork 1, med-high confidence). The concept recurs without its neighbour — icon, expressive-symbol, media, image, avatar all need the *same* meaningful-vs-decorative + label-source policy — which is exactly the "earns its own home" case for the standing separate-and-decouple bias. The counter (it's "too thin" because AccName already standardizes computation) is real but answered by Fork 2: the intent owns *policy*, not *computation*.
2. **Own the declarative policy axes only; defer name *computation* to the platform AccName algorithm** (Fork 2, high confidence). Dimensions: `naming` (meaningful | decorative) and `labelSource` (explicit | referenced | derived-fallback). It does **not** re-specify the aria-labelledby > aria-label > native > title precedence — that is the browser-implemented W3C standard, and re-minting it as a WE protocol is lock-in with no swappable-vendor interop gain (native-first; minimize lock-in).
3. **Everything else is support-all, not a decision**: orthogonal to `live-region-status` (naming ≠ announcement); #587 keeps its interim dimension and *graduates to composing* this intent once minted (a migration note, not a blocker).

## Key Findings

### 1. Name *computation* is already a platform standard — the browser does it
The **W3C Accessible Name and Description Computation (AccName 1.2)** defines, step by step, how every browser derives an element's accessible name from a fixed precedence: **`aria-labelledby` → `aria-label` → native (e.g. `<img alt>`, `<label>`, text content) → `title`**. A higher-priority non-empty source wins; lower ones are ignored. This is read-only computed state — you don't "implement" an accessible name, you provide *inputs* the browser reads. **Consequence for the classification:** there is no swappable-vendor runtime behavior to factor out, so the cross-cutting concern is **not a protocol** (Q2 of the per-fork classification). Re-specifying AccName precedence as a WE contract would be lock-in for zero interop gain.

### 2. The one cross-cutting naming primitive in the prior art is a thin icon wrapper
Across the benchmark systems, only **Radix `AccessibleIcon`** ships a *reusable* naming abstraction: wrap an icon, pass `label`, and it injects a visually-hidden label + `aria-hidden` on the glyph. Material 3, Carbon, Fluent, and the rest expose **per-component label props** that map straight to `aria-label`/`aria-labelledby` — no shared "naming intent." This confirms the recurrence (everyone needs it on icons/images) *and* that the existing solution is a thin policy wrapper, not a heavy mechanism — supporting "mint a small composable intent" over both "do nothing" and "build a protocol."

### 3. The policy that recurs is small but non-trivial and identical everywhere
Two declarative axes recur unchanged across glyph/icon/media/image:
- **meaningful ↔ decorative** — meaningful content gets `role="img"` + a label; author-chosen decorative content opts into `aria-hidden="true"`.
- **label source + fallback** — explicit (`aria-label`), referenced (`aria-labelledby`), or a derived fallback that is *never empty* (CLDR short name for emoji per #587; `alt` for images; **never** a raw codepoint or filename). Stickers/custom images have no derived fallback, so the label is *required*, not defaulted.
This is the substance a cross-cutting intent standardizes. Most-permissive default (Q6): **meaningful with a derived fallback** — the author opts *into* decorative.

### 4. WCAG 2.5.3 "Label in Name" couples visible text to the accessible name
Where a control has visible text, its accessible name must contain that text. This is a constraint the naming policy must respect (don't let `aria-label` override a visible label), reinforcing "defer computation to AccName" rather than inventing precedence.

### 5. Grounding refs in the real tree
- `we:src/_data/intents.json:155` — `live-region-status` (the only existing a11y intent; owns *announcement*, not naming).
- `we:src/_data/intents.json:899` — `icon` intent: dimensions are size/weight/style only, **no a11y/naming axis** — the gap a cross-cutting intent would fill for icons.
- `we:src/_data/intents.json:616` — `validation` intent: precedent for an intent owning its own aria surface (`aria-invalid`/`aria-describedby`) in-place — the "per-intent dimension" branch's strongest analogy.
- `we:backlog/587-author-the-expressive-symbol-rendering-intent-substrate.md` — #587 currently owns its own accessible-name dimension (role=img + CLDR fallback; sticker mode requires label).
- `we:backlog/370-...-expressive-symbols-...md` Fork 3 — surfaced the gap and spun out this candidate.
- `fui:frontierui/blocks/droplist/Clearable.ts:33`, `fui:frontierui/blocks/tabs/TabGroupBehavior.ts:177` — existing ad-hoc `aria-label`/`aria-labelledby` wiring with no shared policy home.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:reports/2026-06-14-cross-cutting-accessible-name-intent.md` | Created (this report) |
| `we:src/_data/researchTopics.json` | Added `accessible-name-intent` entry |
| `we:src/_includes/research-descriptions/accessible-name-intent.njk` | Created (write-up) |
| `we:backlog/596-candidate-cross-cutting-accessible-name-intent.md` | Rewritten to prepared-fork shape + `preparedDate` |
