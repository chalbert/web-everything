---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-17"
tags: [blocks, blocks-json, architecture, 11ty, data-loader, concurrency]
relatedProject: webdocs
crossRef: { url: /backlog/657-formalize-the-blocks-json-block-protocol-shape-cem-aligned-r/, label: "#657 pinned the field set, not file granularity" }
---

# Split the monolithic blocks.json into one file per block spec (assemble via a _data loader)

The block structural contract lives in one 4657-line `we:src/_data/blocks.json`, while every other per-item surface is one-file-per-item: behavioral specs are already per-block (`we:src/_includes/block-descriptions/*.njk`, 80 files), and the 866-item backlog has no `backlog.json` — it globs `we:backlog/*.md` via a `_data` loader (one of 12). The monolith is the lone holdout and it hurts: every block edit collides on one file (the concurrent-edit conflict the backlog dodged by going per-file), diffs lose locality, and the structural half is inconsistent with its already-per-block behavioral half. Decide: keep the monolith vs split to per-file specs assembled by a `we:src/_data/blocks.js` glob loader (recommended, ~85%). #657 pinned the field set but not file granularity — an open gap, not a re-litigation. Orthogonal to #841.

## The evidence — per-file is already the repo norm; blocks.json is the holdout

| Surface | Granularity | Assembled by |
|---|---|---|
| Backlog (866 items) | one `we:backlog/<NNN-slug>.md` per item, **no `backlog.json`** | `we:src/_data/backlog.js` (glob loader) |
| Block behavioral specs (80) | one `we:src/_includes/block-descriptions/<id>.njk` per block | 11ty include per block |
| Block **structural** contract (75) | **one 4657-line `we:src/_data/blocks.json`** | — (monolith) |

The repo already has **12** `_data/*.js` glob loaders (`backlog.js`, `cases.js`, `burndown.js`, …), so
glob-and-assemble is the idiomatic pattern here, not a new mechanism. The structural contract is the only
per-item surface that didn't follow it — and its *own* behavioral half already did.

## Fork — monolithic `blocks.json` vs per-file block specs

*Fork-existence (case b, genuine either/or):* the contract is authored either as one aggregate file or as
N per-block files; both produce the same assembled `blocks` collection, so it's a real default-posture call.

- **A — Per-file block specs, assembled by a `we:src/_data/blocks.js` loader (recommended, ~85%).** One file
  per block; a loader globs them into the same `blocks` array templates + scripts consume today. Mirrors the
  backlog (`backlog.js`) exactly. **Wins:** (1) **concurrent-edit conflicts vanish** — the #1 driver; one big
  JSON means every block edit collides, the same hazard the backlog dodged by dropping `backlog.json` and the
  reason `intents.json`/`adapters.json` are spliced-not-rewritten; (2) **diff/locus locality** — a one-block
  change is a small clean diff with an unambiguous path (feeds #880); (3) **consistency** — structural spec
  sits beside its already-per-block `block-descriptions/<id>.njk`; (4) **scale** — 75 → growing.
- **B — Keep the monolith.** *Con:* the conflict/diff/scale costs above; inconsistent with every other
  per-item surface. *Pro:* zero migration, trivially atomic cross-block ops — but those ops are equally easy
  on the assembled array, so the pro is thin.

**Recommended default: A.** Confidence ~85%. Residual is purely the layout sub-choice below + the one-time
migration cost; the direction is strongly precedented (the backlog already proved it in this exact repo).

## Layout sub-choice (decide with A)

- **B1 — Flat `we:src/_data/blocks/<id>.json`** + the existing per-block njk staying in `block-descriptions/`.
  Minimal move; loader globs `_data/blocks/*.json`. (Note: 11ty would also expose `_data/blocks/` as nested
  data, so the loader is named to *replace* that and emit the array shape templates expect.)
- **B2 — Co-located `we:blocks/<id>/{spec.json, description.njk}`** — the full per-block bundle in one dir,
  structural + behavioral together. Cleaner ownership, larger move (relocates 80 njk files + retargets the
  include resolution). **Lean B1 first** (smaller, reversible toward B2 later), but call it at ratify.

## Migration plan (on ratify A)

- Write `we:src/_data/blocks.js` (copy `we:src/_data/backlog.js`'s glob pattern) → assembles `blocks` array,
  preserving sort/shape.
- Split `blocks.json` → per-block files (scripted, deterministic).
- Repoint the ~10 readers (`we:scripts/gen-cem.mjs`, `we:scripts/check-standards.mjs`,
  `we:scripts/check-app-conformance.mjs`, …) — most read the assembled `blocks`, so a shared loader keeps
  them unchanged; only direct `readFileSync('blocks.json')` sites (`gen-cem`) need the glob.
- Keep cross-block validation (unique `id`, intent refs) operating on the assembled array.
- Delete `blocks.json` only after the gate is green on the assembled collection.
