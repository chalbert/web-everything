---
bornAs: xc1wd1f
kind: story
size: 3
parent: "2676"
status: open
dateOpened: "2026-07-26"
tags: []
scope:
  - "plateau-app:src/feature-tracker/design-snapshots.ts"
  - "plateau-app:src/feature-tracker/design-snapshots.test.ts"
  - "plateau-app:scripts/record-design-snapshot.mjs"
  - "plateau-app:public/design-snapshots/index.json"
  - "plateau-app:tests/visual/README.md"
---

# Capture dated design snapshots per feature — feed the design-increment filmstrip

The feature-tracking screen's visual-kind delivery marker is a design-increment filmstrip (shipped → current →
dashed ghost projected-next; [#2728](/backlog/2728-s6b-filmstrip-markers-visual-epics-empty-filmstrip.md), "S6b").
Nothing captures those dated per-feature snapshots today — verified: no schema field on a backlog item carries
one (see Fork 1 below), and no artifact store exists in either repo (`plateau-app:tests/visual/` only holds two
named, hand-maintained baseline PNGs — `board`, `console-grammar` — per
`plateau-app:tests/visual/baselines/PROVENANCE.md`).

## Decided design

**Store and capture live entirely in `plateau-app`; the WE backlog item is used only as an ID, never as a
storage layer.** Three named forks were real; all are decided here, not left open.

**Fork 1 — where the snapshot data lives.** Considered and REJECTED: a `designSnapshots:` field on the WE
backlog item's frontmatter. Verified against the live `/api/backlog` path
(`plateau-app:vite.config.mts:1041` → `plateau-app:src/backlog-view/loader.ts:50-93` →
`plateau-app:src/backlog-view/parse.ts:155-203`): the YAML frontmatter is parsed into a
`Record<string, unknown>`, but only a fixed, hand-listed set of fields is copied out into the wire type
(`we:contracts/backlog.ts:30-67`, `BacklogItemDTO`) — `plateau-app:src/backlog-view/parse.ts` builds the parsed
item field-by-field with no `...data` spread. An unlisted key like `designSnapshots` parses fine into the
intermediate object and is then silently dropped; it never reaches the client. Carrying it this way would mean
touching the **shared cross-repo contract** (`we:contracts/backlog.ts`) plus three `plateau-app` files, to move
image metadata through a channel designed for backlog *authoring* fields, not build artifacts. **Decided:** the
store is plain files in `plateau-app`, fetched directly by the browser — no WE-side change, no `/api/backlog`
change, no cross-repo contract touch.

**Fork 2 — `tests/visual/` vs `public/`.** `plateau-app:tests/visual/baselines/` (from resolved #2670) looks
like the obvious sibling, but it is a **Node/Playwright-side** fixture directory — never fetched by the running
browser app; it exists only for the Node comparator (`we:scripts/lib/visual-comparator.mjs`) and its Playwright
capture harness (`plateau-app:tests/visual/capture.mjs`). The feature-tracker's filmstrip is a **browser-rendered
UI surface** that needs these images and their dates at runtime. **Decided:** store snapshots under
`plateau-app:public/`, which Vite serves as static files (verified: no `publicDir` override and no existing use
of `public/` in `plateau-app:vite.config.mts` — confirmed by grep; the directory does not exist yet and is
unclaimed). `plateau-app:public/design-snapshots/index.json` is then fetchable at runtime from the app's own
origin, with per-file PNGs alongside it — zero new server code, mirroring how any other static asset is served.

**Fork 3 — automated vs explicit capture.** The original card's first option ("source from the design-studio
visual-diff / trace machinery") is **not viable today**: verified against
[#2676](/backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-committee-p.md) (Plateau
design-studio epic) — its request-intake / committee-run / ratify product surface is explicitly **unbuilt**
("kept unsliced for now... a future /slice candidate"), so there is no live pipeline that could call into a
per-feature capture step. **Decided:** ship explicit, manual capture now (a CLI script filing an already-produced
PNG); automated wiring is deferred and filed separately (see "Follow-up filed" below) rather than silently
dropped.

**Naming: key by epic id, not the future `kind:feature` id.** #2691/#2998 ratified a real `feature` tier but its
plumbing ([#2998](/backlog/2998-implement-the-feature-tier-kind-feature-above-epic-with-epic.md)) is still
`status: open`. Every sibling S1a–S12 slice under [#2705](/backlog/2705-feature-tracking-screen-ratified.md)
already uses the interim "feature≈epic" convention (verified: #2705's own text, "a read-only first slice over
existing epic data (feature≈epic interim) can start before it lands"). This card follows the same convention —
snapshots are keyed by WE backlog epic id — so it needs no new decision and stays consistent with what its
consumer (#2728) will read.

**Stale open question removed.** The original card asked "what does security, docs, orchestration, etc. each
get" for the per-kind delivery marker. Verified: this is already answered by a sibling slice opened one day
later in the same ratified planning session —
[#2731](/backlog/2731-s6a-ship-log-markers-build-epics-generic-fallback.md) ("S6a") explicitly delivers "a
generic fallback for other kinds." Dropped from this card's scope; not this card's work.

## Interfaces

`plateau-app:src/feature-tracker/design-snapshots.ts` — pure, unit-tested, no I/O (mirrors the S1a/#2718
read-model style: logic only, the caller supplies already-loaded data):

```ts
export type SnapshotKind = 'shipped' | 'current' | 'draft';

export interface DesignSnapshot {
  /** ISO date the snapshot was captured, e.g. "2026-08-13". */
  date: string;
  kind: SnapshotKind;
  /** Path relative to this epic's snapshot folder, e.g. "2026-08-13-current.png". */
  file: string;
  /** Optional human label shown in the filmstrip tooltip. */
  label?: string;
  /** Optional provenance — a PR/commit URL or claude.ai artifact link. */
  source?: string;
}

/** epicId (a WE backlog NNN, as a string) -> its snapshots, unsorted, as stored on disk. */
export type DesignSnapshotIndex = Record<string, DesignSnapshot[]>;

/**
 * Snapshots for one epic, sorted by date ascending. Unknown epicId -> [] (the honest "no snapshots" case
 * #2728/M24 renders). Malformed entries (bad `kind`, missing/unparsable `date`) are dropped, never thrown —
 * a hand-edited index must never crash the screen.
 */
export function snapshotsFor(index: DesignSnapshotIndex, epicId: string): DesignSnapshot[];

/** Pure validation the CLI (below) calls before writing — same rules `snapshotsFor` uses to drop entries,
 *  so the two can never disagree on what counts as well-formed. Returns an error message, or null if valid. */
export function validateSnapshotEntry(entry: unknown): string | null;
```

**Loading the index is explicitly out of this module's scope** (same split S1a leaves to S1b's data module):
whichever slice consumes this (#2728, or the feature-tracker's own data-loading slice) fetches the committed
index JSON at its served URL and passes the parsed result into `snapshotsFor`.

`plateau-app:scripts/record-design-snapshot.mjs` — a thin CLI wrapper, explicit/manual invocation (mirrors the
untested-orchestration precedent of `plateau-app:tests/visual/capture.mjs` / `plateau-app:tests/visual/render-baselines.mjs`;
the pure logic it calls is unit-tested, the fs orchestration itself is not):

```
node scripts/record-design-snapshot.mjs --epic=2705 --kind=current --file=tests/visual/shots/board.png \
  [--label="S1b shell landed"] [--source="https://github.com/chalbert/plateau-app/pull/123"]
```

Behavior: validates `--epic` and `--file` are present and `--file` exists; validates `--kind` is one of
`shipped|current|draft` via `validateSnapshotEntry`; copies the file into this epic's dated snapshot folder under
`plateau-app:public/design-snapshots/` (date = today, ISO, from the CLI's own clock; filename
`<today>-<kind>.png`); reads `plateau-app:public/design-snapshots/index.json` (or starts `{}`), appends the entry
under `index[epic]`, writes the file back pretty-printed. Errors (bad kind, missing file, missing flag): non-zero
exit, explanatory message, **no partial write** (validate fully before touching disk). This deliberately does not
itself run Playwright — get a PNG however you already do (`plateau-app:tests/visual/capture.mjs`'s
`captureSurface`, `plateau-app:tests/visual/render-baselines.mjs`, or an exported committee mock), then file it
with this script.

## Done when

- `plateau-app:src/feature-tracker/design-snapshots.ts` exports `SnapshotKind`, `DesignSnapshot`,
  `DesignSnapshotIndex`, `snapshotsFor`, `validateSnapshotEntry`; unit tests cover: unknown epicId → `[]`; single
  entry; many entries returned sorted by date ascending; an entry with an invalid `kind` or unparsable `date` is
  dropped, not thrown.
- `plateau-app:scripts/record-design-snapshot.mjs`, run against a real PNG with valid flags, writes the PNG into
  this epic's dated snapshot folder and appends a well-formed entry to
  `plateau-app:public/design-snapshots/index.json`.
- Run with a bad `--kind` (or a `--file` that doesn't exist), it exits non-zero and
  `plateau-app:public/design-snapshots/index.json` is byte-for-byte unchanged (no partial write).
- `plateau-app:public/design-snapshots/index.json` ships committed as `{}` — the real, honest empty state for
  every current epic, so #2728/S6b's "no snapshots" case (M24) can build and pass against real (not fixture)
  data.
- `npm test` (vitest) green in `plateau-app` for the new test file; `npm run check:standards` green in
  `webeverything` (this PR only touches this backlog card).

## Tasks

1. `plateau-app:public/design-snapshots/index.json` — commit as `{}`.
2. `plateau-app:src/feature-tracker/design-snapshots.ts` — types + `snapshotsFor` + `validateSnapshotEntry`.
3. `plateau-app:src/feature-tracker/design-snapshots.test.ts` — the Done-when cases above.
4. `plateau-app:scripts/record-design-snapshot.mjs` — CLI, calling `validateSnapshotEntry`.
5. `plateau-app:tests/visual/README.md` — one short section pointing at the new convention and why it's not
   under `tests/visual/` (browser-fetched runtime data, not a Node-side test fixture).

## Delivery shape

Lands as one small, additive PR in `plateau-app` — new files only, nothing existing is edited except the README
note. No consumer is wired yet (#2728/S6b consumes later, once it itself is unblocked by #2726). Ships behind
`main` incrementally; does not need a branch spanning multiple items.

## Follow-up filed

The deferred half of the original card — auto-capturing a snapshot from a design-studio committee run instead of
running the CLI by hand — is real future work, not dropped silently. Filed as
[#3127](/backlog/3127-auto-capture-a-design-snapshot-when-the-design-studio-commit.md), a child of #2676 not
yet buildable (#2676 has no committee-run product slice filed to block on — revisit once it is sliced).

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic
#2676 (Plateau design-studio). Committee decision-view artifact:
https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
