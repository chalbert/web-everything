---
bornAs: xx9738m
kind: story
size: 3
parent: "2505"
status: open
relatedTo: ["2550"]
blockedBy: ["2550"]
scope:
  - we:contracts/backlog.ts
  - plateau-app:src/backlog-view/webcases-resolver.ts
  - plateau-app:src/backlog-view/webcases-source-registry.ts
  - plateau-app:src/backlog-view/webcases-source-registry.test.ts
  - plateau-app:src/backlog-view/webcases-source-write.ts
  - plateau-app:src/backlog-view/webcases-source-write.test.ts
  - plateau-app:src/backlog-view/webcases-sources.json
  - plateau-app:vite.config.mts
  - plateau-app:src/backlog-view/card-taxonomy-docs.ts
  - plateau-app:src/backlog-view/card-taxonomy-docs.css
  - plateau-app:src/backlog-view/card-taxonomy-docs.test.ts
  - plateau-app:src/main.ts
tags: [plateau-loop, console, webcases, web-docs, viewer, source-registry]
dateOpened: "2026-07-25"
---

# Webcases viewer: durable source registry + add-a-source (carved from #2550)

**Part 1 of the original #2550**, carved out so it rides its own lane. #2550's Part 2 (per-case review-verdict
persistence — the coalesced "Submit review" flush → committed ledger seam) is delivered in plateau-app PR #104.
This item is the remaining half: making the **source registry** itself durable, using the *same* seam.

## Why carved
The two halves share the ratified coalesced-flush-to-committed-file seam but are independent surfaces. Part 2
built the whole write path (`runReviewWriteFlow`, the committed-file pattern, the write verb + endpoint branch,
the localStorage-buffer + Submit UX). This item **reuses that seam** for source registration, so it should land
AFTER #104 (`blockedBy: 2550`) to avoid touching the same files in parallel.

## What already exists (do NOT rebuild)
- Server registry `plateau-app:src/backlog-view/webcases-resolver.ts`: `REGISTRY` (a compile-time const with
  two entries — `console`, `acme`), `listWebcaseSources()` (→ the `GET /api/webcases` index / datalist), and
  `resolveWebcases(src)`. Verified live 2026-08-15 — matches this description exactly (lines 38-60).
- The "load a source" input + datalist and `repoCaseSource(ref)` fetch-by-id in
  `plateau-app:src/backlog-view/card-taxonomy-docs.ts` (lines 88-113, 366-381) — so an *already-registered*
  source is browsable today; what's missing is durable **registration** of a new one.
- The coalesced write seam from #2550 Part 2 (PR #104, merged 2026-07-22), verified live 2026-08-15:
  `plateau-app:src/backlog-view/webcases-review-write.ts` (`runReviewWriteFlow`/`startReviewWrite`, a
  cross-repo lane→PR: acquires a **plateau-app** lane from WE's pool, `writeFileSync`s the committed JSON, a
  re-parse gate, stage-only-the-file, commit, push, `gh pr create --label ready-to-merge`),
  `plateau-app:src/backlog-view/webcases-reviews-ledger.ts` (pure fold + serialize, browser-safe), the
  `'webcase-review'` `WriteVerb` + `source`/`verdicts` fields on `WriteRequest`
  (`we:contracts/backlog.ts:123-125,166-169`), and the endpoint branch in
  `plateau-app:vite.config.mts:741-771`. **This item generalizes the same shape with a sibling write verb
  (`webcase-source`), not a rewrite of `runReviewWriteFlow` itself** — see Decided design.

## Blocker found + filed (2026-08-15)
`blockedBy: ["2550"]` is **satisfied in substance but not in bookkeeping**: `gh pr view 104 --repo
chalbert/plateau-app` confirms PR #104 `state: MERGED`, `mergedAt: 2026-07-22T18:49:30Z`, and the merged code
matches #2550's Part-2 acceptance. But `backlog/2550-*.md` frontmatter is still `status: open`, so the
readiness engine (`we:scripts/check-readiness.mjs`) still counts this as an unresolved blocker. Filed
[#x8ua0pa](/backlog/x8ua0pa-resolve-2550-its-tracked-deliverable-plateau-app-pr-104-alre.md) — a size-1
mechanical status splice — rather than working around it here. **A builder should confirm that item is
resolved (or resolve #2550 directly) before claiming this one**, since the readiness tool will otherwise
refuse to surface it as unblocked.

## Verified against live code (2026-08-15)
- The client/server duplication the card describes is real and current: `plateau-app:src/main.ts:710-719`
  declares `CASE_SOURCES = [CONSOLE_SOURCE, { id: 'acme-webdocs', label: 'Acme — Web Docs', ... }]`, while the
  server `REGISTRY` (`plateau-app:src/backlog-view/webcases-resolver.ts:38-41`) declares the same two sources
  keyed `console` / `acme` — different id for the same Acme source (`acme-webdocs` vs `acme`).
- `resolveWebcases(src)` only ever resolves the **compile-time** `REGISTRY` — it does not, and per the phase
  rule below cannot, resolve an arbitrary newly-registered source's real case data server-side. This is the
  fork the next section resolves.
- The plateau project's phase rule (`plateau-app:CLAUDE.md:53-77`, "THE PHASE RULE — no backend in the MVP")
  is a **standing, already-ratified constraint**: Phase 1 is browser-only, no backend/live-serve/git-clone
  resolution; real git/registry resolution is explicitly parked at **#554** and is "NOT to be built before
  live-serve is on the roadmap." `plateau-app:src/backlog-view/webcases-resolver.ts:8-13`'s own header comment
  confirms the same thing for this exact module: "Real git/registry resolution (clone a repo URL, read its
  webmanifest + webcases)… drops in here when live-serve is on the roadmap (parked under #554), NOT a
  rewrite." Any design that has the **server** fetch/clone an arbitrary `load-ref` at resolve time would be
  building #554 early, out of phase. The decided design below avoids this.

## Scope
- **Durable registration.** A registered source persists across a dev-server restart: a committed registry
  file (`plateau-app:src/backlog-view/webcases-sources.json`) holding `{ id, label, loadRef }` entries,
  written through the same coalesced lane→PR seam #104 built — a sibling `webcase-source` write verb (see
  Decided design for why a sibling verb, not a generalized `runReviewWriteFlow`, is the shape). The resolver
  index (`listWebcaseSources()` / `GET /api/webcases`) merges the two built-in entries with the committed
  file's entries.
- **Add-a-source UI.** Beyond the current fetch-by-id input: an "add a source" form (id · label · load-ref)
  that registers durably via the write seam and shows the new source in the picker on reload.
- **Fold the two hard-coded client sources.** `plateau-app:src/main.ts` `CASE_SOURCES` declares `CONSOLE_SOURCE`
  + an inline `acme-webdocs`; the server `REGISTRY` declares `console` + `acme` — the same logical sources
  declared twice, inconsistently. Make the server registry the single source of truth for **id + label**; the
  client derives those from it (see Decided design for why the actual `load()`/`runtime` stay client-owned
  bundles rather than becoming a network fetch).

## Decided design

**Fork: how does a newly-registered source's actual case data get resolved — server-side (git/URL fetch in
the resolver) or client-side (the browser fetches `loadRef` directly)?** This is the one real design decision
the original card left implicit under "the resolver merges the two built-in entries with the committed file."
**Decided: client-side.** `loadRef` is a URL the **browser** `fetch()`s directly, expecting the same
`{ manifest, cases }` JSON shape `repoCaseSource` already parses
(`plateau-app:src/backlog-view/card-taxonomy-docs.ts:104-110`). The server's role is limited to (a) durably
persisting the `{id, label, loadRef}` triple via the write seam, and (b) merging committed entries into the
**index** (`GET /api/webcases`, id+label+loadRef only) so the picker/datalist knows they exist after a reload.
The server's `resolveWebcases(src)` — the `?src=<id>` case-data resolver — is **unchanged**; it continues to
serve only the two compile-time bundles. Why: the phase rule (above) already parks real git/registry
resolution at #554; having the server fetch an arbitrary `loadRef` at request time would be exactly that
parked work, done early and without its own design pass. A same-origin browser `fetch()` of a URL that
already returns `{manifest,cases}` JSON needs no new backend capability, stays in phase, and reuses the exact
response shape the viewer already validates. CORS is the registering source's problem, same as any external
fetch — not something this item builds infrastructure for.

**Corollary — the client "load a source" input gains a second loader, not a rewrite.** Today `repoCaseSource(ref)`
always calls `GET /api/webcases?src=<ref>` (works only for the two built-ins). A **new** client function,
`registeredCaseSource(id, loadRef)`, `fetch()`s `loadRef` directly (no runtime — same "safe baseline" contract
`repoCaseSource` already documents at `plateau-app:src/backlog-view/card-taxonomy-docs.ts:83-87`). The
datalist-index response (`GET /api/webcases`) is extended to carry an optional `loadRef` per entry; the
"load a source" form-submit handler picks `registeredCaseSource` when the matched suggestion carries a
`loadRef`, else falls back to today's `repoCaseSource` (built-ins / a manually-typed ref).

**Corollary — folding the two hard-coded client sources does NOT become a network round trip.** Re-fetching
`console`/`acme` over HTTP instead of importing their bundles at build time would (a) add a network dependency
+ latency to the app's own default/self-hosted view, and (b) **regress their preview rendering**: a
`repoCaseSource`/`registeredCaseSource`-loaded source deliberately carries **no** `CaseRuntime`
(`plateau-app:src/backlog-view/card-taxonomy-docs.ts:83-87`), but `acme` needs
`runtime.scripts: [previewRuntimeUrl('acme')]` to register its `<auto-complete>` custom element inside the
sandboxed preview frame — losing that would render empty previews. So `load()` and `runtime` for
`console`/`acme` **stay exactly as they are today** (bundle-in-hand, imported at build time). Only their
**id + label strings** are made single-sourced: `plateau-app:src/main.ts` derives them from `listWebcaseSources()` (a
synchronous, compile-time call — the resolver module does no I/O, so no async mount change is needed) instead
of hardcoding `'acme-webdocs'` / `'Acme — Web Docs'` inline. This is the literal fix for the "declared twice,
inconsistently" duplication the card names, without any of the risk of a network-driven re-architecture.

**Registration is single-shot, not coalesced-batch.** Unlike review verdicts (many marks flushed together),
one add-a-source submit is one entry. It mirrors `scaffold`/`waiver` (single POST → 202 pending job → poll →
`opened`/`failed`), not the `webcase-review` buffer/localStorage machinery — no new client-side buffer module
is needed.

**Collision policy.** Registering an `id` that collides with a compile-time built-in (`console`/`acme`) is
rejected (400) — an add-a-source submission must never be able to shadow/break the app's own default sources.
Registering an `id` that already exists in the **committed** file is an upsert (re-registering updates its
label/loadRef) — matches the ledger's existing upsert-by-key pattern
(`plateau-app:src/backlog-view/webcases-reviews-ledger.ts:23-37`), and needs no separate "edit" verb.

## Interfaces and protocol

**1. `we:contracts/backlog.ts` — the write-port contract.** Slice-0 WE PR, mirroring the precedent commit
`48812b52` ("WE #2550: add webcase-review write verb + ReviewVerdictEdit to the write-port contract"):
```ts
export type WriteVerb =
  | 'claim' | 'release' | 'resolve' | 'prioritize' | 'tier' | 'rank'
  | 'weights' | 'build-queue' | 'scaffold' | 'waiver' | 'webcase-review' | 'webcase-source';
```
Add to `WriteRequest` (reuses the existing `source?: string` field as the new source's id — semantically
"the source this request concerns," already used that way by `webcase-review`):
```ts
/** For `webcase-source` (#2662): register/update a durable webcases source. `source` carries the new
 *  source's id (reused from `webcase-review`'s field); `label` + `loadRef` are this verb's own. */
label?: string;
loadRef?: string;
```

**2. `plateau-app:src/backlog-view/webcases-sources.json` — the committed registry file.** Seed content `{}`
(exactly like the review ledger's own seed). Shape: `Record<id, { label: string; loadRef: string }>`,
sorted-by-key on write (mirrors the ledger's serialize convention).

**3. `plateau-app:src/backlog-view/webcases-source-registry.ts` — NEW pure module** (browser-safe, no `fs`),
mirroring `plateau-app:src/backlog-view/webcases-reviews-ledger.ts`:
```ts
export type SourceRegistry = Record<string, { label: string; loadRef: string }>;

/** Upsert one registration (pure). Rejects (throws) if `id` collides with `builtInIds` — the caller passes
 *  the compile-time REGISTRY's ids so a registration can never shadow console/acme. */
export function applySourceRegistration(
  registry: SourceRegistry, id: string, label: string, loadRef: string, builtInIds: ReadonlySet<string>,
): SourceRegistry;

/** Serialize with keys sorted, matching the ledger's stable-diff convention. */
export function serializeSourceRegistry(registry: SourceRegistry): string;
```

**4. `plateau-app:src/backlog-view/webcases-resolver.ts` — extend, do not rewrite.** Add one new exported
function; `REGISTRY` and `resolveWebcases` are unchanged:
```ts
/** The index merged with a committed registry (#2662): built-ins first (their real id/label), then any
 *  committed entry not already a built-in id. Pure — the caller reads the committed file and passes it in. */
export function mergedSourceIndex(
  committed: SourceRegistry,
): ReadonlyArray<{ id: string; label: string; loadRef?: string }> {
  const builtIns = listWebcaseSources(); // existing function, unchanged
  const extra = Object.entries(committed)
    .filter(([id]) => !builtIns.some((b) => b.id === id))
    .map(([id, e]) => ({ id, label: e.label, loadRef: e.loadRef }));
  return [...builtIns, ...extra];
}
```

**5. `plateau-app:src/backlog-view/webcases-source-write.ts` — NEW, mirrors
`plateau-app:src/backlog-view/webcases-review-write.ts` exactly** (same cross-repo shape: acquire a
**plateau-app** lane from **WE's** pool, pure `writeFileSync`, re-parse gate, stage-only-the-registry-file,
commit, push, `gh pr create --label ready-to-merge --repo chalbert/plateau-app`):
```ts
export function readSourceRegistryFile(path: string): SourceRegistry; // missing/bad JSON → {}, never throws

export interface SourceWriteOpts {
  poolRoot: string; targetRoot: string; ghRepo: string; registryRel: string;
  id: string; label: string; loadRef: string; builtInIds: ReadonlySet<string>; dryRun?: boolean;
}
export async function runSourceWriteFlow(o: SourceWriteOpts, deps?: {...}): Promise<{ number: number; url: string }>;
export function startSourceWrite(store: WriteJobStore, opts: SourceWriteOpts, deps?: {...}): WriteJob;
```
Commit subject: `` `webcases: register source "${id}" — ${label}` ``. Branch:
`` `lane/webcases-source-${stamp}-ui` `` (timestamped, not id-scoped, matching the `weights`/`webcase-review`
non-item-scoped branch convention). Coalesce key: `store.create('source', 'webcase-source', ...)` +
`pendingByNum('source')` 409-on-concurrent-flush guard, matching `webcase-review`'s
(`plateau-app:vite.config.mts:761-762`) — one registration in flight at a time is an acceptable, precedented
simplification for a rare admin action.

**6. `plateau-app:vite.config.mts` — wiring, mirroring the `webcase-review` branch
(lines 741-771) almost exactly:**
- New const beside the ledger-rel const, `WEBCASES_SOURCES_REL`, holding the repo-relative path to the new
  registry file (`plateau-app:src/backlog-view/webcases-sources.json`).
- Imports: `mergedSourceIndex` from the resolver module; `readSourceRegistryFile, startSourceWrite` from the
  new source-write module.
- `webcasesApi()`'s index branch (the `if (!src) return sendJson(res, 200, { sources:
  listWebcaseSources() })` case) becomes:
  ```ts
  if (!src) {
    const committed = readSourceRegistryFile(join(__dirname, WEBCASES_SOURCES_REL));
    return sendJson(res, 200, { sources: mergedSourceIndex(committed) });
  }
  ```
- Add `'webcase-source'` to `WRITE_VERBS`.
- New branch in the POST `/api/backlog/write` handler, sibling to the `webcase-review` branch:
  validate `body.source` (id: required, ≤64 chars, `/^[a-z0-9][a-z0-9-]*$/`, must NOT match a built-in id from
  `listWebcaseSources()` → 400 "id is reserved for a built-in source"), `body.label` (required, 1-80 chars,
  same plain-character allowlist the `scaffold` branch's title validation uses), `body.loadRef` (required,
  ≤2000 chars, must parse as a `URL` with protocol `http:`/`https:` → 400 otherwise, reusing the same
  fail-closed shape-validation style as the `weights`/`webcase-review` branches). On the 409 coalesce guard,
  refuse like `webcase-review` does. Call `startSourceWrite(writeJobs, { poolRoot: resolution.root,
  targetRoot: IMPL_REPOS['plateau-app'].root, ghRepo: IMPL_REPOS['plateau-app'].ghRepo, registryRel:
  WEBCASES_SOURCES_REL, id, label, loadRef, builtInIds: new Set(listWebcaseSources().map(s => s.id)), dryRun:
  !!body.dryRun })`.

**7. `plateau-app:src/backlog-view/card-taxonomy-docs.ts` — client changes:**
- New export `registeredCaseSource(id: string, label: string, loadRef: string): CaseSource` (sibling to
  `repoCaseSource`, same error-handling shape — `id`, `label`, `load: async () => fetch(loadRef)…`, no
  `runtime`, id NOT `repo:`-prefixed so it round-trips with the registry entry).
- The datalist-index GET response type gains `loadRef?: string` per suggestion entry; the fetched
  `suggestions` array widens from `Array<{id,label}>` to `Array<{id,label,loadRef?}>` (no other shape change).
- The "load a source" form-submit handler: before falling back to `repoCaseSource(ref)`, check
  `suggestions?.find(s => s.id === ref || s.id === ref.toLowerCase())`; if found and it carries `loadRef`, use
  `registeredCaseSource(s.id, s.label, s.loadRef)` instead.
- New "Register a source" form (a sibling control block to the existing "load a source" form): three inputs
  (id, label, load-ref URL) + submit. Wiring mirrors the existing review-submit/poll pair but single-shot:
  POST `{ verb: 'webcase-source', source: id, label, loadRef }` to the write endpoint, poll the job id, on
  `opened` push the new `{id,label,loadRef}` into the in-memory `suggestions` cache + repopulate the datalist
  (so it's immediately loadable this session without a hard reload) and show a status line; on
  `failed`/`409` show the server's error and keep the form's values so the operator can retry.

**8. `plateau-app:src/main.ts` — fold, id/label only:**
```ts
import { listWebcaseSources } from './backlog-view/webcases-resolver';
// ...
const acmeMeta = listWebcaseSources().find((s) => s.id === 'acme');
const CASE_SOURCES: readonly CaseSource[] = [
  CONSOLE_SOURCE,
  {
    id: acmeMeta?.id ?? 'acme',
    label: acmeMeta?.label ?? 'Acme — Web Docs',
    runtime: { scripts: [previewRuntimeUrl('acme')] },
    load: async () => ({ manifest: SEED_MANIFEST, cases: SEED_CASES }),
  },
];
```
(The `?? ` fallback is defensive only — `listWebcaseSources()` is a compile-time const lookup that cannot
fail at runtime; it exists so a future rename of the registry key doesn't silently blank the label.)

## Tasks

1. **WE slice-0 PR** (small, own PR, lands first): add `'webcase-source'` to `WriteVerb` + `label`/`loadRef`
   to `WriteRequest` in `we:contracts/backlog.ts`, mirroring commit `48812b52`. Gate: WE `check:standards`.
2. Confirm [#x8ua0pa](/backlog/x8ua0pa-resolve-2550-its-tracked-deliverable-plateau-app-pr-104-alre.md) is
   resolved (or resolve #2550 directly) so this item reads as unblocked before claiming it.
3. Add `plateau-app:src/backlog-view/webcases-sources.json` (seed `{}`).
4. Add `plateau-app:src/backlog-view/webcases-source-registry.ts` (`applySourceRegistration`,
   `serializeSourceRegistry`) + its test file (mirror the ledger test's cases: upsert, built-in-collision
   rejection, no-mutate-input, other-ids-untouched).
5. Add `mergedSourceIndex` to `plateau-app:src/backlog-view/webcases-resolver.ts`.
6. Add `plateau-app:src/backlog-view/webcases-source-write.ts` (`readSourceRegistryFile`,
   `runSourceWriteFlow`, `startSourceWrite`) + its test file (mirror the review-write test's `stubSh` pattern:
   asserts the plateau-app lane is acquired, only the registry file is staged, the PR opens on
   `chalbert/plateau-app`, and the file on disk carries the new entry).
7. Wire `plateau-app:vite.config.mts` per Interface item 6 (index-merge branch, `WRITE_VERBS`, the new POST
   validation branch).
8. Add `registeredCaseSource` + the "Register a source" form + its wiring in
   `plateau-app:src/backlog-view/card-taxonomy-docs.ts`, small companion CSS in
   `plateau-app:src/backlog-view/card-taxonomy-docs.css`.
9. Fold `plateau-app:src/main.ts`'s `CASE_SOURCES` per Interface item 8.
10. Add/extend tests in `plateau-app:src/backlog-view/card-taxonomy-docs.test.ts`: register-a-source submit →
    202 → poll → `opened` → new source appears in the datalist and is loadable via `registeredCaseSource`; a
    built-in-id collision is rejected client-visibly; a 409 concurrent-flush keeps the form's values.
11. Run plateau-app `npm test` (all suites) and WE `check:standards`; check both themes render (the new form
    + its status line).

## Done when

- [ ] `we:contracts/backlog.ts` carries `'webcase-source'` on `WriteVerb` and `label`/`loadRef` on
      `WriteRequest`; WE `check:standards` passes.
- [ ] Registering a source through the add-a-source UI (id · label · load-ref) persists it to
      `plateau-app:src/backlog-view/webcases-sources.json` via a lane→PR opened on `chalbert/plateau-app`,
      labelled `ready-to-merge`, staging only that one file.
- [ ] After that PR merges and the primary plateau-app checkout is synced, `GET /api/webcases` includes the
      new source (id, label, loadRef) — the SAME staleness contract every other lane→PR console write already
      has (no new "doesn't show up" regression relative to `webcase-review`/`claim`/`resolve`).
- [ ] The registered source is selectable via the "load a source" input and renders through
      `registeredCaseSource` (a direct client-side `fetch(loadRef)`, no server round trip for the case data).
- [ ] Registering an `id` that collides with a compile-time built-in (`console`/`acme`) is rejected (400) and
      the built-in's own registration is provably unaffected.
- [ ] `plateau-app:src/main.ts`'s `CASE_SOURCES` no longer hardcodes the Acme id/label literal — both are read
      from `listWebcaseSources()`; `console` and `acme` keep rendering with their existing runtime intact (no
      preview regression — the acme case still shows its `<auto-complete>` custom element correctly rendered).
- [ ] plateau-app `npm test` is green (existing suites unmodified in behavior except the explicitly-listed
      new/changed files; nothing under the review-ledger/-write files changes).
- [ ] WE `check:standards` reports 0 errors.
- [ ] Both light and dark themes render the new "Register a source" form correctly.

## Delivery shape

**Two ordered PRs across two repos — cannot land as one increment behind `main`, because plateau-app's
`@webeverything/contracts/backlog` alias resolves to the sibling WE checkout on disk
(`plateau-app:tsconfig.json:58` → the WE contracts file), so the type has to exist on WE's `main` before
plateau-app can import it.**

1. **WE PR (slice 0, Task 1 above):** the contracts file only. Small, mirrors the precedent commit
   `48812b52`. Lands first.
2. **plateau-app PR (Tasks 3-11):** everything else — the registry file, the two new modules + tests, the
   `plateau-app:vite.config.mts` wiring, the viewer UI + its tests, the `plateau-app:src/main.ts` fold. One PR (the new write-flow module
   and its `vite.config.mts` wiring are coupled at the import boundary, same as #104 landed as one PR).

Both PRs are otherwise independently landable at their own pace once ordered correctly; neither needs a
feature flag (the new form only appears once its wiring exists, and existing sources/verbs are untouched).
