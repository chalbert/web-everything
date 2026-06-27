---
name: JSON registries auto-render their catalog
description: Discovery surfaces (/protocols/, /intents/) auto-render from their JSON registry. Authoring instructions must point at them, and check-standards.mjs must validate the registry so they stay aligned.
type: feedback
originSessionId: 401816cf-8ea8-48b6-b194-6bfa15bb0a3b
---
Catalog pages in Web Everything are tile indexes auto-rendered from a JSON registry — never hand-maintained.

- `/protocols/` ← `src/_data/protocols.json` (filters: Project + Status). Code: `src/protocols.njk`.
- `/intents/` ← `src/_data/intents.json` (filter: Status + free-text search across name/summary/dimension keys). Code: `src/intents.njk`. Dimension keys are NOT a filter facet — there are ~50 unique keys across ~22 intents, so chip filters would be unusable; text search hits them instead.

**Why:** When the `/protocols/` catalog landed, the user noted that "with AI a page to maintain is not too bad, especially if we update our instructions" — i.e. the cost of a catalog page is acceptable provided (a) authoring instructions tell agents the catalog auto-renders so they don't try to "register" entries elsewhere, and (b) a validator keeps the registry honest. Both are required; only one is fragile over time.

**How to apply:** When adding a new top-level entity that needs discovery:
1. Define a registry JSON at `src/_data/{thing}.json`.
2. Build `src/{thing}.njk` modeled on `src/protocols.njk` (intro → filter row → tile grid → empty state → vanilla JS filter script).
3. Add a nav link in `src/_layouts/base.njk`.
4. Extend the relevant "Adding a {thing}" section in `docs/agent/design-first.md` with a one-paragraph note: catalog auto-renders, required fields, validator-enforced.
5. Add a validator block to `scripts/check-standards.mjs` (required fields, status enum via `checkStatus`, `dupCheck`, plus any cross-registry resolution like `ownedByProject` for protocols). Update the final report line to include the new entity's count.
6. Cross-reference the catalog in `AGENTS.md` (one line under the canonical-data-files / discovery paragraph).
7. **Add the new top-level URL segment to the Vite dev-proxy allowlist** (`vite.config.mts`, the `^/(projects|adapters|…)` regex). A new catalog renders on 11ty `:8080` but **404s on Vite `:3000`** until proxied, and the edit needs a **Vite restart** to take effect. `check:standards` §9 now guards this — it cross-checks every `src/*.njk` permalink's first path segment against the proxy keys and fails the build on a missing one (backlog #210; this caught a latent `/adapters/` 404).

When the facet cardinality of a candidate filter is high relative to entry count (rule of thumb: more unique values than entries), use text search instead of chip filters — that's the lesson from the intent dimensions count.

**Guardrail — registry-ify only record-shaped content (#1792).** Before promoting an artifact type to this auto-rendered registry pattern, test whether it is *record-shaped*: does it have facetable frontmatter fields (status, owner, tags, dimensions) the catalog actually filters on? This pattern was built for structured records. Cargo-culting it onto **prose** (e.g. the 57 `### {#anchor}` rule headings in `docs/agent/platform-decisions.md`, a single living file edited every resolve) moves the authoring SoT off the standard's own form ([[feedback_authoring_sot_is_the_standard_form]]), shatters dense inter-entry cross-references into brittle cross-file IDREFs, and adds a filter UI with nothing to facet on. File-count ≠ schema-coupling ([[feedback_file_count_not_schema_coupling]]). For prose, keep markdown as SoT, render it to pages with stable heading **and inline** anchors, and derive just a lightweight **index** + a gate that every inbound citation anchor resolves — that synthesis (the #1792 default) buys the read-path, link-resolution, and discoverability without a records migration. The skeptic test that surfaces it: "what would the filter facet *on*?" — if the answer is "heading substring" (Ctrl-F), the catalog is YAGNI.
