---
bornAs: xnxjxq6
kind: story
size: 2
tier: pinned
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Daemon rebuild recovers a clone dirtied only by a stray backlog claim stamp

2026-09-29: the build daemon clone was dirtied by a stray backlog frontmatter edit (status: open→active + dateStarted on we:backlog/3809-*.md, written by a misdirected worker run). we:scripts/lib/daemon-rebuild.mjs refuses a dirty clone unless every dirty path is a known DAEMON_STATE_FILES entry, so every overlay and rebuild stopped until a human restored the file (the guard correctly blocks agents from writing to the clone). MVP: treat a dirty path under we:backlog/ whose diff is ONLY claim-stamp frontmatter keys (status, dateStarted, claimedBy-style fields) as recoverable: log it loudly (alert + the diff), restore the tracked copy, and continue; anything else stays a hard refuse. Test: claim-stamp-only diff → restored + alert; any body/other-key change → refused. Proof: replay the 2026-09-29 diff.

## Progress

- Old scope: claim-stamp keys = "status, dateStarted, claimedBy-style fields". Corrected: `claim` writes ONLY `status` + `dateStarted` (`we:scripts/backlog/frontmatter.mjs:225` (applyTransition, claim branch)); no `claimedBy` field exists. The same two-key fact is already relied on at `we:scripts/operations/probation-build-run.mjs:113` (BUILD_OWNED_FRONTMATTER_KEYS). So the allowed keys are exactly `status` and `dateStarted`.
- Old scope: only `we:scripts/lib/daemon-rebuild.mjs`. Corrected: add the test file `we:scripts/lib/__tests__/daemon-rebuild.test.mjs`.
- Live evidence: `~/.claude/daemon-self-sync-state/538b34848923b948.alerts.jsonl` and its sibling alerts file `a48e86d0fc118d97` hold repeated `kind: dirty` rows naming the card we:backlog/3809-wip-report-is-readable-on-a-phone-full-word-descriptions-no.md as modified, from 2026-09-29T23:34Z on. The card filed in `a684ab19d`.

## Design

Today the dirty refusal works like this:
- `we:scripts/lib/daemon-rebuild.mjs:486` (findUnsafeLocalState) returns `reason: 'dirty'` with the porcelain lines.
- `we:scripts/lib/daemon-rebuild.mjs:1210` (ensureSafeToMove) then calls `we:scripts/lib/daemon-rebuild.mjs:621` (migrateDaemonStateFiles). That only recovers when EVERY dirty path is in `we:scripts/lib/daemon-rebuild.mjs:578` (DAEMON_STATE_FILES). A backlog path is not, so the rebuild refuses as `dirty` forever.

Add one more recovery step, next to the state-file carry:

1. New PURE helper `isClaimStampOnlyEdit(headText, workText)` in `we:scripts/lib/daemon-rebuild.mjs`. Returns true only when ALL hold:
   - both texts have a `---` frontmatter block (CRLF-tolerant, same regex shape as line 430);
   - the text after the frontmatter (the body) is byte-identical;
   - the frontmatter lines, with every `status:` and `dateStarted:` line removed, are identical;
   - HEAD `status` is `open` and the working `status` is `active` or `preparing` (the only two claim targets).
   Keep it local. Do not import `we:scripts/lib/probation-launcher.mjs` (frontmatterTamperedBeyondClaim): it pulls `we:scripts/lib/provider-routing.mjs` and more into the daemon's import graph, which this file keeps light (see line 435).
2. New exported `restoreStrayClaimStamps({ git, root, dirty, fs })` (fs injectable, default `readFileSync`), mirroring migrateDaemonStateFiles:
   - `paths = modifiedPathsOf(dirty)`; `null` or empty → `{ ok:false, reason:'not-claim-stamps', restored:[] }`.
   - Ignore paths that are DAEMON_STATE_FILES entries (the existing carry owns them).
   - Every other path must match `^backlog/[^/]+\.md$` AND pass `isClaimStampOnlyEdit(git show HEAD:<path>, working file)`. If ANY path fails, restore NOTHING and return `ok:false, reason:'not-claim-stamps'` (all-or-nothing, as today).
   - For each backlog path: capture `git diff HEAD -- <path>`, re-read the file and require it unchanged since the check, then `git checkout HEAD -- <path>`. A failed show/read/restore → `ok:false` with a specific reason (`head-unreadable`, `file-busy`, `restore-failed`).
   - Returns `{ ok:true, restored:[{ path, diff }] }`.
3. In `ensureSafeToMove`, on `reason === 'dirty'`, call `restoreStrayClaimStamps` FIRST. For each restored entry raise `alert('backlog-claim-stamp-restored', { path, diff })` (loud: alerts file + log). If `ok`, re-run `findUnsafeLocalState`; if still `dirty`, fall through to the existing migrate step unchanged. A non-`not-claim-stamps` failure raises `alert('backlog-claim-stamp-restore-failed', { reason })`.

Mixed dirt (a claim stamp plus a scorecard row) recovers both. Any other dirt still refuses as `dirty`, exactly as before.

## MVP

The two helpers plus the `ensureSafeToMove` wiring. Modified (`M`) lines only. A rename, delete or conflict line still makes `modifiedPathsOf` return `null` and refuses.

## Test plan

Add `describe('rebuildClone — a stray backlog claim stamp is restored, never a freeze (#4561)')` to `we:scripts/lib/__tests__/daemon-rebuild.test.mjs`, reusing `makeFixture`/`advanceMain`/`passSmoke`/`LOCK_OPTS` like the state-file block at line 1713. Seed a committed fixture card (id 9001, in the fixture repo backlog folder) with `status: open`. Cases:
1. `restores a claim-stamp-only edit, alerts with the diff, and moves the clone` — flip to `status: active` + add `dateStarted: "2026-09-29"`; expect `moved:true`, clean status, HEAD = origin/main, and an alert `backlog-claim-stamp-restored` whose `detail.path` is the card and `detail.diff` contains `+status: active`.
2. `restores a status: preparing claim stamp too`.
3. `refuses a body change in the same card as dirty` — stamp + one body line edited; expect `reason:'dirty'`, file still modified, no restore alert.
4. `refuses a change to any other frontmatter key as dirty` — e.g. `scope:` edited alongside the stamp.
5. `refuses a non-claim status move as dirty` — HEAD `status: active` → `resolved`.
6. `refuses when a non-backlog file is also dirty, restoring nothing` — stamp + an edit to the fixture repo README; expect both files still modified.
7. `recovers mixed dirt: a claim stamp plus a scorecard row` — both recovered, `moved:true`.
8. Pure unit cases for `isClaimStampOnlyEdit` (LF and CRLF true case; body-change false).

## Proof plan

No live dirty clone exists now (the 3809 file was hand-restored; 3809 is `resolved` on main). Replay the recorded shape:
- Before: in a scratch `git clone` of origin into the scratchpad, pick any `status: open` card, apply the exact 2026-09-29 diff (`status: open`→`active`, add `dateStarted: "2026-09-29"`), and run `node -e` calling `findUnsafeLocalState` + the current `ensureSafeToMove` path via `rebuildClone({ root, runSmoke: async()=>({ok:true}) ... })` or `dryRunRebuild`; capture `reason: 'dirty'` on current main.
- After: same replay on the build branch; capture the `backlog-claim-stamp-restored` alert with the diff and a clean `git status`.
- Never run this against a live daemon clone. Delete the scratch clone after.

## Done when

1. **Executable** — `npx vitest run daemon-rebuild.test -t "stray backlog claim stamp"` (`we:scripts/lib/__tests__/daemon-rebuild.test.mjs`) fails before the change and passes after; the whole file stays green.
2. A claim-stamp-only backlog edit is restored with a `backlog-claim-stamp-restored` alert carrying the diff, and the rebuild moves on.
3. Any body change, other-key change, non-claim status move, or extra non-backlog dirt still refuses as `dirty` and restores nothing.
4. The replay in the Proof plan shows `dirty` before and a clean restore after.

## Follow-ups

- A claim that also RENAMES the card file (porcelain `R`/`D` + untracked) is out of scope; it still refuses. File only if seen live.
- The root cause (a worker writing into its run checkout) is its own card, filed with this one in `a684ab19d` (4560).
