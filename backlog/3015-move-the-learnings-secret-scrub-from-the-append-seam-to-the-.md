---
bornAs: xby3o0h
kind: story
size: 5
status: active
dateOpened: "2026-08-08"
dateStarted: "2026-08-14"
tags: [conveyor, learnings, security]
scope: [
  "we:scripts/lib/secret-scrub.mjs",
  "we:scripts/conveyor/learnings-drop.mjs",
  "we:scripts/conveyor/learnings-harvest.mjs",
  "we:scripts/backlog.mjs",
  "we:scripts/backlog-guard.mjs",
  "we:scripts/check-memory.mjs",
  "we:scripts/check-standards.mjs",
  "we:skills-src/harvest-learnings/SKILL.md",
  "we:scripts/__tests__/learnings-drop.test.mjs",
  "we:scripts/__tests__/learnings-harvest.test.mjs",
  "we:scripts/__tests__/close-session-sweep.test.mjs",
  "we:scripts/__tests__/backlog-guard.test.mjs",
  "we:scripts/__tests__/check-memory.test.mjs",
  "we:scripts/__tests__/backlog-cli-snapshot.test.mjs",
]
---

# Move the learnings secret-scrub from the append seam to the publish seam

Fork 3 of #2978 (ratified) removes the pool entry caps and moves the secret/entropy scrub "from the append
seam to the publish seam, because the pool is untracked local state but harvest output is committed and
pushed." This item builds that move. It is ordered **before** #3016 (`blockedBy: ["3015"]` on that card),
which adds an uncapped raw-quote field to the pool entry — that field removes the append seam's own
protection, so the exit gate must exist first.

## Where the scrub runs today (grounded)

`scrubReasons`/`isHighEntropyToken` (we:scripts/conveyor/learnings-drop.mjs lines 92-189) are called from
`validateEntry` (we:scripts/conveyor/learnings-drop.mjs line 243), which is called by two things:

- **`appendEntry`** (we:scripts/conveyor/learnings-drop.mjs lines 313-325) — the append seam. It throws
  *before* `appendFileSync` (lines 322-323) runs, so a rejected entry never touches disk. This protects
  only the machine-local, untracked pool file (`~/.claude/conveyor/learnings/<session>.jsonl` — confirmed
  present on this machine: 7 files, ~19 KB, dated Aug 8/13).
- **`readPool`** (we:scripts/conveyor/learnings-harvest.mjs lines 95-116, calling `validateEntry` at line
  110) — re-validates each line at harvest-*read* time, purely to decide candidate membership. It gates
  nothing; it filters already-on-disk lines.

**The seam that actually matters — where harvest content becomes a committed, pushed artifact — has zero
scrub today.** we:scripts/backlog.mjs's `scaffold()` (lines 524-572) writes the item straight to `fs` via
`writeBacklogMd` (we:scripts/backlog.mjs lines 96-118) with no call to `scrubReasons` anywhere. Memory topic
files are hand-authored via the `Write`/`Edit` tools; we:scripts/check-memory.mjs's `--pre` branch (lines
84-116) only gates the memory index itself (`isMemoryIndexPath`, lines 66-76, matches only the
we:agent-memory-src/MEMORY.md spelling, never
a numbered topic file under `agent-memory-src/`). So today: the append seam guards a file that never leaves
the machine, and the file that *does* leave the machine (backlog/memory, committed + pushed) is unguarded.

**A second, concrete mechanism gap:** we:scripts/backlog.mjs's own header comment (lines 90-95) already
documents this exact failure shape for a *different* check — locus-prefix hygiene (#1574): "the CLI write
path is the dominant... leak: `scaffold`/`resolve`/`settle` write digest + body... straight to `fs`, never
through the `Edit`/`Write` tools, so the load-bearing `PreToolUse --pre` hook never sees that content." A
`PreToolUse(Edit|Write)` hook (the mechanism we:scripts/backlog-guard.mjs's `--pre` / we:scripts/check-memory.mjs's
`--pre` use) fires **only** on Claude's own Edit/Write tool calls — never on a Bash-invoked CLI's own `fs`
writes. `scaffold` is exactly such a CLI call. #1574's fix was to run the same pure detector a **third**
time, inline in `writeBacklogMd` itself. This item mirrors that precedent rather than re-discovering it the
hard way: a hook-only design would leave the harvest's actual write path (`scaffold`) completely unscrubbed.

## Does moving it close the window, or just narrow it? (say plainly)

**Closes**, for the class that matters most: today nothing scrubs the committed artifact. After this item,
every path that writes backlog/memory content — the CLI funnel (`writeBacklogMd`, covering
scaffold/resolve/settle/retype/yield/prepare-stamp) and the `Edit`/`Write` tool (backlog body edits, memory
files) — is scrub-gated for secrets/credentials/PII/high-entropy tokens/absolute paths, *before* the write,
mirroring the append seam's own throw-before-write shape.

> **BUILD CORRECTION (2026-08-14), and it changes the "Narrows" list below.** The subset this card decided
> on — `SECRET_PATTERNS` + `PATH_PATTERNS` + `PII_PATTERNS` + `CRED_LABEL` + `isHighEntropyToken` — was
> measured against the committed corpus before wiring, and it fires on **1,276 of 3,319** `backlog/*.md` +
> memory files. Every sampled hit is legitimate content. Three families had to be retired BEYOND what this
> card planned, and the honest framing is that the gate is narrower than written here:
>
> - **`PATH_PATTERNS`' filesystem rules — retired.** This card asserted absolute paths "are never legitimate
>   in ... a backlog item". Measurement says otherwise: 1,077 files carry a match, and the matches are
>   site-relative routes (`/backlog/NNN-slug`, `/blocks/component`, `/api/backlog`) and the repo's own
>   documented machine conventions (the home-relative hooks settings file, `~/workspace/.lanes/<repo>/lane-N`
>   — a path this repo prints in its own error messages). Only the `user:pass@host` inline-credential rule
>   survives. A real `/Users/<name>/…` paste is therefore **not** blocked; #883 locus-prefix remains the path rule.
> - **The `≥40-char base64` and `≥20-char hex` rules — replaced, not kept.** The base64 rule's character
>   class includes `/`, so it fires on every long module path (343 files, e.g.
>   `we:plugs/webregistries/CustomElementRegistry`). The hex rule fires on git SHA citations, which are
>   legitimate and recurring; a SHA and a hex session token are the same string by shape. Both were replaced
>   by two entropy detectors calibrated against this corpus (blob entropy ≥ 4.8 bits/char vs a corpus max of
>   4.55; opaque-token vowel ratio < 0.20 vs a corpus min of 0.222). Measured detection on synthetic
>   secrets: 79% / 100% / 65% for 32-byte base64, 45-byte base64, 32-byte base64url — and **0% for bare
>   hex**. This is a probabilistic test, not a proof.
> - **`isHighEntropyToken` — not reused.** It fires on ordinary hyphenated prose (`UTF-16-code-unit`,
>   `JS-first-vs-CSS-first`) and on UUIDs that cards quote. `isOpaquePublishToken` is its calibrated twin.
> - **`PII_PATTERNS` — narrowed.** Email is restricted to personal-mailbox shapes (a service local part like
>   the git SSH remote, a `..`-containing domain, and single-character placeholders are exempt); IPv4
>   excludes loopback/RFC1918/link-local. Without that, the localhost address and the repo's own SSH remote
>   go red.
>
> **One real pre-existing hit was found and fixed**, which is separate from the harvest question this card
> settled below: `backlog/3055` carried the repo owner's actual email address in prose. It was redacted in
> the same change. The "no remediation needed" finding below still holds for its own claim — no harvest
> output ever reached a committed artifact — but "the corpus was clean" was never established, and it wasn't.

**Narrows, and this must be said honestly, not glossed over:**

1. **The code/path-identifying classes are dropped, not ported.** The old `scrubReasons` also rejected
   `CODE_PATTERNS` (arrow functions, import statements, SQL, HTML-with-attributes, fenced code) and
   `CODE_EXT`/`DOC_EXT`/`REPO_NAMES` token checks (any `.mjs`/`.md` mention, any "web-everything" mention).
   Those exist in the OLD schema for a reason stated in its own docstring
   (we:scripts/conveyor/learnings-drop.mjs lines 12-19): the drop-box is "TENANT-READY BY CONSTRUCTION" for
   the eventual multi-tenant feed (#2610) — a learnings entry should never carry raw code or a
   repo-identifying path. That rationale **inverts** once the destination is the repo's own backlog/memory
   corpus: a backlog item is *required* to cite `we:`-prefixed repo paths (#883, we:docs/agent/conventions.md), and #2978
   Fork 1's Grounding filter *requires* citing the corroborating artifact — almost always a repo path.
   Porting those two pattern families to the publish seam would make ordinary, correct authorship fail the
   gate. So the publish-seam scrub is a **deliberately narrower subset**: `SECRET_PATTERNS` +
   `PATH_PATTERNS` (absolute filesystem paths — these are never legitimate in either an entry or a backlog
   item, and keeping them double-enforces the existing #883 convention) + `PII_PATTERNS` + `CRED_LABEL` +
   `isHighEntropyToken`. `CODE_PATTERNS`, `CODE_EXT`/`DOC_EXT`, and `REPO_NAMES` are **retired at this
   seam**, named here so the loss is a decision, not a silent gap.
2. **`readPool`'s defense-in-depth disappears.** Once `validateEntry` no longer calls the scrub, a
   manually-appended or corrupted pool line with secret-shaped content is no longer dropped at harvest-read
   time — it now reaches the red-team/routing steps (i.e., an LLM's context) before the new publish-seam
   gate would catch it on the way to a committed file. Blocked from landing, not blocked from being read.
3. **A hook can still be bypassed locally** (disabled hooks, a future write path that calls neither
   `writeBacklogMd` nor goes through `Edit`/`Write`). Task 7 below adds a `check:standards`-level corpus
   sweep as the backstop — mirroring lint-locus-prefix's own hook+CLI+sweep trio — but a sweep is a later
   catch, not a same-turn deny; the window for that specific bypass is narrowed, not eliminated.

## Already-persisted data — remediation?

**No remediation needed, on current evidence.** `git log --all --oneline | grep -i harvest` shows no PR
that ever routed harvest output into `backlog/`/`agent-memory-src/` — the pipeline (#1068/#2978) exists but
has not yet completed a routing pass on this repo. The local pool (7 `*.jsonl` files present on this
machine) was written under the *currently still-active* append-seam scrub, so its content already clears
the bar being relocated. This item lands before any leak has had a chance to reach a committed artifact, and
before #3016 removes the protection that has covered the gap so far — that ordering is exactly why #3016
declares `blockedBy: ["3015"]`.

## Decided design

Extract the pure regex/entropy core out of we:scripts/conveyor/learnings-drop.mjs into
we:scripts/lib/secret-scrub.mjs (this repo's established pure-core home — mirrors
we:scripts/lib/write-all-sync.mjs). Keep `scrubReasons` (full set, unit-tested, still importable) and add a
new export:

```js
// we:scripts/lib/secret-scrub.mjs
export function scrubPublish(value) { /* string -> string[] */ }
```

Same contract as `scrubReasons` (empty array means clean), built from `SECRET_PATTERNS` + `PATH_PATTERNS` +
`PII_PATTERNS` + `CRED_LABEL` + `isHighEntropyToken` only — the subset named above, excluding
`CODE_PATTERNS`/`CODE_EXT`/`DOC_EXT`/`REPO_NAMES`.

**Old seam (removed):** `validateEntry` (we:scripts/conveyor/learnings-drop.mjs lines 218-254) drops its
`for (const reason of scrubReasons(v)) errors.push(...)` line (line 243). It keeps the allow-list, `kind`
enum, and per-field cap checks — those are unrelated to the scrub and out of this item's scope (cap removal
is #3016/#2978 Fork 3's job).

**New seam (added), three call sites — mirroring the #1574 hook+CLI+sweep trio:**

1. we:scripts/backlog.mjs, `writeBacklogMd(abs, rel, content)` (line 96) — call `scrubPublish(content)`
   before `writeBacklogMdUnguarded(...)`; `die()` with the joined reasons on any hit. This is the
   **load-bearing** gate: it is the one funnel every CLI card-mutation (scaffold/resolve/settle/retype/
   yield/prepare-stamp) writes through, so it is the only thing that actually covers `scaffold`.
2. we:scripts/backlog-guard.mjs, `--pre` branch (lines 79-103) — call `scrubPublish` on the
   already-computed `proposedContent(ev)` (line 88); `deny()` on any hit. Covers direct `Edit`/`Write`-tool
   body edits that never go through `we:scripts/backlog.mjs` (the normal way scope/tasks/design prose gets added after
   `scaffold`).
3. we:scripts/check-memory.mjs, `--pre` branch (lines 84-116) — broaden the match past `isMemoryIndexPath`
   to also cover a proposed write to a memory **topic** file (`agent-memory-src/*.md` /
   `.claude/agent-memory/*.md`, not just `we:agent-memory-src/MEMORY.md`); run `scrubPublish` on the proposed content, deny via
   the same exit-2 contract. Keep the existing budget/tree-shape logic scoped to the index only — memory
   files have no CLI writer to mirror (no dedicated memory-write script exists), so the hook is the *only*
   gate for them.

All three deny **before** the write executes (CLI: before `writeFileSync`; hooks: before the tool call
runs) — the same reject-before-persist shape the append seam had.

## Interface & protocol

```js
// we:scripts/lib/secret-scrub.mjs
export const SECRET_PATTERNS, PATH_PATTERNS, PII_PATTERNS, CRED_LABEL;   // moved verbatim from learnings-drop.mjs
export function isHighEntropyToken(tok) { /* string -> boolean */ }       // moved verbatim
export function scrubReasons(value) { /* string -> string[] */ }          // moved verbatim — full set, kept for tests
export function scrubPublish(value) { /* string -> string[] */ }          // NEW — publish-seam subset (see above)
```

- **Receives:** a single string field value (a digest, a proposed file's body/frontmatter text — scan the
  whole proposed content, matching how `writeBacklogMd`/`we:scripts/backlog-guard.mjs`/`we:scripts/check-memory.mjs --pre`
  already compute a single `content`/`proposedContent` string today).
- **Returns:** `string[]` of human-readable reasons; empty means clean. Pure, no I/O — identical contract to
  the existing `scrubReasons`, so every caller composes it the same way (`if (reasons.length) deny/die(...)`).
- **Old invocation site:** `validateEntry` calling `scrubReasons(v)` per text field, at append time
  (we:scripts/conveyor/learnings-drop.mjs line 243, called from `appendEntry` before `appendFileSync`).
- **New invocation sites:** `writeBacklogMd` calling `scrubPublish(content)` before `writeBacklogMdUnguarded`;
  we:scripts/backlog-guard.mjs's `--pre` calling `scrubPublish(proposedContent(ev))` before its existing
  checks resolve; we:scripts/check-memory.mjs's `--pre` calling `scrubPublish(proposed)` for a topic-file
  target, before its exit.

## Done when

1. `validateEntry` (we:scripts/conveyor/learnings-drop.mjs) no longer runs the entropy/secret/path/PII
   scrub — a secret-shaped value in `summary`/`area`/`suggestion` now **passes** `validateEntry` when it
   satisfies the allow-list/`kind`/cap rules. The existing "the scrub gate rejects leaks" tests
   (we:scripts/__tests__/learnings-drop.test.mjs lines 57-83) are updated to assert this, not deleted.
2. `scrubPublish` is unit-tested to (a) reject a synthetic secret-shaped fixture in each pattern family it
   keeps, and (b) **pass** ordinary backlog/memory-shaped prose that cites a `we:`-prefixed repo path and a
   short code identifier — proving the false-positive case named above is actually avoided, not just
   asserted.
3. **Adversarial — backlog, real path.** A test runs (in we:scripts/backlog.mjs's own CLI, via `scaffold`):
   ```bash
   node scripts/backlog.mjs scaffold --kind=story --size=1 --title='...' \
     --digest='<the synthetic marker>'
   ```
   The marker is `sk-` followed by `SYNTHETIC0000TESTMARKERNOTREAL`; it is spelled out only in
   we:scripts/__tests__/publish-secret-gate.test.mjs, never here — the whole-word form now trips the very
   gate this card builds, which is itself a live demonstration that the sweep works on this corpus.
   (An obviously-synthetic marker, never a real credential shape from any live service.) Run in a sandboxed
   backlog dir (mirroring we:scripts/__tests__/backlog-cli-snapshot.test.mjs's existing fixture pattern),
   asserts a non-zero exit with the rejection reason, and asserts **no new `backlog/*.md` file exists** on
   disk afterward.
4. **Adversarial — memory, real path.** A test feeds we:scripts/check-memory.mjs's `--pre` a `Write`
   hook-event JSON (on stdin) proposing a new `we:agent-memory-src/999-test.md` file whose body contains the
   same synthetic marker; asserts exit 2. A companion test proposes an otherwise-identical file with **no**
   secret but **with** a legitimate `we:scripts/...`-shaped path citation (the Grounding-filter shape) and
   asserts exit 0 — proving the gate doesn't regress normal memory authoring.
5. `we:scripts/backlog-guard.mjs`'s `--pre` denies (exit 2) a proposed `Edit`/`Write` to an existing `backlog/*.md`
   that would introduce the synthetic marker anywhere in the body, and passes an edit that adds ordinary
   prose plus a `we:`-prefixed path.
6. `check:standards` (or a small sweep folded into it, mirroring `we:scripts/lint-locus-prefix.mjs`'s `--all` mode)
   scans every `backlog/*.md` and memory-corpus `.md` file with `scrubPublish` and fails on a fixture
   containing the synthetic marker — the backstop for a write that bypasses both the hook and the CLI
   funnel.
7. `readPool`'s doc comment (we:scripts/conveyor/learnings-harvest.mjs lines 87-94) and the harvest
   `we:skills-src/harvest-learnings/SKILL.md` step 1 prose no longer claim it "re-applies the write-seam scrub (defence in depth)" — that
   claim becomes false once `validateEntry` drops the check, and a stale comment here is exactly the kind of
   silently-reintroduced hole #2978's own post-mortem warns about.
8. we:scripts/__tests__/close-session-sweep.test.mjs (lines 22-26) — a real, if dormant, `validateEntry`
   consumer (the module is explicitly superseded/unwired but still imports and tests `validateEntry`) — has
   its secret-rejection expectation updated to match the new behavior, so the suite doesn't silently start
   testing a stale claim.
9. `npm run check:standards` is 0 errors and the full `vitest` suite is green.

## Consumers checked, deliberately excluded

- **ES importers of `validateEntry`:** we:scripts/conveyor/learnings-harvest.mjs (updated, see above),
  we:scripts/conveyor/close-session-sweep.mjs (test updated, see Done-when 8 — the module itself is
  dead/unwired per its own header comment, "nothing in the close path calls it any more," so no behavior
  change is needed beyond its test).
- **Subprocess/hook callers of `we:scripts/conveyor/learnings-drop.mjs`:** doc-only mentions in
  we:skills-src/conveyor/*-brief.md, we:.claude/commands/*.md, we:docs/agent/platform-decisions.md — none
  call `validateEntry`/`scrubReasons` directly or need edits; they describe the CLI at a level this item
  doesn't change (`--kind`/`--summary`/... flags, `--session` requirement).
- we:scripts/lib/stdout-flush-scan.mjs — a comment mentioning `we:scripts/conveyor/learnings-harvest.mjs` as an example caller
  of `write-all-sync`; not a scrub consumer, excluded.

## Tasks

1. Create we:scripts/lib/secret-scrub.mjs: move `SECRET_PATTERNS`/`PATH_PATTERNS`/`PII_PATTERNS`/
   `CRED_LABEL`/`isHighEntropyToken`/`scrubReasons` verbatim; add `scrubPublish`. Re-export from
   `we:scripts/conveyor/learnings-drop.mjs` (so existing importers/tests are undisturbed).
2. Remove the `scrubReasons` call from `validateEntry`; update its docstring.
3. Fix the stale "re-applies the write-seam scrub (defence in depth)" claim in `readPool`'s docstring and in
   the harvest `we:skills-src/harvest-learnings/SKILL.md` step 1.
4. Wire `scrubPublish` into `writeBacklogMd` (we:scripts/backlog.mjs) — `die()` on any hit, before
   `writeBacklogMdUnguarded`.
5. Wire `scrubPublish` into `we:scripts/backlog-guard.mjs`'s `--pre` — `deny()` on any hit.
6. Extend `we:scripts/check-memory.mjs`'s `--pre` to match memory topic files (not just the index) and run
   `scrubPublish` on their proposed content; keep budget/tree-shape logic index-only.
7. Add the corpus-sweep backstop to `we:scripts/check-standards.mjs` (mirrors `we:scripts/lint-locus-prefix.mjs`'s `--all` mode).
8. Update/add tests per **Done when** 1-8: `we:scripts/__tests__/learnings-drop.test.mjs`, `we:scripts/__tests__/learnings-harvest.test.mjs`,
   `we:scripts/__tests__/close-session-sweep.test.mjs`, a new `we:scripts/__tests__/backlog-guard.test.mjs`, `we:scripts/__tests__/check-memory.test.mjs`,
   `we:scripts/__tests__/backlog-cli-snapshot.test.mjs` (or a new adversarial test file for `scaffold`).
9. `npm run check:standards` and `npm test`, clean.

## Delivery shape

**One piece, not incremental/behind a flag.** This is internal script hardening with no product-facing
surface to gate. It is safe to sequence *within* the one PR — add and test the three new gates first, then
remove the old `validateEntry` check last, in the same diff — but it must not land as two separate PRs: a
PR that only adds the new gates is harmless to ship early (pure addition), but a PR that removes the old
check without the new gates already in place and tested would be the exact hazard this item exists to
avoid. Land it whole.
