# Report — Promoting Internationalization to the `webintl` Project

**Date**: 2026-05-31
**Plan**: `~we:/.claude/plans/i-d-like-you-to-fluffy-noodle.md`
**Scope**: Materialize **Web Intl (`webintl`)** as a standalone Web Project that owns
a **Localization Protocol**, realizing a new **Locale Intent**, and re-home the existing
`internationalization` research topic under it.
**Prompted by**: the gap-analysis triage
([we:reports/2026-05-31-standards-gap-analysis.md](2026-05-31-standards-gap-analysis.md)), which ranks
Internationalization as the **#1 missing standard** — the strongest native-aligned gap, already
backed by open research but with no home of its own.

---

## 1. The question

The `internationalization` research topic has existed since 2026-02-23, parented under `webadapters`.
But i18n is not a library bridge — it owns a real conformance contract (message composition + locale
negotiation) that vendors must satisfy for catalogs to interoperate. The question the gap analysis
posed: **standalone `webintl` project, or leave it under `webadapters`?** Decision: **standalone**.
A native-aligned domain that universally recurs across apps and attracts its own registry, plugs, and
(eventually) blocks warrants its own project.

## 2. The lens — native-first

Every `webintl` decision follows the repo's North Star: the web platform already ships the hard part
of *formatting individual values* (`Intl.NumberFormat/DateTimeFormat/PluralRules/ListFormat/Segmenter/
DisplayNames`, `dir`/`:dir()`, CSS logical properties). What it lacks is *composing messages*,
*managing catalogs*, and *switching locale reactively*. The project claims **only that gap**: native
`Intl` is the default formatter; FormatJS / i18next / Lingui / Paraglide are opt-in adapters behind a
registry seam. Unicode **MessageFormat 2.0** is the default message syntax precisely because it is the
syntax `Intl.MessageFormat` (TC39 Stage 1) will expose natively — today's polyfill becomes tomorrow's
native call with no source change.

## 3. What was authored

| Layer | Decision |
|---|---|
| **Project** | `webintl` — standalone, `concept`, category `standard`. |
| **Protocol** | One cohesive **Localization Protocol** (`protocol-localization`) — contract + registry + observable states + MF2 message shape — mirroring how `webreliability` nests one Error Recovery Protocol. Splitting into several protocols is deferred until one grows its own registry/blocks. |
| **Plugs** | One contract + registry pair: `CustomTranslationProvider` (`resolve(key, locale) → MessageFn \| null`) + `CustomTranslationProviderRegistry` (`window.customTranslations`, first-that-resolves). MessageFormatter and LocaleNegotiation stay protocol-internal contracts for now. |
| **Intent** | New **Locale Intent** (`locale`) — dimensions `locale` (BCP-47, open-valued), `direction` (`ltr`/`rtl`/`auto`), optional `numbering`/`calendar`. Retroactively fills the RTL/format gaps implied by `temporal`/`typography`/`anchor`. |
| **Research** | `internationalization` re-homed from `webadapters` → `webintl`; `relatedPlugs` updated to the new translation plugs. |
| **Semantics** | 8 new terms: Localization, Locale Negotiation, Fallback Chain, Message Catalog, MessageFormat 2.0, Message Function, Translation Provider, Bidi. |

## 4. Design decisions

- **First-that-resolves, null-means-decline.** Providers are tried in registration order; the first
  whose `resolve()` returns a non-null `MessageFn` owns the message; `null` continues down the locale
  fallback chain. Consistent with `CustomRecoveryHandler` (`tryRecover`) and route matching
  (`matchRoute`).
- **`resolve()` returns a function, not a string.** The `MessageFn = (params?) => string` shape lets
  the same resolved message re-format with different params and lets compile-time (tree-shaken)
  message functions slot in with no shape change.
- **MF2 over ICU 1.0** as the default syntax — forward-compatible with native `Intl.MessageFormat`.
- **No built-in catalog.** The protocol ships no messages; apps register only the providers they need.

## 5. Composition, not reimplementation

`webintl` owns message composition and locale negotiation — not the reactive locale *value*
(`webstates` `CustomStore`), the lazy-load *UX* (Loader Intent), the *direction* declaration (Locale
Intent), or URL *locale routing* (Router). Each composes with a neighbouring standard.

## 6. Deferred (not this pass)

- No runnable TypeScript — concept phase ships contracts; the MF2 provider, lazy-namespace provider,
  and library adapters are the first planned implementations.
- No `we:adapters.json` entries (FormatJS/i18next/Lingui/Paraglide noted as planned, not registered).
- No separate MessageFormatter / LocaleDetector plug entries — kept as protocol-internal contracts.

## 7. Files created / modified

| File | Action |
|---|---|
| `we:src/_data/projects.json` | + `webintl` entry |
| `src/assets/icons/webintl.svg` | new (globe glyph, indigo gradient) |
| `we:src/_includes/project-webintl.njk` | new (Mission, Feature Surface, How, Localization Protocol, Composition, Status) |
| `we:src/_data/protocols.json` | + `localization` protocol (`ownedByProject: webintl`, `realizesIntent: locale`) |
| `we:src/_data/plugs.json` | + `customtranslationprovider`, `customtranslationproviderregistry` |
| `we:src/_includes/plug-descriptions/customtranslationprovider.njk` | new |
| `we:src/_includes/plug-descriptions/customtranslationproviderregistry.njk` | new |
| `we:src/_data/intents.json` | + `locale` intent |
| `we:src/_data/researchTopics.json` | `internationalization` re-homed to `webintl` |
| `we:src/_data/semantics.json` | + 8 terms |

## 8. Open questions carried forward

- Ship an MF2 polyfill now, or wait for `Intl.MessageFormat` (Stage 1, potentially years out)?
- Offer both runtime (plugged) and compile-time (unplugged, Paraglide-style) modes, or one default?
- Normalize translation file formats (JSON/PO/XLIFF/ARB/Fluent) at build time, or one canonical format?
- Missing-key strategy — Locale Intent dimension or registry option?
