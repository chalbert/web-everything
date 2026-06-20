---
kind: story
size: 3
status: resolved
blockedBy: ["596"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "intent:accessible-name"
tags: []
---

# Mint the accessible-name cross-cutting intent

Mint a cross-cutting accessible-name intent in we:intents.json, ratified by #596. It owns the declarative naming policy only — two axes: naming (meaningful | decorative) and labelSource (explicit | referenced | derived-fallback) — and defers name computation to the platform W3C AccName 1.2 algorithm (not re-specified, not a protocol). Most-permissive default: meaningful + derived-fallback; decorative (aria-hidden) is the author opt-in. Derived fallback is never empty (CLDR short name for emoji, alt for images); custom images require an explicit label. icon/glyph/media/image/avatar compose it. Also add a migration note to #587 so its interim accessible-name dimension graduates to composing this intent.

## Scope

Ratified by [#596](/backlog/596-candidate-cross-cutting-accessible-name-intent/) (both forks = A). The decision settled *what* this intent is; this item builds it.

- **Add the `accessible-name` entry to [we:intents.json](../src/_data/intents.json)** following the existing entry shape (`live-region-status` at [we:intents.json:155](../src/_data/intents.json#L155) and `validation` at [we:intents.json:616](../src/_data/intents.json#L616) are the nearest a11y-intent precedents). Splice the single entry — never JSON.stringify-roundtrip the whole file.
- **Two policy axes only:**
  - `naming`: `meaningful` (default) | `decorative`. Decorative ⇒ `aria-hidden`; the author opts in.
  - `labelSource`: `explicit` | `referenced` (`aria-labelledby`) | `derived-fallback` (default). Derived fallback is never empty — CLDR short name for emoji (per #587), `alt` for images. Custom-image/sticker has no fallback ⇒ label is **required**, not defaulted.
- **Most-permissive default:** `meaningful` + `derived-fallback`.
- **Defer computation:** do **not** restate the AccName `aria-labelledby > aria-label > native > title` precedence — that's the browser's job (native-first, minimize-lock-in). Not a protocol, no we:adapters.json entry.
- **Composition:** icon/glyph/media/image/avatar compose this intent rather than each redefining naming. No Technical Configurator card.
- **#587 migration note:** add a note on [#587](/backlog/587-author-the-expressive-symbol-rendering-intent-substrate/) that its interim accessible-name dimension graduates to composing this intent once minted (a migration note, not a blocker on #587).

## Acceptance

- `accessible-name` intent renders on `/intents/` from the registry (catalogs auto-render from JSON).
- `npm run check:standards` green; docs build smoke (`npx @11ty/eleventy --dryrun`) clean.
- #587 carries the migration note.
