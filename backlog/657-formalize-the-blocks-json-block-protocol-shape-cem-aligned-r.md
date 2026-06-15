---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["641"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: src/_data/blocks.json (implementedBy field, CEM-aligned block-protocol shape) + scripts/check-standards.mjs (form validation)
tags: []
---

# Formalize the blocks.json block-protocol shape (CEM-aligned) + repoint every sourcePath to FUI

Execute Fork 1 of the #641 ruling: pin src/_data/blocks.json to a CEM-aligned structural-contract field set (implementsIntent/exports/events/traits/webStandards) as the canonical WE-side block-protocol shape, paired with each src/_includes/block-descriptions/{id}.njk behavioral spec. Fix the lying sourcePath on every entry — repoint from WE's vendored blocks/ copy to the canonical @frontierui/blocks impl (or add a typed implementedBy field). No new schema; extend the surface that already exists. Emitting a real custom-elements.json is a deferred sub-build, not in scope.

## Progress (2026-06-15, resolved)

Chose the **typed `implementedBy` field** option (the ruling's blessed alternative to repointing `sourcePath`) — `sourcePath` literally implies WE owns the source, which is exactly the lie #641 removes; `implementedBy` honestly names the impl's canonical home.

- **blocks.json** — renamed `sourcePath` → `implementedBy` on all **31** entries, repointing the value `blocks/…` → `@frontierui/blocks/…` (a single localized splice; all 31 were `blocks/`-prefixed). The other CEM-aligned contract fields (`implementsIntent`/`exports`/`events`/`traits`/`webStandards`) already existed — this pins them as the canonical block-protocol shape.
- **scripts/check-standards.mjs** — the validator checked `sourcePath` via `existsSync` under WE root. That re-encodes the vendored-copy assumption #641 removed, so it now validates the *form* of `implementedBy` (must reference `@frontierui/blocks/…`), **not** local existence — per Fork 3-A a contract may precede its impl (the 9 WE-only families migrate to FUI in #658). Active-without-impl warning repointed to the new field name.
- **docs/agent/design-first.md** — "Adding a block" step now documents the CEM-aligned block-protocol shape + `implementedBy` (impl lives in `@frontierui/blocks`, never WE-local; the old `sourcePath` was removed).

Gate: `npm run check:standards` green (64 blocks, 0 errors). The physical delete of WE's vendored `blocks/` + migration of the 9 WE-only families is **#658** (out of scope here); emitting a real `custom-elements.json` is a deferred sub-build.
