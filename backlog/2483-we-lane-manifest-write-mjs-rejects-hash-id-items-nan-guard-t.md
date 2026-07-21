---
bornAs: xckahwf
kind: task
parent: "2445"
status: resolved
dateOpened: "2026-07-14"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
tags: []
---

# we:lane-manifest-write.mjs rejects hash-id items (NaN guard) though the manifest schema accepts them

The `we:scripts/lane-manifest-write.mjs` CLI refuses to write a manifest for a hash-id
item, even though the manifest schema it writes accepts hash ids. Under JIT-numbering
(#2288) a brand-new item carries a hash id until the drain assigns its real NNN at land —
so a lane working a fresh item cannot use the CLI at all and must hand-build the manifest.
This item captures the bug and the fix direction so an implementer can act without
re-deriving it. Confirmed real this session (2026-07-14).

## The bug

`we:scripts/lane-manifest-write.mjs` (line ~69) parses `--item` as a number and rejects
anything non-finite:

```js
const item = Number(flags.item);
if (!Number.isFinite(item)) emit({ ok: false, detail: 'pass --item=<NNN> (a finite item number)' }, 3);
```

So a hash id — e.g. `2482` — gives `Number('2482')` = `NaN`, and the CLI refuses
with exit 3.

But JIT-numbering (#2288) means a NEW item created via `we:scripts/backlog.mjs scaffold`
gets a hash id, and only earns its NNN when the drain numbers it at land. During the whole
lane life the item id IS a hash, so `we:scripts/lane-manifest-write.mjs` is unusable for it.

## Why it's an unnecessary guard

The manifest schema already supports hash ids. In `we:scripts/readiness/lane-manifest.mjs`:

- `asItemId(v)` keeps a hash as a string and coerces a number to `Number` (line ~37).
- `isItemId(v)` accepts a hash OR a finite number (line ~38).
- `buildManifest` runs `input.item` through `asItemId`, so it already takes a hash as-is.
- `validateManifest` accepts the resulting hash-keyed manifest, and the drain reads
  hash-keyed manifests fine.

So the CLI is stricter than the schema it writes — the `Number()` / `Number.isFinite`
check is an unnecessary NaN guard that rejects an id the rest of the pipeline handles.

## Observed

Filing item `2482` (which later landed as #2482) hit this exact refusal. As a
workaround the manifest had to be hand-built inline via `buildManifest` + `validateManifest`
rather than through the CLI. This item's own filing hit it again.

## Fix direction

In `we:scripts/lane-manifest-write.mjs`, validate `flags.item` with
`isItemId` / `asItemId` (imported from `we:scripts/readiness/lane-manifest.mjs`) instead of
`Number()` / `Number.isFinite`, and thread the item id through as-is — the same value
`buildManifest` already accepts. Keep rejecting a truly-absent or empty `--item` (guard on
presence, not on numeric-ness). Also thread the `--blocked-by` edges through `asItemId`
rather than `Number` so hash edges survive the same way.

**Delivered by** WE PR #495 (merged 2026-07-14).
