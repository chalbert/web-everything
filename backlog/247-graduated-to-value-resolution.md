---
type: idea
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
tags: [tooling, check-standards, backlog, graduatedTo, validation]
crossRef: { url: /backlog/, label: Backlog }
---

# Make `check:standards` actually resolve `graduatedTo` values (not just presence)

Today the graduation nudge in `we:scripts/check-standards.mjs` only checks that a resolved item *has* a
`graduatedTo` — it never resolves the **value**. So a typo'd entity ref (`graduatedTo: intnet:droplist`)
or a stale pointer silences the warning just as well as a correct one, and the new sentinel
`graduatedTo: none` (sanctioned in `we:docs/agent/backlog-workflow.md` for resolved items that spawned no
entity) is indistinguishable from a bogus value.

Upgrade the check from *presence* to *resolution*:

- Accept the explicit sentinel **`none`** (resolved without a new entity) — silent, first-class.
- For any other value, parse the `kind:slug` form and verify it resolves to a real entity in the
  matching registry (`block:` → fui:blocks.json, `intent:` → we:intents.json, `protocol:` → we:protocols.json,
  `adapter:` → we:adapters.json, `project:` → we:projects.json, etc.) — **error** on an unresolvable ref, the
  same way `relatedProject`/`relatedReport`/`crossRef` are already resolved.
- Keep the existing exemption (`issue`/`review`/`decision` need no `graduatedTo`).

Surfaced while closing #189 (which set `graduatedTo: none`). Small, self-contained validator change
plus a couple of fixture cases in whatever exercises `check-standards`.

## Progress
- **Status:** resolved (2026-06-09). `graduatedTo: none` — enhanced existing tooling (`we:check-standards.mjs`), no new entity.
- **Key design finding:** existing `graduatedTo` values are **heterogeneous** — 17 compact `kind:slug`
  refs but **63 free-form** values (prose describing what was built, URL/file paths, `{url,label}`
  crossRef objects, the `none` sentinel). The item's "for any other value, parse the kind:slug form and
  error if unresolvable" reading would have **errored on 40+ legitimate prose values**. Resolved that by
  validating **only the compact `kind:slug` shape** (`^[a-z]+:[A-Za-z0-9_-]+$` — no spaces/slashes/dots,
  so prose/paths/URLs never match); everything else stays the sanctioned free-form. Catches the item's
  exact example (`intnet:droplist`) plus stale slugs, breaks nothing.
- **Done (`we:scripts/check-standards.mjs`):**
  - Loads `we:adapters.json` + `we:demos.json`; builds `GRADUATED_KINDS` (block/intent/protocol/project/plug/
    capability/adapter/demo → id-set + source file). Adapters resolve through the nested `items[]`.
  - In the backlog loop: a compact-shape graduatedTo with an unknown kind → error; a known kind with an
    unresolvable slug → error (via `dUnresolvedRef`, same as `relatedProject`). `none` + all free-form
    values don't match the shape and are untouched. Presence-nudge retained.
- **Gate / proof:** `check:standards` **0 errors** across all 239 real items (zero false-positives —
  pre-verified by a dry-run over every existing value). Negative-path proof against the real loader:
  `intnet:droplist`→ unknown-kind error, `intent:droplsit`→ unresolved-slug error, `intent:motion`/`none`
  → clean.
- **Scope note:** `we:check-standards.mjs` has **no unit-test harness** (no rule does — it's validated by its
  live run over the real registries); the live run + the negative-path proof are the conformance surface
  here, consistent with the rest of the tool. A dedicated harness would be a separate initiative, not a
  deferred piece of this change.
